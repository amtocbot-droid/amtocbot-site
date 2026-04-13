import {
  Component, inject, AfterViewChecked, ElementRef, signal, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TutorialService } from './tutorial.service';

@Component({
  selector: 'app-tutorial',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    @if (svc.active()) {
      <!-- Backdrop -->
      <div class="tutorial-backdrop" (click)="svc.finish()"></div>

      <!-- Tooltip card -->
      <div class="tutorial-card" [style.top.px]="cardTop()" [style.left.px]="cardLeft()">
        <!-- Header -->
        <div class="tc-header">
          <span class="tc-step">{{ svc.stepIndex() + 1 }} / {{ svc.steps().length }}</span>
          <span class="tc-title">{{ svc.currentStep()?.title }}</span>
          <button mat-icon-button class="tc-close" (click)="svc.finish()" aria-label="Close tutorial">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <!-- Body -->
        <p class="tc-body">{{ svc.currentStep()?.body }}</p>

        <!-- Progress dots -->
        <div class="tc-dots">
          @for (s of svc.steps(); track $index) {
            <span class="tc-dot" [class.active]="$index === svc.stepIndex()"></span>
          }
        </div>

        <!-- Nav buttons -->
        <div class="tc-actions">
          <button mat-stroked-button [disabled]="svc.stepIndex() === 0" (click)="svc.prev()">
            <mat-icon>arrow_back</mat-icon> Back
          </button>
          <button mat-raised-button color="primary" (click)="svc.next()">
            {{ svc.isLast() ? 'Finish' : 'Next' }}
            @if (!svc.isLast()) { <mat-icon>arrow_forward</mat-icon> }
            @if (svc.isLast()) { <mat-icon>check</mat-icon> }
          </button>
        </div>
      </div>

      <!-- Highlight ring on target element -->
      @if (highlightRect()) {
        <div class="tutorial-highlight" [style]="{
          top: highlightRect()!.top + 'px',
          left: highlightRect()!.left + 'px',
          width: highlightRect()!.width + 'px',
          height: highlightRect()!.height + 'px'
        }"></div>
      }
    }
  `,
  styles: [`
    .tutorial-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.55);
      z-index: 1000; backdrop-filter: blur(1px);
    }

    .tutorial-card {
      position: fixed; z-index: 1002;
      width: 360px; background: #1e293b;
      border: 1px solid #3b82f6; border-radius: 12px;
      padding: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.6);
      transition: top 0.25s ease, left 0.25s ease;
    }

    .tc-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
    }
    .tc-step {
      background: #3b82f6; color: #fff; font-size: 10px; font-weight: 700;
      padding: 2px 8px; border-radius: 10px; white-space: nowrap;
    }
    .tc-title {
      flex: 1; font-weight: 700; font-size: 15px; color: #f1f5f9;
    }
    .tc-close {
      color: #64748b; flex-shrink: 0;
    }

    .tc-body {
      color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;
    }

    .tc-dots {
      display: flex; gap: 6px; justify-content: center; margin-bottom: 16px;
    }
    .tc-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #334155;
      transition: background 0.2s;
    }
    .tc-dot.active { background: #3b82f6; }

    .tc-actions {
      display: flex; gap: 8px; justify-content: flex-end;
    }

    .tutorial-highlight {
      position: fixed; z-index: 1001; pointer-events: none;
      border: 2px solid #3b82f6; border-radius: 6px;
      box-shadow: 0 0 0 4px rgba(59,130,246,0.25);
      transition: all 0.25s ease;
    }
  `],
})
export class TutorialComponent implements AfterViewChecked, OnDestroy {
  svc = inject(TutorialService);
  private el = inject(ElementRef);

  cardTop = signal(0);
  cardLeft = signal(0);
  highlightRect = signal<DOMRect | null>(null);

  private lastStep = -1;

  ngAfterViewChecked() {
    if (!this.svc.active()) return;
    const i = this.svc.stepIndex();
    if (i === this.lastStep) return;
    this.lastStep = i;
    this.positionCard();
  }

  ngOnDestroy() {
    this.lastStep = -1;
  }

  private positionCard() {
    const step = this.svc.currentStep();
    if (!step) return;

    const cardW = 360;
    const cardH = 220; // approx
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 16;

    if (step.target) {
      const target = document.querySelector(step.target);
      if (target) {
        const rect = target.getBoundingClientRect();
        this.highlightRect.set(rect);

        let top = 0;
        let left = 0;

        switch (step.placement) {
          case 'bottom':
            top = rect.bottom + pad;
            left = rect.left + (rect.width / 2) - (cardW / 2);
            break;
          case 'top':
            top = rect.top - cardH - pad;
            left = rect.left + (rect.width / 2) - (cardW / 2);
            break;
          case 'left':
            top = rect.top + (rect.height / 2) - (cardH / 2);
            left = rect.left - cardW - pad;
            break;
          case 'right':
            top = rect.top + (rect.height / 2) - (cardH / 2);
            left = rect.right + pad;
            break;
          default:
            top = rect.bottom + pad;
            left = rect.left;
        }

        // Clamp to viewport
        top = Math.max(pad, Math.min(top, vh - cardH - pad));
        left = Math.max(pad, Math.min(left, vw - cardW - pad));

        this.cardTop.set(top);
        this.cardLeft.set(left);
        return;
      }
    }

    // No target — center of screen
    this.highlightRect.set(null);
    this.cardTop.set(Math.max(pad, (vh - cardH) / 2));
    this.cardLeft.set(Math.max(pad, (vw - cardW) / 2));
  }
}
