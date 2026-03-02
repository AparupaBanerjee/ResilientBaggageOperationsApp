import uuid
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException
from couchbase.exceptions import DocumentNotFoundException

import db
from models import Bag, BagCreate, BagStatusUpdate

router = APIRouter(prefix="/bags", tags=["bags"])
logger = logging.getLogger(__name__)


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


@router.get("", response_model=List[dict])
def list_bags():
    """List all bags from Edge Couchbase."""
    if db.edge_cluster is None:
        raise HTTPException(503, "Edge Couchbase not connected")
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
            bags.append(row)
        return bags
    except Exception as exc:
        logger.error("list_bags error: %s", exc)
        raise HTTPException(500, f"Query error: {exc}")


@router.post("", response_model=dict, status_code=201)
def create_bag(bag: BagCreate):
    """Create a new bag on Edge Couchbase. Works regardless of online state."""
    if db.edge_collection is None:
        raise HTTPException(503, "Edge Couchbase not connected")

    bag_id = f"BAG-{uuid.uuid4().hex[:8].upper()}"
    belt = _get_belt_for_flight(bag.flight_id)
    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "type": "bag",
        "bag_id": bag_id,
        "flight_id": bag.flight_id,
        "passenger_name": bag.passenger_name,
        "status": bag.status.value,
        "destination_belt": belt,
        "weight_kg": bag.weight_kg,
        "last_updated": now,
        "sync_pending": not db.is_online,
    }

    try:
        db.edge_collection.insert(bag_id, doc)
    except Exception as exc:
        logger.error("create_bag insert error: %s", exc)
        raise HTTPException(500, f"Insert error: {exc}")

    doc["source"] = "edge_only" if not db.is_online else "synced"
    return doc


@router.put("/{bag_id}/status", response_model=dict)
def update_bag_status(bag_id: str, update: BagStatusUpdate):
    """Update bag status. Works regardless of online state."""
    if db.edge_collection is None:
        raise HTTPException(503, "Edge Couchbase not connected")
    try:
        result = db.edge_collection.get(bag_id)
        doc = result.content_as[dict]
        doc["status"] = update.status.value
        doc["last_updated"] = datetime.now(timezone.utc).isoformat()
        db.edge_collection.replace(bag_id, doc)
        doc["source"] = "edge_only" if doc.get("sync_pending") else "synced"
        return doc
    except DocumentNotFoundException:
        raise HTTPException(404, f"Bag {bag_id} not found")
    except Exception as exc:
        raise HTTPException(500, f"Update error: {exc}")


@router.delete("/{bag_id}", status_code=204)
def delete_bag(bag_id: str):
    """Delete a bag from Edge Couchbase."""
    if db.edge_collection is None:
        raise HTTPException(503, "Edge Couchbase not connected")
    try:
        db.edge_collection.remove(bag_id)
    except DocumentNotFoundException:
        raise HTTPException(404, f"Bag {bag_id} not found")
    except Exception as exc:
        raise HTTPException(500, f"Delete error: {exc}")
