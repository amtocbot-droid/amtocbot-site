# amtocbot.com Redesign + Referral Admin UI — Design Spec

**Date:** 2026-04-10
**Status:** Approved

---

## Overview

Two parallel workstreams:

1. **amtocbot.com redesign** — new theme system (3 user-selectable themes), restructured nav, split-hero homepage, improved inner pages (Blog, Videos, Podcasts, Metrics)
2. **Referral admin UI + audit log** — new Dashboard tab for admin users to manage amtocsoft.com referral codes and view a full audit trail

These are implemented as two separate plans (Plan A: redesign, Plan B: referral admin).

---

## Part A — Site Redesign (amtocbot.com)

### A1. Theme System

**Approach:** CSS custom properties on `<body>` + a `ThemeService` that reads/writes to `localStorage`.

**Three themes (CSS body classes):**

| Theme class | Background | Surface | Accent | Text |
|---|---|---|---|---|
| `theme-warm-glow` (default) | `#0a0a0a` | `rgba(255,255,255,0.04)` | `#fb923c → #f43f5e` (gradient) | `#e2e8f0` |
| `theme-dark-tech` | `#0f0f23` | `rgba(255,255,255,0.05)` | `#7c3aed` | `#e2e8f0` |
| `theme-light` | `#f8fafc` | `#ffffff` | `#6366f1` | `#1e293b` |

**CSS custom properties set per theme on `body`:**
```css
--bg-primary       /* page background */
--bg-surface       /* card/panel background */
--bg-surface-hover /* card hover state */
--border-color     /* subtle borders */
--accent           /* primary accent color (solid) */
--accent-gradient  /* gradient string for CTAs */
--text-primary     /* headings */
--text-secondary   /* body / muted */
--text-accent      /* accent-colored text */
```

**ThemeService (`src/app/shared/services/theme.service.ts`):**
- Signal: `currentTheme` (default: `'theme-warm-glow'`)
- `setTheme(theme)` — applies class to `document.body`, persists to `localStorage`
- `loadTheme()` — reads from `localStorage` on init, falls back to default
- Called from `APP_INITIALIZER`

**Theme switcher UI:** Floating button group, bottom-right corner, three color swatches (orange, purple, indigo/white). Implemented as a standalone `ThemeToggleComponent` included in `SiteLayoutComponent`.

---

### A2. Navigation (`SiteLayoutComponent`)

**Desktop header (left → right):**
1. Logo: lightbulb icon + "AmtocSoft" wordmark
2. `Learn ▾` dropdown → Blog, Videos, Podcasts
3. `Community ▾` dropdown → About, Resources, Metrics
4. Spacer
5. Theme toggle (3 swatches inline, no label)
6. `Get Courses →` pill button — links to `https://amtocsoft.com/#pricing`, orange/coral gradient across all themes

**Mobile:** Hamburger → full-screen drawer. Same link groups as collapsible sections. Theme swatches at the bottom of the drawer.

**Removed from public nav:** Dashboard, Admin (accessible via direct URL only).

**Dropdowns:** Pure CSS hover dropdowns (no Angular Material Menu — avoids overlay complexity). On mobile, each section is a collapsible `<details>` element.

---

### A3. Homepage (`HomeComponent`)

#### Hero (split, above fold)

**Left column (60%):**
- Eyebrow label: "AI · Security · Performance" in `--text-accent`
- H1: "Tech Education Without the Noise" — last word uses `--accent-gradient`
- Subline: "Deep-dive blogs, videos & podcasts. Beginner to professional."
- Stat pills (live from `/api/content-stats`): `{blogs} posts · {videos} videos · {platforms} platforms`
- CTAs: "Browse Content" (primary, gradient bg) + "Subscribe" (ghost, accent border)

**Right column (40%):**
- Three stacked content tiles: Latest Blog, Latest Video, Latest Podcast
- Each tile: type icon + topic tag + title + "Read / Watch / Listen →" link
- Data from existing `ContentService`

