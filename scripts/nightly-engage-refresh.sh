#!/bin/bash
# nightly-engage-refresh.sh — Run by cron at 2:00 AM ET
# Refreshes engage.html audit tab from content.json, saves daily snapshot,
# and auto-commits + pushes if anything changed.

set -euo pipefail

SITE_DIR="/Users/amtoc/amtocbot-site"
LOG_FILE="$SITE_DIR/scripts/refresh.log"

echo "========================================" >> "$LOG_FILE"
echo "$(date '+%Y-%m-%d %H:%M:%S') — Starting nightly refresh" >> "$LOG_FILE"

cd "$SITE_DIR"

# Run the refresh script
python3 scripts/refresh-engage.py >> "$LOG_FILE" 2>&1

# Check if engage.html or snapshots changed
if git diff --quiet public/engage.html && git diff --quiet --cached; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') — No changes detected" >> "$LOG_FILE"
else
    # Stage and commit
    git add public/engage.html public/engage-snapshots/
    git commit -m "chore: nightly engage.html audit refresh ($(date '+%Y-%m-%d'))" >> "$LOG_FILE" 2>&1
    echo "$(date '+%Y-%m-%d %H:%M:%S') — Committed changes" >> "$LOG_FILE"

    # Push to remote
    git push >> "$LOG_FILE" 2>&1
    echo "$(date '+%Y-%m-%d %H:%M:%S') — Pushed to remote" >> "$LOG_FILE"
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') — Done" >> "$LOG_FILE"
