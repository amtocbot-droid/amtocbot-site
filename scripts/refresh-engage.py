#!/usr/bin/env python3
"""
refresh-engage.py — Nightly pipeline to refresh engage.html audit tab.

Reads content.json to regenerate:
  - Summary stat cards (blog/video/short/podcast counts)
  - Podcast episodes table
  - YouTube videos table

Also:
  - Saves a dated snapshot of engage.html BEFORE any changes
  - Snapshots go to public/engage-snapshots/YYYY-MM-DD.html

Usage:
  python3 scripts/refresh-engage.py                  # normal run
  python3 scripts/refresh-engage.py --dry-run        # preview without writing
  python3 scripts/refresh-engage.py --snapshot-only   # just save today's snapshot
"""

import json
import re
import shutil
import sys
from datetime import datetime, date
from pathlib import Path
from html import escape

# ── Paths ──────────────────────────────────────────────────────────────────
SITE_DIR = Path(__file__).resolve().parent.parent
ENGAGE_HTML = SITE_DIR / "public" / "engage.html"
CONTENT_JSON = SITE_DIR / "public" / "assets" / "data" / "content.json"
SNAPSHOT_DIR = SITE_DIR / "public" / "engage-snapshots"

# Spotify show page (shared across all episodes)
SPOTIFY_SHOW = "https://open.spotify.com/show/2X82OW5nzyaXT0AQ7HZhHh"

# ── Data loading ───────────────────────────────────────────────────────────

def load_content():
    """Load and parse content.json, return structured counts and entries."""
    with open(CONTENT_JSON) as f:
        data = json.load(f)

    blogs = data.get("blogs", [])
    videos_raw = data.get("videos", [])
    tiktok_count = data.get("tiktokCount", 0)
    platform_count = data.get("platformCount", 0)

    # Split the mixed videos array by type
    podcasts = sorted(
        [v for v in videos_raw if v.get("type") == "podcast"],
        key=lambda v: v.get("id", ""),
    )
    videos = sorted(
        [v for v in videos_raw if v.get("type") == "video"],
        key=lambda v: v.get("id", ""),
    )
    shorts = sorted(
        [v for v in videos_raw if v.get("type") == "short"],
        key=lambda v: v.get("id", ""),
    )

    return {
        "blogs": blogs,
        "podcasts": podcasts,
        "videos": videos,
        "shorts": shorts,
        "tiktok_count": tiktok_count,
        "platform_count": platform_count,
    }


# ── HTML generators ────────────────────────────────────────────────────────

def fmt_date(iso_date: str) -> str:
    """'2026-04-08' -> 'Apr 8'"""
    try:
        d = datetime.strptime(iso_date, "%Y-%m-%d")
        return d.strftime("%b %-d")
    except (ValueError, TypeError):
        return iso_date or "—"


def youtube_url(entry: dict) -> str:
    """Extract YouTube URL from either youtubeUrl or youtubeId field."""
    if entry.get("youtubeUrl"):
        return entry["youtubeUrl"]
    if entry.get("youtubeId"):
        return f"https://youtu.be/{entry['youtubeId']}"
    return ""


def is_recent(iso_date: str, days: int = 3) -> bool:
    """Return True if the date is within the last N days (for row highlighting)."""
    try:
        d = datetime.strptime(iso_date, "%Y-%m-%d").date()
        return (date.today() - d).days <= days
    except (ValueError, TypeError):
        return False


def gen_stats(data: dict) -> str:
    """Generate the stat-grid HTML."""
    blog_count = len(data["blogs"])
    video_count = len(data["videos"])
    short_count = len(data["shorts"])
    podcast_count = len(data["podcasts"])
    tiktok = data["tiktok_count"]
    platforms = data["platform_count"]

    return f"""  <div class="stat-grid">
    <div class="stat-card"><div class="number">{blog_count}</div><div class="label">Blog Posts</div></div>
    <div class="stat-card"><div class="number">{video_count}</div><div class="label">YouTube Videos</div></div>
    <div class="stat-card"><div class="number">{short_count}</div><div class="label">YouTube Shorts</div></div>
    <div class="stat-card"><div class="number">{podcast_count}</div><div class="label">Podcast Episodes</div></div>
    <div class="stat-card"><div class="number">{tiktok}</div><div class="label">TikTok Posts</div></div>
    <div class="stat-card"><div class="number">{platforms}</div><div class="label">Platforms</div></div>
  </div>"""


