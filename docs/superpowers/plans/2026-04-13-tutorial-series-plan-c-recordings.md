# Tutorial Series — Plan C: User Recordings & Public Comment Feed

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users record themselves explaining a concept, upload to R2, and display all recordings publicly as a "comments" feed under each lesson.

**Architecture:** MediaRecorder API captures webm video (with audio). User provides display name. Angular component posts the blob + metadata to a Cloudflare Pages Function which stores the file in R2 and writes metadata to D1. GET endpoint returns recordings for a lesson. Feed displays video cards publicly (no auth required to view; no auth required to submit either — display name is the only identity).

**Tech Stack:** Angular 21, MediaRecorder API (browser built-in), Cloudflare Pages Functions, D1 (ENGAGE_DB), Cloudflare R2 (new TUTORIAL_MEDIA bucket), no auth required

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `migrations/008-tutorial-recordings.sql` | Create | D1 table for recording metadata |
| `wrangler.toml` | Modify | Add R2 bucket binding |
| `functions/api/learn/[language]/[slug]/recordings.ts` | Create | GET list + POST upload handler |
| `functions/api/_shared/auth.ts` | Modify | Add `TUTORIAL_MEDIA` and `TUTORIAL_MEDIA_BASE_URL` to `Env` interface |
| `src/app/features/learn/recording/recording.component.ts` | Create | 5-state MediaRecorder UI |
| `src/app/features/learn/recording/recording-feed.component.ts` | Create | Public video card feed with refresh |
| `src/app/features/learn/learn-lesson.component.ts` | Modify | Wire in both components, handle submitted event |

**Prerequisites:** Plan A must be complete. `learn-lesson.component.ts` must exist with the disabled "Record Your Understanding" button that this plan replaces.

---

## Task 1 — D1 Migration + R2 Bucket Setup

- [ ] Create `migrations/008-tutorial-recordings.sql` with the following content:

```sql
-- Migration 008: tutorial recordings — user video explanations per lesson
-- Apply (remote): npx wrangler d1 execute engage-db --remote --file=migrations/008-tutorial-recordings.sql
-- Apply (local):  npx wrangler d1 execute engage-db --local  --file=migrations/008-tutorial-recordings.sql

CREATE TABLE IF NOT EXISTS tutorial_recordings (
  id           TEXT PRIMARY KEY,                          -- crypto.randomUUID() generated server-side
  language     TEXT NOT NULL,                             -- 'html' | 'linux' | 'csharp' | 'java'
  level        TEXT NOT NULL,                             -- 'beginner' | 'intermediate' | 'advanced'
  slug         TEXT NOT NULL,                             -- lesson slug
  display_name TEXT NOT NULL,                             -- user-provided name (max 50 chars)
  r2_key       TEXT NOT NULL UNIQUE,                      -- path in R2: learn/{language}/{level}/{slug}/{id}.webm
  public_url   TEXT NOT NULL,                             -- R2 public CDN URL
  duration_ms  INTEGER,                                   -- recording duration in milliseconds
  status       TEXT NOT NULL DEFAULT 'active',            -- 'active' | 'removed'
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tr_lesson
  ON tutorial_recordings(language, level, slug, status, created_at);

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (8, 'Tutorial recordings: user video explanations per lesson');
```

- [ ] Add the R2 bucket binding to `wrangler.toml`. Open the file and append after the `[[d1_databases]]` block:

```toml
[[r2_buckets]]
binding = "TUTORIAL_MEDIA"
bucket_name = "tutorial-media"
```

The full `wrangler.toml` after the edit should read:

```toml
name = "amtocbot-site"
compatibility_date = "2024-09-23"
pages_build_output_dir = "dist/amtocbot-site/browser"

[[kv_namespaces]]
binding = "METRICS_KV"
id = "423269c6f6404126aefd46480cc99a06"

[[d1_databases]]
binding = "ENGAGE_DB"
database_name = "engage-db"
database_id = "e3ba9916-844b-47f1-9c43-8ed761dbf753"

[[r2_buckets]]
binding = "TUTORIAL_MEDIA"
bucket_name = "tutorial-media"

# Secrets (set via: npx wrangler pages secret put AMTOCSOFT_ADMIN_KEY --project-name=amtocbot-site)
# AMTOCSOFT_ADMIN_KEY — forwarded as X-Admin-Key to amtocsoft.com admin endpoints
```

