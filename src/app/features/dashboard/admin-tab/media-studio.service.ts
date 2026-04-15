// src/app/features/dashboard/admin-tab/media-studio.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface MediaItem {
  item_id: string;
  type: 'short' | 'podcast';
  blog_num: number;
  short_num: number;
  kind: 'hook' | 'demo';
  title: string;
  yt_title: string;
  yt_description: string;
  tags: string;
  segments: string[];
  source_file: string;
  stage: string;
  audio_dir: string;
  output_file: string;
  youtube_url: string;
}

export interface MediaJob {
  job_id: string;
  job_type: string;
  status: 'queued' | 'running' | 'done' | 'error';
  created_at: string;
  output: string | null;
  error: string | null;
  stage?: string;
}

export interface JobProgress {
  event: 'start' | 'progress' | 'done' | 'error';
  data: string;
}

const SERVER_URL = 'http://localhost:8765';

@Injectable({ providedIn: 'root' })
export class MediaStudioService {
  private http = inject(HttpClient);

  serverOnline = signal(false);

  checkServer(): Observable<boolean> {
    return new Observable(observer => {
      this.http.get<{ ok: boolean }>(`${SERVER_URL}/status`)
        .pipe(catchError(() => of({ ok: false })))
        .subscribe(r => {
          const online = !!(r as { ok?: boolean }).ok;
          this.serverOnline.set(online);
          observer.next(online);
          observer.complete();
        });
    });
  }

  getItems(): Observable<MediaItem[]> {
    return this.http.get<MediaItem[]>(`${SERVER_URL}/items`)
      .pipe(catchError(() => of([])));
  }

  getItem(itemId: string): Observable<MediaItem> {
    return this.http.get<MediaItem>(`${SERVER_URL}/items/${itemId}`);
  }

  startNarrate(itemId: string, voice = 'af_heart', speed = 0.95): Observable<{ job_id: string }> {
    return this.http.post<{ job_id: string }>(`${SERVER_URL}/jobs`, {
      job_type: 'narrate',
      params: { item_id: itemId, voice, speed },
    });
  }

  startAssemble(itemId: string, bgPath: string): Observable<{ job_id: string }> {
    return this.http.post<{ job_id: string }>(`${SERVER_URL}/jobs`, {
      job_type: 'assemble',
      params: { item_id: itemId, bg_path: bgPath },
    });
  }

  startUpload(
    itemId: string, filePath: string, title: string,
    description: string, tags: string, privacy: string
  ): Observable<{ job_id: string }> {
    return this.http.post<{ job_id: string }>(`${SERVER_URL}/jobs`, {
      job_type: 'upload',
      params: { item_id: itemId, file_path: filePath, title, description, tags, privacy },
    });
  }

  getJob(jobId: string): Observable<MediaJob> {
    return this.http.get<MediaJob>(`${SERVER_URL}/jobs/${jobId}`);
  }

  /** Open an SSE stream for job progress. Returns an EventSource. */
  streamJob(jobId: string): EventSource {
    return new EventSource(`${SERVER_URL}/jobs/${jobId}/stream`);
  }

  /** Subscribe to a job's SSE stream as an Observable. Auto-closes on done/error. */
  watchJob(jobId: string): Observable<JobProgress> {
    return new Observable(observer => {
      const es = this.streamJob(jobId);
      es.onmessage = (e) => {
        try {
          const msg: JobProgress = JSON.parse(e.data);
          observer.next(msg);
          if (msg.event === 'done' || msg.event === 'error') {
            es.close();
            if (msg.event === 'error') {
              observer.error(new Error(msg.data));
            } else {
              observer.complete();
            }
          }
        } catch { /* ignore parse errors */ }
      };
      es.onerror = () => {
        es.close();
        observer.error(new Error('SSE connection lost'));
      };
      return () => es.close();
    });
  }
}