def gen_podcasts(data: dict) -> str:
    """Generate the podcast episodes table HTML."""
    rows = []
    for p in data["podcasts"]:
        pid = escape(p.get("id", ""))
        title = escape(p.get("title", ""))
        duration = escape(p.get("duration", "—"))
        dt = fmt_date(p.get("date", ""))
        url = youtube_url(p)
        recent = is_recent(p.get("date", ""))

        yt_cell = f'<a href="{escape(url)}" target="_blank">YouTube</a>' if url else "Pending"
        # Mark as Spotify-linked if P001 or P002 (already uploaded), else Pending
        pid_num = int(pid[1:]) if pid[1:].isdigit() else 999
        spotify_cell = (
            f'<a href="{SPOTIFY_SHOW}" target="_blank">Spotify</a>'
            if pid_num <= 2
            else "Pending"
        )

        style = ' style="background:#0f2918;"' if recent else ""
        rows.append(
            f"      <tr{style}>\n"
            f"        <td>{pid}</td><td>{title}</td><td>{duration}</td>\n"
            f"        <td>{yt_cell}</td>\n"
            f"        <td>{spotify_cell}</td>\n"
            f'        <td class="audit-date">{dt}</td>\n'
            f"      </tr>"
        )

    max_id = max((p.get("id", "P000") for p in data["podcasts"]), default="P000")
    return (
        f'  <div class="section">\n'
        f'    <div class="section-title"><span class="icon">&#127911;</span> Podcast Episodes (Bot Thoughts)</div>\n'
        f'    <table class="audit-table">\n'
        f"      <tr><th>#</th><th>Title</th><th>Duration</th><th>YouTube</th><th>Spotify</th><th>Date</th></tr>\n"
        + "\n".join(rows)
        + "\n    </table>\n  </div>"
    )


def gen_videos(data: dict) -> str:
    """Generate the YouTube videos table HTML."""
    rows = []
    for v in data["videos"]:
        vid = escape(v.get("id", ""))
        title = escape(v.get("title", ""))
        dt = fmt_date(v.get("date", ""))
        url = youtube_url(v)
        recent = is_recent(v.get("date", ""))

        yt_cell = f'<a href="{escape(url)}" target="_blank">Link</a>' if url else "—"
        style = ' style="background:#0f2918;"' if recent else ""
        rows.append(
            f"      <tr{style}><td>{vid}</td><td>{title}</td><td>{yt_cell}</td>"
            f'<td class="audit-date">{dt}</td></tr>'
        )

    first_id = data["videos"][0]["id"] if data["videos"] else "V001"
    last_id = data["videos"][-1]["id"] if data["videos"] else "V001"
    return (
        f'  <div class="section">\n'
        f'    <div class="section-title"><span class="icon">&#127909;</span> YouTube Videos ({first_id}-{last_id})</div>\n'
        f'    <table class="audit-table">\n'
        f"      <tr><th>#</th><th>Title</th><th>YouTube</th><th>Date</th></tr>\n"
        + "\n".join(rows)
        + "\n    </table>\n  </div>"
    )


# ── Marker replacement engine ──────────────────────────────────────────────

def replace_section(html: str, section: str, new_content: str) -> str:
    """Replace content between <!-- AUTO:{section}:BEGIN --> and <!-- AUTO:{section}:END -->."""
    pattern = re.compile(
        rf"(  <!-- AUTO:{section}:BEGIN -->\n)(.*?)(  <!-- AUTO:{section}:END -->)",
        re.DOTALL,
    )
    match = pattern.search(html)
    if not match:
        print(f"  ⚠  Marker AUTO:{section} not found — skipping")
        return html
    return pattern.sub(rf"\g<1>{new_content}\n\g<3>", html)


# ── Snapshot ───────────────────────────────────────────────────────────────

