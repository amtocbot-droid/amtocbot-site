#!/usr/bin/env python3
"""
scrape-metrics.py — Scrape YouTube + Blogger engagement metrics.

Reads content.json, fetches stats from APIs, writes updated numbers
back to content.json and content-tracker.md.

Usage:
  python3 scripts/scrape-metrics.py                # scrape all
  python3 scripts/scrape-metrics.py --youtube       # YouTube only
  python3 scripts/scrape-metrics.py --blogger       # Blogger only
  python3 scripts/scrape-metrics.py --dry-run       # preview changes
  python3 scripts/scrape-metrics.py --report-url URL  # POST summary to URL
"""

import argparse
import json
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path

try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
except ImportError:
    print("Error: Missing dependencies. Run:")
    print("  pip3 install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client")
    sys.exit(1)

# ── Paths ──────────────────────────────────────────────────────
SITE_DIR = Path(__file__).resolve().parent.parent
CONTENT_DIR = Path("/Users/amtoc/amtocsoft-content")
CONTENT_JSON = SITE_DIR / "public" / "assets" / "data" / "content.json"
CONTENT_TRACKER = CONTENT_DIR / "metrics" / "content-tracker.md"

CONFIG_DIR = os.path.expanduser("~/.config/amtocsoft")
CLIENT_SECRETS = os.path.join(CONFIG_DIR, "client_secrets.json")
YT_TOKEN_FILE = os.path.join(CONFIG_DIR, "youtube_token.json")
BLOGGER_TOKEN_FILE = os.path.join(CONFIG_DIR, "blogger_token.json")

BLOG_ID = "1674696478057813305"

YT_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",
]
BLOGGER_SCOPES = [
    "https://www.googleapis.com/auth/blogger.readonly",
]


# ── Auth ───────────────────────────────────────────────────────

def get_google_service(api_name, api_version, scopes, token_file):
    """Authenticate and return a Google API service."""
    os.makedirs(CONFIG_DIR, exist_ok=True)

    if not os.path.exists(CLIENT_SECRETS):
        print(f"  ❌ client_secrets.json not found at: {CLIENT_SECRETS}")
        return None

    creds = None
    if os.path.exists(token_file):
        creds = Credentials.from_authorized_user_file(token_file, scopes)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print(f"  🔄 Refreshing {api_name} token...")
            creds.refresh(Request())
        else:
            print(f"  🌐 Opening browser for {api_name} OAuth login...")
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRETS, scopes)
            creds = flow.run_local_server(port=0, open_browser=True)

        with open(token_file, "w") as f:
            f.write(creds.to_json())
        print(f"  ✅ Token saved to {token_file}")

    return build(api_name, api_version, credentials=creds)


# ── YouTube Scraping ───────────────────────────────────────────

def scrape_youtube(content_data):
    """Fetch YouTube stats for all videos/podcasts/shorts in content.json."""
    youtube = get_google_service("youtube", "v3", YT_SCOPES, YT_TOKEN_FILE)
    if not youtube:
        print("  ⚠  YouTube: skipping (auth failed)")
        return {}, 0

    # Collect all YouTube video IDs from content.json
    video_ids = {}
    for entry in content_data.get("videos", []):
        yt_id = entry.get("youtubeId")
        if not yt_id:
            url = entry.get("youtubeUrl", "")
            if "youtu.be/" in url:
                yt_id = url.split("youtu.be/")[-1].split("?")[0]
            elif "youtube.com/shorts/" in url:
                yt_id = url.split("/shorts/")[-1].split("?")[0]
        if yt_id:
            video_ids[yt_id] = entry["id"]

    if not video_ids:
        print("  ⚠  YouTube: no video IDs found in content.json")
        return {}, 0

    # Batch API calls (max 50 IDs per request)
    stats = {}
    id_list = list(video_ids.keys())
    for i in range(0, len(id_list), 50):
        batch = id_list[i : i + 50]
        response = youtube.videos().list(
            part="statistics",
            id=",".join(batch),
        ).execute()

        for item in response.get("items", []):
            yt_id = item["id"]
            s = item["statistics"]
            content_id = video_ids[yt_id]
            stats[content_id] = {
                "views": int(s.get("viewCount", 0)),
                "likes": int(s.get("likeCount", 0)),
                "comments": int(s.get("commentCount", 0)),
            }

    total_views = sum(s["views"] for s in stats.values())
    print(f"  📺 YouTube: fetched stats for {len(stats)} items ({total_views:,} total views)")
    return stats, total_views


