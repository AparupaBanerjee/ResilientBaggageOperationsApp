import logging
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import db
from models import HealthResponse
from routers import bags, flights, simulate, predict, integrations, analytics, passengers, conflicts
import audit
from integrations.iot import iot_sim

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def _on_sync_divergence(edge: int, main: int) -> None:
    """Called by db.py sync monitor when counts diverge — write a single audit entry."""
    audit.write_audit(
        operator="system",
        action="sync_divergence",
        doc_id="system",
        detail=f"Edge={edge} Main={main} — replication lag detected",
        result="warn",
    )


def _start_escalation_monitor() -> None:
    """Background thread: every 60 s scan for on_hold bags held > 10 minutes."""
    HOLD_LIMIT_SECS = 600  # 10 minutes

    def _loop():
        while True:
            time.sleep(60)
            if db.edge_cluster is None:
                continue
            try:
                now = datetime.now(timezone.utc)
                result = db.edge_cluster.query(
                    f"SELECT META().id AS _doc_id, b.bag_id, b.hold_since, b.hold_reason "
                    f"FROM `{db.BUCKET_NAME}` b "
                    f"WHERE b.`type` = 'bag' AND b.status = 'on_hold' AND b.hold_since IS NOT MISSING"
                )
                for row in list(result):
                    hs_str = row.get("hold_since")
                    if not hs_str:
                        continue
                    try:
                        hs = datetime.fromisoformat(hs_str.replace("Z", "+00:00"))
                        age_secs = (now - hs).total_seconds()
                        if age_secs > HOLD_LIMIT_SECS:
                            bid = row.get("bag_id") or row.get("_doc_id")
                            reason = row.get("hold_reason", "unknown")
                            audit.write_audit(
                                operator="system",
                                action="on_hold_escalation",
                                doc_id=bid or "unknown",
                                detail=f"Bag held {int(age_secs // 60)} min — reason: {reason}. Manual retrieval required.",
                                result="warn",
                            )
                    except Exception:
                        pass
            except Exception as exc:
                logger.debug("Escalation monitor error: %s", exc)

    t = threading.Thread(target=_loop, daemon=True)
    t.start()
    logger.info("On-hold escalation monitor started (threshold: 10 min).")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    import asyncio
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, db.init_connections)
    db.set_divergence_callback(_on_sync_divergence)
    await loop.run_in_executor(None, db.start_sync_monitor)
    await loop.run_in_executor(None, _seed_routing_rules)
    await loop.run_in_executor(None, _start_escalation_monitor)
    iot_sim.start()
    yield
    iot_sim.stop()
    # Shutdown (nothing to do)


def _seed_routing_rules():
    """Insert default routing rules if the bucket is empty."""
    if db.edge_cluster is None:
        return
    try:
        result = db.edge_cluster.query(
            f"SELECT RAW COUNT(*) FROM `{db.BUCKET_NAME}` WHERE `type` = 'routing_rule'"
        )
        count = list(result)[0]
        if count > 0:
            return
    except Exception:
        return

    rules = [
        {"flight_id": "SK101", "belt": "A1"},
        {"flight_id": "SK202", "belt": "A2"},
        {"flight_id": "SK303", "belt": "B1"},
        {"flight_id": "SK404", "belt": "B2"},
        {"flight_id": "SK505", "belt": "C1"},
    ]
    for rule in rules:
        doc_id = f"routing_rule::{rule['flight_id']}"
        try:
            db.edge_collection.upsert(doc_id, {
                "type": "routing_rule",
                "flight_id": rule["flight_id"],
                "belt": rule["belt"],
                "priority": 1,
                "active": True,
            })
        except Exception as exc:
            logger.warning("Could not upsert routing rule %s: %s", doc_id, exc)
    logger.info("Default routing rules seeded.")


app = FastAPI(
    title="Swedavia Resilient Baggage Operations",
    description="Hybrid online/offline baggage handling with Couchbase Edge + XDCR",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bags.router)
app.include_router(flights.router)
app.include_router(passengers.router)
app.include_router(simulate.router)
app.include_router(predict.router)
app.include_router(audit.router)
app.include_router(integrations.router)
app.include_router(analytics.router)
app.include_router(conflicts.router)


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health_check():
    edge_count = db.get_edge_doc_count()
    main_count = db.get_main_doc_count()
    pending = db.get_pending_sync_count()
    return {
        "status": "ok",
        "online": db.is_online,
        "edge_doc_count": edge_count,
        "main_doc_count": main_count,
        "edge_bag_count": db.get_edge_bag_count(),
        "main_bag_count": db.get_main_bag_count(),
        "counts_in_sync": edge_count == main_count,
        "pending_sync_count": pending,
        "throughput_per_min": db.get_throughput_per_min(),
    }
