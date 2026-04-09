#!/bin/bash
# nightly-metrics-scrape.sh — Run by cron at 1:30 AM ET
# Checks D1 flags, runs scrape-metrics.py, auto-commits, logs result.

set -euo pipefail

SITE_DIR="/Users/amtoc/amtocbot-site"
CONTENT_DIR="/Users/amtoc/amtocsoft-content"
LOG_FILE="$SITE_DIR/scripts/metrics-scrape.log"
API_BASE="https://amtocbot.com/api/admin/automation"

# Load SYNC_SECRET from .env or environment
if [ -f "$SITE_DIR/.env" ]; then
    export $(grep -v '^#' "$SITE_DIR/.env" | xargs)
fi

echo "========================================" >> "$LOG_FILE"
echo "$(date '+%Y-%m-%d %H:%M:%S') — Starting metrics scrape" >> "$LOG_FILE"

cd "$SITE_DIR"

# Check pause flag
PAUSED=$(curl -sf -H "Authorization: Bearer ${SYNC_SECRET:-}" \
    "$API_BASE/status?job=metrics-scrape" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['jobs']['metrics-scrape']['paused'])" 2>/dev/null \
    || echo "false")

if [ "$PAUSED" = "True" ] || [ "$PAUSED" = "true" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') — Skipped (paused)" >> "$LOG_FILE"
    exit 0
fi

# Check trigger flag (determines trigger_type for logging)
TRIGGERED=$(curl -sf -H "Authorization: Bearer ${SYNC_SECRET:-}" \
    "$API_BASE/status?job=metrics-scrape" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['jobs']['metrics-scrape']['trigger_requested'])" 2>/dev/null \
    || echo "false")

if [ "$TRIGGERED" = "True" ] || [ "$TRIGGERED" = "true" ]; then
    export TRIGGER_TYPE="trigger-flag"
else
    export TRIGGER_TYPE="cron"
fi

# Run the scraper
python3 scripts/scrape-metrics.py --all \
    --report-url "$API_BASE/log" \
    --metrics-url "https://amtocbot.com/api/admin/content/metrics" \
    >> "$LOG_FILE" 2>&1 || {
    echo "$(date '+%Y-%m-%d %H:%M:%S') — Scraper failed" >> "$LOG_FILE"
    exit 1
}

# Auto-commit content.json if changed
if ! git diff --quiet public/assets/data/content.json 2>/dev/null; then
    git add public/assets/data/content.json
    git commit -m "chore: nightly metrics update ($(date '+%Y-%m-%d'))" >> "$LOG_FILE" 2>&1
    git push >> "$LOG_FILE" 2>&1
    echo "$(date '+%Y-%m-%d %H:%M:%S') — Site repo pushed" >> "$LOG_FILE"
fi

# Auto-commit content-tracker.md if changed
cd "$CONTENT_DIR"
if ! git diff --quiet metrics/content-tracker.md 2>/dev/null; then
    git add metrics/content-tracker.md
    git commit -m "chore: nightly metrics update ($(date '+%Y-%m-%d'))" >> "$LOG_FILE" 2>&1
    git push >> "$LOG_FILE" 2>&1
    echo "$(date '+%Y-%m-%d %H:%M:%S') — Content repo pushed" >> "$LOG_FILE"
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') — Done" >> "$LOG_FILE"