- [ ] Create the R2 bucket (run once from `/Users/amtoc/amtocbot-site/`):

```bash
npx wrangler r2 bucket create tutorial-media
```

Expected output contains: `Created bucket tutorial-media`

- [ ] Apply the migration to the remote D1 database:

```bash
npx wrangler d1 execute engage-db --remote --file=migrations/008-tutorial-recordings.sql
```

Expected output: no errors, migration applied.

- [ ] Verify the table exists:

```bash
npx wrangler d1 execute engage-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='tutorial_recordings';"
```

Expected: one row with `name = tutorial_recordings`.

---

## Task 2 — Extend `Env` Interface

- [ ] Open `functions/api/_shared/auth.ts`. Locate the `Env` interface (currently at line 54):

```typescript
export interface Env {
  BREVO_API_KEY: string;
  ENGAGE_DB: D1Database;
  METRICS_KV?: KVNamespace;
  GITHUB_TOKEN?: string;
}
```

Replace it with:

```typescript
export interface Env {
  BREVO_API_KEY: string;
  ENGAGE_DB: D1Database;
  METRICS_KV?: KVNamespace;
  GITHUB_TOKEN?: string;
  TUTORIAL_MEDIA: R2Bucket;
  TUTORIAL_MEDIA_BASE_URL: string;
}
```

- [ ] Verify TypeScript still compiles cleanly:

```bash
npx tsc --noEmit
```

Expected: `Found 0 errors.`

---

## Task 3 — Cloudflare Function: `functions/api/learn/[language]/[slug]/recordings.ts`

- [ ] Create the directory `functions/api/learn/[language]/[slug]/` if it does not exist.

- [ ] Create `functions/api/learn/[language]/[slug]/recordings.ts` with the full content below:

```typescript
// functions/api/learn/[language]/[slug]/recordings.ts
// GET  /api/learn/:language/:slug/recordings?level=beginner  — list recordings for a lesson
// POST /api/learn/:language/:slug/recordings                 — upload new recording

import {
  Env,
  jsonResponse,
  corsHeaders,
  optionsHandler,
} from '../../../_shared/auth';

export const onRequestOptions = optionsHandler;

const VALID_LANGUAGES = new Set(['html', 'linux', 'csharp', 'java']);
const VALID_LEVELS    = new Set(['beginner', 'intermediate', 'advanced']);
const MAX_BYTES       = 50 * 1024 * 1024; // 50 MB

// ── GET — list recordings for a lesson ───────────────────────────────────────

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { language, slug } = context.params as { language: string; slug: string };
  const level = new URL(context.request.url).searchParams.get('level') ?? 'beginner';

  if (!VALID_LANGUAGES.has(language)) {
    return jsonResponse({ error: 'Invalid language' }, 400);
  }
  if (!VALID_LEVELS.has(level)) {
    return jsonResponse({ error: 'Invalid level' }, 400);
  }
  if (!slug || slug.length > 120) {
    return jsonResponse({ error: 'Invalid slug' }, 400);
  }

  const rows = await context.env.ENGAGE_DB.prepare(`
    SELECT id, display_name, public_url, duration_ms, created_at
    FROM tutorial_recordings
    WHERE language = ? AND level = ? AND slug = ? AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(language, level, slug).all();

  return jsonResponse({ recordings: rows.results ?? [] });
};

