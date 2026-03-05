import uuid
import logging
import random
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

import db
from audit import write_audit
from integrations.iot import iot_sim

router = APIRouter(prefix="/simulate", tags=["simulation"])
logger = logging.getLogger(__name__)

# ── Outage tracking ───────────────────────────────────────────────────────────
_outage_started_at: Optional[datetime] = None
_outage_bags_before: int = 0  # edge doc count when outage began


def _operator(request: Request) -> str:
    return request.headers.get("x-operator-id", "anonymous")

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
def simulate_offline(request: Request):
    """Pause XDCR replication — Edge and Main will diverge."""
    global _outage_started_at, _outage_bags_before
    if not db.is_online:
        raise HTTPException(400, "Already offline")
    _outage_started_at = datetime.now(timezone.utc)
    _outage_bags_before = db.get_edge_doc_count()
    ok = db.pause_sync()
    write_audit(_operator(request), "sim_outage",
                detail="XDCR replication PAUSED — edge will diverge from main")
    return {
        "success": ok,
        "online": db.is_online,
        "message": "Replication PAUSED. New bags will write to Edge only.",
    }


@router.post("/online", response_model=dict)
def simulate_online(request: Request):
    """Resume XDCR replication — Main will sync to match Edge."""
    global _outage_started_at, _outage_bags_before
    if db.is_online:
        raise HTTPException(400, "Already online")
    ended_at = datetime.now(timezone.utc)
    ok = db.resume_sync()
    write_audit(_operator(request), "sim_restore",
                detail="XDCR replication RESUMED — edge syncing to main")

    # Persist outage event for analytics
    if _outage_started_at is not None:
        duration_sec = int((ended_at - _outage_started_at).total_seconds())
        bags_after   = db.get_edge_doc_count()
        bags_offline = max(0, bags_after - _outage_bags_before)
        event_doc = {
            "type":         "outage_event",
            "started_at":   _outage_started_at.isoformat(),
            "ended_at":     ended_at.isoformat(),
            "duration_sec": duration_sec,
            "bags_offline": bags_offline,
            "operator":     _operator(request),
        }
        try:
            db.edge_collection.insert(f"outage_event::{uuid.uuid4().hex}", event_doc)
        except Exception as exc:
            logger.warning("Could not save outage_event: %s", exc)
        _outage_started_at = None
        _outage_bags_before = 0

    return {
        "success": ok,
        "online": db.is_online,
        "message": "Replication RESUMED. Edge bags syncing to Main.",
    }


@router.post("/load", response_model=dict)
def generate_load(count: int = 10, request: Request = None):
    """Rapidly insert N bags to drive throughput metrics."""
    if db.edge_collection is None:
        raise HTTPException(503, "Edge Couchbase not connected")

    count = max(1, min(count, 50))
    inserted = 0

    # Fetch all active (non-cancelled) flights from DB so new flights get traffic too
    active_flights = SEED_FLIGHTS  # fallback
    try:
        result = db.edge_cluster.query(
            f"SELECT f.flight_id, f.belt FROM `{db.BUCKET_NAME}` f "
            f"WHERE f.`type` = 'flight' AND f.status != 'cancelled'"
        )
        rows = [r for r in result if r.get("flight_id") and r.get("belt")]
        if rows:
            active_flights = rows
    except Exception:
        pass

    for _ in range(count):
        passenger = random.choice(SWEDISH_PASSENGERS)
        flight = random.choice(active_flights)
        bag_id = f"BAG-{uuid.uuid4().hex[:8].upper()}"
        doc = {
            "type": "bag",
            "bag_id": bag_id,
            "flight_id": flight["flight_id"],
            "passenger_name": passenger,
            "status": "check_in",
            "destination_belt": flight["belt"],
            "weight_kg": round(random.uniform(7.0, 28.0), 1),
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "sync_pending": not db.is_online,
        }
        try:
            db.edge_collection.insert(bag_id, doc)
            db.record_bag_write()
            inserted += 1
        except Exception:
            pass

    if inserted > 0 and request:
        write_audit(_operator(request), "sim_load",
                    detail=f"Generated {inserted} synthetic bags for load testing")
    return {"inserted": inserted, "message": f"Generated {inserted} bags."}


