import { Component, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../shared/services/auth.service';

export interface AckDialogData {
  content_code: string;
  content_kind: string;
  content_title: string | null;
  check_type: string;
  status: string;
  error_detail: string | null;
  existing_ack: {
    acknowledged_by: number;
    reason: string;
    expires_at: string;
    acknowledged_at: string;
  } | null;
}

@Component({
  selector: 'app-qa-ack-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatChipsModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <span class="dialog-code">{{ data.content_code }}</span>
      <span class="dialog-sep"> · </span>
      <span class="dialog-check">{{ data.check_type }}</span>
    </h2>

    <mat-dialog-content>
      <!-- Content info -->
      @if (data.content_title) {
        <p class="content-title">{{ data.content_title }}</p>
      }
      <div class="meta-row">
        <mat-chip [class]="'status-chip status-' + data.status">{{ data.status }}</mat-chip>
        <span class="kind-label">{{ data.content_kind }}</span>
      </div>

      <!-- Error detail -->
      @if (data.error_detail) {
        <div class="error-box">
          <strong>Error:</strong> {{ data.error_detail }}
        </div>
      }

      <!-- Existing ack info -->
      @if (data.existing_ack) {
        <div class="existing-ack-box">
          <strong>Active acknowledgement:</strong><br/>
          Reason: {{ data.existing_ack.reason }}<br/>
          Acknowledged: {{ data.existing_ack.acknowledged_at | date:'MMM d, yyyy' }}<br/>
          Expires: {{ data.existing_ack.expires_at | date:'MMM d, yyyy' }}
        </div>
      }

      <!-- Ack form — only if user has permission -->
      @if (auth.hasPermission('qa.acknowledge')) {
        <div class="ack-form">
          <h3>{{ data.existing_ack ? 'Update acknowledgement' : 'Acknowledge this failure' }}</h3>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Reason</mat-label>
            <textarea matInput [(ngModel)]="reason" rows="3"
              placeholder="Why is this failure acceptable? What's the plan?"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Expires in</mat-label>
            <mat-select [(ngModel)]="expiresInDays">
              <mat-option [value]="7">7 days</mat-option>
              <mat-option [value]="14">14 days</mat-option>
              <mat-option [value]="30">30 days</mat-option>
              <mat-option [value]="90">90 days</mat-option>
            </mat-select>
          </mat-form-field>
          @if (ackError) {
            <p class="ack-error">{{ ackError }}</p>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="null">Close</button>
      @if (auth.hasPermission('qa.acknowledge')) {
        <button mat-flat-button color="primary"
          [disabled]="!reason.trim() || submitting"
          (click)="submitAck()">
          {{ submitting ? 'Saving…' : 'Acknowledge' }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-code { font-weight: 700; }
    .dialog-sep { color: #9e9e9e; }
    .dialog-check { font-weight: 400; font-size: 14px; }
    .content-title { margin: 0 0 8px; font-size: 14px; color: #555; }
    .meta-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .kind-label { font-size: 12px; color: #888; }
    .status-chip { font-size: 11px !important; padding: 2px 8px !important; }
    .status-pass { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .status-fail { background: #ffebee !important; color: #c62828 !important; }
    .status-unknown { background: #fff8e1 !important; color: #e65100 !important; }
    .status-na { background: #f5f5f5 !important; color: #616161 !important; }
    .error-box { background: #fff3e0; border-left: 3px solid #f44336; padding: 8px 12px;
      border-radius: 4px; font-size: 13px; margin-bottom: 12px; word-break: break-word; }
    .existing-ack-box { background: #e3f2fd; border-left: 3px solid #1976d2; padding: 8px 12px;
      border-radius: 4px; font-size: 13px; margin-bottom: 12px; }
    .ack-form { margin-top: 16px; }
    .ack-form h3 { font-size: 14px; font-weight: 500; margin: 0 0 12px; }
    .full-width { width: 100%; }
    .ack-error { color: #c62828; font-size: 13px; margin: 4px 0 0; }
    mat-dialog-content { min-width: 420px; max-width: 560px; }
  `],
})
export class QaAckDialogComponent {
  readonly data = inject<AckDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<QaAckDialogComponent>);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);

  reason = this.data.existing_ack?.reason ?? '';
  expiresInDays = 14;
  submitting = false;
  ackError: string | null = null;

  submitAck(): void {
    if (!this.reason.trim() || this.submitting) return;
    this.submitting = true;
    this.ackError = null;

    this.http.post<{ ack_id: number; expires_at: string }>(
      '/api/dashboard/qa/acknowledge',
      {
        content_code: this.data.content_code,
        check_type: this.data.check_type,
        reason: this.reason.trim(),
        expires_in_days: this.expiresInDays,
      }
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => this.dialogRef.close({ acknowledged: true, ...result }),
      error: (err) => {
        this.submitting = false;
        this.ackError = err?.error?.error ?? 'Failed to save acknowledgement.';
      },
    });
  }
}
