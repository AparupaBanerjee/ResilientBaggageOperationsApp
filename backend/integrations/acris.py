"""
Mock ACRIS (Airport Community Recommended Information Services) adapter.
Provides standardised flight status data as per ACRIS AIDX message format.
"""
from datetime import datetime, timezone, timedelta
import random

_rng = random.Random(99)

# Simulated ACRIS flight movement messages
_FLIGHTS = {
    "SK101": {"dest": "ARN", "sched_dep": "+00:45", "terminal": "T2", "stand": "G14"},
    "SK202": {"dest": "CPH", "sched_dep": "+01:15", "terminal": "T1", "stand": "B7"},
    "SK303": {"dest": "OSL", "sched_dep": "+00:20", "terminal": "T2", "stand": "D3"},
    "SK404": {"dest": "HEL", "sched_dep": "+02:30", "terminal": "T1", "stand": "A11"},
    "SK505": {"dest": "AMS", "sched_dep": "+03:00", "terminal": "T3", "stand": "C2"},
}

_ACRIS_STATUSES = ["ON_SCHEDULE", "DELAYED", "BOARDING", "FINAL_CALL", "GATE_CLOSED"]
_STATUS_WEIGHTS = [0.55, 0.15, 0.20, 0.07, 0.03]

def get_all_acris_status() -> list[dict]:
    now = datetime.now(timezone.utc)
    results = []
    for flight_id, info in _FLIGHTS.items():
        h, m = map(int, info["sched_dep"].split(":"))
        sched = now + timedelta(hours=h, minutes=m)
        delay_min = _rng.choice([0, 0, 0, 10, 15, 25]) if _rng.random() < 0.2 else 0
        est = sched + timedelta(minutes=delay_min)
        status = _rng.choices(_ACRIS_STATUSES, weights=_STATUS_WEIGHTS)[0]
        if delay_min > 0 and status == "ON_SCHEDULE":
            status = "DELAYED"
        results.append({
            "flight_id": flight_id,
            "destination": info["dest"],
            "terminal": info["terminal"],
            "stand": info["stand"],
            "scheduled_departure": sched.isoformat(),
            "estimated_departure": est.isoformat(),
            "delay_min": delay_min,
            "acris_status": status,
            "source": "ACRIS",
            "as_of": now.isoformat(),
        })
    return results

def get_acris_status(flight_id: str) -> dict | None:
    return next((f for f in get_all_acris_status() if f["flight_id"] == flight_id), None)
