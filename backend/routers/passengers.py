import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from couchbase.exceptions import DocumentNotFoundException

import db
from audit import write_audit

router = APIRouter(prefix="/passengers", tags=["passengers"])
logger = logging.getLogger(__name__)


class PassengerCreate(BaseModel):
    passenger_name: str
    flight_id: str


def _operator(request: Request) -> str:
    return request.headers.get("x-operator-id", "anonymous")


@router.get("", response_model=List[dict])
def list_passengers(flight_id: Optional[str] = None):
    """List passengers, optionally filtered by flight_id."""
    if db.edge_cluster is None:
        raise HTTPException(503, "Edge Couchbase not connected")
    try:
        if flight_id:
            fid_esc = flight_id.replace("'", "\\'")
            result = db.edge_cluster.query(
                f"SELECT META().id as _id, p.* FROM `{db.BUCKET_NAME}` p "
                f"WHERE p.`type` = 'passenger' AND p.flight_id = '{fid_esc}' "
                f"ORDER BY p.passenger_name ASC"
            )
        else:
            result = db.edge_cluster.query(
                f"SELECT META().id as _id, p.* FROM `{db.BUCKET_NAME}` p "
                f"WHERE p.`type` = 'passenger' "
                f"ORDER BY p.flight_id ASC, p.passenger_name ASC"
            )
        return list(result)
    except Exception as exc:
        logger.error("list_passengers error: %s", exc)
        raise HTTPException(500, f"Query error: {exc}")


@router.post("", response_model=dict, status_code=201)
def create_passenger(passenger: PassengerCreate, request: Request):
    """Register a passenger for a flight at check-in."""
    if db.edge_collection is None:
        raise HTTPException(503, "Edge Couchbase not connected")

    passenger_id = f"PAX-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    op = _operator(request)

    doc = {
        "type":            "passenger",
        "passenger_id":    passenger_id,
        "passenger_name":  passenger.passenger_name,
        "flight_id":       passenger.flight_id,
        "boarding_status": "checked_in",
        "checked_in_at":   now,
        "boarded_at":      None,
        "last_updated":    now,
    }
    try:
        db.edge_collection.insert(passenger_id, doc)
    except Exception as exc:
        raise HTTPException(500, f"Insert error: {exc}")

    write_audit(op, "passenger_checkin", passenger_id,
                detail=f"{passenger.passenger_name} / {passenger.flight_id}")
    return doc


@router.put("/{passenger_id}/board", response_model=dict)
def mark_boarded(passenger_id: str, request: Request):
    """Mark a passenger as boarded. Irreversible for demo purposes."""
    if db.edge_collection is None:
        raise HTTPException(503, "Edge Couchbase not connected")

    op = _operator(request)
    now = datetime.now(timezone.utc).isoformat()
    try:
        res = db.edge_collection.get(passenger_id)
        doc = res.content_as[dict]
    except DocumentNotFoundException:
        raise HTTPException(404, f"Passenger {passenger_id} not found")

    if doc.get("boarding_status") == "no_show":
        raise HTTPException(409, "Cannot board a passenger already marked no-show")

    doc["boarding_status"] = "boarded"
    doc["boarded_at"]      = now
    doc["last_updated"]    = now
    db.edge_collection.replace(passenger_id, doc)

    write_audit(op, "passenger_boarded", passenger_id,
                detail=f"{doc.get('passenger_name')} / {doc.get('flight_id')}")
    return doc


@router.post("/{passenger_id}/no-show", response_model=dict)
def mark_no_show(passenger_id: str, request: Request):
    """
    Mark passenger as no-show — IATA security rule.
    All their active bags (not yet delivered/offloaded) are immediately put on hold.
    Operator must physically retrieve and offload the bags.
    """
    if db.edge_collection is None or db.edge_cluster is None:
        raise HTTPException(503, "Edge Couchbase not connected")

    op = _operator(request)
    now = datetime.now(timezone.utc).isoformat()

    try:
        res = db.edge_collection.get(passenger_id)
        doc = res.content_as[dict]
    except DocumentNotFoundException:
        raise HTTPException(404, f"Passenger {passenger_id} not found")

    if doc.get("boarding_status") == "boarded":
        raise HTTPException(409, "Passenger has already boarded — cannot mark as no-show")

    doc["boarding_status"] = "no_show"
    doc["last_updated"]    = now
    db.edge_collection.replace(passenger_id, doc)

    pname     = doc.get("passenger_name", "")
    flight_id = doc.get("flight_id", "")
    pname_esc = pname.replace("'", "\\'")
    fid_esc   = flight_id.replace("'", "\\'")

    # Locate and hold all active bags for this passenger+flight
    bags_on_hold = 0
    try:
        result = db.edge_cluster.query(
            f"SELECT META().id AS _doc_id, b.* FROM `{db.BUCKET_NAME}` b "
            f"WHERE b.`type` = 'bag' "
            f"  AND b.passenger_name = '{pname_esc}' "
            f"  AND b.flight_id = '{fid_esc}' "
            f"  AND b.status NOT IN ['delivered', 'offloaded', 'on_hold']"
        )
        for bag in list(result):
            doc_id = bag.get("_doc_id")
            if not doc_id:
                continue
            try:
                res2   = db.edge_collection.get(doc_id)
                bagdoc = res2.content_as[dict]
                bagdoc["status"]           = "on_hold"
                bagdoc["destination_belt"] = None
                bagdoc["hold_since"]       = now
                bagdoc["hold_reason"]      = "passenger_no_show"
                bagdoc["last_updated"]     = now
                if "checkpoint_log" not in bagdoc or not isinstance(bagdoc["checkpoint_log"], list):
                    bagdoc["checkpoint_log"] = []
                bagdoc["checkpoint_log"].append({"status": "on_hold", "ts": now, "operator": "system"})
                db.edge_collection.replace(doc_id, bagdoc)
                bags_on_hold += 1
            except Exception:
                pass
    except Exception as exc:
        logger.warning("no-show bag hold failed: %s", exc)

    write_audit(op, "passenger_no_show", passenger_id,
                detail=f"{pname} / {flight_id} — {bags_on_hold} bag(s) put on hold. OFFLOAD REQUIRED.")

    return {
        "passenger_id":    passenger_id,
        "passenger_name":  pname,
        "flight_id":       flight_id,
        "boarding_status": "no_show",
        "bags_put_on_hold": bags_on_hold,
        "timestamp":       now,
    }
