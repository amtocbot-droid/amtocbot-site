#!/bin/bash
# nightly-engage-refresh.sh — Run by cron at 2:00 AM ET
# Refreshes engage.html audit tab from content.json, saves daily snapshot,
# checks D1 pause flag, and logs run result.

set -euo pipefail

SITE_DIR="/Users/amtoc/amtocbot-site"
LOG_FILE="$SITE_DIR/scripts/refresh.log"
API_BASE="https://amtocbot.com/api/admin/automation"
STARTED=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

# Load SYNC_SECRET from .env or environment
if [ -f "$SITE_DIR/.env" ]; then
    export $(grep -v '^#' "$SITE_DIR/.env" | xargs)
fi

echo "========================================" >> "$LOG_FILE"
echo "$(date '+%Y-%m-%d %H:%M:%S') — Starting nightly refresh" >> "$LOG_FILE"

cd "$SITE_DIR"

# Check pause flag
PAUSED=$(curl -sf -H "Authorization: Bearer ${SYNC_SECRET:-}" \
    "$API_BASE/status?job=engage-refresh" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['jobs']['engage-refresh']['paused'])" 2>/dev/null \
    || echo "false")

if [ "$PAUSED" = "True" ] || [ "$PAUSED" = "true" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') — Skipped (paused)" >> "$LOG_FILE"
    exit 0
fi

# Run the refresh script
python3 scripts/refresh-engage.py >> "$LOG_FILE" 2>&1

# Check if engage.html or snapshots changed
SUMMARY="No changes"
if git diff --quiet public/engage.html && git diff --quiet --cached; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') — No changes detected" >> "$LOG_FILE"
else
    # Stage and commit
    git add public/engage.html public/engage-snapshots/
    git commit -m "chore: nightly engage.html audit refresh ($(date '+%Y-%m-%d'))" >> "$LOG_FILE" 2>&1
    echo "$(date '+%Y-%m-%d %H:%M:%S') — Committed changes" >> "$LOG_FILE"

    git push >> "$LOG_FILE" 2>&1
    echo "$(date '+%Y-%m-%d %H:%M:%S') — Pushed to remote" >> "$LOG_FILE"
    SUMMARY="Refreshed and pushed"
fi

# Log run result to D1
FINISHED=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
curl -sf -X POST "$API_BASE/log" \
    -H "Authorization: Bearer ${SYNC_SECRET:-}" \
    -H "Content-Type: application/json" \
    -d "{\"job\":\"engage-refresh\",\"status\":\"success\",\"summary\":\"$SUMMARY\",\"started_at\":\"$STARTED\",\"finished_at\":\"$FINISHED\",\"trigger\":\"cron\"}" \
    >> "$LOG_FILE" 2>&1 || echo "  ⚠  Failed to log run to D1" >> "$LOG_FILE"

echo "$(date '+%Y-%m-%d %H:%M:%S') — Done" >> "$LOG_FILE"
