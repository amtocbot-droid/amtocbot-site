// src/app/features/planner/planner.component.ts
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { SlicePipe } from '@angular/common';
import {
  PlannerService, CalendarProposal, CalendarItem, ProposalDetail,
} from './planner.service';
import { CalendarGridComponent } from './calendar-grid.component';
import { PerformancePanelComponent } from './performance-panel.component';

@Component({
  selector: 'app-planner',
  standalone: true,
  imports: [CalendarGridComponent, PerformancePanelComponent, SlicePipe],
  template: `
    <div class="planner-layout">
      <div class="planner-main">
        <!-- Top bar -->
        <div class="top-bar">
          <div class="top-info">
            @if (proposal(); as p) {
              <h2>Week of {{ p.week_start }}</h2>
              <span class="status-badge" [class]="'status-' + p.status">{{ p.status }}</span>
              @if (p.generated_at) {
                <span class="generated-at">Generated {{ p.generated_at | slice:0:16 }}</span>
              }
            } @else {
              <h2>Content Calendar</h2>
            }
          </div>
          <div class="top-actions">
            @if (!proposal()) {
              <button class="btn btn-primary" (click)="generate()" [disabled]="loading()">
                {{ loading() ? 'Generating...' : 'Generate Proposal' }}
              </button>
            } @else if (proposal()?.status === 'draft') {
              <button class="btn btn-success" (click)="approveAll()" [disabled]="loading()">Approve All</button>
              <button class="btn btn-warning" (click)="regenerateRejected()" [disabled]="loading() || rejectedCount() === 0">
                Regenerate ({{ rejectedCount() }})
              </button>
              <button class="btn btn-secondary" (click)="generate()" [disabled]="loading()">New Proposal</button>
            } @else {
              <button class="btn btn-secondary" (click)="generate()" [disabled]="loading()">New Proposal</button>
            }
          </div>
        </div>

        @if (error()) {
          <div class="error-banner">{{ error() }}</div>
        }

        <!-- Calendar grid -->
        @if (days().length > 0 && items().length > 0) {
          <app-calendar-grid
            [days]="days()"
            [items]="items()"
            (itemApproved)="approveItem($event)"
            (itemRejected)="rejectItem($event)"
            (itemUpdated)="updateItem($event)"
            (itemMoved)="moveItem($event)"
          />
        } @else if (!loading()) {
          <div class="empty-state">
            <p>No calendar proposals yet.</p>
            <p>Click <strong>Generate Proposal</strong> to create your first week.</p>
          </div>
        }

        @if (loading()) {
          <div class="loading">Fetching trends and analyzing metrics...</div>
        }

        <!-- Proposal history -->
        @if (proposals().length > 1) {
          <div class="history">
            <h3>Previous Proposals</h3>
            @for (p of proposals().slice(1); track p.id) {
              <div class="history-row" (click)="loadProposal(p.id)">
                <span>{{ p.week_start }}</span>
                <span class="status-badge" [class]="'status-' + p.status">{{ p.status }}</span>
                <span class="history-trigger">{{ p.trigger_type }}</span>
              </div>
            }
          </div>
        }
      </div>

      <!-- Performance sidebar -->
      <div class="planner-sidebar">
        <app-performance-panel
          [performanceSummary]="proposal()?.performance_summary ?? null"
          [trendSources]="proposal()?.trend_sources ?? null"
        />
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; padding: 16px; }
    .planner-layout { display: grid; grid-template-columns: 1fr 280px; gap: 16px; max-width: 1400px; margin: 0 auto; }
    .planner-main { min-width: 0; }
    .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
    .top-info { display: flex; align-items: center; gap: 12px; }
    .top-info h2 { margin: 0; color: #e2e8f0; font-size: 20px; }
    .top-actions { display: flex; gap: 8px; }
    .status-badge {
      font-size: 11px; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; font-weight: 600;
    }
    .status-draft { background: #334155; color: #94a3b8; }
    .status-approved { background: #166534; color: #22c55e; }
    .status-archived { background: #1e293b; color: #64748b; }
    .generated-at { font-size: 12px; color: #64748b; }
    .btn {
      padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;
      transition: opacity 0.15s;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-success { background: #22c55e; color: white; }
    .btn-warning { background: #eab308; color: #1e293b; }
    .btn-secondary { background: #334155; color: #94a3b8; }
    .error-banner { background: #7f1d1d; color: #fca5a5; padding: 12px; border-radius: 6px; margin-bottom: 12px; }
    .empty-state { text-align: center; color: #64748b; padding: 60px 20px; }
    .loading { text-align: center; color: #60a5fa; padding: 40px; font-style: italic; }
    .history { margin-top: 24px; }
    .history h3 { color: #94a3b8; font-size: 14px; margin-bottom: 8px; }
    .history-row {
      display: flex; gap: 12px; align-items: center; padding: 8px 12px;
      background: #1e293b; border-radius: 6px; margin-bottom: 4px; cursor: pointer;
      color: #cbd5e1; font-size: 13px;
    }
    .history-row:hover { background: #334155; }
    .history-trigger { color: #64748b; font-size: 11px; }
    @media (max-width: 900px) {
      .planner-layout { grid-template-columns: 1fr; }
      .planner-sidebar { order: -1; }
    }
  `],
})
export class PlannerComponent implements OnInit {
  private svc = inject(PlannerService);

