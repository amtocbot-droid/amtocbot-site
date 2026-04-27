import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface Todo {
  priority_tier: number;
  priority_label: string;
  content_code: string;
  content_kind: string;
  content_title: string | null;
  check_type: string;
  last_error: string | null;
  last_known_good_at: string | null;
  suggested_action: string;
  existing_ack_id: number | null;
  existing_issue_id: number | null;
}

@Component({
  selector: 'app-qa-todos',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatChipsModule, MatDividerModule, MatTooltipModule],
  template: `
    <div class="todos-container">
      <h3 class="section-title">Priority Fixes</h3>

      @if (loading) {
        <p class="loading-text">Loading…</p>
      } @else if (error) {
        <p class="error-text">{{ error }}</p>
      } @else if (!todos.length) {
        <div class="all-clear">
          <span class="all-clear-icon">✓</span>
          <span>No outstanding issues — all checks passing or acknowledged.</span>
        </div>
      } @else {
        <p class="todo-count">{{ todos.length }} item{{ todos.length !== 1 ? 's' : '' }} require attention</p>

        @for (group of groupedTodos; track group.tier) {
          <div class="tier-group">
            <div class="tier-header" [class]="tierHeaderClass(group.tier)">
              <span class="tier-badge">{{ group.tier }}</span>
              {{ group.label }}
              <span class="tier-count">({{ group.items.length }})</span>
            </div>
            @for (todo of group.items; track todo.content_code + todo.check_type) {
              <div class="todo-item">
                <div class="todo-row">
                  <span class="todo-code">{{ todo.content_code }}</span>
                  <mat-chip class="todo-check-chip">{{ todo.check_type }}</mat-chip>
                  @if (todo.existing_ack_id) {
                    <mat-chip class="ack-chip" matTooltip="Has acknowledgement #{{ todo.existing_ack_id }}">acked</mat-chip>
                  }
                  @if (todo.existing_issue_id) {
                    <mat-chip class="issue-chip" matTooltip="Issue #{{ todo.existing_issue_id }} open">issue</mat-chip>
                  }
                </div>
                @if (todo.content_title) {
                  <div class="todo-title">{{ todo.content_title }}</div>
                }
                @if (todo.last_error) {
                  <div class="todo-error">{{ todo.last_error | slice:0:140 }}</div>
                }
                <div class="todo-action">→ {{ todo.suggested_action }}</div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .todos-container { padding: 4px 0; }
    .section-title { font-size: 14px; font-weight: 500; margin: 0 0 12px; }
    .loading-text, .error-text { font-size: 13px; color: #888; }
    .error-text { color: #c62828; }
    .all-clear { display: flex; align-items: center; gap: 8px; padding: 16px; background: #f1f8e9; border-radius: 6px; font-size: 13px; color: #33691e; }
    .all-clear-icon { font-size: 20px; }
    .todo-count { font-size: 12px; color: #888; margin: 0 0 12px; }
    .tier-group { margin-bottom: 16px; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; }
    .tier-header { display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600; }
    .tier-header-1 { background: #ffebee; color: #c62828; }
    .tier-header-2, .tier-header-3 { background: #fff3e0; color: #e65100; }
    .tier-header-4, .tier-header-5 { background: #fffde7; color: #f57f17; }
    .tier-header-6, .tier-header-7, .tier-header-8 { background: #f5f5f5; color: #555; }
    .tier-badge { background: rgba(0,0,0,0.1); border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 10px; }
    .tier-count { margin-left: auto; font-weight: 400; opacity: 0.7; }
    .todo-item { padding: 8px 12px; border-top: 1px solid #f0f0f0; font-size: 12px; }
    .todo-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 2px; }
    .todo-code { font-weight: 600; font-size: 13px; }
    .todo-check-chip { font-size: 10px !important; padding: 0 6px !important; height: 20px !important; background: #e3f2fd !important; color: #1565c0 !important; }
    .ack-chip { font-size: 10px !important; padding: 0 6px !important; height: 20px !important; background: #e0f2f1 !important; color: #00695c !important; }
    .issue-chip { font-size: 10px !important; padding: 0 6px !important; height: 20px !important; background: #f3e5f5 !important; color: #6a1b9a !important; }
    .todo-title { color: #555; font-size: 11px; margin-bottom: 2px; }
    .todo-error { color: #b71c1c; font-size: 11px; font-family: monospace; background: #fff8f8; padding: 2px 6px; border-radius: 3px; margin: 2px 0; word-break: break-all; }
    .todo-action { color: #1976d2; font-size: 11px; margin-top: 3px; }
  `],
})
export class QaTodosComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  loading = true;
  error: string | null = null;
  todos: Todo[] = [];

  get groupedTodos(): { tier: number; label: string; items: Todo[] }[] {
    const map = new Map<number, { tier: number; label: string; items: Todo[] }>();
    for (const t of this.todos) {
      if (!map.has(t.priority_tier)) {
        map.set(t.priority_tier, { tier: t.priority_tier, label: t.priority_label, items: [] });
      }
      map.get(t.priority_tier)!.items.push(t);
    }
    return Array.from(map.values()).sort((a, b) => a.tier - b.tier);
  }

  tierHeaderClass(tier: number): string {
    if (tier === 1) return 'tier-header tier-header-1';
    if (tier <= 3) return 'tier-header tier-header-2';
    if (tier <= 5) return 'tier-header tier-header-4';
    return 'tier-header tier-header-6';
  }

  ngOnInit(): void {
    this.http.get<{ todos: Todo[]; tier_labels: string[] }>('/api/dashboard/qa/todos')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ todos }) => { this.loading = false; this.todos = todos; },
        error: (err) => { this.loading = false; this.error = err?.error?.error ?? 'Failed to load todos.'; },
      });
  }
}