// ── POST — receive multipart form data (video + metadata) ────────────────────

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { language, slug } = context.params as { language: string; slug: string };

  // Content-length guard (Cloudflare Workers enforce 100 MB max body; we enforce 50 MB)
  const contentLength = parseInt(context.request.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_BYTES) {
    return jsonResponse({ error: 'Upload exceeds 50 MB limit' }, 413);
  }

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await context.request.formData();
  } catch {
    return jsonResponse({ error: 'Invalid multipart form data' }, 400);
  }

  const displayName = (formData.get('displayName') as string | null)?.trim() ?? '';
  const level       = (formData.get('level')       as string | null)?.trim() ?? '';
  const videoFile   = formData.get('video') as File | null;

  // ── Validate inputs ──────────────────────────────────────────────────────

  if (!VALID_LANGUAGES.has(language)) {
    return jsonResponse({ error: 'Invalid language' }, 400);
  }
  if (!VALID_LEVELS.has(level)) {
    return jsonResponse({ error: 'Invalid level' }, 400);
  }
  if (!slug || slug.length > 120) {
    return jsonResponse({ error: 'Invalid slug' }, 400);
  }
  if (!displayName || displayName.length > 50) {
    return jsonResponse({ error: 'display_name must be 1–50 characters' }, 400);
  }
  if (!videoFile) {
    return jsonResponse({ error: 'Missing video field' }, 400);
  }

  const contentType = videoFile.type || '';
  if (!['video/webm', 'video/mp4'].includes(contentType)) {
    return jsonResponse({ error: 'Video must be video/webm or video/mp4' }, 400);
  }

  if (videoFile.size > MAX_BYTES) {
    return jsonResponse({ error: 'Upload exceeds 50 MB limit' }, 413);
  }

  // ── Store in R2 ──────────────────────────────────────────────────────────

  const id     = crypto.randomUUID();
  const ext    = contentType === 'video/mp4' ? 'mp4' : 'webm';
  const r2Key  = `learn/${language}/${level}/${slug}/${id}.${ext}`;

  const videoBuffer = await videoFile.arrayBuffer();

  try {
    await context.env.TUTORIAL_MEDIA.put(r2Key, videoBuffer, {
      httpMetadata: { contentType },
    });
  } catch (err) {
    console.error('R2 put failed', err);
    return jsonResponse({ error: 'Storage error — please try again' }, 502);
  }

  // ── Build public URL ─────────────────────────────────────────────────────
  // TUTORIAL_MEDIA_BASE_URL is set as a Pages secret, e.g. https://pub-XXXX.r2.dev
  // (no trailing slash)
  const baseUrl   = (context.env.TUTORIAL_MEDIA_BASE_URL ?? '').replace(/\/$/, '');
  const publicUrl = `${baseUrl}/${r2Key}`;

  // ── Write metadata to D1 ─────────────────────────────────────────────────

  const durationMs = parseInt((formData.get('durationMs') as string | null) ?? '0', 10) || null;

  try {
    await context.env.ENGAGE_DB.prepare(`
      INSERT INTO tutorial_recordings (id, language, level, slug, display_name, r2_key, public_url, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, language, level, slug, displayName, r2Key, publicUrl, durationMs).run();
  } catch (err) {
    console.error('D1 insert failed', err);
    // Attempt R2 cleanup (best-effort)
    await context.env.TUTORIAL_MEDIA.delete(r2Key).catch(() => {});
    return jsonResponse({ error: 'Database error — please try again' }, 502);
  }

  return jsonResponse({
    success: true,
    recording: { id, public_url: publicUrl, display_name: displayName },
  }, 201);
};
```

- [ ] Verify TypeScript compiles:

```bash
npx tsc --noEmit
```

Expected: `Found 0 errors.`

---

## Task 4 — `recording.component.ts`

- [ ] Create the directory `src/app/features/learn/recording/` if it does not exist.

- [ ] Create `src/app/features/learn/recording/recording.component.ts` with the full content below:

```typescript
// src/app/features/learn/recording/recording.component.ts

import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

type UiState = 'idle' | 'recording' | 'preview' | 'submitting' | 'submitted';

@Component({
  selector: 'app-recording',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  template: `
    <div class="recording-widget">

      <!-- ── State: idle ─────────────────────────────────────────────────── -->
      @if (uiState() === 'idle') {
        <div class="idle-panel">
          <p class="prompt-text">
            Explain what you just learned in your own words — speak to the camera
            or just use your voice.
          </p>
          @if (error()) {
            <p class="error-msg">{{ error() }}</p>
          }
          <button class="btn-record" (click)="startRecording()">
            🎥 Record Your Understanding
          </button>
        </div>
      }

      <!-- ── State: recording ────────────────────────────────────────────── -->
      @if (uiState() === 'recording') {
        <div class="recording-panel">
          <div class="rec-indicator">
            <span class="red-dot"></span>
            Recording… {{ formatTime(elapsedSeconds()) }}
          </div>
          <button class="btn-stop" (click)="stopRecording()">⏹ Stop</button>
        </div>
      }

      <!-- ── State: preview ──────────────────────────────────────────────── -->
      @if (uiState() === 'preview') {
        <div class="preview-panel">
          <video [src]="previewUrl()" controls class="preview-video"></video>

          <div class="name-row">
            <label for="rec-name">Your name</label>
            <input
              id="rec-name"
              type="text"
              [(ngModel)]="displayName"
              placeholder="e.g. Alex"
              maxlength="50"
              class="name-input"
            />
          </div>

          @if (error()) {
            <p class="error-msg">{{ error() }}</p>
          }

          <div class="preview-actions">
            <button
              class="btn-submit"
              (click)="submitRecording()"
              [disabled]="!displayName.trim()"
            >
              Submit Recording
            </button>
            <button class="btn-rerecord" (click)="reRecord()">Re-record</button>
          </div>
        </div>
      }

      <!-- ── State: submitting ────────────────────────────────────────────── -->
      @if (uiState() === 'submitting') {
        <div class="submitting-panel">
          <span class="spinner"></span> Uploading…
        </div>
      }

      <!-- ── State: submitted ─────────────────────────────────────────────── -->
      @if (uiState() === 'submitted') {
        <div class="submitted-panel">
          <span class="check">✅</span>
          Your recording has been shared! Refresh to see it in the feed below.
        </div>
      }

    </div>
  `,
  styles: [`
    .recording-widget {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .prompt-text { color: #94a3b8; margin: 0 0 16px; font-size: 14px; }
    .btn-record {
      background: #3b82f6; color: #fff; border: none;
      padding: 10px 20px; border-radius: 8px; cursor: pointer;
      font-size: 14px; font-weight: 600;
    }
    .btn-record:hover { background: #2563eb; }
    .recording-panel { display: flex; align-items: center; gap: 20px; }
    .rec-indicator { display: flex; align-items: center; gap: 8px; font-size: 15px; }
    .red-dot {
      width: 12px; height: 12px; border-radius: 50%; background: #ef4444;
      animation: pulse 1s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.3; }
    }
    .btn-stop {
      background: #ef4444; color: #fff; border: none;
      padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 14px;
    }
    .preview-video {
      width: 100%; border-radius: 8px; max-height: 320px; background: #000;
    }
    .name-row { margin: 16px 0 8px; display: flex; flex-direction: column; gap: 6px; }
    .name-row label { font-size: 13px; color: #94a3b8; }
    .name-input {
      background: #1e293b; border: 1px solid #334155; border-radius: 6px;
      color: #e2e8f0; padding: 8px 12px; font-size: 14px; width: 100%;
      box-sizing: border-box;
    }
    .name-input::placeholder { color: #475569; }
    .preview-actions { display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
    .btn-submit {
      background: #22c55e; color: #fff; border: none;
      padding: 10px 20px; border-radius: 8px; cursor: pointer;
      font-size: 14px; font-weight: 600;
    }
    .btn-submit:disabled { background: #166534; cursor: not-allowed; opacity: 0.6; }
    .btn-rerecord {
      background: transparent; color: #94a3b8; border: 1px solid #334155;
      padding: 10px 16px; border-radius: 8px; cursor: pointer; font-size: 14px;
    }
    .btn-rerecord:hover { color: #e2e8f0; border-color: #64748b; }
    .submitting-panel { display: flex; align-items: center; gap: 10px; color: #94a3b8; }
    .spinner {
      width: 18px; height: 18px; border: 2px solid #334155;
      border-top-color: #3b82f6; border-radius: 50%;
      animation: spin 0.8s linear infinite; display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .submitted-panel { display: flex; align-items: center; gap: 10px; color: #22c55e; font-size: 15px; }
    .check { font-size: 20px; }
    .error-msg { color: #f87171; font-size: 13px; margin: 8px 0 0; }
  `],
})
export class RecordingComponent implements OnDestroy {
  @Input() language = '';
  @Input() level    = '';
  @Input() slug     = '';

  @Output() recordingSubmitted = new EventEmitter<void>();

  uiState    = signal<UiState>('idle');
  previewUrl = signal<string | null>(null);
  error      = signal<string | null>(null);
  elapsedSeconds = signal(0);

  displayName = '';
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private videoBlob: Blob | null = null;
  private timerHandle: ReturnType<typeof setInterval> | null = null;

  constructor(private http: HttpClient) {}

  // ── Recording ─────────────────────────────────────────────────────────────

  async startRecording(): Promise<void> {
    this.error.set(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      this.error.set('Camera/microphone access denied. Please allow permission and try again.');
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    this.mediaRecorder = new MediaRecorder(stream, { mimeType });
    this.chunks = [];

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      this.videoBlob = new Blob(this.chunks, { type: mimeType });
      const url = URL.createObjectURL(this.videoBlob);
      this.previewUrl.set(url);
      this.uiState.set('preview');
    };

    this.mediaRecorder.start(1000); // 1-second timeslice
    this.elapsedSeconds.set(0);
    this.uiState.set('recording');
    this.startTimer();
  }

  stopRecording(): void {
    this.stopTimer();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  reRecord(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
    this.videoBlob = null;
    this.displayName = '';
    this.error.set(null);
    this.uiState.set('idle');
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async submitRecording(): Promise<void> {
    if (!this.videoBlob || !this.displayName.trim()) return;

    this.uiState.set('submitting');
    this.error.set(null);

    const formData = new FormData();
    formData.append('video', this.videoBlob, 'recording.webm');
    formData.append('displayName', this.displayName.trim());
    formData.append('level', this.level);
    formData.append('durationMs', String(this.elapsedSeconds() * 1000));

    const url = `/api/learn/${this.language}/${this.slug}/recordings?level=${this.level}`;

    this.http.post(url, formData).subscribe({
      next: () => {
        this.uiState.set('submitted');
        this.recordingSubmitted.emit();
      },
      error: (err) => {
        const msg = err?.error?.error ?? 'Upload failed. Please try again.';
        this.error.set(msg);
        this.uiState.set('preview');
      },
    });
  }

  // ── Timer helpers ─────────────────────────────────────────────────────────

  private startTimer(): void {
    this.timerHandle = setInterval(() => {
      this.elapsedSeconds.update((s) => s + 1);
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  ngOnDestroy(): void {
    this.stopTimer();
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }
}
```

- [ ] Verify TypeScript compiles:

```bash
npx tsc --noEmit
```

Expected: `Found 0 errors.`

---

## Task 5 — `recording-feed.component.ts`

- [ ] Create `src/app/features/learn/recording/recording-feed.component.ts` with the full content below:

```typescript
// src/app/features/learn/recording/recording-feed.component.ts

import {
  Component,
  Input,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Recording {
  id: string;
  display_name: string;
  public_url: string;
  duration_ms: number | null;
  created_at: string;
}

@Component({
  selector: 'app-recording-feed',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  template: `
    <div class="feed-container">
      <h3 class="feed-title">Community Explanations</h3>

      <!-- ── Loading skeleton ───────────────────────────────────────── -->
      @if (loading()) {
        <div class="skeletons">
          @for (n of skeletonItems; track n) {
            <div class="skeleton-card">
              <div class="sk-video"></div>
              <div class="sk-meta">
                <div class="sk-line sk-name"></div>
                <div class="sk-line sk-date"></div>
              </div>
            </div>
          }
        </div>
      }

      <!-- ── Error ──────────────────────────────────────────────────── -->
      @if (!loading() && fetchError()) {
        <p class="feed-error">Could not load recordings. Please refresh the page.</p>
      }

      <!-- ── Empty state ────────────────────────────────────────────── -->
      @if (!loading() && !fetchError() && recordings().length === 0) {
        <div class="empty-state">
          <span class="empty-icon">🎥</span>
          <p>Be the first to share your understanding!</p>
        </div>
      }

      <!-- ── Video cards ────────────────────────────────────────────── -->
      @if (!loading() && recordings().length > 0) {
        <div class="cards-grid">
          @for (r of recordings(); track r.id) {
            <div class="video-card">
              <video
                [src]="r.public_url"
                controls
                preload="metadata"
                class="card-video"
              ></video>
              <div class="card-meta">
                <span class="card-name">{{ r.display_name }}</span>
                <span class="card-date">{{ formatDate(r.created_at) }}</span>
                @if (r.duration_ms) {
                  <span class="card-duration">{{ formatDuration(r.duration_ms) }}</span>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .feed-container {
      margin: 32px 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .feed-title {
      color: #e2e8f0; font-size: 18px; font-weight: 700;
      margin: 0 0 20px; border-bottom: 1px solid #1e293b; padding-bottom: 12px;
    }

    /* ── Skeletons ── */
    .skeletons { display: flex; flex-direction: column; gap: 16px; }
    .skeleton-card {
      display: flex; gap: 16px; background: #0f172a;
      border: 1px solid #1e293b; border-radius: 10px; padding: 12px;
    }
    .sk-video {
      width: 160px; min-width: 160px; height: 90px;
      background: #1e293b; border-radius: 6px;
      animation: shimmer 1.4s infinite linear;
    }
    .sk-meta { flex: 1; display: flex; flex-direction: column; gap: 8px; padding-top: 8px; }
    .sk-line {
      height: 12px; border-radius: 4px; background: #1e293b;
      animation: shimmer 1.4s infinite linear;
    }
    .sk-name { width: 40%; }
    .sk-date { width: 25%; }
    @keyframes shimmer {
      0%   { opacity: 1; }
      50%  { opacity: 0.4; }
      100% { opacity: 1; }
    }

    /* ── Empty ── */
    .empty-state {
      text-align: center; padding: 40px 20px;
      color: #475569; display: flex; flex-direction: column;
      align-items: center; gap: 8px;
    }
    .empty-icon { font-size: 32px; }
    .empty-state p { margin: 0; font-size: 15px; }

    /* ── Cards ── */
    .cards-grid { display: flex; flex-direction: column; gap: 16px; }
    .video-card {
      background: #0f172a; border: 1px solid #1e293b; border-radius: 10px;
      overflow: hidden; display: flex; gap: 0;
      flex-direction: column;
    }
    .card-video { width: 100%; max-height: 280px; background: #000; display: block; }
    .card-meta {
      padding: 12px 16px; display: flex; align-items: center;
      gap: 12px; flex-wrap: wrap;
    }
    .card-name { color: #e2e8f0; font-weight: 600; font-size: 14px; }
    .card-date { color: #64748b; font-size: 12px; }
    .card-duration {
      color: #64748b; font-size: 12px;
      background: #1e293b; padding: 2px 8px; border-radius: 12px;
    }

    /* ── Fetch error ── */
    .feed-error { color: #f87171; font-size: 14px; margin: 0; }
  `],
})
export class RecordingFeedComponent implements OnInit {
  @Input() language = '';
  @Input() level    = '';
  @Input() slug     = '';

  recordings  = signal<Recording[]>([]);
  loading     = signal(true);
  fetchError  = signal(false);

  readonly skeletonItems = [1, 2, 3];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadRecordings();
  }

  /** Called by parent via @ViewChild after a new recording is submitted. */
  refresh(): void {
    this.loadRecordings();
  }

  private loadRecordings(): void {
    this.loading.set(true);
    this.fetchError.set(false);

    const url = `/api/learn/${this.language}/${this.slug}/recordings?level=${this.level}`;

    this.http.get<{ recordings: Recording[] }>(url).subscribe({
      next: (res) => {
        this.recordings.set(res.recordings ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.fetchError.set(true);
        this.loading.set(false);
      },
    });
  }

  formatDate(isoString: string): string {
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch {
      return isoString;
    }
  }

  formatDuration(ms: number): string {
    const total = Math.round(ms / 1000);
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}
```

- [ ] Verify TypeScript compiles:

```bash
npx tsc --noEmit
```

Expected: `Found 0 errors.`

---

## Task 6 — Update `learn-lesson.component.ts`

**Prerequisite:** Plan A must have created `src/app/features/learn/learn-lesson.component.ts`. The component should already have a disabled "Record Your Understanding" button. This task replaces that button with the live recording UI.

- [ ] Open `src/app/features/learn/learn-lesson.component.ts`.

- [ ] Add the two new imports to the `imports` array of the `@Component` decorator:

```typescript
import { RecordingComponent }     from './recording/recording.component';
import { RecordingFeedComponent } from './recording/recording-feed.component';
```

- [ ] Add both to the component's `imports` array:

```typescript
imports: [
  // ... existing imports ...
  RecordingComponent,
  RecordingFeedComponent,
],
```

- [ ] Add a `@ViewChild` reference for the feed component. At the top of the class body (after any existing `@ViewChild` declarations), add:

```typescript
import { ViewChild } from '@angular/core';
// (add ViewChild to the existing @angular/core import line if not already there)

@ViewChild('feed') feedComponent!: RecordingFeedComponent;
```

- [ ] Add a handler method to the class:

```typescript
onRecordingSubmitted(): void {
  this.feedComponent?.refresh();
}
```

- [ ] In the component template, locate and remove the disabled "Record Your Understanding" button (it will look similar to):

```html
<button disabled>Record Your Understanding</button>
```

Replace it with:

```html
<app-recording
  [language]="lesson.language"
  [level]="lesson.level"
  [slug]="lesson.slug"
  (recordingSubmitted)="onRecordingSubmitted()"
></app-recording>

<app-recording-feed
  #feed
  [language]="lesson.language"
  [level]="lesson.level"
  [slug]="lesson.slug"
></app-recording-feed>
```

> **Note:** The exact property names (`lesson.language`, `lesson.level`, `lesson.slug`) depend on what Plan A defined in the `Lesson` model. Adjust the binding expressions to match the actual property names from `src/app/features/learn/curriculum/types.ts` if they differ.

- [ ] Verify TypeScript compiles:

```bash
npx tsc --noEmit
```

Expected: `Found 0 errors.`

---

## Task 7 — Build, Configure R2 Public URL, Deploy & Commit

### 7a — Get the R2 public URL

> **IMPORTANT:** The R2 public bucket URL (`pub-XXXX`) is specific to your Cloudflare account and bucket. You must retrieve it from the Cloudflare dashboard:
>
> 1. Go to **Cloudflare Dashboard → R2 Object Storage → tutorial-media**
> 2. Click the **Settings** tab
> 3. Copy the **Public Bucket URL** — it looks like `https://pub-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.r2.dev`
>
> You will use this URL in step 7c below.

### 7b — Build

- [ ] Run the full build:

```bash
npx ng build && cp dist/amtocbot-site/browser/index.csr.html dist/amtocbot-site/browser/index.html
```

Expected: Build completes with no errors. The `cp` command produces no output.

### 7c — Set the R2 public URL secret

- [ ] Set the `TUTORIAL_MEDIA_BASE_URL` Pages secret (you will be prompted to paste the value from 7a):

```bash
npx wrangler pages secret put TUTORIAL_MEDIA_BASE_URL --project-name=amtocbot-site
```

Paste the full R2 public URL (e.g. `https://pub-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.r2.dev`) when prompted. Press Enter. Expected output: `✨ Success! Saved secret TUTORIAL_MEDIA_BASE_URL`

### 7d — Deploy

- [ ] Deploy to Cloudflare Pages:

```bash
npx wrangler pages deploy dist/amtocbot-site/browser --project-name=amtocbot-site
```

Expected: deployment URL printed. Verify the learn lesson page loads and the recording widget appears.

### 7e — Smoke test

- [ ] Navigate to any lesson page (e.g. `/learn/html/beginner/first-lesson`).
- [ ] Confirm the "Record Your Understanding" section shows the RecordingComponent (camera button, not a disabled button).
- [ ] Confirm the "Community Explanations" feed section appears below it (either empty state or loading skeleton, then empty state).
- [ ] Record a short test clip, enter a display name, submit — verify it appears in the feed after refresh.

### 7f — Commit

- [ ] Stage and commit all changed files:

```bash
git add \
  migrations/008-tutorial-recordings.sql \
  wrangler.toml \
  functions/api/_shared/auth.ts \
  "functions/api/learn/[language]/[slug]/recordings.ts" \
  src/app/features/learn/recording/recording.component.ts \
  src/app/features/learn/recording/recording-feed.component.ts \
  src/app/features/learn/learn-lesson.component.ts
```

- [ ] Commit:

```bash
git commit -m "$(cat <<'EOF'
feat: tutorial series Plan C — user recordings + public comment feed

- MediaRecorder capture (video/webm) with 5-state UI flow
- POST to /api/learn/[language]/[slug]/recordings → stores in R2 + D1
- Public recording feed: video cards with name, date, duration
- No auth required to record or view — display name as identity
- D1 migration 008: tutorial_recordings table

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Task | Files touched | Key outcome |
|------|--------------|-------------|
| 1 | `migrations/008-tutorial-recordings.sql`, `wrangler.toml` | D1 table + R2 bucket binding created |
| 2 | `functions/api/_shared/auth.ts` | `Env` interface extended with R2 types |
| 3 | `functions/api/learn/[language]/[slug]/recordings.ts` | GET list + POST upload endpoint live |
| 4 | `src/app/features/learn/recording/recording.component.ts` | 5-state recording UI |
| 5 | `src/app/features/learn/recording/recording-feed.component.ts` | Public video feed with skeletons + refresh |
| 6 | `src/app/features/learn/learn-lesson.component.ts` | Components wired into lesson page |
| 7 | — | Build verified, secret set, deployed, committed |
