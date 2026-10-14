#!/bin/bash
# WeChat gateway watchdog - keeps the OpenClaw gateway running.
# Run on a schedule (every 2 minutes works). Exits 0 when healthy,
# exits 1 only when a restart was attempted and failed.
#
# Override the health URL with GATEWAY_HEALTH_URL, e.g.
#   GATEWAY_HEALTH_URL=http://127.0.0.1:18789/health

HEALTH_URL="${GATEWAY_HEALTH_URL:-http://127.0.0.1:18789/health}"
LOG_FILE="$HOME/workspace/system/gateway-watchdog.log"
TOKEN_FILE="$HOME/.openclaw/.gateway-token"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Check if gateway is responding
if curl -s -m 10 "$HEALTH_URL" 2>/dev/null | grep -q '"ok":true'; then
  exit 0
fi

log "Gateway health check failed, attempting restart..."

# Kill any stale gateway processes (the real one, not wrappers)
for pid in $(pgrep -f "openclaw gateway" 2>/dev/null); do
  if ps -p "$pid" -o args= 2>/dev/null | grep -q "gateway --auth"; then
    log "Killing stale gateway PID $pid"
    kill "$pid" 2>/dev/null
  fi
done

sleep 5

if [ ! -f "$TOKEN_FILE" ]; then
  log "ERROR: Token file not found at $TOKEN_FILE"
  exit 1
fi

TOKEN=$(cat "$TOKEN_FILE")

log "Starting gateway..."
nohup openclaw gateway --auth token --token "$TOKEN" --port 18789 >> /tmp/openclaw-gateway-watchdog.log 2>&1 &
log "Gateway start initiated (PID $!), waiting for health..."

# Wait up to 90 seconds for gateway to become healthy
for _ in $(seq 1 18); do
  sleep 5
  if curl -s -m 10 "$HEALTH_URL" 2>/dev/null | grep -q '"ok":true'; then
    log "Gateway restarted successfully and healthy"
    exit 0
  fi
done

log "ERROR: Gateway failed to become healthy after restart"
exit 1
