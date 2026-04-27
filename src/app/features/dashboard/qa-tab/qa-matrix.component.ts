import { Component, Input, OnChanges, SimpleChanges, inject, DestroyRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { QaAckDialogComponent, AckDialogData } from './qa-ack-dialog.component';

interface CheckCell {
  status: string;
  error_detail: string | null;
  ack: { acknowledged_by: number; reason: string; expires_at: string; acknowledged_at: string } | null;
}

interface MatrixRow {
  content_code: string;
  content_kind: string;
  content_title: string | null;
  checks: Record<string, CheckCell>;
}

interface MatrixResponse {
  run_id: number;
  run: {
    source: string;
    started_at: string;
    finished_at: string;
    total_checks: number;
    total_pass: number;
    total_fail: number;
    total_na: number;
    notes: string | null;
  };
  rows: MatrixRow[];
  check_types: string[];
  total_rows: number;
}

@Component({
  selector: 'app-qa-matrix',
  standalone: true,
  imports: [CommonModule, DatePipe, MatProgressSpinnerModule, MatTooltipModule],
  template: `
    <div class="matrix-container">
      @if (loading) {
        <div class="matrix-loading">
          <mat-spinner diameter="36"></mat-spinner>
          <span>Loading matrix…</span>
        </div>
      } @else if (error) {
        <div class="matrix-error">{{ error }}</div>
      } @else if (!data) {
        <div class="matrix-empty">No run data available.</div>
      } @else {
        <div class="matrix-meta">
          <span>{{ data.total_rows }} items · {{ data.run.total_checks }} checks</span>
          <span class="meta-sep">|</span>
          <span class="meta-pass">{{ data.run.total_pass }} pass</span>
          <span class="meta-fail">{{ data.run.total_fail }} fail</span>
          <span class="meta-na">{{ data.run.total_na }} n/a</span>
          @if (data.run.finished_at) {
            <span class="meta-sep">|</span>
            <span class="meta-date">{{ data.run.finished_at | date:'MMM d, HH:mm' }}</span>
          }
        </div>

        <div class="matrix-scroll-wrapper">
          <table class="matrix-table">
            <thead>
              <tr>
                <th class="col-code">Code</th>
                <th class="col-kind">Kind</th>
                @for (ct of data.check_types; track ct) {
                  <th class="col-check" [matTooltip]="ct">{{ ct.slice(0, 8) }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of data.rows; track row.content_code) {
                <tr>
                  <td class="col-code" [matTooltip]="row.content_title ?? ''">{{ row.content_code }}</td>
                  <td class="col-kind">{{ row.content_kind }}</td>
                  @for (ct of data.check_types; track ct) {
                    <td
                      class="cell"
                      [class]="cellClass(row.checks[ct])"
                      [matTooltip]="cellTooltip(row.checks[ct])"
                      (click)="openCell(row, ct)">
                      {{ cellIcon(row.checks[ct]) }}
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .matrix-container { width: 100%; }
    .matrix-loading { display: flex; align-items: center; gap: 12px; padding: 32px; color: #888; }
    .matrix-error { padding: 16px; color: #c62828; }
    .matrix-empty { padding: 16px; color: #888; }
    .matrix-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #666; padding: 8px 0 12px; flex-wrap: wrap; }
    .meta-sep { color: #ccc; }
    .meta-pass { color: #2e7d32; font-weight: 500; }
    .meta-fail { color: #c62828; font-weight: 500; }
    .meta-na { color: #888; }
    .meta-date { color: #888; }
    .matrix-scroll-wrapper { overflow-x: auto; border: 1px solid #e0e0e0; border-radius: 8px; }
    .matrix-table { border-collapse: collapse; min-width: 100%; font-size: 12px; }
    .matrix-table th, .matrix-table td { border: 1px solid #f0f0f0; white-space: nowrap; }
    .matrix-table thead th { background: #fafafa; font-weight: 500; padding: 6px 8px; position: sticky; top: 0; z-index: 2; }
    .col-code { min-width: 80px; max-width: 100px; font-weight: 500; padding: 4px 8px; position: sticky; left: 0; background: white; z-index: 1; overflow: hidden; text-overflow: ellipsis; }
    .col-kind { min-width: 70px; padding: 4px 6px; color: #888; }
    .col-check { min-width: 36px; max-width: 60px; text-align: center; font-size: 10px; overflow: hidden; text-overflow: ellipsis; cursor: default; }
    .cell { width: 36px; min-width: 36px; text-align: center; cursor: pointer; font-size: 14px; padding: 2px; transition: opacity 0.1s; }
    .cell:hover { opacity: 0.75; }
    .cell-pass { background: #e8f5e9; }
    .cell-fail { background: #ffebee; }
    .cell-unknown { background: #fff8e1; }
    .cell-na { background: #f5f5f5; }
    .cell-acked { background: #e0f2f1; }
  `],
})
export class QaMatrixComponent implements OnChanges {
  @Input() runId: number | null = null;
  @Input() kindFilter = '';

  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  loading = false;
  error: string | null = null;
  data: MatrixResponse | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['runId'] || changes['kindFilter']) {
      this.load();
    }
  }

  private load(): void {
    this.loading = true;
    this.error = null;

    let url = '/api/dashboard/qa/matrix';
    const params: string[] = [];
    if (this.runId !== null) params.push(`run_id=${this.runId}`);
    if (this.kindFilter) params.push(`kind=${encodeURIComponent(this.kindFilter)}`);
    if (params.length) url += '?' + params.join('&');

    this.http.get<MatrixResponse>(url)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => { this.loading = false; this.data = resp; },
        error: (err) => { this.loading = false; this.error = err?.error?.error ?? 'Failed to load matrix.'; },
      });
  }

  cellClass(cell: CheckCell | undefined): string {
    if (!cell) return 'cell-na';
    if (cell.ack && (cell.status === 'fail' || cell.status === 'unknown')) return 'cell-acked';
    return `cell-${cell.status}`;
  }

  cellIcon(cell: CheckCell | undefined): string {
    if (!cell) return '–';
    if (cell.ack && (cell.status === 'fail' || cell.status === 'unknown')) return '✓̃';
    switch (cell.status) {
      case 'pass': return '✓';
      case 'fail': return '✗';
      case 'na': return '–';
      default: return '?';
    }
  }

  cellTooltip(cell: CheckCell | undefined): string {
    if (!cell) return 'n/a';
    let tip = cell.status;
    if (cell.error_detail) tip += ': ' + cell.error_detail.slice(0, 120);
    if (cell.ack) tip += ` [acked: ${cell.ack.reason.slice(0, 60)}]`;
    return tip;
  }

  openCell(row: MatrixRow, checkType: string): void {
    const cell = row.checks[checkType];
    const dialogData: AckDialogData = {
      content_code: row.content_code,
      content_kind: row.content_kind,
      content_title: row.content_title,
      check_type: checkType,
      status: cell?.status ?? 'na',
      error_detail: cell?.error_detail ?? null,
      existing_ack: cell?.ack ?? null,
    };

    const ref = this.dialog.open(QaAckDialogComponent, {
      data: dialogData,
      width: '560px',
    });

    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result?.acknowledged && this.data) {
        // Optimistically update cell to show acked state
        const targetRow = this.data.rows.find(r => r.content_code === row.content_code);
        if (targetRow?.checks[checkType]) {
          targetRow.checks[checkType].ack = {
            acknowledged_by: 0,
            reason: result.reason ?? '',
            expires_at: result.expires_at ?? '',
            acknowledged_at: new Date().toISOString(),
          };
        }
      }
    });
  }
}
