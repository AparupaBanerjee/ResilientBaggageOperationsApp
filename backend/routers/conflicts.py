"""
conflicts.py — Split-brain conflict resolution demo.

Simulates the scenario:
  1. Edge goes offline (XDCR paused)
  2. Cloud operator issues a directive against Main (e.g. cancel flight)
  3. Edge keeps routing bags for that flight — diverged state
  4. Sync restores — conflict detected between Edge and Main
  5. Human operator reviews and resolves: ACCEPT CLOUD or KEEP EDGE

Couchbase's built-in mechanism (timestamp/revision-based XDCR conflict
resolution) would auto-resolve data-level conflicts, but safety-critical
baggage operations require a human-in-the-loop override layer on top.
"""

import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conflicts", tags=["conflicts"])

# ── In-memory directive store (simulates cloud-side event log) ─────────────────
# Each directive:
#   { directive_id, flight_id, directive, issued_by, issued_at, source,
#     resolved, resolution, resolved_at, resolved_by }
_cloud_directives: list[dict] = []


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Request models ─────────────────────────────────────────────────────────────
class CloudCancelRequest(BaseModel):
    flight_id: str


class ResolveRequest(BaseModel):
    directive_id: str
    action: str        # "accept_cloud" | "keep_edge" | "manual_update"
    divert_belt: str = "D12"  # used only for manual_update


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/cloud-cancel", tags=["conflicts"])
def issue_cloud_cancel(
    req: CloudCancelRequest,
    x_operator_id: str = Header(default="cloud-ops"),
):
    """
    Simulate a cloud-side cancellation issued while Edge is offline.
    Writes the directive to Main (if reachable) — Edge does NOT see it
    because XDCR is paused, creating the split-brain divergence.
    """
    if db.edge_cluster is None:
        raise HTTPException(503, "Edge cluster not available")

    # Validate flight exists and is cancellable
    try:
        rows = list(db.edge_cluster.query(
            f"SELECT flight_id, status FROM `{db.BUCKET_NAME}` "
            f"WHERE `type` = 'flight' AND flight_id = '{req.flight_id}'"
        ))
    except Exception as exc:
        raise HTTPException(500, str(exc))

    if not rows:
        raise HTTPException(404, f"Flight {req.flight_id} not found")
    if rows[0].get("status") in ("cancelled", "departed"):
        raise HTTPException(400, f"Flight {req.flight_id} is already {rows[0]['status']}")

    # Check for duplicate pending directive
    existing = next(
        (d for d in _cloud_directives
         if d["flight_id"] == req.flight_id and not d["resolved"]),
        None,
    )
    if existing:
        raise HTTPException(409, f"Pending directive already exists for {req.flight_id}")

    directive_id = f"DIR-{uuid.uuid4().hex[:8].upper()}"
    issued_at = _now()

    directive = {
        "directive_id": directive_id,
        "flight_id": req.flight_id,
        "directive": "cancel_flight",
        "issued_by": x_operator_id,
        "issued_at": issued_at,
        "source": "cloud_main",
        "resolved": False,
        "resolution": None,
        "resolved_at": None,
        "resolved_by": None,
    }
    _cloud_directives.append(directive)

    # Write cancellation to Main (cloud side) — Edge won't see this while offline
    if db.main_cluster is not None:
        try:
            db.main_cluster.query(
                f"UPDATE `{db.BUCKET_NAME}` "
                f"SET status = 'cancelled', cloud_cancelled_at = '{issued_at}', "
                f"cloud_directive_id = '{directive_id}' "
                f"WHERE `type` = 'flight' AND flight_id = '{req.flight_id}'"
            )
            logger.info("Cloud cancel written to Main for %s", req.flight_id)
        except Exception as exc:
            logger.warning("Could not update Main for cloud cancel: %s", exc)

    logger.info("Cloud directive %s issued for flight %s", directive_id, req.flight_id)
    return {
        "directive_id": directive_id,
        "flight_id": req.flight_id,
        "issued_at": issued_at,
        "detail": f"Cloud cancellation queued for {req.flight_id}. "
                  f"Edge is unaware — conflict will surface on sync restore.",
    }


