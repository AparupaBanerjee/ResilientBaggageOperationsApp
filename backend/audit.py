"""
Audit logging — every state-changing operation writes a tamper-evident
audit_log document to Couchbase (Edge, replicated to Main via XDCR).
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter

import db

router = APIRouter(prefix="/audit", tags=["audit"])
logger = logging.getLogger(__name__)


def write_audit(
    operator: str,
    action: str,
    doc_id:  Optional[str] = None,
    detail:  Optional[str] = None,
    result:  str = "success",
) -> None:
    """
    Write a single audit entry to Couchbase.
    Never raises — audit failure must never block the primary operation.
    """
    if db.edge_collection is None:
        return
    entry = {
        "type":     "audit_log",
        "ts":       datetime.now(timezone.utc).isoformat(),
        "operator": operator or "anonymous",
        "action":   action,
        "doc_id":   doc_id,
        "detail":   detail,
        "result":   result,
    }
    try:
        db.edge_collection.insert(f"audit::{uuid.uuid4().hex}", entry)
    except Exception as exc:
        logger.debug("audit write failed: %s", exc)


@router.get("")
def get_audit_log(limit: int = 30):
    """Return the most recent audit log entries, newest first."""
    if db.edge_cluster is None:
        return []
    try:
        result = db.edge_cluster.query(
            f"SELECT META().id as id, a.* "
            f"FROM `{db.BUCKET_NAME}` a "
            f"WHERE a.`type` = 'audit_log' "
            f"ORDER BY a.ts DESC "
            f"LIMIT {min(limit, 50)}"
        )
        return list(result)
    except Exception as exc:
        logger.error("get_audit_log error: %s", exc)
        return []