  proposals = signal<CalendarProposal[]>([]);
  proposal = signal<CalendarProposal | null>(null);
  items = signal<CalendarItem[]>([]);
  loading = signal(false);
  error = signal('');

  days = computed(() => {
    const p = this.proposal();
    if (!p) return [];
    const d = new Date(p.week_start + 'T00:00:00Z');
    const result: string[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(d);
      day.setUTCDate(d.getUTCDate() + i);
      result.push(day.toISOString().split('T')[0]);
    }
    return result;
  });

  rejectedCount = computed(() => this.items().filter(i => i.status === 'rejected').length);

  ngOnInit(): void {
    this.loadLatest();
  }

  private loadLatest(): void {
    this.svc.listProposals(undefined, 10).subscribe({
      next: (data) => {
        this.proposals.set(data.proposals);
        if (data.proposals.length > 0) {
          this.loadProposal(data.proposals[0].id);
        }
      },
      error: (e) => this.error.set('Failed to load proposals: ' + e.message),
    });
  }

  loadProposal(id: number): void {
    this.svc.getProposal(id).subscribe({
      next: (data) => {
        this.proposal.set(data.proposal);
        this.items.set(data.items);
        this.error.set('');
      },
      error: (e) => this.error.set('Failed to load proposal: ' + e.message),
    });
  }

  generate(): void {
    this.loading.set(true);
    this.error.set('');
    this.svc.generate().subscribe({
      next: (data) => {
        this.proposal.set(data.proposal);
        this.items.set(data.items);
        this.loading.set(false);
        this.loadLatest();
      },
      error: (e) => {
        this.error.set('Generation failed: ' + e.message);
        this.loading.set(false);
      },
    });
  }

  approveAll(): void {
    const p = this.proposal();
    if (!p) return;
    this.loading.set(true);
    this.svc.approve(p.id).subscribe({
      next: (data) => {
        this.proposal.set(data.proposal);
        this.items.set(data.items);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set('Approve failed: ' + e.message);
        this.loading.set(false);
      },
    });
  }

  regenerateRejected(): void {
    const p = this.proposal();
    if (!p) return;
    this.loading.set(true);
    this.svc.regenerate(p.id).subscribe({
      next: (data) => {
        this.items.set(data.items);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set('Regenerate failed: ' + e.message);
        this.loading.set(false);
      },
    });
  }

  approveItem(item: CalendarItem): void {
    this.svc.updateItem(item.id, { status: 'approved' }).subscribe({
      next: (data) => this.replaceItem(data.item),
    });
  }

  rejectItem(item: CalendarItem): void {
    this.svc.updateItem(item.id, { status: 'rejected' }).subscribe({
      next: (data) => this.replaceItem(data.item),
    });
  }

  updateItem(event: { id: number; updates: Partial<CalendarItem> }): void {
    this.svc.updateItem(event.id, event.updates).subscribe({
      next: (data) => this.replaceItem(data.item),
    });
  }

  moveItem(event: { id: number; newDay: string }): void {
    this.svc.updateItem(event.id, { day: event.newDay }).subscribe({
      next: (data) => this.replaceItem(data.item),
    });
  }

  private replaceItem(updated: CalendarItem): void {
    this.items.update(items => items.map(i => i.id === updated.id ? updated : i));
  }
}

export default PlannerComponent;