# ── Blogger Scraping ───────────────────────────────────────────

def scrape_blogger(content_data):
    """Fetch Blogger pageview stats."""
    blogger = get_google_service("blogger", "v3", BLOGGER_SCOPES, BLOGGER_TOKEN_FILE)
    if not blogger:
        print("  ⚠  Blogger: skipping (auth failed)")
        return {}, 0

    try:
        # Get blog-level pageview totals
        pageviews = blogger.pageViews().get(blogId=BLOG_ID).execute()
        total_views = 0
        for count in pageviews.get("counts", []):
            if count.get("timeRange") == "ALL_TIME":
                total_views = int(count.get("count", 0))

        print(f"  📝 Blogger: {total_views:,} all-time page views (blog-level total)")
        return {"_blog_total": total_views}, total_views

    except Exception as e:
        print(f"  ⚠  Blogger: API error — {e}")
        return {}, 0


# ── Update content.json ───────────────────────────────────────

def update_content_json(content_data, yt_stats, blogger_stats, dry_run):
    """Merge scraped stats into content.json."""
    today = date.today().isoformat()
    changes = 0

    for entry in content_data.get("videos", []):
        cid = entry["id"]
        if cid in yt_stats:
            for key, val in yt_stats[cid].items():
                if entry.get(key) != val:
                    entry[key] = val
                    changes += 1
            entry["lastScraped"] = today

    # Blogger blog-level total
    if "_blog_total" in blogger_stats:
        content_data["blogPageViews"] = blogger_stats["_blog_total"]
        content_data["blogLastScraped"] = today
        changes += 1

    if changes == 0:
        print("  📊 content.json: no changes")
        return False

    if dry_run:
        print(f"  📊 content.json: would update {changes} fields (dry run)")
        return False

    with open(CONTENT_JSON, "w") as f:
        json.dump(content_data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"  📊 content.json: updated {changes} fields")
    return True


# ── Update content-tracker.md ──────────────────────────────────

def update_content_tracker(yt_stats, dry_run):
    """Update the Video Metrics table in content-tracker.md with YouTube stats."""
    if not CONTENT_TRACKER.exists():
        print("  ⚠  content-tracker.md not found — skipping")
        return False

    text = CONTENT_TRACKER.read_text()
    changes = 0

    # Find video metrics rows and update views column (3rd column after # and Title)
    for cid, stats in yt_stats.items():
        if not cid.startswith(("V", "P", "S")):
            continue
        # Match the row by ID in the first column, replace first dash with view count
        pattern = re.compile(
            rf"(\|\s*{re.escape(cid)}\s*\|[^|]*\|)\s*-\s*(\|)",
        )
        if pattern.search(text):
            text = pattern.sub(
                rf"\g<1> {stats['views']:,} \g<2>",
                text,
                count=1,
            )
            changes += 1

    if changes == 0:
        print("  📋 content-tracker.md: no changes")
        return False

    if dry_run:
        print(f"  📋 content-tracker.md: would update {changes} rows (dry run)")
        return False

    CONTENT_TRACKER.write_text(text)
    print(f"  📋 content-tracker.md: updated {changes} rows")
    return True


# ── Summary & Report ───────────────────────────────────────────