def save_snapshot():
    """Copy current engage.html to engage-snapshots/YYYY-MM-DD.html."""
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()
    dest = SNAPSHOT_DIR / f"{today}.html"
    if dest.exists():
        print(f"  📸 Snapshot already exists: {dest.name}")
        return dest
    shutil.copy2(ENGAGE_HTML, dest)
    print(f"  📸 Snapshot saved: {dest.name}")
    return dest


# ── Snapshot index page ────────────────────────────────────────────────────

def rebuild_snapshot_index():
    """Generate engage-snapshots/index.html listing all dated snapshots."""
    NL = "\n"
    snapshots = sorted(SNAPSHOT_DIR.glob("20*.html"), reverse=True)
    rows = []
    for s in snapshots:
        name = s.stem  # e.g. "2026-04-08"
        size_kb = s.stat().st_size / 1024
        rows.append(
            f'      <tr><td><a href="{s.name}">{name}</a></td>'
            f"<td>{size_kb:.0f} KB</td></tr>"
        )

    index_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Engage.html Snapshots</title>
  <style>
    body {{ background: #0b1120; color: #e2e8f0; font-family: system-ui, sans-serif; padding: 2rem; }}
    h1 {{ color: #60a5fa; }}
    table {{ border-collapse: collapse; margin-top: 1rem; }}
    th, td {{ padding: 0.5rem 1.5rem; border-bottom: 1px solid #1e293b; text-align: left; }}
    th {{ color: #60a5fa; border-bottom: 2px solid #334155; }}
    a {{ color: #93c5fd; text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
    .meta {{ color: #64748b; font-size: 0.85rem; margin-top: 0.5rem; }}
  </style>
</head>
<body>
  <h1>Engage.html Daily Snapshots</h1>
  <p class="meta">Auto-generated by refresh-engage.py &mdash; {len(snapshots)} snapshots</p>
  <table>
    <tr><th>Date</th><th>Size</th></tr>
{NL.join(rows) if rows else "    <tr><td colspan='2'>No snapshots yet</td></tr>"}
  </table>
</body>
</html>"""

    index_path = SNAPSHOT_DIR / "index.html"
    index_path.write_text(index_html)
    print(f"  📋 Snapshot index rebuilt: {len(snapshots)} entries")


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    dry_run = "--dry-run" in sys.argv
    snapshot_only = "--snapshot-only" in sys.argv

    print(f"🔄 refresh-engage.py — {date.today().isoformat()}")

    if not ENGAGE_HTML.exists():
        print(f"  ❌ engage.html not found at {ENGAGE_HTML}")
        sys.exit(1)
    if not CONTENT_JSON.exists():
        print(f"  ❌ content.json not found at {CONTENT_JSON}")
        sys.exit(1)

    # Step 1: Always snapshot first
    save_snapshot()

    if snapshot_only:
        rebuild_snapshot_index()
        print("  ✅ Snapshot-only mode — done")
        return

    # Step 2: Load data
    data = load_content()
    print(
        f"  📊 Found: {len(data['blogs'])} blogs, {len(data['videos'])} videos, "
        f"{len(data['shorts'])} shorts, {len(data['podcasts'])} podcasts"
    )

    # Step 3: Generate new HTML sections
    new_stats = gen_stats(data)
    new_podcasts = gen_podcasts(data)
    new_videos = gen_videos(data)

    # Step 4: Read current HTML and replace sections
    html = ENGAGE_HTML.read_text()
    html = replace_section(html, "STATS", new_stats)
    html = replace_section(html, "PODCASTS", new_podcasts)
    html = replace_section(html, "VIDEOS", new_videos)

    if dry_run:
        print("\n  🧪 DRY RUN — would write the following changes:")
        print(f"     Stats: {len(data['blogs'])} blogs, {len(data['videos'])} videos, "
              f"{len(data['shorts'])} shorts, {len(data['podcasts'])} podcasts")
        print(f"     Podcasts table: {len(data['podcasts'])} rows")
        print(f"     Videos table: {len(data['videos'])} rows")
        print("  ✅ No files modified")
        return

    # Step 5: Write updated HTML
    ENGAGE_HTML.write_text(html)
    print(f"  ✏️  engage.html updated")

    # Step 6: Rebuild snapshot index
    rebuild_snapshot_index()

    print("  ✅ Done")


if __name__ == "__main__":
    main()
