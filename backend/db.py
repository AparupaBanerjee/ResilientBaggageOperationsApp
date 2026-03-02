"""
db.py — Couchbase connectivity and XDCR replication control.

Architecture:
  - Edge Couchbase (couchbase-edge:8091) — primary write target, always-on
  - Main Couchbase (couchbase-main:8091) — central/cloud server, stats only
  - XDCR replication Edge → Main (set up by setup.sh)
  - pause_sync / resume_sync call the Couchbase XDCR REST API on the Edge node
"""

import os
import time
import logging
import threading
import urllib.parse
from datetime import timedelta
from typing import Optional

import requests
from couchbase.cluster import Cluster
from couchbase.options import ClusterOptions
from couchbase.auth import PasswordAuthenticator
from couchbase.exceptions import DocumentNotFoundException, BucketNotFoundException

logger = logging.getLogger(__name__)

# ─── Config from environment ──────────────────────────────────────────────────
EDGE_HOST = os.getenv("EDGE_COUCHBASE_HOST", "couchbase-edge")
MAIN_HOST = os.getenv("MAIN_COUCHBASE_HOST", "couchbase-main")
EDGE_PORT = os.getenv("EDGE_COUCHBASE_PORT", "8091")
MAIN_PORT = os.getenv("MAIN_COUCHBASE_PORT", "8091")
CB_USERNAME = os.getenv("COUCHBASE_USERNAME", "Administrator")
CB_PASSWORD = os.getenv("COUCHBASE_PASSWORD", "password")
BUCKET_NAME = os.getenv("COUCHBASE_BUCKET", "baggage")

# ─── Global state ─────────────────────────────────────────────────────────────
is_online: bool = True
_xdcr_replication_id: Optional[str] = None

edge_cluster: Optional[Cluster] = None
edge_collection = None
main_cluster: Optional[Cluster] = None


# ─── Connection helpers ───────────────────────────────────────────────────────
def _connect(host: str, max_retries: int = 15) -> tuple:
    """Connect to Couchbase and return (cluster, bucket, collection)."""
    conn_str = f"couchbase://{host}"
    for attempt in range(1, max_retries + 1):
        try:
            cluster = Cluster(
                conn_str,
                ClusterOptions(PasswordAuthenticator(CB_USERNAME, CB_PASSWORD)),
            )
            cluster.wait_until_ready(timedelta(seconds=20))
            bucket = cluster.bucket(BUCKET_NAME)
            collection = bucket.default_collection()
            logger.info("Connected to Couchbase at %s", host)
            return cluster, bucket, collection
        except Exception as exc:
            logger.warning(
                "Connection attempt %d/%d to %s failed: %s",
                attempt, max_retries, host, exc,
            )
            time.sleep(5)
    raise RuntimeError(f"Could not connect to Couchbase at {host} after {max_retries} retries")


def init_connections() -> None:
    """Called once at startup to establish SDK connections."""
    global edge_cluster, edge_collection, main_cluster

    edge_cluster, _, edge_collection = _connect(EDGE_HOST)

    try:
        main_cluster, _, _ = _connect(MAIN_HOST, max_retries=8)
    except Exception as exc:
        logger.warning("Main Couchbase not reachable (stats disabled): %s", exc)


# ─── Document counts via REST (real item counts) ──────────────────────────────
def _rest_doc_count(host: str, port: str = "8091") -> int:
    try:
        resp = requests.get(
            f"http://{host}:{port}/pools/default/buckets/{BUCKET_NAME}",
            auth=(CB_USERNAME, CB_PASSWORD),
            timeout=5,
        )
        if resp.status_code == 200:
            return resp.json().get("basicStats", {}).get("itemCount", 0)
    except Exception as exc:
        logger.debug("REST doc count error (%s): %s", host, exc)
    return 0


def get_edge_doc_count() -> int:
    return _rest_doc_count(EDGE_HOST, EDGE_PORT)


def get_main_doc_count() -> int:
    return _rest_doc_count(MAIN_HOST, MAIN_PORT)