#### Below the fold (scroll order)

1. **Stats bar** — animated count-up on scroll entry: Posts, Videos, Shorts, Podcasts, TikTok, Platforms. Data from `/api/content-stats`.

2. **Content section** — tabbed component (Blog / Video / Podcast tabs):
   - 6 cards per tab
   - "View all →" RouterLink per tab
   - Cards: topic color-coded left border, level badge, date, title

3. **Course promo card** — inline card inside the content section grid, spanning full width. Glassmorphic style with `--accent-gradient` border. Copy: "Level up with structured courses → amtocsoft.com". Lists 3–4 module names. CTA: "Browse Courses" → `https://amtocsoft.com/#pricing`.

4. **Newsletter signup** — centered row: "Get AI insights weekly" + email input + Subscribe button. Calls existing `/api/subscribe`.

5. **Platforms grid** — "Find Us Everywhere" — platform icon links (existing data from `ContentService.platforms()`).

---

### A4. Blog Page (`BlogComponent`)

**Filter bar (new):**
- Search input — filters by title client-side
- Topic chip filters: All, AI/LLMs, Security, Performance, Software Engineering, Quant
- Level filter: All, Beginner, Intermediate, Advanced, Professional
- All filtering is client-side (no API changes)

**Card design (improved):**
- Left color border keyed to topic (orange=AI, red=Security, blue=Performance, green=SWE, purple=Quant)
- Level badge (colored chip)
- Date + read time estimate (approx: `Math.ceil(wordCount/200)` — use fixed 5 min if not available)
- Title (bold, 2 lines max with ellipsis)
- "Read →" link to `blogUrl`

**Layout:** Responsive grid, 3 cols desktop / 2 tablet / 1 mobile.

---

### A5. Videos Page (`VideosComponent`)

**Filter bar (new):**
- Type toggle: All / Full Videos / Shorts

**Card design (improved):**
- Thumbnail (YouTube hqdefault) with duration badge overlay (bottom-right)
- Title (2 lines max)
- Date
- "Watch →" link

**Layout:** Same responsive grid as Blog.

---

### A6. Podcasts Page (`PodcastsComponent`)

**Layout change:** Grid → episode list (vertical stack).

**Each episode row:**
- Episode number badge
- Title
- Duration (if available)
- Platform links: Spotify icon link
- "Listen →" external link

Simpler than a card grid — audio content suits a list format.

---

### A7. Metrics Page (`MetricsComponent`)

**Restyle only** — same data, new card design:
- Platform stat cards: icon + platform name + follower count + total views + last updated
- Cards use `--bg-surface`, `--border-color`, `--text-accent` for values
- No layout changes

---

## Part B — Referral Admin UI + Audit Log

### B1. Database Changes (amtocsoft.com D1)

New table in `amtocsoft-db`:

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,        -- 'code_created', 'code_validated', 'code_redeemed', 'review_moderated'
  code TEXT,                   -- referral code involved (nullable)
  actor TEXT,                  -- email (admin) or IP (public action)
  result TEXT,                 -- 'success', 'invalid', 'already_used', etc.
  detail TEXT,                 -- JSON blob for extra context
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_code ON audit_log(code);
```

### B2. amtocsoft.com Worker Changes (`_worker.js`)

**Write audit entries** on:
- `POST /api/admin/referral` → log `code_created`, actor = request IP
- `GET /api/referral/validate` → log `code_validated`, result = valid/invalid/already_used
- `POST /api/checkout` (when referral applied) → log `code_redeemed`, actor = IP
- `POST /api/admin/review` → log `review_moderated`

**New endpoints:**

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/referrals` | `X-Admin-Key` | List all referral codes, paginated (limit/offset), filterable by `used` param |
| `GET` | `/api/admin/audit` | `X-Admin-Key` | List audit log entries, paginated, filterable by `code` and `action` params |

Both return JSON with `{ items: [...], total: N }`.

