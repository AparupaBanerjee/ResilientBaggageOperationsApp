from datetime import datetime, timezone

from fastapi import APIRouter

import db

router = APIRouter(prefix="/predict", tags=["prediction"])


@router.get("/outage-impact")
def outage_impact(duration_min: int = 5):
    """
    Forecast how many bags accumulate unsynced during an outage of `duration_min` minutes.
    Also surfaces flights at risk of having bags written offline during their boarding window.
    """
    duration_min = max(1, min(duration_min, 60))
    throughput = db.get_throughput_per_min()
    estimated_unsynced = round(throughput * duration_min)

    # Flights boarding or scheduled that depart within the outage window + 30-min buffer
    high_risk_flights = []
    if db.edge_cluster is not None:
        try:
            result = db.edge_cluster.query(
                f"SELECT flight_id, departure_time, gate, status "
                f"FROM `{db.BUCKET_NAME}` "
                f"WHERE `type` = 'flight' AND status IN ['boarding', 'scheduled']"
            )
            now = datetime.now(timezone.utc)
            for row in result:
                try:
                    dep = datetime.fromisoformat(row["departure_time"])
                    if dep.tzinfo is None:
                        dep = dep.replace(tzinfo=timezone.utc)
                    minutes_until = (dep - now).total_seconds() / 60
                    if minutes_until <= duration_min + 30:
                        high_risk_flights.append({
                            "flight_id": row["flight_id"],
                            "gate": row.get("gate", "—"),
                            "status": row.get("status"),
                            "minutes_until_departure": round(minutes_until),
                        })
                except Exception:
                    pass
        except Exception:
            pass

    high_risk_flights.sort(key=lambda f: f["minutes_until_departure"])

    if estimated_unsynced > 30 or len(high_risk_flights) > 1:
        severity = "HIGH"
    elif estimated_unsynced > 5 or len(high_risk_flights) == 1:
        severity = "MEDIUM"
    else:
        severity = "LOW"

    return {
        "duration_min": duration_min,
        "throughput_per_min": throughput,
        "estimated_unsynced_bags": estimated_unsynced,
        "high_risk_flights": high_risk_flights[:3],
        "severity": severity,
    }
