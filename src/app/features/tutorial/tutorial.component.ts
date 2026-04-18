import { Component, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

interface TutorialStep {
  icon: string;
  text: string;
}

interface TutorialSection {
  id: string;
  icon: string;
  title: string;
  summary: string;
  steps: TutorialStep[];
}

interface TutorialCategory {
  id: string;
  label: string;
  icon: string;
  sections: TutorialSection[];
}

const TUTORIALS: TutorialCategory[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: '🚀',
    sections: [
      {
        id: 'what-is',
        icon: '🤖',
        title: 'What is amtocbot?',
        summary: 'An AI-driven platform publishing tech education content across blogs, videos, and podcasts.',
        steps: [
          { icon: '📝', text: 'amtocbot publishes weekly blog posts covering AI, cloud computing, security, and software engineering.' },
          { icon: '🎬', text: 'Video tutorials on YouTube — from beginner explainers to deep technical walkthroughs.' },
          { icon: '🎙️', text: 'Podcast episodes you can listen to on Spotify and other platforms.' },
          { icon: '💻', text: 'Interactive coding lessons with live playgrounds for TypeScript, HTML, Java, and Linux.' },
          { icon: '📊', text: 'Transparent metrics — see exactly how the content is performing across all platforms.' },
        ],
      },
      {
        id: 'navigation',
        icon: '🧭',
        title: 'Navigating the Site',
        summary: 'Find your way around using the header navigation and dropdown menus.',
        steps: [
          { icon: '▾', text: 'Use the Learn dropdown (Blog, Videos, Podcasts, Tutorials) to browse all content types.' },
          { icon: '👥', text: 'The Community dropdown has the About page, Resources, and Metrics dashboard.' },
          { icon: '🌙', text: 'Toggle dark / light mode with the theme button in the top-right corner.' },
          { icon: '📱', text: 'On mobile, tap the hamburger menu (three lines) to open the full navigation.' },
          { icon: '🔗', text: 'The Get Courses → button links to the AmtocSoft course catalog.' },
        ],
      },
      {
        id: 'theme',
        icon: '🎨',
        title: 'Dark & Light Mode',
        summary: 'Switch between dark and light themes to suit your reading environment.',
        steps: [
          { icon: '☀️', text: 'Click the sun/moon icon in the header to toggle between dark and light mode.' },
          { icon: '💾', text: 'Your preference is saved in your browser and persists across visits.' },
          { icon: '📱', text: 'On mobile, the theme toggle is at the bottom of the navigation drawer.' },
        ],
      },
    ],
  },
  {
    id: 'content',
    label: 'Browsing Content',
    icon: '📚',
    sections: [
      {
        id: 'blog',
        icon: '📝',
        title: 'Reading Blog Posts',
        summary: 'Deep-dive technical articles, beginner guides, and industry analysis.',
        steps: [
          { icon: '🗂️', text: 'Go to Blog in the Learn dropdown to see all published posts.' },
          { icon: '🔍', text: 'Posts are sorted newest-first. Each card shows the topic, level (Beginner/Intermediate/Advanced), and publish date.' },
          { icon: '🏷️', text: 'Look for the level badge — Beginner posts use simple analogies; Advanced posts dive into architecture and tradeoffs.' },
          { icon: '🔗', text: 'Click the post title or "Read post" to open the full article on Blogger.' },
          { icon: '↗️', text: 'Each blog post links out to related videos, LinkedIn articles, and Reddit discussions.' },
        ],
      },
      {
        id: 'videos',
        icon: '🎬',
        title: 'Watching Videos',
        summary: 'YouTube videos ranging from quick explainers to 15-minute deep dives.',
        steps: [
          { icon: '▶️', text: 'Go to Videos in the Learn dropdown to browse all uploads.' },
          { icon: '🃏', text: 'Each card shows the video thumbnail, title, topic, and view count from YouTube.' },
          { icon: '🖱️', text: 'Click any card to open the video directly on YouTube.' },
          { icon: '📌', text: 'Videos are typically 10–15 minutes — long enough to be thorough, short enough to finish in one sitting.' },
          { icon: '🔔', text: 'Subscribe on YouTube (@quietsentinelshadow) to get notified when new videos drop.' },
        ],
      },
      {
        id: 'podcasts',
        icon: '🎙️',
        title: 'Listening to Podcasts',
        summary: 'Audio-first tech discussions — listen on Spotify while commuting or coding.',
        steps: [
          { icon: '🎧', text: 'Go to Podcasts in the Learn dropdown to see all episodes.' },
          { icon: '▶️', text: 'You can play episodes directly in the browser using the embedded Spotify player.' },
          { icon: '📱', text: 'Episodes are also available on the Spotify app — search for "Bot Thoughts".' },
          { icon: '📋', text: 'Each episode page includes full show notes, timestamps, and links to related blog posts.' },
        ],
      },
    ],
  },
  {
    id: 'learning',
    label: 'Learning Platform',
    icon: '🎓',
    sections: [
      {
        id: 'courses',
        icon: '📖',
        title: 'Finding Your Learning Path',
        summary: 'Structured curricula with lessons, exercises, and interactive playgrounds.',
        steps: [
          { icon: '📚', text: 'Go to Learn from the Learn dropdown (or visit /learn) to see all available tracks.' },
          { icon: '🗺️', text: 'Currently available tracks: TypeScript, HTML, Java, and Linux.' },
          { icon: '📊', text: 'Each track is divided into levels — Beginner → Intermediate → Advanced. Start at the beginning if you are new.' },
          { icon: '📑', text: 'Click a track to browse its lessons. Each lesson card shows the topic and estimated time.' },
          { icon: '✅', text: 'Work through lessons in order — each builds on the previous one.' },
        ],
      },
      {
        id: 'playground',
        icon: '⚗️',
        title: 'Using the Code Playground',
        summary: 'Run TypeScript, HTML, and Linux commands live in your browser — no setup required.',
        steps: [
          { icon: '🖊️', text: 'Open a lesson and click the Playground tab to switch to the interactive editor.' },
          { icon: '▶️', text: 'Type your code and click Run (or press Ctrl+Enter) to execute it.' },
          { icon: '💡', text: 'The TypeScript playground compiles your code in real time and shows output and errors inline.' },
          { icon: '🌐', text: 'The HTML playground renders your markup live in a preview pane.' },
          { icon: '🐧', text: 'The Linux playground gives you a sandboxed terminal to practice shell commands.' },
        ],
      },
    ],
  },
  {
    id: 'team',
    label: 'For Team Members',
    icon: '🛠️',
    sections: [
      {
        id: 'dashboard',
        icon: '📊',
        title: 'The Dashboard',
        summary: 'The central hub for content QA, issue tracking, and team management.',
        steps: [
          { icon: '🔑', text: 'Access the Dashboard at /dashboard. You must be logged in with an assigned role.' },
          { icon: '📋', text: 'The Overview tab shows open issues, pending approvals, and recent activity.' },
          { icon: '✅', text: 'Content QA tab: review content items, update their QA status (draft → in_review → approved → published).' },
          { icon: '🐛', text: 'Issues tab: browse, create, comment on, and resolve tracked issues.' },
          { icon: '👥', text: 'Users tab (admin only): invite new team members and manage roles.' },
        ],
      },
      {
        id: 'roles',
        icon: '🎭',
        title: 'Roles & Permissions',
        summary: 'Each role has specific capabilities within the dashboard.',
        steps: [
          { icon: '🧪', text: 'Tester: Create issues, update QA status, submit for review, flag content.' },
          { icon: '✔️', text: 'Approver: Approve or reject content in review, close issues.' },
          { icon: '👁️', text: 'Reviewer: Read-only access to all content and issues; can add comments.' },
          { icon: '⚙️', text: 'Admin: Full access to all dashboard features plus user management.' },
          { icon: '🔐', text: 'Superadmin: All admin permissions plus audit logs and session management.' },
        ],
      },
      {
        id: 'planner',
        icon: '📅',
        title: 'Using the Content Planner',
        summary: 'View and manage the weekly content calendar from the Planner.',
        steps: [
          { icon: '📅', text: 'Go to /planner (login required) to see the weekly content schedule.' },
          { icon: '💡', text: 'AI-generated content proposals appear here, pulled from trending topics.' },
          { icon: '✏️', text: 'Edit individual calendar items — change the title, topic, or type.' },
          { icon: '✅', text: 'Approve a proposal to lock it in for the week.' },
          { icon: '🔄', text: 'Request a regeneration if the proposal does not match current priorities.' },
        ],
      },
    ],
  },
  {
    id: 'support',
    label: 'Help & Support',
    icon: '💬',
    sections: [
      {
        id: 'report-guide',
        icon: '🐛',
        title: 'Reporting an Issue',
        summary: 'Found a bug, broken video, or wrong image? Let us know and we will fix it.',
        steps: [
          { icon: '🔗', text: 'Click Report Issue in the navigation header or go to /report-issue.' },
          { icon: '🏷️', text: 'Select the issue type: Bug, Image Issue, Video Issue, Content Error, Performance, or Other.' },
          { icon: '✏️', text: 'Write a clear title and a detailed description — include what you expected vs what you saw.' },
          { icon: '🔗', text: 'Paste the URL of the page where you found the issue in the Page URL field.' },
          { icon: '⚠️', text: 'Set the severity: Low (cosmetic) → Medium (noticeable) → High (major error) → Critical (blocks usage).' },
          { icon: '📧', text: 'Optionally add your email if you would like to receive an update when it is resolved.' },
        ],
      },
      {
        id: 'feedback-guide',
        icon: '💡',
        title: 'Giving Feedback',
        summary: 'Suggestions, ideas, and general comments are always welcome.',
        steps: [
          { icon: '🔗', text: 'Go to /feedback or click Feedback in the Community navigation dropdown.' },
          { icon: '🗂️', text: 'Pick a category: Suggestion, Improvement, UX, Content, General, or Other.' },
          { icon: '✏️', text: 'Write a short subject and then explain your idea or comment in the message box.' },
          { icon: '📧', text: 'Adding your email is optional but lets us follow up with questions or updates.' },
          { icon: '📩', text: 'All feedback is read by the team — we use it to prioritise improvements.' },
        ],
      },
      {
        id: 'contact',
        icon: '✉️',
        title: 'Contact Us',
        summary: 'Reach out directly for anything not covered above.',
        steps: [
          { icon: '📧', text: 'Email: hello@amtocbot.com — monitored daily.' },
          { icon: '𝕏', text: 'X / Twitter: @AmToc96282 — quick questions and public conversation.' },
          { icon: 'in', text: 'LinkedIn: linkedin.com/in/toc-am-b301373b4/ — professional enquiries.' },
          { icon: '🐙', text: 'GitHub: github.com/amtocbot-droid — code-level issues and PRs.' },
        ],
      },
    ],
  },
];

