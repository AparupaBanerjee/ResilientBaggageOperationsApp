#!/usr/bin/env bash
set -euo pipefail

EDGE_URL="http://localhost:8091"
MAIN_URL="http://localhost:8092"
USERNAME="${COUCHBASE_USERNAME:-Administrator}"
PASSWORD="${COUCHBASE_PASSWORD:-password}"
BUCKET="${COUCHBASE_BUCKET:-baggage}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[SETUP]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail() { echo -e "${RED}[FAIL]${NC}  $*" >&2; exit 1; }

# ─── wait helpers ────────────────────────────────────────────────────────────
wait_for_couchbase() {
  local url=$1 name=$2
  log "Waiting for $name at $url ..."
  local attempts=0
  until curl -sf "$url/pools" -o /dev/null 2>/dev/null; do
    attempts=$((attempts+1))
    [ $attempts -ge 60 ] && fail "$name never became ready after 120 s"
    sleep 2
  done
  log "$name is responding."
}

wait_http() {
  local url=$1
  until curl -sf "$url" -o /dev/null 2>/dev/null; do sleep 2; done
}

# ─── cluster init ─────────────────────────────────────────────────────────────
init_cluster() {
  local url=$1 name=$2
  log "Initialising $name cluster..."

  # Only init if not already initialised (idempotent)
  local pools_status
  pools_status=$(curl -s -o /dev/null -w "%{http_code}" "$url/pools/default" 2>/dev/null || true)
  if [ "$pools_status" = "200" ]; then
    warn "$name already initialised, skipping cluster-init."
    return 0
  fi

  curl -sf "$url/nodes/self/controller/settings" \
    -d "path=/opt/couchbase/var/lib/couchbase/data" \
    -d "index_path=/opt/couchbase/var/lib/couchbase/data" > /dev/null

  curl -sf "$url/node/controller/setupServices" \
    -d "services=kv,n1ql,index" > /dev/null

  curl -sf "$url/pools/default" \
    -d "memoryQuota=512" \
    -d "indexMemoryQuota=256" > /dev/null

  curl -sf "$url/settings/web" \
    -d "username=$USERNAME" \
    -d "password=$PASSWORD" \
    -d "port=SAME" > /dev/null

  log "$name cluster initialised."
}

# ─── bucket creation ──────────────────────────────────────────────────────────
create_bucket() {
  local url=$1 name=$2
  # Check if bucket already exists
  local status
  status=$(curl -su "$USERNAME:$PASSWORD" -o /dev/null -w "%{http_code}" \
    "$url/pools/default/buckets/$BUCKET" 2>/dev/null || true)
  if [ "$status" = "200" ]; then
    warn "Bucket '$BUCKET' already exists on $name, skipping."
    return 0
  fi

  log "Creating bucket '$BUCKET' on $name..."
  curl -sf -u "$USERNAME:$PASSWORD" \
    -X POST "$url/pools/default/buckets" \
    -d "name=$BUCKET" \
    -d "bucketType=couchbase" \
    -d "ramQuota=256" \
    -d "replicaNumber=0" \
    -d "flushEnabled=1" > /dev/null
  log "Bucket created on $name."
}

# ─── indexer storage mode ─────────────────────────────────────────────────────
set_indexer_mode() {
  local url=$1 name=$2
  log "Setting indexer storage mode on $name..."
  curl -sf -u "$USERNAME:$PASSWORD" \
    -X POST "$url/settings/indexes" \
    -d "storageMode=forestdb" > /dev/null 2>&1 || true
}

# ─── primary index ────────────────────────────────────────────────────────────
create_index() {
  local url=$1 name=$2 qport=$3
  log "Creating primary index on $name (bucket: $BUCKET)..."
  # Retry a few times – query service may lag behind
  local i=0
  until curl -sf -u "$USERNAME:$PASSWORD" \
    -X POST "${url%:*}:$qport/query/service" \
    --data-urlencode "statement=CREATE PRIMARY INDEX IF NOT EXISTS ON \`$BUCKET\` USING GSI" \
    > /dev/null 2>&1; do
    i=$((i+1))
    [ $i -ge 20 ] && warn "Could not create primary index on $name (non-fatal)" && return 0
    sleep 3
  done
  log "Primary index ready on $name."
}

