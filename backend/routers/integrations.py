from fastapi import APIRouter, HTTPException
from integrations.dcs import get_all_dcs_status
from integrations.acris import get_all_acris_status
from integrations.iot import iot_sim
import db

router = APIRouter(prefix="/integrations", tags=["integrations"])

# Map Couchbase flight status → ACRIS status
_ACRIS_STATUS_MAP = {
    'scheduled': 'ON_SCHEDULE',
    'boarding':  'BOARDING',
    'delayed':   'DELAYED',
    'departed':  'GATE_CLOSED',
    'arrived':   'GATE_CLOSED',
    'cancelled': 'GATE_CLOSED',
}


@router.get("/live")
def get_integrations_live():
    """Combined snapshot from DCS, ACRIS, and IoT — enriched with real Couchbase data."""

    # ── 1. Fetch real bags, flights, and passenger counts from Edge ───────────
    real_bags     = []
    flight_status = {}
    pax_counts    = {}

    if db.edge_cluster is not None:
        try:
            rows = db.edge_cluster.query(
                f"SELECT b.bag_id, b.flight_id, b.destination_belt, "
                f"       b.status, b.weight_kg "
                f"FROM `{db.BUCKET_NAME}` b WHERE b.`type` = 'bag'"
            )
            real_bags = [dict(r) for r in rows]
        except Exception:
            pass

        try:
            rows = db.edge_cluster.query(
                f"SELECT f.flight_id, f.status "
                f"FROM `{db.BUCKET_NAME}` f WHERE f.`type` = 'flight'"
            )
            flight_status = {r['flight_id']: r['status'] for r in rows}
        except Exception:
            pass

        try:
            rows = db.edge_cluster.query(
                f"SELECT p.flight_id, COUNT(*) AS cnt "
                f"FROM `{db.BUCKET_NAME}` p WHERE p.`type` = 'passenger' "
                f"GROUP BY p.flight_id"
            )
            pax_counts = {r['flight_id']: r['cnt'] for r in rows}
        except Exception:
            pass

    # ── 2. Build DCS — override bag/pax counts with real values ──────────────
    bag_counts = {}
    for b in real_bags:
        fid = b.get('flight_id', '')
        if fid:
            bag_counts[fid] = bag_counts.get(fid, 0) + 1

    dcs = get_all_dcs_status()
    for d in dcs:
        fid = d['flight_id']
        d['bags_checked'] = bag_counts.get(fid, 0)
        real_pax = pax_counts.get(fid, 0)
        if real_pax > 0:
            d['checked_in']  = real_pax
            d['load_factor'] = round(real_pax / d['capacity'] * 100, 1)

    # ── 3. Build ACRIS — map real flight statuses ─────────────────────────────
    acris = get_all_acris_status()
    for a in acris:
        real_st = flight_status.get(a['flight_id'])
        if real_st:
            a['acris_status'] = _ACRIS_STATUS_MAP.get(real_st, a['acris_status'])

    # ── 4. Build RFID events — replace fake TAG IDs with real bag IDs ─────────
    rfid_events = iot_sim.get_rfid_events(limit=15)
    active_bags = [
        b for b in real_bags
        if b.get('status') in ('check_in', 'in_transit', 'loaded')
    ]
    if active_bags:
        new_events = []
        for i, evt in enumerate(rfid_events):
            evt = dict(evt)  # copy — don't mutate shared IoT state
            bag = active_bags[i % len(active_bags)]
            evt['bag_tag']    = bag.get('bag_id', evt.get('bag_tag'))
            evt['weight_kg']  = bag.get('weight_kg', evt.get('weight_kg'))
            evt['overweight'] = (evt.get('weight_kg') or 0) > 23
            new_events.append(evt)
        rfid_events = new_events

    return {
        "dcs":             dcs,
        "acris":           acris,
        "rfid_events":     rfid_events,
        "conveyor_health": iot_sim.get_conveyor_health(),
        "chaos": {
            "flaky_mode": db.flaky_mode,
            "blackout":   iot_sim.is_blackout(),
        },
    }


@router.post("/iot/jam/{belt_id}")
def inject_jam(belt_id: str):
    if not iot_sim.inject_jam(belt_id):
        raise HTTPException(status_code=404, detail=f"Belt {belt_id} not found")
    return {"ok": True, "belt_id": belt_id, "status": "JAM"}


@router.post("/iot/clear/{belt_id}")
def clear_jam(belt_id: str):
    if not iot_sim.clear_jam(belt_id):
        raise HTTPException(status_code=404, detail=f"Belt {belt_id} not found")
    return {"ok": True, "belt_id": belt_id, "status": "OK"}