@router.get("", tags=["conflicts"])
def get_conflicts():
    """
    Return pending cloud directives with affected Edge bags.
    Each entry shows: the directive, affected bags still being routed,
    and Couchbase's automatic resolution recommendation.
    """
    pending = [d for d in _cloud_directives if not d["resolved"]]
    result = []

    for directive in pending:
        flight_id = directive["flight_id"]
        affected_bags = []
        flight_status = "unknown"

        if db.edge_cluster is not None:
            try:
                rows = list(db.edge_cluster.query(
                    f"SELECT bag_id, passenger_name, status, destination_belt, "
                    f"last_updated, sync_pending "
                    f"FROM `{db.BUCKET_NAME}` "
                    f"WHERE `type` = 'bag' AND flight_id = '{flight_id}' "
                    f"AND status NOT IN ['cancelled', 'offloaded', 'on_hold', 'delivered']"
                ))
                affected_bags = rows
            except Exception as exc:
                logger.warning("Conflict bag query failed: %s", exc)

            try:
                frows = list(db.edge_cluster.query(
                    f"SELECT status FROM `{db.BUCKET_NAME}` "
                    f"WHERE `type` = 'flight' AND flight_id = '{flight_id}' LIMIT 1"
                ))
                if frows:
                    flight_status = frows[0].get("status", "unknown")
            except Exception as exc:
                logger.warning("Conflict flight status query failed: %s", exc)

        result.append({
            **directive,
            "flight_status": flight_status,
            "affected_bags": affected_bags,
            "affected_count": len(affected_bags),
            # Explain Couchbase's built-in mechanism
            "cb_conflict_mode": "timestamp-based XDCR resolution",
            "cb_auto_winner": "Main (cloud) — newer write timestamp",
            "cb_cas_note": "Couchbase CAS sequence on Main > Edge for this flight doc",
        })

    return result


