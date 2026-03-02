import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import db
from models import HealthResponse
from routers import bags, flights, simulate

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    import asyncio
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, db.init_connections)
    await loop.run_in_executor(None, db.start_sync_monitor)
    await loop.run_in_executor(None, _seed_routing_rules)
    yield
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
app.include_router(simulate.router)


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
        "counts_in_sync": edge_count == main_count,
        "pending_sync_count": pending,
    }
