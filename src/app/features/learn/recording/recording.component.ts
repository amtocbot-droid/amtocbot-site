// src/app/features/learn/recording/recording.component.ts

import {
  Component, Input, Output, EventEmitter, signal, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

type UiState = 'idle' | 'recording' | 'preview' | 'submitting' | 'submitted';

@Component({
  selector: 'app-recording',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="recording-widget">

      @if (uiState() === 'idle') {
        <div class="idle-panel">
          <p class="prompt-text">
            Explain what you just learned in your own words — speak to the camera
            or just use your voice.
          </p>
          @if (error()) { <p class="error-msg">{{ error() }}</p> }
          <button class="btn-record" (click)="startRecording()">
            🎥 Record Your Understanding
          </button>
        </div>
      }

      @if (uiState() === 'recording') {
        <div class="recording-panel">
          <div class="rec-indicator">
            <span class="red-dot"></span>
            Recording… {{ formatTime(elapsedSeconds()) }}
          </div>
          <button class="btn-stop" (click)="stopRecording()">⏹ Stop</button>
        </div>
      }

      @if (uiState() === 'preview') {
        <div class="preview-panel">
          <video [src]="previewUrl()!" controls class="preview-video"></video>
          <div class="name-row">
            <label for="rec-name">Your name</label>
            <input id="rec-name" type="text" [(ngModel)]="displayName"
              placeholder="e.g. Alex" maxlength="50" class="name-input" />
          </div>
          @if (error()) { <p class="error-msg">{{ error() }}</p> }
          <div class="preview-actions">
            <button class="btn-submit" (click)="submitRecording()" [disabled]="!displayName.trim()">
              Submit Recording
            </button>
            <button class="btn-rerecord" (click)="reRecord()">Re-record</button>
          </div>
        </div>
      }

      @if (uiState() === 'submitting') {
        <div class="submitting-panel">
          <span class="spinner"></span> Uploading…
        </div>
      }

      @if (uiState() === 'submitted') {
        <div class="submitted-panel">
          <span class="check">✅</span>
          Your recording has been shared! Refresh to see it in the feed below.
        </div>
      }

    </div>
  `,
  styles: [`
    .recording-widget { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; margin: 24px 0; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .prompt-text { color: #94a3b8; margin: 0 0 16px; font-size: 14px; }
    .btn-record { background: #3b82f6; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; }
    .btn-record:hover { background: #2563eb; }
    .recording-panel { display: flex; align-items: center; gap: 20px; }
    .rec-indicator { display: flex; align-items: center; gap: 8px; font-size: 15px; }
    .red-dot { width: 12px; height: 12px; border-radius: 50%; background: #ef4444; animation: pulse 1s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .btn-stop { background: #ef4444; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .preview-video { width: 100%; border-radius: 8px; max-height: 320px; background: #000; }
    .name-row { margin: 16px 0 8px; display: flex; flex-direction: column; gap: 6px; }
    .name-row label { font-size: 13px; color: #94a3b8; }
    .name-input { background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #e2e8f0; padding: 8px 12px; font-size: 14px; width: 100%; box-sizing: border-box; }
    .name-input::placeholder { color: #475569; }
    .preview-actions { display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
    .btn-submit { background: #22c55e; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; }
    .btn-submit:disabled { background: #166534; cursor: not-allowed; opacity: 0.6; }
    .btn-rerecord { background: transparent; color: #94a3b8; border: 1px solid #334155; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .btn-rerecord:hover { color: #e2e8f0; border-color: #64748b; }
    .submitting-panel { display: flex; align-items: center; gap: 10px; color: #94a3b8; }
    .spinner { width: 18px; height: 18px; border: 2px solid #334155; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .submitted-panel { display: flex; align-items: center; gap: 10px; color: #22c55e; font-size: 15px; }
    .check { font-size: 20px; }
    .error-msg { color: #f87171; font-size: 13px; margin: 8px 0 0; }
  `],
})
export class RecordingComponent implements OnDestroy {
  @Input() language = '';
  @Input() level    = '';
  @Input() slug     = '';
  @Output() recordingSubmitted = new EventEmitter<void>();

  uiState        = signal<UiState>('idle');
  previewUrl     = signal<string | null>(null);
  error          = signal<string | null>(null);
  elapsedSeconds = signal(0);

  displayName = '';
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private videoBlob: Blob | null = null;
  private timerHandle: ReturnType<typeof setInterval> | null = null;

  constructor(private http: HttpClient) {}

  async startRecording(): Promise<void> {
    this.error.set(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      this.error.set('Camera/microphone access denied. Please allow permission and try again.');
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';

    this.mediaRecorder = new MediaRecorder(stream, { mimeType });
    this.chunks = [];

    this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
    this.mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      this.videoBlob = new Blob(this.chunks, { type: mimeType });
      this.previewUrl.set(URL.createObjectURL(this.videoBlob));
      this.uiState.set('preview');
    };

    this.mediaRecorder.start(1000);
    this.elapsedSeconds.set(0);
    this.uiState.set('recording');
    this.startTimer();
  }

  stopRecording(): void {
    this.stopTimer();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  reRecord(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
    this.videoBlob = null;
    this.displayName = '';
    this.error.set(null);
    this.uiState.set('idle');
  }

  submitRecording(): void {
    if (!this.videoBlob || !this.displayName.trim()) return;
    this.uiState.set('submitting');
    this.error.set(null);

    const formData = new FormData();
    formData.append('video', this.videoBlob, 'recording.webm');
    formData.append('displayName', this.displayName.trim());
    formData.append('level', this.level);
    formData.append('durationMs', String(this.elapsedSeconds() * 1000));

    const url = `/api/learn/${this.language}/${this.slug}/recordings?level=${this.level}`;

    this.http.post(url, formData).subscribe({
      next: () => {
        this.uiState.set('submitted');
        this.recordingSubmitted.emit();
      },
      error: (err) => {
        const msg = err?.error?.error ?? 'Upload failed. Please try again.';
        this.error.set(msg);
        this.uiState.set('preview');
      },
    });
  }

  private startTimer(): void {
    this.timerHandle = setInterval(() => this.elapsedSeconds.update(s => s + 1), 1000);
  }

  private stopTimer(): void {
    if (this.timerHandle !== null) { clearInterval(this.timerHandle); this.timerHandle = null; }
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  ngOnDestroy(): void {
    this.stopTimer();
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
  }
}
