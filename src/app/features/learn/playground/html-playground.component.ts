// src/app/features/learn/playground/html-playground.component.ts

import {
  Component, Input, OnInit, OnDestroy, ElementRef, ViewChild,
  signal, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { Lesson } from '../curriculum/types';

@Component({
  selector: 'app-html-playground',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .playground-wrapper { display: flex; flex-direction: column; border: 1px solid #333; border-radius: 8px; overflow: hidden; min-height: 400px; }
    .playground-toolbar { display: flex; align-items: center; justify-content: space-between; background: #1e1e2e; padding: 8px 12px; border-bottom: 1px solid #333; }
    .toolbar-label { color: #cdd6f4; font-size: 13px; font-weight: 500; letter-spacing: 0.02em; }
    .panels { display: flex; flex: 1; min-height: 380px; }
    .editor-panel { flex: 1; overflow: auto; border-right: 1px solid #333; }
    .preview-panel { flex: 1; background: #fff; display: flex; flex-direction: column; }
    .preview-label { background: #f5f5f5; border-bottom: 1px solid #ddd; padding: 4px 12px; font-size: 12px; color: #666; font-family: monospace; }
    iframe { flex: 1; width: 100%; border: none; min-height: 340px; }
    :host ::ng-deep .cm-editor { height: 100%; min-height: 380px; font-size: 14px; }
    :host ::ng-deep .cm-scroller { font-family: 'JetBrains Mono', 'Fira Code', monospace; }
  `],
  template: `
    <div class="playground-wrapper">
      <div class="playground-toolbar">
        <span class="toolbar-label">HTML Editor</span>
        <button mat-stroked-button color="warn" (click)="reset()">
          <mat-icon>restart_alt</mat-icon> Reset
        </button>
      </div>
      <div class="panels">
        <div class="editor-panel" #editorHost></div>
        <div class="preview-panel">
          <div class="preview-label">Preview</div>
          <iframe [srcdoc]="previewDoc()" sandbox="allow-scripts"></iframe>
        </div>
      </div>
    </div>
  `,
})
export class HtmlPlaygroundComponent implements OnInit, OnDestroy {
  @Input() lesson!: Lesson;
  @ViewChild('editorHost', { static: true }) editorHost!: ElementRef<HTMLDivElement>;

  previewDoc = signal('');
  private editorView?: EditorView;
  private debounceTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.initEditor(this.lesson.starterCode);
    this.previewDoc.set(this.lesson.starterCode);
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.editorView?.destroy();
  }

  private initEditor(doc: string): void {
    this.editorView?.destroy();
    const state = EditorState.create({
      doc,
      extensions: [
        history(),
        lineNumbers(),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        html(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newDoc = update.state.doc.toString();
            if (this.debounceTimer) clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.previewDoc.set(newDoc), 300);
          }
        }),
      ],
    });
    this.editorView = new EditorView({ state, parent: this.editorHost.nativeElement });
  }

  reset(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.initEditor(this.lesson.starterCode);
    this.previewDoc.set(this.lesson.starterCode);
  }
}