@router.post("/misroute", response_model=dict)
def simulate_misroute(request: Request):
    """Deliberately assign one random bag to the wrong belt — triggers misrouting detection."""
    if db.edge_cluster is None:
        raise HTTPException(503, "Edge Couchbase not connected")

    all_belts = ["A1", "A2", "B1", "B2", "C1"]

    try:
        result = db.edge_cluster.query(
            f"SELECT META().id as bag_id, b.destination_belt, b.flight_id "
            f"FROM `{db.BUCKET_NAME}` b "
            f"WHERE b.`type` = 'bag' AND b.status NOT IN ['delivered'] "
            f"ORDER BY RAND() LIMIT 1"
        )
        rows = list(result)
    except Exception as exc:
        raise HTTPException(500, f"Query error: {exc}")

    if not rows:
        raise HTTPException(404, "No active bags to misroute")

    row         = rows[0]
    bag_id      = row["bag_id"]
    correct_belt = row.get("destination_belt", "A1")
    wrong_belt  = random.choice([b for b in all_belts if b != correct_belt])

    try:
        res = db.edge_collection.get(bag_id)
        doc = res.content_as[dict]
        doc["destination_belt"] = wrong_belt
        doc["last_updated"]     = datetime.now(timezone.utc).isoformat()
        db.edge_collection.replace(bag_id, doc)
    except Exception as exc:
        raise HTTPException(500, f"Update error: {exc}")

    write_audit(_operator(request), "sim_misroute", bag_id,
                detail=f"Belt changed {correct_belt} → {wrong_belt} (flight {row.get('flight_id')})")
    return {
        "bag_id":       bag_id,
        "flight_id":    row.get("flight_id"),
        "wrong_belt":   wrong_belt,
        "correct_belt": correct_belt,
        "message":      f"Bag {bag_id} rerouted to belt {wrong_belt} (correct: {correct_belt}).",
    }


@router.post("/seed", response_model=dict)
def seed_data(request: Request = None):
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

    if request:
        write_audit(_operator(request), "sim_seed",
                    detail=f"Seeded {len(SEED_FLIGHTS)} flights + {bags_created} bags on Edge")
    return {
        "flights_seeded": len(SEED_FLIGHTS),
        "bags_seeded": bags_created,
        "message": f"Seeded {len(SEED_FLIGHTS)} flights and {bags_created} bags on Edge.",
    }


# ── Chaos scenarios ───────────────────────────────────────────────────────────

@router.post("/flaky", response_model=dict)
def toggle_flaky(request: Request):
    """Toggle flaky write mode — ~30% of bag writes will randomly fail."""
    db.flaky_mode = not db.flaky_mode
    state = "ENABLED" if db.flaky_mode else "DISABLED"
    write_audit(_operator(request), "sim_chaos",
                detail=f"Flaky write mode {state}")
    return {"flaky_mode": db.flaky_mode, "message": f"Flaky mode {state}"}


@router.post("/blackout", response_model=dict)
def sensor_blackout(duration: int = 30, request: Request = None):
    """Cut all RFID sensor feeds for N seconds — simulates scanner hardware failure."""
    duration = max(5, min(duration, 120))
    iot_sim.start_blackout(duration)
    if request:
        write_audit(_operator(request), "sim_chaos",
                    detail=f"Sensor blackout for {duration}s — RFID feeds suppressed")
    return {"blackout_seconds": duration, "message": f"RFID sensors offline for {duration}s"}


@router.post("/corrupt", response_model=dict)
def inject_corrupt(request: Request):
    """Inject a bag document with corrupted/missing fields — tests validation and alerting."""
    if db.edge_collection is None:
        raise HTTPException(503, "Edge Couchbase not connected")
    corrupt_id = f"BAG-CORRUPT-{uuid.uuid4().hex[:6].upper()}"
    doc = {
        "type": "bag",
        "bag_id": corrupt_id,
        "flight_id": None,          # missing — corrupt
        "passenger_name": "???",
        "status": "UNKNOWN",        # invalid enum value
        "destination_belt": "ZZ",   # non-existent belt
        "weight_kg": -99.9,         # invalid weight
        "last_updated": "INVALID_TS",
        "sync_pending": not db.is_online,
        "_corrupt": True,
    }
    db.edge_collection.insert(corrupt_id, doc)
    write_audit(_operator(request), "sim_chaos", corrupt_id,
                detail="Corrupt bag document injected — flight_id=null, status=UNKNOWN, weight=-99.9")
    return {"bag_id": corrupt_id, "message": "Corrupt document inserted. Check BaggageTable for anomalies."}


@router.post("/storm", response_model=dict)
def write_storm(request: Request):
    """Burst-insert 50 bags as fast as possible — stress-tests write throughput."""
    return generate_load(count=50, request=request)
