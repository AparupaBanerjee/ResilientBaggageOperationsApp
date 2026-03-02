# Swedavia — Resilient Baggage Operations

A hybrid online/offline baggage handling system built for the Swedavia Airports hackathon.
Edge Couchbase is always-on. Main (cloud) Couchbase stays in sync via XDCR.
When connectivity is lost, the edge node continues accepting bags with zero downtime.
When connectivity is restored, everything reconciles automatically.

---

## Architecture

```
Browser
  └── React (port 3000)
        └── FastAPI backend (port 8000)
              ├── Edge Couchbase (port 8091) ← always-on, primary writes
              │     └── XDCR replication ──────────────────────────────┐
              └── Main Couchbase  (port 8092) ← central/cloud          │
                                                                ◄───────┘
Sync Gateway (port 4984 / 4985) ← connected to Edge
```

- **Edge Couchbase**: Airport-local node. All writes go here first.
- **Main Couchbase**: Central cloud node. Receives data via XDCR replication.
- **XDCR**: Couchbase Cross Data Center Replication — paused during outage simulation, resumed on restore.
- **Sync Gateway**: Exposes REST / mobile-sync API on Edge; included for future mobile clients.

---

## Prerequisites

| Tool          | Minimum version |
|---------------|-----------------|
| Docker Desktop (or Docker Engine + Compose v2) | 24.x |
| curl          | any             |
| Node.js       | 18.x (if running frontend locally) |
| Python        | 3.11 (if running backend locally)  |

> **Memory**: Couchbase needs at least **4 GB RAM** available to Docker.
> In Docker Desktop → Settings → Resources, set memory to ≥ 4 GB.

---

## Quick Start

```bash
# 1. Clone / enter the project
cd swedavia-baggage

# 2. Copy environment file (defaults work out of the box)
cp .env.example .env

# 3. One command to start everything, initialise clusters, and open the browser
sh start.sh
```

`start.sh` will:
1. Build and start all Docker containers
2. Wait for Couchbase to be ready
3. Run `setup.sh` — initialises both clusters, creates the `baggage` bucket, sets up XDCR replication
4. Wait for the backend health check
5. Open `http://localhost:3000` in your default browser

---

## Manual Step-by-Step

```bash
# Start containers
docker compose up -d --build

# Wait ~25 s, then initialise
sh setup.sh

# Verify backend is healthy
curl http://localhost:8000/health
```

---

## URLs

| Service           | URL                          | Credentials            |
|-------------------|------------------------------|------------------------|
| **Frontend**      | http://localhost:3000        | —                      |
| **Backend API**   | http://localhost:8000        | —                      |
| **Edge Admin UI** | http://localhost:8091        | Administrator / password |
| **Main Admin UI** | http://localhost:8092        | Administrator / password |
| **Sync Gateway**  | http://localhost:4984        | —                      |
| **SGW Admin**     | http://localhost:4985        | —                      |
| **API Docs**      | http://localhost:8000/docs   | —                      |

---

## Jury Demo Script

### Step 1 — Seed data
1. Open **http://localhost:3000**
2. Click **SEED TEST DATA** → 5 flights and 20 bags are created on Edge
3. Wait ~5 s — XDCR replicates to Main
4. **CouchbaseStats** panel shows both Edge and Main with the same document count
5. Status bar shows **ONLINE — Edge and Main in sync**

### Step 2 — Simulate outage
6. Click **SIMULATE OUTAGE**
7. Status bar turns red: **OFFLINE — Sync paused. Writing to edge only.**
8. Open **http://localhost:8091** (Edge Admin) → Buckets → `baggage` → Item count
9. Open **http://localhost:8092** (Main Admin) → same path
10. Add several bags via the **Add Bag** form
11. Watch Edge item count increase; Main count stays unchanged
12. The CouchbaseStats panel shows **OUT OF SYNC** in red with the pending delta

### Step 3 — Restore connection
13. Click **RESTORE CONNECTION**
14. Status bar turns green: **ONLINE**
15. Within a few seconds, Main item count catches up to Edge
16. CouchbaseStats shows **IN SYNC** in green
17. Bags that were created offline now show **SYNCED** (amber → green)

---

## Stopping

```bash
docker compose down
# To also remove volumes (wipe all data):
docker compose down -v
```

---

## Project Structure

```
swedavia-baggage/
├── docker-compose.yml          # All services: edge, main, sgw, backend, frontend
├── sync-gateway-config.json    # Sync Gateway bootstrap config
├── setup.sh                    # One-shot cluster initialisation + XDCR setup
├── start.sh                    # Full startup orchestration
├── .env.example                # Environment template
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                 # FastAPI app, /health endpoint, startup events
│   ├── db.py                   # Couchbase connections, XDCR pause/resume
│   ├── models.py               # Pydantic models
│   └── routers/
│       ├── bags.py             # CRUD for bags
│       ├── flights.py          # CRUD for flights
│       └── simulate.py         # /simulate/offline, /online, /seed
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx
        ├── index.css
        ├── hooks/
        │   └── useHealth.js
        └── components/
            ├── StatusBar.jsx           # Fixed top bar, online/offline indicator
            ├── CouchbaseStats.jsx      # Live Edge / Main document counts
            ├── FlightBoard.jsx         # FIDS-style flight table
            ├── SimulationControls.jsx  # Seed, outage, restore buttons + event log
            └── BaggageTable.jsx        # Live bag registry with sync state
```

---

## API Reference

| Method | Path                        | Description                        |
|--------|-----------------------------|------------------------------------|
| GET    | `/health`                   | System health + document counts    |
| GET    | `/bags`                     | List all bags from Edge            |
| POST   | `/bags`                     | Create bag (works offline)         |
| PUT    | `/bags/{id}/status`         | Update bag status                  |
| DELETE | `/bags/{id}`                | Delete bag                         |
| GET    | `/flights`                  | List all flights                   |
| POST   | `/flights`                  | Create / update flight             |
| POST   | `/simulate/seed`            | Seed 5 flights + 20 bags           |
| POST   | `/simulate/offline`         | Pause XDCR → outage simulation     |
| POST   | `/simulate/online`          | Resume XDCR → restore connection   |

Interactive docs: **http://localhost:8000/docs**

---

## Tech Stack

- **Backend**: Python 3.11 · FastAPI · Couchbase Python SDK 4.x
- **Frontend**: React 18 · Vite · Tailwind CSS · Inter + IBM Plex Mono (Google Fonts)
- **Database**: Couchbase Community 7.1 (two instances)
- **Sync**: Couchbase XDCR + Sync Gateway 3.1
- **Infrastructure**: Docker Compose