@router.post("/resolve", tags=["conflicts"])
def resolve_conflict(
    req: ResolveRequest,
    x_operator_id: str = Header(default="anonymous"),
):
    """
    Human-in-the-loop resolution.
    accept_cloud → apply cloud state: offload all active Edge bags for the flight.
    keep_edge    → override cloud: clear sync_pending, keep routing as-is.
    """
    directive = next(
        (d for d in _cloud_directives if d["directive_id"] == req.directive_id),
        None,
    )
    if not directive:
        raise HTTPException(404, "Directive not found")
    if directive["resolved"]:
        raise HTTPException(400, "Already resolved")
    if req.action not in ("accept_cloud", "keep_edge", "manual_update"):
        raise HTTPException(400, "action must be 'accept_cloud', 'keep_edge', or 'manual_update'")

    if db.edge_cluster is None:
        raise HTTPException(503, "Edge cluster not available")

    flight_id = directive["flight_id"]
    now = _now()
    bags_affected = 0

    if req.action == "accept_cloud":
        # Accept cloud state: put all active Edge bags on hold + cancel flight on Edge
        try:
            r = db.edge_cluster.query(
                f"UPDATE `{db.BUCKET_NAME}` "
                f"SET status = 'on_hold', hold_reason = 'cloud_conflict_resolution', "
                f"hold_since = '{now}', destination_belt = null, "
                f"sync_pending = false, last_updated = '{now}' "
                f"WHERE `type` = 'bag' AND flight_id = '{flight_id}' "
                f"AND status NOT IN ['cancelled', 'offloaded', 'on_hold', 'delivered']"
            )
            list(r)
        except Exception as exc:
            raise HTTPException(500, f"Failed to apply cloud state: {exc}")

        try:
            list(db.edge_cluster.query(
                f"UPDATE `{db.BUCKET_NAME}` "
                f"SET status = 'cancelled', last_updated = '{now}' "
                f"WHERE `type` = 'flight' AND flight_id = '{flight_id}'"
            ))
            logger.info("Flight %s marked cancelled on Edge", flight_id)
        except Exception as exc:
            logger.warning("Could not cancel flight on Edge: %s", exc)

        # Count affected bags for response
        try:
            rows = list(db.edge_cluster.query(
                f"SELECT RAW COUNT(*) FROM `{db.BUCKET_NAME}` "
                f"WHERE `type` = 'bag' AND flight_id = '{flight_id}' "
                f"AND hold_reason = 'cloud_conflict_resolution'"
            ))
            bags_affected = rows[0] if rows else 0
        except Exception:
            pass

    elif req.action == "keep_edge":
        # Override cloud: clear sync_pending, flight stays active on Edge
        try:
            list(db.edge_cluster.query(
                f"UPDATE `{db.BUCKET_NAME}` "
                f"SET sync_pending = false, last_updated = '{now}' "
                f"WHERE `type` = 'bag' AND flight_id = '{flight_id}' "
                f"AND sync_pending = true"
            ))
        except Exception as exc:
            raise HTTPException(500, f"Failed to apply edge override: {exc}")

    else:  # manual_update
        divert_belt = req.divert_belt.strip().upper() or "D12"
        # Cancel flight on Edge
        try:
            list(db.edge_cluster.query(
                f"UPDATE `{db.BUCKET_NAME}` "
                f"SET status = 'cancelled', last_updated = '{now}' "
                f"WHERE `type` = 'flight' AND flight_id = '{flight_id}'"
            ))
            logger.info("Flight %s marked cancelled on Edge (manual_update)", flight_id)
        except Exception as exc:
            logger.warning("Could not cancel flight on Edge (manual_update): %s", exc)

        # Reroute all active bags to the divert belt
        try:
            r = list(db.edge_cluster.query(
                f"UPDATE `{db.BUCKET_NAME}` "
                f"SET destination_belt = '{divert_belt}', "
                f"divert_reason = 'manual_conflict_resolution', "
                f"sync_pending = false, last_updated = '{now}' "
                f"WHERE `type` = 'bag' AND flight_id = '{flight_id}' "
                f"AND status NOT IN ['cancelled', 'offloaded', 'delivered']"
            ))
            _ = r
        except Exception as exc:
            raise HTTPException(500, f"Failed to reroute bags: {exc}")

        # Count rerouted bags
        try:
            rows = list(db.edge_cluster.query(
                f"SELECT RAW COUNT(*) FROM `{db.BUCKET_NAME}` "
                f"WHERE `type` = 'bag' AND flight_id = '{flight_id}' "
                f"AND divert_reason = 'manual_conflict_resolution'"
            ))
            bags_affected = rows[0] if rows else 0
        except Exception:
            pass

    # Write audit entry
    try:
        audit_doc_id = f"audit-conflict-{uuid.uuid4().hex[:8]}"
        db.edge_collection.upsert(audit_doc_id, {
            "type": "audit",
            "event": "conflict_resolved",
            "directive_id": req.directive_id,
            "flight_id": flight_id,
            "action": req.action,
            "divert_belt": req.divert_belt if req.action == "manual_update" else None,
            "operator_id": x_operator_id,
            "bags_affected": bags_affected,
            "timestamp": now,
        })
    except Exception as exc:
        logger.warning("Audit write failed: %s", exc)

    # Mark directive resolved
    directive.update({
        "resolved": True,
        "resolution": req.action,
        "resolved_at": now,
        "resolved_by": x_operator_id,
        "divert_belt": req.divert_belt if req.action == "manual_update" else None,
    })

    logger.info(
        "Conflict %s resolved: %s by %s (%d bags affected)",
        req.directive_id, req.action, x_operator_id, bags_affected,
    )
    return {
        "resolved": True,
        "directive_id": req.directive_id,
        "action": req.action,
        "flight_id": flight_id,
        "bags_affected": bags_affected,
        "divert_belt": req.divert_belt if req.action == "manual_update" else None,
    }


@router.get("/history", tags=["conflicts"])
def get_history():
    """Return resolved directives for audit trail."""
    return [d for d in _cloud_directives if d["resolved"]]


@router.delete("/reset", tags=["conflicts"])
def reset_directives():
    """Clear all directives (dev/demo use only)."""
    _cloud_directives.clear()
    return {"cleared": True}