# ─── XDCR setup ───────────────────────────────────────────────────────────────
setup_xdcr() {
  log "Setting up XDCR replication Edge → Main..."

  # Check if remote cluster ref already exists
  local existing
  existing=$(curl -s -u "$USERNAME:$PASSWORD" \
    "$EDGE_URL/pools/default/remoteClusters" 2>/dev/null || echo "[]")
  if echo "$existing" | grep -q "main-cluster"; then
    warn "XDCR remote cluster 'main-cluster' already exists, skipping."
  else
    curl -sf -u "$USERNAME:$PASSWORD" \
      -X POST "$EDGE_URL/pools/default/remoteClusters" \
      -d "name=main-cluster" \
      -d "hostname=couchbase-main:8091" \
      -d "username=$USERNAME" \
      -d "password=$PASSWORD" > /dev/null
    log "Remote cluster reference created."
    sleep 2
  fi

  # Check if replication already exists
  local tasks
  tasks=$(curl -s -u "$USERNAME:$PASSWORD" \
    "$EDGE_URL/pools/default/tasks" 2>/dev/null || echo "[]")
  if echo "$tasks" | grep -q '"type":"xdcr"'; then
    warn "XDCR replication already exists, skipping."
  else
    local result
    result=$(curl -sf -u "$USERNAME:$PASSWORD" \
      -X POST "$EDGE_URL/controller/createReplication" \
      -d "fromBucket=$BUCKET" \
      -d "toCluster=main-cluster" \
      -d "toBucket=$BUCKET" \
      -d "replicationType=continuous" \
      -d "enableCompression=1" 2>/dev/null)
    log "XDCR replication created: $result"
  fi
}

# ─── Sync Gateway DB ──────────────────────────────────────────────────────────
setup_sync_gateway() {
  log "Configuring Sync Gateway database..."
  local sgw="http://localhost:4985"
  local attempts=0

  # Wait for SGW admin port
  until curl -sf "$sgw/" -o /dev/null 2>/dev/null; do
    attempts=$((attempts+1))
    [ $attempts -ge 30 ] && warn "Sync Gateway not responding – skipping SGW db setup" && return 0
    sleep 3
  done

  # Create DB config if not present
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "$sgw/baggage/" 2>/dev/null || echo "0")
  if [ "$status" = "200" ]; then
    warn "Sync Gateway database 'baggage' already exists."
  else
    curl -sf -X PUT "$sgw/baggage/" \
      -H "Content-Type: application/json" \
      -d '{
        "bucket": "baggage",
        "server": "couchbase://couchbase-edge",
        "username": "Administrator",
        "password": "password",
        "enable_shared_bucket_access": true,
        "import_docs": true,
        "num_index_replicas": 0
      }' > /dev/null 2>&1 || warn "SGW database creation returned an error (may be ok)."
    log "Sync Gateway database configured."
  fi
}

# ─── main ─────────────────────────────────────────────────────────────────────
wait_for_couchbase "$EDGE_URL" "Edge Couchbase"
wait_for_couchbase "$MAIN_URL" "Main Couchbase"

init_cluster "$EDGE_URL" "Edge"
init_cluster "$MAIN_URL" "Main"

log "Waiting 5 s for clusters to stabilise..."
sleep 5

create_bucket "$EDGE_URL" "Edge"
create_bucket "$MAIN_URL" "Main"

log "Waiting 10 s for buckets to be ready..."
sleep 10

set_indexer_mode "$EDGE_URL" "Edge"
set_indexer_mode "$MAIN_URL" "Main"

create_index "$EDGE_URL" "Edge" "8093"
create_index "$MAIN_URL" "Main" "8094"

setup_xdcr

setup_sync_gateway

echo ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log " Setup complete!"
log " Frontend :  http://localhost:3000"
log " Backend  :  http://localhost:8000"
log " Edge UI  :  http://localhost:8091  (Administrator / password)"
log " Main UI  :  http://localhost:8092  (Administrator / password)"
log " SGW API  :  http://localhost:4984"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