# ─── Pending sync count via N1QL ──────────────────────────────────────────────
def get_pending_sync_count() -> int:
    if edge_cluster is None:
        return 0
    try:
        result = edge_cluster.query(
            f"SELECT RAW COUNT(*) FROM `{BUCKET_NAME}` "
            f"WHERE `type` = 'bag' AND sync_pending = true"
        )
        rows = list(result)
        return rows[0] if rows else 0
    except Exception as exc:
        logger.debug("Pending count query error: %s", exc)
        return 0


# ─── XDCR replication management ─────────────────────────────────────────────
def _discover_xdcr_id() -> Optional[str]:
    """Look up the live XDCR replication ID from Edge Couchbase tasks."""
    global _xdcr_replication_id
    try:
        resp = requests.get(
            f"http://{EDGE_HOST}:{EDGE_PORT}/pools/default/tasks",
            auth=(CB_USERNAME, CB_PASSWORD),
            timeout=5,
        )
        if resp.status_code == 200:
            for task in resp.json():
                if task.get("type") == "xdcr":
                    _xdcr_replication_id = task.get("id")
                    logger.info("XDCR replication ID: %s", _xdcr_replication_id)
                    return _xdcr_replication_id
    except Exception as exc:
        logger.warning("Could not discover XDCR replication ID: %s", exc)
    return None


def _set_xdcr_pause(pause: bool) -> bool:
    """Pause (True) or resume (False) XDCR replication via REST API."""
    rep_id = _xdcr_replication_id or _discover_xdcr_id()
    if not rep_id:
        logger.warning("No XDCR replication ID found — cannot %s sync",
                       "pause" if pause else "resume")
        return False

    encoded = urllib.parse.quote(rep_id, safe="")
    try:
        resp = requests.post(
            f"http://{EDGE_HOST}:{EDGE_PORT}/settings/replications/{encoded}",
            auth=(CB_USERNAME, CB_PASSWORD),
            data={"pauseRequested": "true" if pause else "false"},
            timeout=10,
        )
        action = "PAUSED" if pause else "RESUMED"
        logger.info("XDCR %s — HTTP %d", action, resp.status_code)
        return resp.status_code in (200, 204)
    except Exception as exc:
        logger.error("XDCR pause/resume error: %s", exc)
        return False


def pause_sync() -> bool:
    """
    Pause Sync Gateway / XDCR replication so Edge and Main diverge.
    Returns True on success.
    """
    global is_online
    ok = _set_xdcr_pause(True)
    is_online = False
    return ok


def resume_sync() -> bool:
    """
    Resume replication; Edge bags will propagate to Main.
    Returns True on success.
    """
    global is_online
    ok = _set_xdcr_pause(False)
    is_online = True
    # Schedule async update of sync_pending flags
    threading.Thread(target=_clear_pending_flags, daemon=True).start()
    return ok


def _clear_pending_flags() -> None:
    """After resuming, mark previously offline-created bags as synced."""
    time.sleep(8)  # Give XDCR a moment to start flowing
    if edge_cluster is None:
        return
    try:
        result = edge_cluster.query(
            f"UPDATE `{BUCKET_NAME}` "
            f"SET sync_pending = false "
            f"WHERE `type` = 'bag' AND sync_pending = true"
        )
        list(result)  # consume iterator
        logger.info("sync_pending flags cleared")
    except Exception as exc:
        logger.warning("Could not clear sync_pending flags: %s", exc)


# ─── Background sync monitor ──────────────────────────────────────────────────
def start_sync_monitor() -> None:
    def _monitor():
        while True:
            time.sleep(10)
            if is_online:
                edge = get_edge_doc_count()
                main = get_main_doc_count()
                if edge != main:
                    logger.warning(
                        "Sync divergence detected — Edge: %d, Main: %d", edge, main
                    )

    t = threading.Thread(target=_monitor, daemon=True)
    t.start()
    logger.info("Sync monitor started.")
