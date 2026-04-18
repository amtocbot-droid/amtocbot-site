import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

interface ReportForm {
  report_type: string;
  title: string;
  description: string;
  page_url: string;
  content_type: string;
  content_ref: string;
  severity: string;
  name: string;
  email: string;
}

const REPORT_TYPES = [
  { value: 'bug',           label: 'Bug',            icon: '🐛', desc: 'Something crashes or behaves unexpectedly' },
  { value: 'image_issue',   label: 'Image Issue',    icon: '🖼️', desc: 'Wrong, broken, or low-quality image' },
  { value: 'video_issue',   label: 'Video Issue',    icon: '🎬', desc: 'Video not playing, out of sync, or wrong content' },
  { value: 'content_error', label: 'Content Error',  icon: '📝', desc: 'Factual mistake or outdated information' },
  { value: 'performance',   label: 'Performance',    icon: '⚡', desc: 'Page loads slowly or is unresponsive' },
  { value: 'other',         label: 'Other',          icon: '❓', desc: 'Any other issue not listed above' },
];

const SEVERITIES = [
  {
    value: 'low',
    label: 'Low',
    icon: '🟢',
    desc: 'Minor cosmetic or polish issue — doesn\'t affect usability.',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.35)',
  },
  {
    value: 'medium',
    label: 'Medium',
    icon: '🟡',
    desc: 'Noticeable problem — worth fixing in the next cycle.',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.35)',
  },
  {
    value: 'high',
    label: 'High',
    icon: '🟠',
    desc: 'Major error — significantly impacts the experience.',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.1)',
    border: 'rgba(249,115,22,0.35)',
  },
  {
    value: 'critical',
    label: 'Critical',
    icon: '🔴',
    desc: 'Blocking — site is down, data is lost, or content is inaccessible.',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.45)',
  },
];

const CONTENT_TYPES = [
  { value: 'video', label: '🎬 Video' },
  { value: 'image', label: '🖼️ Image' },
  { value: 'blog',  label: '📝 Blog post' },
  { value: 'general', label: '🌐 General / Other' },
];

