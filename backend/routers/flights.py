import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, Request
from couchbase.exceptions import DocumentExistsException, DocumentNotFoundException

import db
from models import FlightCreate, FlightStatusUpdate
from audit import write_audit

router = APIRouter(prefix="/flights", tags=["flights"])
logger = logging.getLogger(__name__)


@router.get("", response_model=List[dict])
def list_flights():
    """List all flights from Edge Couchbase."""
    if db.edge_cluster is None:
        raise HTTPException(503, "Edge Couchbase not connected")
    try:
        result = db.edge_cluster.query(
            f"SELECT META().id as _id, f.* "
            f"FROM `{db.BUCKET_NAME}` f "
            f"WHERE f.`type` = 'flight' "
            f"ORDER BY f.departure_time ASC"
        )
        return list(result)
    except Exception as exc:
        logger.error("list_flights error: %s", exc)
        raise HTTPException(500, f"Query error: {exc}")


@router.post("", response_model=dict, status_code=201)
def create_flight(flight: FlightCreate):
    """Create or update a flight record on Edge Couchbase."""
    if db.edge_collection is None:
        raise HTTPException(503, "Edge Couchbase not connected")

    doc_id = f"flight::{flight.flight_id}"
    doc = {
        "type": "flight",
        **flight.model_dump(),
    }
    try:
        db.edge_collection.upsert(doc_id, doc)
    except Exception as exc:
        raise HTTPException(500, f"Upsert error: {exc}")

    return doc


@router.post("/{flight_id}/cancel", response_model=dict)
def cancel_flight(flight_id: str, request: Request):
    """
    Cancel a flight with smart bag distribution (BRS/DCS pattern):
      - check_in bags  → rerouted to alternate flight with same destination (if found)
                         else → offloaded to collection belt RCL
      - in_transit / loaded bags → on_hold (physical retrieval required)
      - delivered / already offloaded → untouched
    Works fully offline — Edge node handles this autonomously if cloud is down.
    """
    if db.edge_collection is None or db.edge_cluster is None:
        raise HTTPException(503, "Edge Couchbase not connected")

    op = request.headers.get("x-operator-id", "anonymous")
    now = datetime.now(timezone.utc).isoformat()

    # ── 1. Update the flight document ────────────────────────────────────────
    flight_doc_id = f"flight::{flight_id}"
    try:
        res = db.edge_collection.get(flight_doc_id)
        flight = res.content_as[dict]
    except DocumentNotFoundException:
        raise HTTPException(404, f"Flight {flight_id} not found")

    if flight.get("status") == "cancelled":
        raise HTTPException(409, f"Flight {flight_id} is already cancelled")

    prev_status  = flight.get("status", "unknown")
    destination  = flight.get("destination", "")
    flight["status"]       = "cancelled"
    flight["last_updated"] = now
    db.edge_collection.replace(flight_doc_id, flight)

    # ── 2. Find alternate active flight to same destination ───────────────────
    alternate_flight_id  = None
    alternate_belt       = None
    dest_escaped = destination.replace("'", "\\'")
    try:
        alt_result = db.edge_cluster.query(
            f"SELECT f.flight_id, f.belt "
            f"FROM `{db.BUCKET_NAME}` f "
            f"WHERE f.`type` = 'flight' "
            f"  AND f.destination = '{dest_escaped}' "
            f"  AND f.flight_id != '{flight_id}' "
            f"  AND f.status IN ['scheduled', 'boarding'] "
            f"ORDER BY f.departure_time ASC "
            f"LIMIT 1"
        )
        alts = list(alt_result)
        if alts:
            alternate_flight_id = alts[0].get("flight_id")
            alternate_belt      = alts[0].get("belt")
    except Exception as exc:
        logger.warning("cancel_flight: alternate flight lookup failed: %s", exc)

    # ── 3. Fetch all bags for this flight ────────────────────────────────────
    try:
        result = db.edge_cluster.query(
            f"SELECT META().id AS _doc_id, b.* "
            f"FROM `{db.BUCKET_NAME}` b "
            f"WHERE b.`type` = 'bag' AND b.flight_id = '{flight_id}'"
        )
        bags = list(result)
    except Exception as exc:
        logger.error("cancel_flight bag query error: %s", exc)
        bags = []

    # ── 4. Smart distribution ─────────────────────────────────────────────────
    rerouted_count  = 0
    on_hold_count   = 0
    offloaded_count = 0

    for bag in bags:
        doc_id = bag.get("_doc_id")
        if not doc_id:
            continue
        bag_status = bag.get("status", "")

        # Skip bags that are already resolved
        if bag_status in ("delivered", "offloaded"):
            continue

        try:
            res    = db.edge_collection.get(doc_id)
            bagdoc = res.content_as[dict]

            if bag_status == "check_in" and alternate_flight_id:
                # Reroute: redirect to alternate flight + belt
                bagdoc["flight_id"]        = alternate_flight_id
                bagdoc["destination_belt"] = alternate_belt
                bagdoc["status"]           = "rerouted"
                bagdoc["last_updated"]     = now
                db.edge_collection.replace(doc_id, bagdoc)
                rerouted_count += 1

            elif bag_status in ("in_transit", "loaded"):
                # Physical retrieval required — put on hold, clear belt
                bagdoc["status"]           = "on_hold"
                bagdoc["destination_belt"] = None
                bagdoc["last_updated"]     = now
                bagdoc["hold_since"]       = now
                bagdoc["hold_reason"]      = "flight_cancelled"
                if "checkpoint_log" not in bagdoc or not isinstance(bagdoc["checkpoint_log"], list):
                    bagdoc["checkpoint_log"] = []
                bagdoc["checkpoint_log"].append({"status": "on_hold", "ts": now, "operator": "system"})
                db.edge_collection.replace(doc_id, bagdoc)
                on_hold_count += 1

            else:
                # check_in with no alternate, or any unrecognised status → collection terminal
                # Detach from cancelled flight so it no longer appears under that flight tab
                bagdoc["status"]           = "offloaded"
                bagdoc["destination_belt"] = "RCL"   # Reclaim / collection belt
                bagdoc["flight_id"]        = None
                bagdoc["last_updated"]     = now
                db.edge_collection.replace(doc_id, bagdoc)
                offloaded_count += 1

        except Exception as exc:
            logger.warning("cancel_flight: failed to process %s: %s", doc_id, exc)

    # ── 5. Write audit entry ──────────────────────────────────────────────────
    detail = (
        f"{flight_id} ({prev_status} → cancelled) · "
        f"rerouted={rerouted_count} (→{alternate_flight_id or 'none'}) "
        f"on_hold={on_hold_count} offloaded={offloaded_count}"
    )
    write_audit(op, "flight_cancel", flight_doc_id, detail=detail)

    return {
        "flight_id":        flight_id,
        "status":           "cancelled",
        "alternate_flight": alternate_flight_id,
        "rerouted_bags":    rerouted_count,
        "on_hold_bags":     on_hold_count,
        "offloaded_bags":   offloaded_count,
        "timestamp":        now,
    }


