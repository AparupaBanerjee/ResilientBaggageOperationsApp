"""
ROI Analytics endpoints.
Derives KPIs, SLA status, outage history, and cost-savings estimations from
live Couchbase data and the audit log.
"""
import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter

import db

router = APIRouter(prefix="/analytics", tags=["analytics"])
logger = logging.getLogger(__name__)

# ── Cost model constants (EUR) ────────────────────────────────────────────────
COST_MISROUTE_EUR      = 50.0   # avg IATA cost per mishandled bag
COST_OFFLINE_BAG_EUR   = 2.0    # manual processing cost per bag when system is down
COST_DOWNTIME_EUR_MIN  = 500.0 / 60  # €500/hr → per minute of avoided downtime

# SLA targets
SLA_UPTIME_TARGET_PCT  = 99.5
SLA_THROUGHPUT_TARGET  = 20    # bags/min
SLA_MISROUTE_TARGET    = 0.5   # max % of bags misrouted


# ── Helpers ───────────────────────────────────────────────────────────────────

def _query_one(sql: str, default=0):
    if db.edge_cluster is None:
        return default
    try:
        result = db.edge_cluster.query(sql)
        rows = list(result)
        return rows[0] if rows else default
    except Exception as exc:
        logger.debug("analytics query error: %s", exc)
        return default


def _query_all(sql: str) -> list:
    if db.edge_cluster is None:
        return []
    try:
        return list(db.edge_cluster.query(sql))
    except Exception as exc:
        logger.debug("analytics query error: %s", exc)
        return []


# ── /analytics/summary ────────────────────────────────────────────────────────

@router.get("/summary")
def get_summary():
    bucket = db.BUCKET_NAME

    total_bags = _query_one(
        f"SELECT RAW COUNT(*) FROM `{bucket}` WHERE `type` = 'bag'"
    )
    delivered_bags = _query_one(
        f"SELECT RAW COUNT(*) FROM `{bucket}` WHERE `type` = 'bag' AND status = 'delivered'"
    )
    misroute_incidents = _query_one(
        f"SELECT RAW COUNT(*) FROM `{bucket}` WHERE `type` = 'audit_log' AND action = 'sim_misroute'"
    )
    outage_events = _query_all(
        f"SELECT duration_sec, bags_offline FROM `{bucket}` "
        f"WHERE `type` = 'outage_event'"
    )
    total_outage_sec = sum(e.get("duration_sec", 0) for e in outage_events)
    total_bags_offline = sum(e.get("bags_offline", 0) for e in outage_events)

    # Session uptime: time since first audit entry
    first_audit = _query_one(
        f"SELECT RAW MIN(ts) FROM `{bucket}` WHERE `type` = 'audit_log'",
        default=None
    )
    session_sec = 1
    if first_audit:
        try:
            start = datetime.fromisoformat(first_audit)
            session_sec = max(1, int((datetime.now(timezone.utc) - start).total_seconds()))
        except Exception:
            pass

    uptime_pct = round(max(0.0, (1 - total_outage_sec / session_sec) * 100), 2)

    misroute_rate = round(misroute_incidents / max(1, total_bags) * 100, 2)

    return {
        "total_bags":         total_bags,
        "delivered_bags":     delivered_bags,
        "throughput_per_min": db.get_throughput_per_min(),
        "misroute_incidents": misroute_incidents,
        "misroute_rate_pct":  misroute_rate,
        "outage_count":       len(outage_events),
        "total_outage_sec":   total_outage_sec,
        "total_bags_offline": total_bags_offline,
        "session_sec":        session_sec,
        "uptime_pct":         uptime_pct,
        "pending_sync":       db.get_pending_sync_count(),
        "sla": {
            "uptime_target":     SLA_UPTIME_TARGET_PCT,
            "uptime_actual":     uptime_pct,
            "uptime_met":        uptime_pct >= SLA_UPTIME_TARGET_PCT,
            "throughput_target": SLA_THROUGHPUT_TARGET,
            "throughput_actual": db.get_throughput_per_min(),
            "throughput_met":    db.get_throughput_per_min() >= SLA_THROUGHPUT_TARGET,
            "misroute_target":   SLA_MISROUTE_TARGET,
            "misroute_actual":   misroute_rate,
            "misroute_met":      misroute_rate <= SLA_MISROUTE_TARGET,
        },
    }


# ── /analytics/outages ────────────────────────────────────────────────────────

@router.get("/outages")
def get_outages():
    rows = _query_all(
        f"SELECT started_at, ended_at, duration_sec, bags_offline, operator "
        f"FROM `{db.BUCKET_NAME}` "
        f"WHERE `type` = 'outage_event' "
        f"ORDER BY started_at DESC LIMIT 20"
    )
    for r in rows:
        d = r.get("duration_sec", 0)
        r["duration_label"] = f"{d // 60}m {d % 60}s" if d >= 60 else f"{d}s"
    return rows


# ── /analytics/roi ────────────────────────────────────────────────────────────

@router.get("/roi")
def get_roi():
    bucket = db.BUCKET_NAME

    misroute_incidents = _query_one(
        f"SELECT RAW COUNT(*) FROM `{bucket}` WHERE `type` = 'audit_log' AND action = 'sim_misroute'"
    )
    outage_events = _query_all(
        f"SELECT duration_sec, bags_offline FROM `{bucket}` "
        f"WHERE `type` = 'outage_event'"
    )
    total_outage_sec  = sum(e.get("duration_sec", 0) for e in outage_events)
    total_bags_offline = sum(e.get("bags_offline", 0) for e in outage_events)
    total_bags = _query_one(
        f"SELECT RAW COUNT(*) FROM `{bucket}` WHERE `type` = 'bag'"
    )

    misrouting_savings  = round(misroute_incidents * COST_MISROUTE_EUR, 2)
    offline_ops_savings = round(total_bags_offline * COST_OFFLINE_BAG_EUR, 2)
    recovery_savings    = round((total_outage_sec / 60) * COST_DOWNTIME_EUR_MIN, 2)
    efficiency_savings  = round(total_bags * 0.50, 2)   # €0.50/bag operational efficiency
    total_savings       = round(
        misrouting_savings + offline_ops_savings + recovery_savings + efficiency_savings, 2
    )

    return {
        "total_savings_eur": total_savings,
        "breakdown": [
            {
                "label":       "Misrouting Detection",
                "description": f"{misroute_incidents} incident(s) detected × €{COST_MISROUTE_EUR:.0f}",
                "savings_eur": misrouting_savings,
                "icon":        "MISROUTE",
            },
            {
                "label":       "Offline Operations",
                "description": f"{total_bags_offline} bag(s) processed during {len(outage_events)} outage(s)",
                "savings_eur": offline_ops_savings,
                "icon":        "OFFLINE",
            },
            {
                "label":       "Downtime Recovery",
                "description": f"{total_outage_sec}s total outage avoided at €{COST_DOWNTIME_EUR_MIN * 60:.0f}/hr",
                "savings_eur": recovery_savings,
                "icon":        "RECOVERY",
            },
            {
                "label":       "Operational Efficiency",
                "description": f"{total_bags} bag(s) processed with edge-first system",
                "savings_eur": efficiency_savings,
                "icon":        "EFFICIENCY",
            },
        ],
        "assumptions": {
            "cost_per_misrouted_bag_eur": COST_MISROUTE_EUR,
            "cost_per_offline_bag_eur":   COST_OFFLINE_BAG_EUR,
            "cost_per_downtime_hr_eur":   500.0,
            "efficiency_per_bag_eur":     0.50,
        },
    }
