#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[START]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }

# ─── Docker Compose v1/v2 compat ─────────────────────────────────────────────
if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose &>/dev/null; then
  DC="docker-compose"
else
  echo "Docker Compose not found. Install Docker Desktop or docker-compose." >&2
  exit 1
fi

log "Starting all containers..."
$DC up -d --build

log "Waiting 25 s for Couchbase to boot (first run may take longer)..."
sleep 25

log "Running cluster setup..."
chmod +x setup.sh
./setup.sh

log "Waiting for backend health check..."
attempts=0
until curl -sf http://localhost:8000/health -o /dev/null 2>/dev/null; do
  attempts=$((attempts+1))
  if [ $attempts -ge 30 ]; then
    warn "Backend health check timed out. It may still be starting up."
    break
  fi
  sleep 3
done

echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log " Swedavia Baggage Operations — READY"
log ""
log " Frontend :  http://localhost:3000"
log " Backend  :  http://localhost:8000"
log " Edge UI  :  http://localhost:8091"
log " Main UI  :  http://localhost:8092"
log " SGW      :  http://localhost:4984"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Open browser
if [[ "$OSTYPE" == "darwin"* ]]; then
  open http://localhost:3000
elif command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:3000 &
fi

log "Tailing logs (Ctrl-C to stop)..."
$DC logs -f