@Component({
  selector: 'app-tutorial',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="tutorial-page">

      <!-- Page hero -->
      <div class="page-hero">
        <div class="hero-inner">
          <div class="hero-badge">Help Centre</div>
          <h1 class="hero-title">How to use amtocbot</h1>
          <p class="hero-sub">
            Everything you need to get the most out of the platform — from browsing content
            to using the team dashboard.
          </p>
          <div class="hero-actions">
            <a routerLink="/feedback" class="cta-primary">💡 Give Feedback</a>
            <a routerLink="/report-issue" class="cta-secondary">🐛 Report an Issue</a>
          </div>
        </div>
      </div>

      <!-- Body: sidebar + content -->
      <div class="body-wrap">

        <!-- Sidebar category nav -->
        <aside class="sidebar">
          <p class="sidebar-label">On this page</p>
          @for (cat of TUTORIALS; track cat.id) {
            <button
              class="sidebar-cat"
              [class.active]="activeCategory() === cat.id"
              (click)="setCategory(cat.id)">
              <span class="cat-icon">{{ cat.icon }}</span>
              {{ cat.label }}
            </button>
          }
          <div class="sidebar-divider"></div>
          <div class="sidebar-links">
            <a routerLink="/feedback" class="sidebar-link">💡 Give feedback</a>
            <a routerLink="/report-issue" class="sidebar-link">🐛 Report an issue</a>
            <a routerLink="/learn" class="sidebar-link">📚 Browse tutorials</a>
          </div>
        </aside>

        <!-- Main content area -->
        <main class="main-content">

          @for (cat of TUTORIALS; track cat.id) {
            @if (activeCategory() === cat.id) {
              <div class="category-header">
                <span class="cat-emoji">{{ cat.icon }}</span>
                <div>
                  <h2 class="cat-title">{{ cat.label }}</h2>
                  <p class="cat-count">{{ cat.sections.length }} section{{ cat.sections.length !== 1 ? 's' : '' }}</p>
                </div>
              </div>

              @for (section of cat.sections; track section.id) {
                <div class="section-card">
                  <div class="section-header" (click)="toggleSection(section.id)">
                    <div class="section-title-row">
                      <span class="section-icon">{{ section.icon }}</span>
                      <div>
                        <h3 class="section-title">{{ section.title }}</h3>
                        <p class="section-summary">{{ section.summary }}</p>
                      </div>
                    </div>
                    <span class="section-chevron" [class.open]="openSection() === section.id">▾</span>
                  </div>

                  @if (openSection() === section.id) {
                    <div class="section-steps">
                      @for (step of section.steps; track $index) {
                        <div class="step-row">
                          <span class="step-num">{{ $index + 1 }}</span>
                          <span class="step-icon">{{ step.icon }}</span>
                          <p class="step-text">{{ step.text }}</p>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            }
          }

        </main>
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; }

    /* ── Hero ── */
    .tutorial-page {
      min-height: 100vh;
      background: var(--bg-primary, #0a0a0a);
      color: var(--text-primary, #e2e8f0);
    }
    .page-hero {
      background: linear-gradient(135deg, rgba(251,146,60,0.08) 0%, rgba(244,63,94,0.06) 100%);
      border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08));
      padding: 4rem 1.5rem 3rem;
    }
    .hero-inner {
      max-width: 720px;
      margin: 0 auto;
      text-align: center;
    }
    .hero-badge {
      display: inline-block;
      padding: 0.3rem 0.9rem;
      background: rgba(251,146,60,0.15);
      border: 1px solid rgba(251,146,60,0.3);
      border-radius: 20px;
      font-size: 0.78rem;
      font-weight: 600;
      color: #fb923c;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1.25rem;
    }
    .hero-title {
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 800;
      margin: 0 0 1rem;
      background: linear-gradient(135deg, #fb923c, #f43f5e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero-sub {
      font-size: 1.05rem;
      color: var(--text-secondary, #9ca3af);
      line-height: 1.7;
      margin: 0 0 2rem;
    }
    .hero-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    .cta-primary {
      padding: 0.65rem 1.5rem;
      background: linear-gradient(90deg, #fb923c, #f43f5e);
      color: #fff;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.92rem;
      text-decoration: none;
      transition: opacity 0.15s;
    }
    .cta-primary:hover { opacity: 0.88; }
    .cta-secondary {
      padding: 0.65rem 1.5rem;
      background: var(--bg-surface, rgba(255,255,255,0.06));
      border: 1px solid var(--border-color, rgba(255,255,255,0.12));
      color: var(--text-primary, #e2e8f0);
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.92rem;
      text-decoration: none;
      transition: background 0.15s;
    }
    .cta-secondary:hover { background: rgba(255,255,255,0.1); }

    /* ── Body layout ── */
    .body-wrap {
      max-width: 1100px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 2.5rem;
      align-items: start;
    }

    /* ── Sidebar ── */
    .sidebar {
      position: sticky;
      top: 76px;
      background: var(--bg-surface, rgba(255,255,255,0.04));
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
      border-radius: 12px;
      padding: 1.25rem;
    }
    .sidebar-label {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-secondary, #9ca3af);
      margin: 0 0 0.75rem;
    }
    .sidebar-cat {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      width: 100%;
      background: none;
      border: none;
      padding: 0.55rem 0.75rem;
      border-radius: 8px;
      color: var(--text-secondary, #9ca3af);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
      transition: color 0.15s, background 0.15s;
      margin-bottom: 0.1rem;
    }
    .sidebar-cat:hover { color: var(--text-primary, #e2e8f0); background: rgba(255,255,255,0.06); }
    .sidebar-cat.active {
      color: #fb923c;
      background: rgba(251,146,60,0.12);
      font-weight: 600;
    }
    .cat-icon { font-size: 1rem; flex-shrink: 0; }
    .sidebar-divider {
      height: 1px;
      background: var(--border-color, rgba(255,255,255,0.08));
      margin: 1rem 0;
    }
    .sidebar-links { display: flex; flex-direction: column; gap: 0.15rem; }
    .sidebar-link {
      display: block;
      padding: 0.45rem 0.75rem;
      border-radius: 8px;
      color: var(--text-secondary, #9ca3af);
      font-size: 0.82rem;
      text-decoration: none;
      transition: color 0.15s;
    }
    .sidebar-link:hover { color: #fb923c; }

    /* ── Category header ── */
    .category-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .cat-emoji { font-size: 2.5rem; }
    .cat-title { font-size: 1.5rem; font-weight: 800; margin: 0 0 0.2rem; }
    .cat-count { font-size: 0.82rem; color: var(--text-secondary); margin: 0; }

    /* ── Section cards ── */
    .section-card {
      background: var(--bg-surface, rgba(255,255,255,0.03));
      border: 1px solid var(--border-color, rgba(255,255,255,0.08));
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      transition: border-color 0.2s;
    }
    .section-card:hover { border-color: rgba(251,146,60,0.25); }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      cursor: pointer;
      gap: 1rem;
    }
    .section-title-row {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      flex: 1;
    }
    .section-icon { font-size: 1.5rem; flex-shrink: 0; margin-top: 0.1rem; }
    .section-title { font-size: 1.05rem; font-weight: 700; margin: 0 0 0.25rem; }
    .section-summary { font-size: 0.85rem; color: var(--text-secondary, #9ca3af); margin: 0; line-height: 1.5; }
    .section-chevron {
      font-size: 1rem;
      color: var(--text-secondary);
      transition: transform 0.2s;
      flex-shrink: 0;
    }
    .section-chevron.open { transform: rotate(180deg); }

    /* ── Steps ── */
    .section-steps {
      border-top: 1px solid var(--border-color, rgba(255,255,255,0.06));
      padding: 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }
    .step-row {
      display: flex;
      align-items: flex-start;
      gap: 0.9rem;
    }
    .step-num {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(251,146,60,0.15);
      border: 1px solid rgba(251,146,60,0.3);
      color: #fb923c;
      font-size: 0.72rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 0.1rem;
    }
    .step-icon { font-size: 1rem; flex-shrink: 0; margin-top: 0.05rem; }
    .step-text { font-size: 0.9rem; color: var(--text-secondary, #9ca3af); line-height: 1.6; margin: 0; }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .body-wrap {
        grid-template-columns: 1fr;
        padding: 1.5rem 1rem;
      }
      .sidebar {
        position: static;
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        padding: 1rem;
      }
      .sidebar-label, .sidebar-divider, .sidebar-links { display: none; }
      .sidebar-cat {
        flex: 0 0 auto;
        padding: 0.4rem 0.75rem;
        font-size: 0.8rem;
        border: 1px solid var(--border-color, rgba(255,255,255,0.1));
      }
      .section-header { padding: 1rem; }
      .section-steps { padding: 1rem; }
    }
  `],
})
export class TutorialComponent {
  readonly TUTORIALS = TUTORIALS;

  activeCategory = signal(TUTORIALS[0].id);
  openSection    = signal<string | null>(TUTORIALS[0].sections[0].id);

  setCategory(id: string): void {
    this.activeCategory.set(id);
    const cat = TUTORIALS.find(c => c.id === id);
    this.openSection.set(cat?.sections[0]?.id ?? null);
  }

  toggleSection(id: string): void {
    this.openSection.set(this.openSection() === id ? null : id);
  }
}
