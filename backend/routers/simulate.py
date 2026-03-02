import uuid
import logging
import random
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException

import db

router = APIRouter(prefix="/simulate", tags=["simulation"])
logger = logging.getLogger(__name__)

# ─── Seed data ────────────────────────────────────────────────────────────────
SEED_FLIGHTS = [
    {
        "flight_id": "SK101",
        "destination": "London Heathrow",
        "departure_time": "2026-03-02T08:30:00+01:00",
        "gate": "A12",
        "belt": "A1",
        "status": "boarding",
    },
    {
        "flight_id": "SK202",
        "destination": "Paris CDG",
        "departure_time": "2026-03-02T09:15:00+01:00",
        "gate": "B3",
        "belt": "A2",
        "status": "scheduled",
    },
    {
        "flight_id": "SK303",
        "destination": "Berlin Brandenburg",
        "departure_time": "2026-03-02T10:00:00+01:00",
        "gate": "C7",
        "belt": "B1",
        "status": "departed",
    },
    {
        "flight_id": "SK404",
        "destination": "Oslo Gardermoen",
        "departure_time": "2026-03-02T11:30:00+01:00",
        "gate": "A5",
        "belt": "B2",
        "status": "scheduled",
    },
    {
        "flight_id": "SK505",
        "destination": "Amsterdam Schiphol",
        "departure_time": "2026-03-02T12:45:00+01:00",
        "gate": "D2",
        "belt": "C1",
        "status": "boarding",
    },
]

SWEDISH_PASSENGERS = [
    "Erik Johansson",
    "Anna Lindqvist",
    "Lars Petersson",
    "Maria Eriksson",
    "Johan Nilsson",
    "Sara Karlsson",
    "Anders Olsson",
    "Emma Persson",
    "Magnus Svensson",
    "Lena Gustafsson",
    "Per Björk",
    "Karin Magnusson",
    "Stefan Larsson",
    "Helena Andersen",
    "Thomas Holm",
    "Ingrid Berglund",
    "Michael Sundqvist",
    "Catarina Wikström",
    "Robert Hedlund",
    "Astrid Lindgren",
]

BAG_STATUSES = ["check_in", "check_in", "in_transit", "in_transit", "loaded", "delivered"]


def _ts_offset(minutes: int) -> str:
    t = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    return t.isoformat()


@router.post("/offline", response_model=dict)
def simulate_offline():
    """Pause XDCR replication — Edge and Main will diverge."""
    if not db.is_online:
        raise HTTPException(400, "Already offline")
    ok = db.pause_sync()
    return {
        "success": ok,
        "online": db.is_online,
        "message": "Replication PAUSED. New bags will write to Edge only.",
    }


@router.post("/online", response_model=dict)
def simulate_online():
    """Resume XDCR replication — Main will sync to match Edge."""
    if db.is_online:
        raise HTTPException(400, "Already online")
    ok = db.resume_sync()
    return {
        "success": ok,
        "online": db.is_online,
        "message": "Replication RESUMED. Edge bags syncing to Main.",
    }


@router.post("/seed", response_model=dict)
def seed_data():
    """Seed 5 flights and 20 bags with realistic Swedish data."""
    if db.edge_collection is None:
        raise HTTPException(503, "Edge Couchbase not connected")

    # ── Flights ───────────────────────────────────────────────────────────────
    for f in SEED_FLIGHTS:
        doc_id = f"flight::{f['flight_id']}"
        db.edge_collection.upsert(doc_id, {"type": "flight", **f})

        # Upsert routing rule
        rule_id = f"routing_rule::{f['flight_id']}"
        db.edge_collection.upsert(rule_id, {
            "type": "routing_rule",
            "flight_id": f["flight_id"],
            "belt": f["belt"],
            "priority": 1,
            "active": True,
        })

    # ── Bags (4 per flight, 20 total) ─────────────────────────────────────────
    bags_created = 0
    for i, passenger in enumerate(SWEDISH_PASSENGERS):
        flight = SEED_FLIGHTS[i % len(SEED_FLIGHTS)]
        bag_id = f"BAG-{uuid.uuid4().hex[:8].upper()}"
        status = BAG_STATUSES[i % len(BAG_STATUSES)]
        weight = round(random.uniform(7.0, 28.0), 1)
        age_minutes = random.randint(5, 90)

        doc = {
            "type": "bag",
            "bag_id": bag_id,
            "flight_id": flight["flight_id"],
            "passenger_name": passenger,
            "status": status,
            "destination_belt": flight["belt"],
            "weight_kg": weight,
            "last_updated": _ts_offset(age_minutes),
            "sync_pending": False,
        }
        db.edge_collection.upsert(bag_id, doc)
        bags_created += 1

    return {
        "flights_seeded": len(SEED_FLIGHTS),
        "bags_seeded": bags_created,
        "message": f"Seeded {len(SEED_FLIGHTS)} flights and {bags_created} bags on Edge.",
    }