@router.put("/{flight_id}/status", response_model=dict)
def update_flight_status(flight_id: str, update: FlightStatusUpdate, request: Request):
    """
    Update a flight's operational status (boarding, delayed, departed, scheduled).
    Cannot be used to cancel — use POST /{flight_id}/cancel for that.
    When delayed, tags all check_in bags with hold_reason=flight_delayed.
    """
    if db.edge_collection is None or db.edge_cluster is None:
        raise HTTPException(503, "Edge Couchbase not connected")

    if update.status.value == "cancelled":
        raise HTTPException(400, "Use POST /flights/{flight_id}/cancel to cancel a flight")

    op = request.headers.get("x-operator-id", "anonymous")
    now = datetime.now(timezone.utc).isoformat()

    flight_doc_id = f"flight::{flight_id}"
    try:
        res = db.edge_collection.get(flight_doc_id)
        flight = res.content_as[dict]
    except DocumentNotFoundException:
        raise HTTPException(404, f"Flight {flight_id} not found")

    if flight.get("status") == "cancelled":
        raise HTTPException(409, f"Flight {flight_id} is cancelled — cannot update status")

    prev_status = flight.get("status", "unknown")
    flight["status"]       = update.status.value
    flight["last_updated"] = now

    try:
        db.edge_collection.replace(flight_doc_id, flight)
    except Exception as exc:
        raise HTTPException(500, f"Update error: {exc}")

    write_audit(op, "flight_status_update", flight_doc_id,
                detail=f"{prev_status} → {update.status.value}")

    # When a flight is delayed, tag its check_in bags so operators know
    delayed_bags = 0
    if update.status.value == "delayed" and prev_status != "delayed":
        try:
            result = db.edge_cluster.query(
                f"SELECT META().id AS _doc_id, b.* "
                f"FROM `{db.BUCKET_NAME}` b "
                f"WHERE b.`type` = 'bag' AND b.flight_id = '{flight_id}' AND b.status = 'check_in'"
            )
            for bag in list(result):
                doc_id = bag.get("_doc_id")
                if not doc_id:
                    continue
                try:
                    res2    = db.edge_collection.get(doc_id)
                    bagdoc  = res2.content_as[dict]
                    bagdoc["hold_reason"]  = "flight_delayed"
                    bagdoc["last_updated"] = now
                    db.edge_collection.replace(doc_id, bagdoc)
                    delayed_bags += 1
                except Exception:
                    pass
        except Exception as exc:
            logger.warning("update_flight_status: delayed bag tagging failed: %s", exc)

    return {
        "flight_id":    flight_id,
        "prev_status":  prev_status,
        "status":       update.status.value,
        "delayed_bags": delayed_bags,
        "timestamp":    now,
    }
