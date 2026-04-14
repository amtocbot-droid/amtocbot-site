// src/app/features/learn/playground/code-playground.component.ts

import { Component, Input, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { Lesson } from '../curriculum/types';

@Component({
  selector: 'app-code-playground',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .playground-wrapper { display: flex; flex-direction: column; border: 1px solid #333; border-radius: 8px; overflow: hidden; }
    .playground-toolbar { display: flex; align-items: center; justify-content: space-between; background: #1e1e2e; padding: 8px 12px; border-bottom: 1px solid #333; }
    .toolbar-label { color: #cdd6f4; font-size: 13px; font-weight: 500; letter-spacing: 0.02em; }
    .toolbar-actions { display: flex; gap: 8px; align-items: center; }
    .code-editor { width: 100%; min-height: 400px; background: #1e1e2e; color: #cdd6f4; font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace; font-size: 14px; line-height: 1.6; padding: 16px; border: none; outline: none; resize: vertical; tab-size: 4; box-sizing: border-box; }
    .output-panel { background: #0d0d0d; border-top: 1px solid #333; padding: 12px 16px; min-height: 80px; }
    .output-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .output-content { font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
    .output-content.running { color: #888; font-style: italic; }
    .output-content.error { color: #f38ba8; }
    .output-content.success { color: #a6e3a1; }
    .exec-time { margin-top: 8px; font-size: 11px; color: #555; font-family: monospace; }
    .spinner-wrapper { display: flex; align-items: center; gap: 8px; color: #888; font-size: 13px; }
  `],
  template: `
    <div class="playground-wrapper">
      <div class="playground-toolbar">
        <span class="toolbar-label">{{ language === 'csharp' ? 'C#' : 'Java' }} Editor</span>
        <div class="toolbar-actions">
          <button mat-stroked-button color="warn" (click)="reset()" [disabled]="running()">
            <mat-icon>restart_alt</mat-icon> Reset
          </button>
          <button mat-flat-button color="primary" (click)="runCode()" [disabled]="running()">
            @if (running()) {
              <mat-spinner diameter="16" style="display:inline-block;margin-right:6px;"></mat-spinner>
              Running...
            } @else {
              <ng-container>
                <mat-icon>play_arrow</mat-icon> Run Code
              </ng-container>
            }
          </button>
        </div>
      </div>
      <textarea class="code-editor" [(ngModel)]="codeValue" [disabled]="running()"
        spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"
        (keydown.tab)="handleTab($event)"></textarea>
      <div class="output-panel">
        <div class="output-header"><mat-icon>terminal</mat-icon> Output</div>
        @if (running()) {
          <div class="spinner-wrapper"><mat-spinner diameter="14"></mat-spinner><span>Sending to run server...</span></div>
        } @else if (output()) {
          <div class="output-content" [class.error]="hasError()" [class.success]="!hasError()">{{ output() }}</div>
          @if (execTime()) { <div class="exec-time">Execution time: {{ execTime() }}ms</div> }
        } @else {
          <div class="output-content running">Click "Run Code" to execute your program.</div>
        }
      </div>
    </div>
  `,
})
export class CodePlaygroundComponent implements OnInit {
  @Input() lesson!: Lesson;
  @Input() language: 'csharp' | 'java' = 'csharp';

  running = signal(false);
  output = signal('');
  execTime = signal<number | null>(null);
  hasError = signal(false);
  codeValue = '';

  ngOnInit(): void { this.codeValue = this.lesson.starterCode; }

  handleTab(event: Event): void {
    event.preventDefault();
    const ta = (event as KeyboardEvent).target as HTMLTextAreaElement;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    this.codeValue = this.codeValue.slice(0, start) + '    ' + this.codeValue.slice(end);
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 4; }, 0);
  }

  async runCode(): Promise<void> {
    this.running.set(true);
    this.output.set('');
    this.execTime.set(null);
    this.hasError.set(false);
    const startTime = Date.now();
    try {
      const res = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: this.language === 'csharp' ? 'csharp' : 'java',
          version: '*',
          files: [{ content: this.codeValue }],
        }),
      });
      if (!res.ok) { this.hasError.set(true); this.output.set(`Server error: ${res.status} ${res.statusText}`); return; }
      const data = await res.json();
      this.execTime.set(Date.now() - startTime);
      const compileOutput: string = data?.compile?.output ?? '';
      const runOutput: string = data?.run?.output ?? '';
      if (compileOutput && !runOutput) {
        this.hasError.set(true); this.output.set(compileOutput.trim());
      } else if (runOutput) {
        const stderr: string = data?.run?.stderr ?? '';
        this.hasError.set(!!stderr && !runOutput.trim());
        this.output.set(runOutput.trim() || compileOutput.trim() || 'Program exited with no output.');
      } else {
        this.hasError.set(true); this.output.set('No output received from run server.');
      }
    } catch {
      this.hasError.set(true);
      this.output.set('Error connecting to run server. Check your internet connection.\nThe Piston API (emkc.org) must be reachable.');
    } finally { this.running.set(false); }
  }

  reset(): void {
    this.codeValue = this.lesson.starterCode;
    this.output.set('');
    this.execTime.set(null);
    this.hasError.set(false);
  }
}
