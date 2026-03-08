import uuid
import random
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, Request
from couchbase.exceptions import DocumentNotFoundException

import db
from models import Bag, BagCreate, BagStatusUpdate
from audit import write_audit

router = APIRouter(prefix="/bags", tags=["bags"])
logger = logging.getLogger(__name__)


def _operator(request: Request) -> str:
    return request.headers.get("x-operator-id", "anonymous")


def _get_belt_for_flight(flight_id: str) -> str:
    """Look up routing rule; fall back to a deterministic hash-based belt."""
    try:
        result = db.edge_cluster.query(
            f"SELECT belt FROM `{db.BUCKET_NAME}` "
            f"WHERE `type` = 'routing_rule' AND flight_id = $flight_id AND active = true",
            named_parameters={"$flight_id": flight_id},
        )
        for row in result:
            return row["belt"]
    except Exception as exc:
        logger.debug("Belt lookup failed for %s: %s", flight_id, exc)

    # Fallback: hash to one of 5 belts
    belts = ["A1", "A2", "B1", "B2", "C1"]
    return belts[sum(ord(c) for c in flight_id) % len(belts)]


def _get_routing_belt_map() -> dict:
    """Fetch all active routing rules as {flight_id: belt}."""
    belt_map = {}
    try:
        result = db.edge_cluster.query(
            f"SELECT flight_id, belt FROM `{db.BUCKET_NAME}` "
            f"WHERE `type` = 'routing_rule' AND active = true"
        )
        for row in result:
            belt_map[row["flight_id"]] = row["belt"]
    except Exception:
        pass
    return belt_map


@router.get("", response_model=List[dict])
def list_bags():
    """List all bags from Edge Couchbase, with misrouting detection."""
    if db.edge_cluster is None:
        raise HTTPException(503, "Edge Couchbase not connected")

    belt_map = _get_routing_belt_map()

    try:
        result = db.edge_cluster.query(
            f"SELECT META().id as bag_id, b.* "
            f"FROM `{db.BUCKET_NAME}` b "
            f"WHERE b.`type` = 'bag' "
            f"ORDER BY b.last_updated DESC"
        )
        bags = []
        for row in result:
            row["source"] = "edge_only" if row.get("sync_pending") else "synced"
            expected = belt_map.get(row.get("flight_id"))
            actual   = row.get("destination_belt")
            if expected and actual and actual != expected:
                row["misrouted"]    = True
                row["correct_belt"] = expected
            else:
                row["misrouted"] = False
            bags.append(row)
        return bags
    except Exception as exc:
        logger.error("list_bags error: %s", exc)
        raise HTTPException(500, f"Query error: {exc}")


