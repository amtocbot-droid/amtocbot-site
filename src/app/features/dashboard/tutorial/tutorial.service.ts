import { Injectable, signal, computed, inject } from '@angular/core';
import { AuthService } from '../../../shared/services/auth.service';

export interface TutorialStep {
  title: string;
  body: string;
  /** CSS selector of the element to highlight (optional) */
  target?: string;
  /** Where the tooltip appears relative to the target */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const STEPS_BY_ROLE: Record<string, TutorialStep[]> = {
  admin: [
    {
      title: 'Welcome, Admin!',
      body: 'You have full control of the platform. This tour walks you through each section of the dashboard.',
    },
    {
      title: 'Overview',
      body: 'The Overview tab shows live stats: open issues, pending approvals, total content, and recent activity across your team.',
      target: '.mat-mdc-tab-labels .mat-mdc-tab:nth-child(1)',
      placement: 'bottom',
    },
    {
      title: 'Content QA',
      body: 'Manage your content pipeline here. Use "New Content" to create items, click any row to open the detail panel, and advance items through the QA pipeline (draft → in_review → approved → published).',
      target: '.mat-mdc-tab-labels .mat-mdc-tab:nth-child(2)',
      placement: 'bottom',
    },
    {
      title: 'Issues Tracker',
      body: 'Log bugs, tasks, and content fixes. As admin you can create, assign, and close any issue. Use severity filters to prioritize.',
      target: '.mat-mdc-tab-labels .mat-mdc-tab:nth-child(3)',
      placement: 'bottom',
    },
    {
      title: 'Users & Invites',
      body: 'Invite team members by username + email and assign roles (tester, approver, reviewer, admin). Change roles inline from the user table.',
      target: '.mat-mdc-tab-labels .mat-mdc-tab:nth-child(4)',
      placement: 'bottom',
    },
    {
      title: 'Admin Controls',
      body: 'Exclusive to admins: edit site config, pause/resume automation jobs, track cross-platform publishing, manage social post drafts, and monitor the podcast/shorts production pipeline.',
      target: '.mat-mdc-tab-labels .mat-mdc-tab:last-child',
      placement: 'bottom',
    },
    {
      title: 'Automation Controls',
      body: 'Inside Admin Controls → Automation: pause individual jobs or hit "Pause All" to halt all bots immediately. Recent run logs appear at the bottom of the panel.',
    },
    {
      title: "You're all set!",
      body: "That's the full dashboard. Click the ? Help button any time to replay this tour.",
    },
  ],

  tester: [
    {
      title: 'Welcome, Tester!',
      body: 'Your job is to review content quality and log issues. Here\'s a quick tour of what you can do.',
    },
    {
      title: 'Content QA',
      body: 'Find your assigned content here. Click any row to open the detail view. Read the amber "Reviewer Instructions" block carefully — it tells you what to check.',
      target: '.mat-mdc-tab-labels .mat-mdc-tab:nth-child(2)',
      placement: 'bottom',
    },
    {
      title: 'Submitting for Review',
      body: 'Once you\'ve checked a draft item, click "Submit for Review" to advance it. Use "Flag" if something needs admin attention before it can proceed.',
    },
    {
      title: 'Leaving Feedback',
      body: 'In the content detail panel, scroll to the Feedback section. Post detailed notes about what you checked and any issues found. Approvers will read these.',
    },
    {
      title: 'Issues Tracker',
      body: 'Use the Issues tab to log bugs or content fixes. Fill in the title, description, type, and severity. You can track your open items with the status filter.',
      target: '.mat-mdc-tab-labels .mat-mdc-tab:nth-child(3)',
      placement: 'bottom',
    },
  ],

  approver: [
    {
      title: 'Welcome, Approver!',
      body: 'You review tested content and make the final call before it goes to admin for publishing. Here\'s what you need to know.',
    },
    {
      title: 'Content QA — Approval Flow',
      body: 'Filter by "in_review" status to see content ready for your decision. Open each item, read the tester feedback thread, then click Approve or Reject.',
      target: '.mat-mdc-tab-labels .mat-mdc-tab:nth-child(2)',
      placement: 'bottom',
    },
    {
      title: 'Resolving Feedback',
      body: 'In the content detail panel you can resolve or reopen tester feedback items. This helps keep the thread clean once issues are addressed.',
    },
    {
      title: 'Closing Issues',
      body: 'In the Issues tab you can close or mark issues as "Won\'t Fix" once they\'ve been addressed or triaged.',
      target: '.mat-mdc-tab-labels .mat-mdc-tab:nth-child(3)',
      placement: 'bottom',
    },
  ],

  reviewer: [
    {
      title: 'Welcome, Reviewer!',
      body: 'You have read-only access to the content pipeline so you can stay informed about what\'s being published.',
    },
    {
      title: 'Content QA',
      body: 'Browse all content items and their QA status. Click any row to open the full detail panel including body draft and reviewer instructions.',
      target: '.mat-mdc-tab-labels .mat-mdc-tab:nth-child(2)',
      placement: 'bottom',
    },
    {
      title: 'Feedback Thread',
      body: 'In the content detail view, scroll down to see the full feedback thread between testers and approvers. You can read but not post.',
    },
  ],
};

const STORAGE_KEY = (role: string) => `tutorial_done_${role}`;

@Injectable({ providedIn: 'root' })
export class TutorialService {
  private auth = inject(AuthService);

  active = signal(false);
  stepIndex = signal(0);

  steps = computed<TutorialStep[]>(() => {
    const role = this.auth.role() ?? 'reviewer';
    return STEPS_BY_ROLE[role] ?? STEPS_BY_ROLE['reviewer'];
  });

  currentStep = computed<TutorialStep | null>(() => {
    const s = this.steps();
    const i = this.stepIndex();
    return i >= 0 && i < s.length ? s[i] : null;
  });

  isLast = computed(() => this.stepIndex() >= this.steps().length - 1);

  /** Start the tour (always, regardless of localStorage) */
  start() {
    this.stepIndex.set(0);
    this.active.set(true);
  }

  /** Auto-start on first visit for this role */
  maybeAutoStart() {
    const role = this.auth.role();
    if (!role) return;
    const done = localStorage.getItem(STORAGE_KEY(role));
    if (!done) {
      this.start();
    }
  }

  next() {
    if (this.isLast()) {
      this.finish();
    } else {
      this.stepIndex.update(i => i + 1);
    }
  }

  prev() {
    this.stepIndex.update(i => Math.max(0, i - 1));
  }

  finish() {
    const role = this.auth.role();
    if (role) localStorage.setItem(STORAGE_KEY(role), '1');
    this.active.set(false);
  }
}