### B3. Dashboard Tab (amtocbot.com)

New **"Referrals"** tab in `DashboardComponent`, visible to `admin` role only.

**Implementation:** New standalone component `ReferralsTabComponent` at `src/app/features/dashboard/referrals-tab/referrals-tab.component.ts`.

The component does **not** call amtocsoft.com directly (that would expose the admin key in the compiled JS bundle). Instead it calls a proxy endpoint on the amtocbot worker: `POST /api/proxy/amtocsoft` with the action in the body. The amtocbot worker adds the `X-Admin-Key` header server-side using a `AMTOCSOFT_ADMIN_KEY` Cloudflare Pages secret, then forwards to amtocsoft.com. The amtocbot dashboard already requires admin auth, so the proxy is gated by the existing session check.

**Tab layout:**

**Create Code panel (top):**
- Text input: "Custom code (optional — leave blank to auto-generate)"
- Radio: "$5 off (modules)" / "$10 off (bundle)"
- Text input: "Note (optional)"
- "Create Code" button → `POST https://amtocsoft.com/api/admin/referral` with `X-Admin-Key`
- Success: shows generated code in a copyable chip

**Codes table (middle):**

Columns: Code | Type | Discount | Status | Created | Used By | Used At

- Filterable by status (All / Available / Used) and type (All / Manual / Auto)
- Pagination: 20 per page
- Copyable code cells (click to copy)

**Audit log table (bottom):**

Columns: Timestamp | Action | Code | Actor | Result

- Filterable by action type
- Pagination: 20 per page
- Color-coded result badges (success=green, invalid=red, already_used=yellow)

---

## File Map

### Plan A — Redesign

| File | Action |
|---|---|
| `src/app/shared/services/theme.service.ts` | Create |
| `src/app/shared/components/theme-toggle/theme-toggle.component.ts` | Create |
| `src/styles.scss` (or `styles.css`) | Add CSS custom properties per theme |
| `src/app/layout/site-layout/site-layout.component.ts` | Modify — new nav, theme toggle, no mat-sidenav |
| `src/app/features/home/home.component.ts` | Rewrite — split hero, tabbed content, promo card, newsletter |
| `src/app/features/blog/blog.component.ts` | Modify — filter bar, new card design |
| `src/app/features/videos/videos.component.ts` | Modify — type filter, new card design |
| `src/app/features/podcasts/podcasts.component.ts` | Modify — list layout |
| `src/app/features/metrics/metrics.component.ts` | Modify — restyle cards |
| `src/app/app.config.ts` | Add APP_INITIALIZER for ThemeService |
| `src/environments/environment.ts` | No change (AMTOCSOFT_ADMIN_KEY in Part B only) |

### Plan B — Referral Admin

| File | Action | Repo |
|---|---|---|
| `www/schema.sql` | Add `audit_log` table | amtocsoft |
| `www/_worker.js` | Add audit writes + `GET /api/admin/referrals` + `GET /api/admin/audit` endpoints | amtocsoft |
| `functions/api/proxy/amtocsoft.ts` | New proxy endpoint — forwards admin calls to amtocsoft with secret key | amtocbot-site |
| `src/app/features/dashboard/referrals-tab/referrals-tab.component.ts` | Create | amtocbot-site |
| `src/app/features/dashboard/dashboard.component.ts` | Add Referrals tab (admin only) | amtocbot-site |

---

## Security Notes

- `AMTOCSOFT_ADMIN_KEY` is stored as a Cloudflare Pages secret on the amtocbot-site project — never in committed code or the Angular bundle
- The `/api/proxy/amtocsoft` endpoint on amtocbot's worker is gated by the existing session auth (admin role required) before forwarding to amtocsoft.com
- Audit log is append-only — no delete endpoint exposed
- `GET /api/admin/referrals` and `GET /api/admin/audit` on amtocsoft require `X-Admin-Key` — same pattern as existing admin endpoints
