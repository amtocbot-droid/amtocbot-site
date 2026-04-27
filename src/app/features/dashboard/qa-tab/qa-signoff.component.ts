import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../shared/services/auth.service';

interface EligibilityResponse {
  eligible: boolean;
  reasons: string[];
  latest_run_id: number | null;
  latest_run_finished_at: string | null;
  week_start_date: string;
  already_signed: boolean;
  count_fail: number;
  count_regressions: number;
  count_pass: number;
  count_na: number;
}

@Component({
  selector: 'app-qa-signoff',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatChipsModule],
  template: `
    <div class="signoff-container">
      <h3 class="section-title">Weekly Sign-Off</h3>

      @if (loading) {
        <p class="loading-text">Checking eligibility…</p>
      } @else if (error) {
        <p class="error-text">{{ error }}</p>
      } @else if (eligibility) {
        <!-- Stats row -->
        <div class="stats-row">
          <span class="stat stat-pass">{{ eligibility.count_pass }} pass</span>
          <span class="stat stat-fail">{{ eligibility.count_fail }} fail</span>
          <span class="stat stat-regression" [class.hidden]="!eligibility.count_regressions">
            {{ eligibility.count_regressions }} regression{{ eligibility.count_regressions !== 1 ? 's' : '' }}
          </span>
          <span class="stat stat-na">{{ eligibility.count_na }} n/a</span>
        </div>

        <!-- Already signed -->
        @if (eligibility.already_signed) {
          <div class="signed-banner">
            ✓ Week of {{ eligibility.week_start_date }} already signed off.
          </div>
        }

        <!-- Ineligible reasons -->
        @if (!eligibility.eligible && !eligibility.already_signed) {
          <div class="ineligible-box">
            <strong>Not eligible to sign off:</strong>
            <ul>
              @for (reason of eligibility.reasons; track reason) {
                <li>{{ reason }}</li>
              }
            </ul>
          </div>
        }

        <!-- Sign-off form (eligible + has permission) -->
        @if (eligibility.eligible && auth.hasPermission('qa.signoff')) {
          <div class="signoff-form">
            <p class="sign-prompt">Sign off on week of <strong>{{ eligibility.week_start_date }}</strong>?</p>
            @if (eligibility.count_regressions > 0) {
              <p class="regression-warning">⚠ {{ eligibility.count_regressions }} regression{{ eligibility.count_regressions !== 1 ? 's' : '' }} since last sign-off.</p>
            }
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Notes (optional)</mat-label>
              <textarea matInput [(ngModel)]="notes" rows="2"
                placeholder="Any notes about this week's QA state…"></textarea>
            </mat-form-field>
            @if (signoffError) {
              <p class="error-text">{{ signoffError }}</p>
            }
            <button mat-flat-button color="primary"
              [disabled]="submitting"
              (click)="submitSignoff()">
              {{ submitting ? 'Signing off…' : 'Sign Off This Week' }}
            </button>
          </div>
        }

        <!-- Signed confirmation -->
        @if (signedOff) {
          <div class="signed-banner">
            ✓ Sign-off recorded for week of {{ eligibility.week_start_date }}.
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .signoff-container { padding: 4px 0; }
    .section-title { font-size: 14px; font-weight: 500; margin: 0 0 12px; }
    .loading-text { font-size: 13px; color: #888; }
    .error-text { color: #c62828; font-size: 13px; }
    .stats-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .stat { font-size: 13px; font-weight: 500; }
    .stat-pass { color: #2e7d32; }
    .stat-fail { color: #c62828; }
    .stat-regression { color: #e65100; }
    .stat-na { color: #888; }
    .hidden { display: none; }
    .signed-banner { background: #f1f8e9; border: 1px solid #c5e1a5; border-radius: 6px;
      padding: 10px 14px; font-size: 13px; color: #33691e; margin-bottom: 12px; }
    .ineligible-box { background: #fff3e0; border: 1px solid #ffcc02; border-radius: 6px;
      padding: 10px 14px; font-size: 13px; color: #e65100; margin-bottom: 12px; }
    .ineligible-box ul { margin: 6px 0 0 16px; padding: 0; }
    .ineligible-box li { margin: 2px 0; }
    .signoff-form { margin-top: 8px; }
    .sign-prompt { font-size: 13px; margin: 0 0 8px; }
    .regression-warning { font-size: 12px; color: #e65100; margin: 0 0 12px; }
    .full-width { width: 100%; }
  `],
})
export class QaSignoffComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);

  loading = true;
  error: string | null = null;
  eligibility: EligibilityResponse | null = null;
  notes = '';
  submitting = false;
  signoffError: string | null = null;
  signedOff = false;

  ngOnInit(): void {
    this.http.get<EligibilityResponse>('/api/dashboard/qa/signoff/eligibility')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => { this.loading = false; this.eligibility = resp; },
        error: (err) => { this.loading = false; this.error = err?.error?.error ?? 'Failed to check eligibility.'; },
      });
  }

  submitSignoff(): void {
    if (this.submitting) return;
    this.submitting = true;
    this.signoffError = null;
    const body = this.notes.trim() ? { notes: this.notes.trim() } : {};
    this.http.post<{ signoff_id: number; week_start_date: string; based_on_run_id: number }>(
      '/api/dashboard/qa/signoff', body
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.submitting = false; this.signedOff = true; },
      error: (err) => { this.submitting = false; this.signoffError = err?.error?.error ?? 'Failed to sign off.'; },
    });
  }
}