def build_summary(yt_stats, yt_total, blogger_stats, blogger_total):
    """Build a human-readable summary string."""
    parts = []
    if yt_stats:
        top = max(yt_stats.items(), key=lambda x: x[1]["views"])
        parts.append(f"YouTube: {len(yt_stats)} items ({yt_total:,} views, top: {top[0]} with {top[1]['views']:,})")
    if blogger_stats:
        parts.append(f"Blogger: {blogger_total:,} all-time views")
    return ". ".join(parts) if parts else "No data scraped"


def post_metrics_to_d1(url, yt_stats, blogger_stats):
    """POST scraped metrics to /api/admin/content/metrics."""
    import urllib.request

    payload = json.dumps({
        "youtube": {cid: stats for cid, stats in yt_stats.items()},
        "blogger": {"total_views": blogger_stats.get("_blog_total", 0)} if blogger_stats else None,
    }).encode()

    token = os.environ.get("SYNC_SECRET", "")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "AmtocSoft-Scraper/1.0",
        },
    )
    try:
        resp = urllib.request.urlopen(req)
        result = json.loads(resp.read())
        print(f"  📤 D1 metrics: updated {result.get('updated', 0)} items")
        return True
    except Exception as e:
        print(f"  ⚠  Failed to post metrics to D1: {e}")
        return False


def post_report(url, summary, started, status):
    """POST run summary to the automation log endpoint."""
    import urllib.request

    payload = json.dumps({
        "job": "metrics-scrape",
        "status": status,
        "summary": summary,
        "started_at": started,
        "finished_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "trigger": os.environ.get("TRIGGER_TYPE", "cron"),
    }).encode()

    token = os.environ.get("SYNC_SECRET", "")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "AmtocSoft-Scraper/1.0",
        },
    )
    try:
        urllib.request.urlopen(req)
        print(f"  📤 Report posted to {url}")
    except Exception as e:
        print(f"  ⚠  Failed to post report: {e}")


# ── Main ───────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Scrape YouTube + Blogger metrics")
    parser.add_argument("--youtube", action="store_true", help="YouTube only")
    parser.add_argument("--blogger", action="store_true", help="Blogger only")
    parser.add_argument("--all", action="store_true", help="Both (default)")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--report-url", default=None, help="POST summary to this URL")
    parser.add_argument("--metrics-url", default=None, help="POST metrics to D1 content/metrics endpoint")
    args = parser.parse_args()

    do_youtube = args.youtube or args.all or (not args.youtube and not args.blogger)
    do_blogger = args.blogger or args.all or (not args.youtube and not args.blogger)

    started = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"🔄 scrape-metrics.py — {date.today().isoformat()}")

    if not CONTENT_JSON.exists():
        print(f"  ❌ content.json not found at {CONTENT_JSON}")
        sys.exit(1)

    with open(CONTENT_JSON) as f:
        content_data = json.load(f)

    yt_stats, yt_total = {}, 0
    blogger_stats, blogger_total = {}, 0

    if do_youtube:
        yt_stats, yt_total = scrape_youtube(content_data)

    if do_blogger:
        blogger_stats, blogger_total = scrape_blogger(content_data)

    # Update files
    json_changed = update_content_json(content_data, yt_stats, blogger_stats, args.dry_run)
    tracker_changed = update_content_tracker(yt_stats, args.dry_run)

    summary = build_summary(yt_stats, yt_total, blogger_stats, blogger_total)
    status = "success" if (yt_stats or blogger_stats) else "no_data"

    # Post metrics to D1
    if args.metrics_url and (yt_stats or blogger_stats):
        post_metrics_to_d1(args.metrics_url, yt_stats, blogger_stats)

    print(f"\n  📊 Summary: {summary}")

    if args.report_url:
        post_report(args.report_url, summary, started, status)

    if json_changed or tracker_changed:
        print("  ✅ Files updated")
    else:
        print("  ✅ Done (no file changes)")


if __name__ == "__main__":
    main()
