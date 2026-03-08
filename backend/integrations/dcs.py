"""
Mock DCS (Departure Control System) adapter.
Simulates an airline DCS providing passenger check-in manifest data per flight.
"""
import random
from datetime import datetime, timezone

# Simulated DCS passenger manifests keyed by flight_id
_MANIFEST_TEMPLATES = {
    "SK101": {"destination": "ARN", "capacity": 180, "gate": "A12"},
    "SK202": {"destination": "CPH", "capacity": 140, "gate": "B3"},
    "SK303": {"destination": "OSL", "capacity": 220, "gate": "C7"},
    "SK404": {"destination": "HEL", "capacity": 160, "gate": "A5"},
    "SK505": {"destination": "AMS", "capacity": 250, "gate": "D2"},
}

# Stable random seed per session so counts don't change wildly
_rng = random.Random(42)

def get_all_dcs_status() -> list[dict]:
    """Return check-in status for all known flights."""
    results = []
    for flight_id, info in _MANIFEST_TEMPLATES.items():
        checked_in = _rng.randint(int(info["capacity"] * 0.70), int(info["capacity"] * 0.98))
        bags_checked = int(checked_in * _rng.uniform(0.88, 1.05))  # some pax no bags, some 2 bags
        bags_checked = min(bags_checked, checked_in + 20)
        results.append({
            "flight_id": flight_id,
            "destination": info["destination"],
            "gate": info["gate"],
            "capacity": info["capacity"],
            "checked_in": checked_in,
            "bags_checked": bags_checked,
            "load_factor": round(checked_in / info["capacity"] * 100, 1),
            "source": "DCS",
            "as_of": datetime.now(timezone.utc).isoformat(),
        })
    return results

def get_dcs_status(flight_id: str) -> dict | None:
    """Return DCS check-in status for a single flight."""
    all_status = get_all_dcs_status()
    return next((f for f in all_status if f["flight_id"] == flight_id), None)
