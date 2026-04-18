import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

interface FeedbackForm {
  category: string;
  subject: string;
  message: string;
  name: string;
  email: string;
}

const CATEGORIES = [
  { value: 'suggestion',   label: 'Suggestion',       icon: '💡', desc: 'Ideas for new features or content' },
  { value: 'improvement',  label: 'Improvement',       icon: '⬆️', desc: 'Ways to make existing things better' },
  { value: 'ux',           label: 'UX / Design',       icon: '🎨', desc: 'Navigation, layout, or visual issues' },
  { value: 'content',      label: 'Content Feedback',  icon: '📝', desc: 'Comments on articles, videos, or podcasts' },
  { value: 'general',      label: 'General',           icon: '💬', desc: 'Anything else on your mind' },
  { value: 'other',        label: 'Other',             icon: '📌', desc: 'If none of the above fit' },
];

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="feedback-page">

      <!-- Header -->
      <div class="page-hero">
        <div class="hero-inner">
          <div class="hero-badge">Feedback</div>
          <h1 class="hero-title">Share your thoughts</h1>
          <p class="hero-sub">
            Suggestions, ideas, or general comments — we read everything and use your
            input to improve the platform.
          </p>
          <div class="hero-meta">
            <span class="hero-meta-item">✓ No account required</span>
            <span class="hero-meta-item">✓ Responses within 48 hours</span>
            <span class="hero-meta-item">✓ All feedback is read by the team</span>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div class="body-wrap">

        @if (submitted()) {
          <!-- Success state -->
          <div class="success-card">
            <div class="success-icon">✅</div>
            <h2 class="success-title">Thank you!</h2>
            <p class="success-msg">Your feedback has been received. We genuinely appreciate you taking the time.</p>
            <div class="success-actions">
              <button class="btn-secondary" (click)="reset()">Send more feedback</button>
              <a routerLink="/" class="btn-primary">Back to home</a>
            </div>
          </div>

        } @else {
          <div class="form-layout">

            <!-- Category selector -->
            <div class="form-section">
              <label class="field-label">Category <span class="required">*</span></label>
              <div class="category-grid">
                @for (cat of CATEGORIES; track cat.value) {
                  <button
                    type="button"
                    class="cat-card"
                    [class.selected]="form.category === cat.value"
                    (click)="form.category = cat.value">
                    <span class="cat-icon">{{ cat.icon }}</span>
                    <span class="cat-label">{{ cat.label }}</span>
                    <span class="cat-desc">{{ cat.desc }}</span>
                  </button>
                }
              </div>
            </div>

            <!-- Subject -->
            <div class="form-section">
              <label class="field-label" for="subject">Subject <span class="required">*</span></label>
              <input
                id="subject"
                class="field-input"
                type="text"
                [(ngModel)]="form.subject"
                placeholder="Brief description of your feedback"
                maxlength="200"
                autocomplete="off" />
              <span class="char-count">{{ form.subject.length }}/200</span>
            </div>

            <!-- Message -->
            <div class="form-section">
              <label class="field-label" for="message">Message <span class="required">*</span></label>
              <textarea
                id="message"
                class="field-textarea"
                [(ngModel)]="form.message"
                placeholder="Describe your idea or feedback in detail. The more context the better!"
                maxlength="5000"
                rows="7"></textarea>
              <span class="char-count">{{ form.message.length }}/5000</span>
            </div>

            <!-- Optional contact -->
            <div class="form-section optional-section">
              <h3 class="optional-heading">Contact details <span class="optional-badge">Optional</span></h3>
              <p class="optional-note">Add your details if you'd like us to follow up with you.</p>
              <div class="contact-grid">
                <div class="field-wrap">
                  <label class="field-label-sm" for="name">Name</label>
                  <input
                    id="name"
                    class="field-input"
                    type="text"
                    [(ngModel)]="form.name"
                    placeholder="Your name"
                    maxlength="100"
                    autocomplete="name" />
                </div>
                <div class="field-wrap">
                  <label class="field-label-sm" for="email">Email</label>
                  <input
                    id="email"
                    class="field-input"
                    type="email"
                    [(ngModel)]="form.email"
                    placeholder="your@email.com"
                    maxlength="200"
                    autocomplete="email" />
                </div>
              </div>
            </div>

            <!-- Auth status hint -->
            @if (auth.authenticated()) {
              <div class="auth-hint">
                <span class="auth-icon">✓</span>
                Signed in as <strong>{{ auth.username() }}</strong> — your submission will be linked to your account.
              </div>
            }

            <!-- Error -->
            @if (error()) {
              <div class="error-banner">⚠️ {{ error() }}</div>
            }

            <!-- Actions -->
            <div class="form-actions">
              <a routerLink="/report-issue" class="btn-ghost">🐛 Report a bug instead</a>
              <button
                class="btn-primary"
                [disabled]="submitting() || !isValid()"
                (click)="submit()">
                @if (submitting()) { Sending… } @else { Send Feedback }
              </button>
            </div>

          </div>
        }

        <!-- Side info -->
        <aside class="side-info">
          <div class="info-card">
            <h3 class="info-title">What happens next?</h3>
            <div class="info-steps">
              <div class="info-step">
                <span class="step-dot">1</span>
                <p>Your feedback is stored securely and tagged by category.</p>
              </div>
              <div class="info-step">
                <span class="step-dot">2</span>
                <p>The team reviews all submissions weekly during planning.</p>
              </div>
              <div class="info-step">
                <span class="step-dot">3</span>
                <p>High-impact ideas get promoted to the content or development roadmap.</p>
              </div>
              <div class="info-step">
                <span class="step-dot">4</span>
                <p>If you left an email, we'll reach out when your suggestion is actioned.</p>
              </div>
            </div>
          </div>
          <div class="info-card alt-card">
            <h3 class="info-title">Other ways to reach us</h3>
            <a href="mailto:hello@amtocbot.com" class="contact-row">
              <span>✉️</span> hello@amtocbot.com
            </a>
            <a href="https://x.com/AmToc96282" target="_blank" rel="noopener" class="contact-row">
              <span>𝕏</span> @AmToc96282
            </a>
            <a routerLink="/report-issue" class="contact-row">
              <span>🐛</span> Report an issue
            </a>
            <a routerLink="/tutorial" class="contact-row">
              <span>📖</span> View help tutorials
            </a>
          </div>
        </aside>

      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .feedback-page { min-height: 100vh; background: var(--bg-primary, #0a0a0a); color: var(--text-primary, #e2e8f0); }

    /* ── Hero ── */
    .page-hero {
      background: linear-gradient(135deg, rgba(251,146,60,0.07) 0%, rgba(244,63,94,0.05) 100%);
      border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08));
      padding: 3.5rem 1.5rem 2.5rem;
    }
    .hero-inner { max-width: 700px; margin: 0 auto; text-align: center; }
    .hero-badge {
      display: inline-block;
      padding: 0.28rem 0.85rem;
      background: rgba(251,146,60,0.15);
      border: 1px solid rgba(251,146,60,0.3);
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 700;
      color: #fb923c;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }
    .hero-title {
      font-size: clamp(1.8rem, 4vw, 2.6rem);
      font-weight: 800;
      margin: 0 0 0.85rem;
      background: linear-gradient(135deg, #fb923c, #f43f5e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero-sub { font-size: 1rem; color: var(--text-secondary, #9ca3af); line-height: 1.7; margin: 0 0 1.5rem; }
    .hero-meta { display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap; }
    .hero-meta-item { font-size: 0.82rem; color: #4ade80; font-weight: 500; }

    /* ── Body ── */
    .body-wrap {
      max-width: 1100px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
      display: grid;
      grid-template-columns: 1fr 300px;
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

    /* ── Category grid ── */
    .form-layout { display: flex; flex-direction: column; gap: 1.75rem; }
    .form-section { display: flex; flex-direction: column; gap: 0.6rem; }
    .field-label { font-size: 0.875rem; font-weight: 600; color: var(--text-primary); }
    .required { color: #f43f5e; margin-left: 2px; }
    .category-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
    .cat-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
      padding: 0.85rem 0.5rem;
      background: var(--bg-surface, rgba(255,255,255,0.04));
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
      border-radius: 10px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
      text-align: center;
    }
    .cat-card:hover { border-color: rgba(251,146,60,0.35); background: rgba(251,146,60,0.06); }
    .cat-card.selected {
      border-color: #fb923c;
      background: rgba(251,146,60,0.12);
    }
    .cat-icon { font-size: 1.3rem; }
    .cat-label { font-size: 0.8rem; font-weight: 600; color: var(--text-primary); }
    .cat-desc { font-size: 0.7rem; color: var(--text-secondary); line-height: 1.3; }

    /* ── Fields ── */
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
    .field-input:focus, .field-textarea:focus { border-color: #fb923c; }
    .field-textarea { resize: vertical; min-height: 160px; }
    .char-count { font-size: 0.75rem; color: var(--text-secondary); text-align: right; }

    /* ── Optional contact ── */
    .optional-section {
      padding: 1.25rem;
      background: var(--bg-surface, rgba(255,255,255,0.03));
      border: 1px solid var(--border-color, rgba(255,255,255,0.07));
      border-radius: 10px;
    }
    .optional-heading { font-size: 0.9rem; font-weight: 700; margin: 0 0 0.3rem; display: flex; align-items: center; gap: 0.75rem; }
    .optional-badge {
      font-size: 0.7rem;
      padding: 0.15rem 0.5rem;
      background: rgba(156,163,175,0.15);
      border: 1px solid rgba(156,163,175,0.25);
      border-radius: 20px;
      color: #9ca3af;
      font-weight: 500;
    }
    .optional-note { font-size: 0.82rem; color: var(--text-secondary); margin: 0 0 1rem; }
    .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .field-wrap { display: flex; flex-direction: column; gap: 0.4rem; }
    .field-label-sm { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }

    /* ── Auth hint ── */
    .auth-hint {
      padding: 0.75rem 1rem;
      background: rgba(74,222,128,0.08);
      border: 1px solid rgba(74,222,128,0.2);
      border-radius: 8px;
      font-size: 0.82rem;
      color: #4ade80;
    }
    .auth-icon { margin-right: 0.4rem; }

    /* ── Error ── */
    .error-banner {
      padding: 0.75rem 1rem;
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.3);
      border-radius: 8px;
      font-size: 0.85rem;
      color: #f87171;
    }

    /* ── Buttons ── */
    .form-actions { display: flex; gap: 1rem; align-items: center; justify-content: flex-end; flex-wrap: wrap; }
    .btn-primary {
      padding: 0.7rem 1.6rem;
      background: linear-gradient(90deg, #fb923c, #f43f5e);
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

    /* ── Sidebar info ── */
    .info-card {
      background: var(--bg-surface, rgba(255,255,255,0.04));
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1rem;
    }
    .alt-card { background: rgba(251,146,60,0.04); border-color: rgba(251,146,60,0.15); }
    .info-title { font-size: 0.88rem; font-weight: 700; margin: 0 0 1rem; color: var(--text-primary); }
    .info-steps { display: flex; flex-direction: column; gap: 0.85rem; }
    .info-step { display: flex; gap: 0.75rem; align-items: flex-start; }
    .step-dot {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(251,146,60,0.15);
      border: 1px solid rgba(251,146,60,0.3);
      color: #fb923c;
      font-size: 0.7rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 0.1rem;
    }
    .info-step p { font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; margin: 0; }
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
    .contact-row:hover { color: #fb923c; }

    @media (max-width: 900px) {
      .body-wrap { grid-template-columns: 1fr; }
      .side-info { order: -1; }
      .category-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 500px) {
      .contact-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class FeedbackComponent {
  auth = inject(AuthService);

  form: FeedbackForm = { category: 'suggestion', subject: '', message: '', name: '', email: '' };
  readonly CATEGORIES = CATEGORIES;

  submitting = signal(false);
  submitted  = signal(false);
  error      = signal('');

  isValid(): boolean {
    return !!this.form.category && !!this.form.subject.trim() && !!this.form.message.trim();
  }

  async submit(): Promise<void> {
    if (!this.isValid() || this.submitting()) return;
    this.error.set('');
    this.submitting.set(true);

    try {
      const payload: Record<string, string> = {
        category: this.form.category,
        subject:  this.form.subject.trim(),
        message:  this.form.message.trim(),
      };
      if (this.form.name.trim())  payload['name']  = this.form.name.trim();
      if (this.form.email.trim()) payload['email'] = this.form.email.trim();

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        this.submitted.set(true);
      } else {
        const data = await res.json() as { error?: string };
        this.error.set(data.error || 'Failed to submit feedback. Please try again.');
      }
    } catch {
      this.error.set('Network error. Please check your connection and try again.');
    } finally {
      this.submitting.set(false);
    }
  }

  reset(): void {
    this.form = { category: 'suggestion', subject: '', message: '', name: '', email: '' };
    this.submitted.set(false);
    this.error.set('');
  }
}
