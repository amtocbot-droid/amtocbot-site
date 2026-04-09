#!/bin/bash
# weekly-calendar-generate.sh — Run by cron Sunday 11:00 PM ET
# Checks D1 flags, triggers calendar proposal generation, logs result.

set -euo pipefail

SITE_DIR="/Users/amtoc/amtocbot-site"
LOG_FILE="$SITE_DIR/scripts/calendar-generate.log"
API_BASE="https://amtocbot.com/api/admin"

# Load SYNC_SECRET from .env
if [ -f "$SITE_DIR/.env" ]; then
    export $(grep -v '^#' "$SITE_DIR/.env" | xargs)
fi

echo "========================================" >> "$LOG_FILE"
echo "$(date '+%Y-%m-%d %H:%M:%S') — Starting calendar generation" >> "$LOG_FILE"

# Check pause flag
PAUSED=$(curl -sf -H "Authorization: Bearer ${SYNC_SECRET:-}" \
    "$API_BASE/automation/status?job=calendar-generate" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['jobs']['calendar-generate']['paused'])" 2>/dev/null \
    || echo "false")

if [ "$PAUSED" = "True" ] || [ "$PAUSED" = "true" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') — Skipped (paused)" >> "$LOG_FILE"
    exit 0
fi

# Check trigger flag
TRIGGERED=$(curl -sf -H "Authorization: Bearer ${SYNC_SECRET:-}" \
    "$API_BASE/automation/status?job=calendar-generate" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['jobs']['calendar-generate']['trigger_requested'])" 2>/dev/null \
    || echo "false")

if [ "$TRIGGERED" = "True" ] || [ "$TRIGGERED" = "true" ]; then
    TRIGGER_TYPE="trigger-flag"
else
    TRIGGER_TYPE="cron"
fi

# Generate proposal
STARTED=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
RESULT=$(curl -sf -X POST "$API_BASE/calendar/generate" \
    -H "Authorization: Bearer ${SYNC_SECRET:-}" \
    -H "Content-Type: application/json" \
    -H "User-Agent: AmtocSoft-Planner/1.0" \
    -d "{\"trigger_type\": \"$TRIGGER_TYPE\"}" 2>&1) || {
    echo "$(date '+%Y-%m-%d %H:%M:%S') — Generation failed" >> "$LOG_FILE"

    # Log failure
    curl -sf -X POST "$API_BASE/automation/log" \
        -H "Authorization: Bearer ${SYNC_SECRET:-}" \
        -H "Content-Type: application/json" \
        -H "User-Agent: AmtocSoft-Planner/1.0" \
        -d "{\"job\": \"calendar-generate\", \"status\": \"failed\", \"summary\": \"Generation request failed\", \"started_at\": \"$STARTED\", \"finished_at\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\", \"trigger\": \"$TRIGGER_TYPE\"}" 2>/dev/null || true

    exit 1
}

TRENDS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('trends_count', 0))" 2>/dev/null || echo "0")
ITEMS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('items', [])))" 2>/dev/null || echo "0")
SUMMARY="Generated proposal: $ITEMS items, $TRENDS trends scraped"

echo "$(date '+%Y-%m-%d %H:%M:%S') — $SUMMARY" >> "$LOG_FILE"

# Log success
curl -sf -X POST "$API_BASE/automation/log" \
    -H "Authorization: Bearer ${SYNC_SECRET:-}" \
    -H "Content-Type: application/json" \
    -H "User-Agent: AmtocSoft-Planner/1.0" \
    -d "{\"job\": \"calendar-generate\", \"status\": \"success\", \"summary\": \"$SUMMARY\", \"started_at\": \"$STARTED\", \"finished_at\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\", \"trigger\": \"$TRIGGER_TYPE\"}" 2>/dev/null || true

echo "$(date '+%Y-%m-%d %H:%M:%S') — Done" >> "$LOG_FILE"