@router.post("", response_model=dict, status_code=201)
def create_bag(bag: BagCreate, request: Request):
    """Create a new bag on Edge Couchbase. Works regardless of online state."""
    if db.edge_collection is None:
        raise HTTPException(503, "Edge Couchbase not connected")

    # Guard: reject bags for departed/cancelled flights
    if db.edge_cluster is not None:
        try:
            fid_esc = bag.flight_id.replace("'", "\\'")
            res = db.edge_cluster.query(
                f"SELECT f.status FROM `{db.BUCKET_NAME}` f "
                f"WHERE f.`type` = 'flight' AND f.flight_id = '{fid_esc}' LIMIT 1"
            )
            rows = list(res)
            if rows:
                flt_status = rows[0].get("status", "")
                if flt_status in ("departed", "cancelled"):
                    raise HTTPException(
                        409,
                        f"Cannot add bag — flight {bag.flight_id} is {flt_status}"
                    )
        except HTTPException:
            raise
        except Exception:
            pass  # permissive — if lookup fails, allow the write

    bag_id = f"BAG-{uuid.uuid4().hex[:8].upper()}"
    belt   = _get_belt_for_flight(bag.flight_id)
    now    = datetime.now(timezone.utc).isoformat()
    op     = _operator(request)

    doc = {
        "type":             "bag",
        "bag_id":           bag_id,
        "flight_id":        bag.flight_id,
        "passenger_name":   bag.passenger_name,
        "status":           bag.status.value,
        "destination_belt": belt,
        "weight_kg":        bag.weight_kg,
        "last_updated":     now,
        "sync_pending":     not db.is_online,
        "checkpoint_log":   [{"status": bag.status.value, "ts": now, "operator": op}],
    }

    # Flaky mode: randomly reject ~30% of writes to simulate unreliable connectivity
    if db.flaky_mode and random.random() < 0.30:
        write_audit(op, "bag_create", bag_id,
                    detail=f"FLAKY DROP — {bag.passenger_name} / {bag.flight_id}",
                    result="error")
        raise HTTPException(503, "Write failed (flaky mode active — 30% drop rate)")

    try:
        db.edge_collection.insert(bag_id, doc)
        db.record_bag_write()
    except Exception as exc:
        logger.error("create_bag insert error: %s", exc)
        write_audit(op, "bag_create", bag_id,
                    detail=f"{bag.passenger_name} / {bag.flight_id} / {bag.weight_kg}kg",
                    result="error")
        raise HTTPException(500, f"Insert error: {exc}")

    # Create matching passenger record
    try:
        pax_id = f"PAX-{uuid.uuid4().hex[:8].upper()}"
        db.edge_collection.insert(pax_id, {
            "type":            "passenger",
            "passenger_id":    pax_id,
            "passenger_name":  bag.passenger_name,
            "flight_id":       bag.flight_id,
            "boarding_status": "checked_in",
            "checked_in_at":   now,
            "boarded_at":      None,
            "last_updated":    now,
        })
    except Exception as exc:
        logger.warning("Passenger record creation failed for %s: %s", bag_id, exc)

    write_audit(op, "bag_create", bag_id,
                detail=f"{bag.passenger_name} / {bag.flight_id} / {bag.weight_kg}kg → belt {belt}")
    doc["source"] = "edge_only" if not db.is_online else "synced"
    return doc


@router.put("/{bag_id}/status", response_model=dict)
def update_bag_status(bag_id: str, update: BagStatusUpdate, request: Request):
    """Update bag status. Works regardless of online state."""
    if db.edge_collection is None:
        raise HTTPException(503, "Edge Couchbase not connected")
    op = _operator(request)
    try:
        result = db.edge_collection.get(bag_id)
        doc    = result.content_as[dict]
        old_status = doc.get("status", "unknown")
        now = datetime.now(timezone.utc).isoformat()
        doc["status"]       = update.status.value
        doc["last_updated"] = now
        # Append checkpoint entry
        if "checkpoint_log" not in doc or not isinstance(doc["checkpoint_log"], list):
            doc["checkpoint_log"] = []
        doc["checkpoint_log"].append({"status": update.status.value, "ts": now, "operator": op})
        # Track when a bag goes on hold (for escalation timer)
        if update.status.value == "on_hold" and old_status != "on_hold":
            doc["hold_since"] = now
        db.edge_collection.replace(bag_id, doc)
        write_audit(op, "bag_status_update", bag_id,
                    detail=f"{old_status} → {update.status.value}")
        doc["source"] = "edge_only" if doc.get("sync_pending") else "synced"
        return doc
    except DocumentNotFoundException:
        raise HTTPException(404, f"Bag {bag_id} not found")
    except Exception as exc:
        raise HTTPException(500, f"Update error: {exc}")


@router.delete("/{bag_id}", status_code=204)
def delete_bag(bag_id: str, request: Request):
    """Delete a bag from Edge Couchbase."""
    if db.edge_collection is None:
        raise HTTPException(503, "Edge Couchbase not connected")
    op = _operator(request)
    try:
        db.edge_collection.remove(bag_id)
        write_audit(op, "bag_delete", bag_id)
    except DocumentNotFoundException:
        raise HTTPException(404, f"Bag {bag_id} not found")
    except Exception as exc:
        raise HTTPException(500, f"Delete error: {exc}")
