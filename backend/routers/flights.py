import logging
from typing import List

from fastapi import APIRouter, HTTPException
from couchbase.exceptions import DocumentExistsException

import db
from models import FlightCreate

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