@Component({
  selector: 'app-report-issue',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="report-page">

      <!-- Header -->
      <div class="page-hero">
        <div class="hero-inner">
          <div class="hero-badge">Bug Report</div>
          <h1 class="hero-title">Report an issue</h1>
          <p class="hero-sub">
            Found a broken image, video that won't play, content error, or bug?
            Tell us and we'll get it fixed.
          </p>
          <div class="hero-meta">
            <span class="hero-meta-item">✓ No account required</span>
            <span class="hero-meta-item">✓ Tracked to resolution</span>
            <span class="hero-meta-item">✓ All roles welcome</span>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div class="body-wrap">

        @if (submitted()) {
          <div class="success-card">
            <div class="success-icon">🎯</div>
            <h2 class="success-title">Issue reported!</h2>
            <p class="success-msg">
              Your report has been logged. The team will review it and work on a fix.
              @if (form.email) {
                We'll update you at <strong>{{ form.email }}</strong> when it's resolved.
              }
            </p>
            <div class="success-actions">
              <button class="btn-secondary" (click)="reset()">Report another issue</button>
              <a routerLink="/" class="btn-primary">Back to home</a>
            </div>
          </div>

        } @else {
          <div class="form-layout">

            <!-- Step 1: Report type -->
            <div class="form-step">
              <div class="step-header">
                <span class="step-num">1</span>
                <h2 class="step-title">What type of issue is this?</h2>
              </div>
              <div class="type-grid">
                @for (t of REPORT_TYPES; track t.value) {
                  <button
                    type="button"
                    class="type-card"
                    [class.selected]="form.report_type === t.value"
                    (click)="form.report_type = t.value">
                    <span class="type-icon">{{ t.icon }}</span>
                    <span class="type-label">{{ t.label }}</span>
                    <span class="type-desc">{{ t.desc }}</span>
                  </button>
                }
              </div>
            </div>

            <!-- Step 2: Title & description -->
            <div class="form-step">
              <div class="step-header">
                <span class="step-num">2</span>
                <h2 class="step-title">Describe the issue</h2>
              </div>

              <div class="field-group">
                <label class="field-label" for="title">Title <span class="required">*</span></label>
                <input
                  id="title"
                  class="field-input"
                  type="text"
                  [(ngModel)]="form.title"
                  placeholder="e.g. Hero image on V029 page is broken"
                  maxlength="200"
                  autocomplete="off" />
                <span class="char-count">{{ form.title.length }}/200</span>
              </div>

              <div class="field-group">
                <label class="field-label" for="description">Description <span class="required">*</span></label>
                <textarea
                  id="description"
                  class="field-textarea"
                  [(ngModel)]="form.description"
                  placeholder="What happened? What did you expect to happen? Include steps to reproduce if relevant."
                  maxlength="8000"
                  rows="7"></textarea>
                <span class="char-count">{{ form.description.length }}/8000</span>
              </div>
            </div>

            <!-- Step 3: Location -->
            <div class="form-step">
              <div class="step-header">
                <span class="step-num">3</span>
                <h2 class="step-title">Where did you find it?</h2>
              </div>

              <div class="field-group">
                <label class="field-label" for="page_url">Page URL <span class="optional-tag">optional</span></label>
                <input
                  id="page_url"
                  class="field-input"
                  type="url"
                  [(ngModel)]="form.page_url"
                  placeholder="https://amtocbot.com/videos or paste the YouTube/blog link"
                  autocomplete="off" />
              </div>

              <div class="content-type-row">
                <div class="field-group flex-1">
                  <label class="field-label">Content type <span class="optional-tag">optional</span></label>
                  <div class="pill-group">
                    @for (ct of CONTENT_TYPES; track ct.value) {
                      <button
                        type="button"
                        class="pill"
                        [class.selected]="form.content_type === ct.value"
                        (click)="form.content_type = form.content_type === ct.value ? '' : ct.value">
                        {{ ct.label }}
                      </button>
                    }
                  </div>
                </div>
                <div class="field-group flex-1">
                  <label class="field-label" for="content_ref">Content ID or reference <span class="optional-tag">optional</span></label>
                  <input
                    id="content_ref"
                    class="field-input"
                    type="text"
                    [(ngModel)]="form.content_ref"
                    placeholder="e.g. V029, B042, or clip name"
                    maxlength="500"
                    autocomplete="off" />
                </div>
              </div>
            </div>

            <!-- Step 4: Severity -->
            <div class="form-step">
              <div class="step-header">
                <span class="step-num">4</span>
                <h2 class="step-title">How severe is it?</h2>
              </div>
              <div class="severity-grid">
                @for (sev of SEVERITIES; track sev.value) {
                  <button
                    type="button"
                    class="sev-card"
                    [class.selected]="form.severity === sev.value"
                    [style.--sev-color]="sev.color"
                    [style.--sev-bg]="sev.bg"
                    [style.--sev-border]="sev.border"
                    (click)="form.severity = sev.value">
                    <span class="sev-icon">{{ sev.icon }}</span>
                    <span class="sev-label">{{ sev.label }}</span>
                    <span class="sev-desc">{{ sev.desc }}</span>
                  </button>
                }
              </div>
            </div>

            <!-- Step 5: Contact (optional) -->
            <div class="form-step optional-step">
              <div class="step-header">
                <span class="step-num opt">5</span>
                <h2 class="step-title">Your contact details <span class="optional-badge">Optional</span></h2>
              </div>
              <p class="optional-note">Add your email if you'd like a notification when this is resolved.</p>
              <div class="contact-grid">
                <div class="field-group">
                  <label class="field-label-sm" for="r-name">Name</label>
                  <input id="r-name" class="field-input" type="text" [(ngModel)]="form.name"
                    placeholder="Your name" maxlength="100" autocomplete="name" />
                </div>
                <div class="field-group">
                  <label class="field-label-sm" for="r-email">Email</label>
                  <input id="r-email" class="field-input" type="email" [(ngModel)]="form.email"
                    placeholder="your@email.com" maxlength="200" autocomplete="email" />
                </div>
              </div>
            </div>

            <!-- Auth hint -->
            @if (auth.authenticated()) {
              <div class="auth-hint">
                <span>✓</span> Signed in as <strong>{{ auth.username() }}</strong> — your report will be linked to your account.
              </div>
            }

            <!-- Error -->
            @if (error()) {
              <div class="error-banner">⚠️ {{ error() }}</div>
            }

            <!-- Actions -->
            <div class="form-actions">
              <a routerLink="/feedback" class="btn-ghost">💡 Give general feedback instead</a>
              <button
                class="btn-primary"
                [disabled]="submitting() || !isValid()"
                (click)="submit()">
                @if (submitting()) { Submitting… } @else { Submit Report }
              </button>
            </div>

          </div>
        }

        <!-- Sidebar -->
        <aside class="side-info">
          <div class="info-card tips-card">
            <h3 class="info-title">💡 Tips for a great report</h3>
            <ul class="tips-list">
              <li>Paste the URL of the exact page where you saw the issue.</li>
              <li>For image/video issues, include the content ID (e.g. V029, B042).</li>
              <li>Describe what you expected vs what you actually saw.</li>
              <li>For bugs, include your browser and device if relevant.</li>
              <li>Screenshots help — note them in the description and we may follow up.</li>
            </ul>
          </div>

          <div class="info-card severity-guide">
            <h3 class="info-title">Severity guide</h3>
            @for (sev of SEVERITIES; track sev.value) {
              <div class="sev-guide-row">
                <span>{{ sev.icon }}</span>
                <div>
                  <strong>{{ sev.label }}</strong>
                  <span class="sev-guide-desc">{{ sev.desc }}</span>
                </div>
              </div>
            }
          </div>

          <div class="info-card alt-card">
            <h3 class="info-title">Other channels</h3>
            <a routerLink="/feedback" class="contact-row">💡 Give feedback or a suggestion</a>
            <a routerLink="/tutorial" class="contact-row">📖 View help tutorials</a>
            <a href="mailto:hello@amtocbot.com" class="contact-row">✉️ hello@amtocbot.com</a>
          </div>
        </aside>

      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .report-page { min-height: 100vh; background: var(--bg-primary, #0a0a0a); color: var(--text-primary, #e2e8f0); }

    /* ── Hero ── */
    .page-hero {
      background: linear-gradient(135deg, rgba(239,68,68,0.07) 0%, rgba(249,115,22,0.05) 100%);
      border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08));
      padding: 3.5rem 1.5rem 2.5rem;
    }
    .hero-inner { max-width: 700px; margin: 0 auto; text-align: center; }
    .hero-badge {
      display: inline-block;
      padding: 0.28rem 0.85rem;
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.3);
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 700;
      color: #ef4444;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }
    .hero-title {
      font-size: clamp(1.8rem, 4vw, 2.6rem);
      font-weight: 800;
      margin: 0 0 0.85rem;
      background: linear-gradient(135deg, #ef4444, #f97316);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero-sub { font-size: 1rem; color: var(--text-secondary, #9ca3af); line-height: 1.7; margin: 0 0 1.5rem; }
    .hero-meta { display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap; }
    .hero-meta-item { font-size: 0.82rem; color: #4ade80; font-weight: 500; }

    /* ── Layout ── */
    .body-wrap {
      max-width: 1100px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: 2rem;
      align-items: start;
    }

    /* ── Success ── */
    .success-card {
      grid-column: 1 / -1;
      text-align: center;
      padding: 4rem 2rem;
      background: var(--bg-surface, rgba(255,255,255,0.04));
      border: 1px solid rgba(74,222,128,0.3);
      border-radius: 16px;
    }
    .success-icon { font-size: 3rem; margin-bottom: 1rem; }
    .success-title { font-size: 1.8rem; font-weight: 800; margin: 0 0 0.75rem; }
    .success-msg { color: var(--text-secondary); line-height: 1.6; margin: 0 0 2rem; }
    .success-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

    /* ── Form steps ── */
    .form-layout { display: flex; flex-direction: column; gap: 0; }
    .form-step {
      padding: 1.75rem 0;
      border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.06));
    }
    .form-step:last-of-type { border-bottom: none; }
    .step-header { display: flex; align-items: center; gap: 0.85rem; margin-bottom: 1.25rem; }
    .step-num {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(239,68,68,0.15);
      border: 1px solid rgba(239,68,68,0.35);
      color: #ef4444;
      font-size: 0.8rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .step-num.opt { background: rgba(156,163,175,0.1); border-color: rgba(156,163,175,0.25); color: #9ca3af; }
    .step-title { font-size: 1.05rem; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 0.75rem; }
    .optional-badge {
      font-size: 0.7rem;
      padding: 0.15rem 0.5rem;
      background: rgba(156,163,175,0.12);
      border: 1px solid rgba(156,163,175,0.2);
      border-radius: 20px;
      color: #9ca3af;
      font-weight: 500;
    }
    .optional-note { font-size: 0.82rem; color: var(--text-secondary); margin: -0.75rem 0 1rem 2.85rem; }

    /* ── Type grid ── */
    .type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
    .type-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      padding: 0.85rem 0.5rem;
      background: var(--bg-surface, rgba(255,255,255,0.04));
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
      border-radius: 10px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
      text-align: center;
    }
    .type-card:hover { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.05); }
    .type-card.selected { border-color: #ef4444; background: rgba(239,68,68,0.1); }
    .type-icon { font-size: 1.3rem; }
    .type-label { font-size: 0.8rem; font-weight: 600; color: var(--text-primary); }
    .type-desc { font-size: 0.68rem; color: var(--text-secondary); line-height: 1.3; }

    /* ── Fields ── */
    .field-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
    .field-group:last-child { margin-bottom: 0; }
    .field-label { font-size: 0.875rem; font-weight: 600; color: var(--text-primary); }
    .field-label-sm { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }
    .required { color: #f43f5e; margin-left: 2px; }
    .optional-tag { font-size: 0.72rem; color: var(--text-secondary); font-weight: 400; margin-left: 4px; }
    .field-input, .field-textarea {
      padding: 0.75rem 1rem;
      background: var(--bg-surface, rgba(255,255,255,0.05));
      border: 1px solid var(--border-color, rgba(255,255,255,0.1));
      border-radius: 8px;
      color: var(--text-primary, #e2e8f0);
      font-size: 0.9rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s;
      width: 100%;
      box-sizing: border-box;
    }
    .field-input:focus, .field-textarea:focus { border-color: #ef4444; }
    .field-textarea { resize: vertical; min-height: 160px; }
    .char-count { font-size: 0.72rem; color: var(--text-secondary); text-align: right; }

    /* ── Content type pills ── */
    .content-type-row { display: flex; gap: 1rem; flex-wrap: wrap; }
    .flex-1 { flex: 1; min-width: 200px; }
    .pill-group { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .pill {
      padding: 0.38rem 0.75rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-color, rgba(255,255,255,0.1));
      border-radius: 20px;
      color: var(--text-secondary);
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .pill:hover { border-color: rgba(239,68,68,0.35); color: var(--text-primary); }
    .pill.selected { border-color: #ef4444; background: rgba(239,68,68,0.1); color: #ef4444; font-weight: 600; }

    /* ── Severity grid ── */
    .severity-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem; }
    .sev-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.2rem;
      padding: 0.9rem 1rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
      border-radius: 10px;
      cursor: pointer;
      text-align: left;
      transition: border-color 0.15s, background 0.15s;
    }
    .sev-card:hover { border-color: var(--sev-border); background: var(--sev-bg); }
    .sev-card.selected { border-color: var(--sev-border) !important; background: var(--sev-bg) !important; }
    .sev-icon { font-size: 1.1rem; }
    .sev-label { font-size: 0.85rem; font-weight: 700; color: var(--text-primary); }
    .sev-desc { font-size: 0.72rem; color: var(--text-secondary); line-height: 1.3; }

    /* ── Contact grid ── */
    .optional-step {
      background: var(--bg-surface, rgba(255,255,255,0.02));
      border: 1px solid var(--border-color, rgba(255,255,255,0.06));
      border-radius: 10px;
      padding: 1.5rem;
      margin: 0 !important;
    }
    .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

    /* ── Auth hint / error ── */
    .auth-hint {
      padding: 0.75rem 1rem;
      background: rgba(74,222,128,0.08);
      border: 1px solid rgba(74,222,128,0.2);
      border-radius: 8px;
      font-size: 0.82rem;
      color: #4ade80;
      margin-top: 1rem;
    }
    .error-banner {
      padding: 0.75rem 1rem;
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.3);
      border-radius: 8px;
      font-size: 0.85rem;
      color: #f87171;
      margin-top: 1rem;
    }

    /* ── Buttons ── */
    .form-actions { display: flex; gap: 1rem; align-items: center; justify-content: flex-end; flex-wrap: wrap; padding-top: 1.5rem; }
    .btn-primary {
      padding: 0.7rem 1.6rem;
      background: linear-gradient(90deg, #ef4444, #f97316);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.92rem;
      cursor: pointer;
      transition: opacity 0.15s;
      text-decoration: none;
      display: inline-block;
    }
    .btn-primary:hover:not(:disabled) { opacity: 0.88; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      padding: 0.7rem 1.4rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      text-decoration: none;
    }
    .btn-ghost {
      color: var(--text-secondary);
      font-size: 0.85rem;
      text-decoration: none;
      padding: 0.5rem;
      transition: color 0.15s;
    }
    .btn-ghost:hover { color: #fb923c; }

    /* ── Sidebar ── */
    .info-card {
      background: var(--bg-surface, rgba(255,255,255,0.04));
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1rem;
    }
    .tips-card { border-color: rgba(239,68,68,0.15); background: rgba(239,68,68,0.03); }
    .alt-card { background: rgba(251,146,60,0.03); border-color: rgba(251,146,60,0.15); }
    .info-title { font-size: 0.88rem; font-weight: 700; margin: 0 0 1rem; color: var(--text-primary); }
    .tips-list { margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .tips-list li { font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; }

    .severity-guide { }
    .sev-guide-row { display: flex; gap: 0.6rem; align-items: flex-start; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.06)); }
    .sev-guide-row:last-child { border-bottom: none; }
    .sev-guide-row strong { font-size: 0.8rem; color: var(--text-primary); display: block; }
    .sev-guide-desc { font-size: 0.72rem; color: var(--text-secondary); display: block; line-height: 1.3; }

    .contact-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.55rem 0;
      color: var(--text-secondary);
      font-size: 0.85rem;
      text-decoration: none;
      border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.06));
      transition: color 0.15s;
    }
    .contact-row:last-child { border-bottom: none; }
    .contact-row:hover { color: #ef4444; }

    /* ── Responsive ── */
    @media (max-width: 900px) {
      .body-wrap { grid-template-columns: 1fr; }
      .type-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 500px) {
      .severity-grid { grid-template-columns: 1fr; }
      .contact-grid { grid-template-columns: 1fr; }
      .content-type-row { flex-direction: column; }
    }
  `],
})
export class ReportIssueComponent implements OnInit {
  auth = inject(AuthService);
  route = inject(ActivatedRoute);

  form: ReportForm = {
    report_type:  'bug',
    title:        '',
    description:  '',
    page_url:     '',
    content_type: '',
    content_ref:  '',
    severity:     'medium',
    name:         '',
    email:        '',
  };

  readonly REPORT_TYPES  = REPORT_TYPES;
  readonly SEVERITIES    = SEVERITIES;
  readonly CONTENT_TYPES = CONTENT_TYPES;

  submitting = signal(false);
  submitted  = signal(false);
  error      = signal('');

  ngOnInit(): void {
    // Pre-fill type from query param: /report-issue?type=image_issue
    this.route.queryParams.subscribe(params => {
      const t = params['type'] as string | undefined;
      if (t && REPORT_TYPES.some(r => r.value === t)) {
        this.form.report_type = t;
      }
      const url = params['url'] as string | undefined;
      if (url) this.form.page_url = decodeURIComponent(url);
    });
  }

  isValid(): boolean {
    return !!this.form.report_type && !!this.form.title.trim() && !!this.form.description.trim();
  }

  async submit(): Promise<void> {
    if (!this.isValid() || this.submitting()) return;
    this.error.set('');
    this.submitting.set(true);

    try {
      const payload: Record<string, string> = {
        report_type:  this.form.report_type,
        title:        this.form.title.trim(),
        description:  this.form.description.trim(),
        severity:     this.form.severity,
      };
      if (this.form.page_url.trim())    payload['page_url']     = this.form.page_url.trim();
      if (this.form.content_type)       payload['content_type'] = this.form.content_type;
      if (this.form.content_ref.trim()) payload['content_ref']  = this.form.content_ref.trim();
      if (this.form.name.trim())        payload['name']         = this.form.name.trim();
      if (this.form.email.trim())       payload['email']        = this.form.email.trim();

      const res = await fetch('/api/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        this.submitted.set(true);
      } else {
        const data = await res.json() as { error?: string };
        this.error.set(data.error || 'Failed to submit report. Please try again.');
      }
    } catch {
      this.error.set('Network error. Please check your connection and try again.');
    } finally {
      this.submitting.set(false);
    }
  }

  reset(): void {
    this.form = {
      report_type: 'bug', title: '', description: '', page_url: '',
      content_type: '', content_ref: '', severity: 'medium', name: '', email: '',
    };
    this.submitted.set(false);
    this.error.set('');
  }
}
