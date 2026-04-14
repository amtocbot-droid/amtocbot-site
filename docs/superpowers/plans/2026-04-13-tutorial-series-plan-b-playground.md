# Tutorial Series — Plan B: Interactive Playground

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add language-aware interactive code playgrounds to every tutorial lesson page.

**Architecture:** Single PlaygroundComponent with 3 sub-components switched by playgroundType. HTML uses CodeMirror 6 + srcdoc iframe. Linux uses Xterm.js with a TypeScript command interpreter. C#/Java use a textarea + Piston API (https://emkc.org/api/v2/piston/execute). No backend needed.

**Tech Stack:** Angular 21, CodeMirror 6 (@codemirror/state, @codemirror/view, @codemirror/lang-html), Xterm.js (xterm, @xterm/addon-fit), Piston REST API (no API key required)

---

## File Map

| File | Purpose |
|------|---------|
| `src/app/features/learn/playground/playground.component.ts` | Wrapper — switches sub-component by `lesson.playgroundType` |
| `src/app/features/learn/playground/html-playground.component.ts` | CodeMirror 6 editor + live srcdoc iframe |
| `src/app/features/learn/playground/linux-playground.component.ts` | Xterm.js terminal + LinuxInterpreter |
| `src/app/features/learn/playground/code-playground.component.ts` | Monospace textarea + Piston API + output panel |
| `src/app/features/learn/playground/linux-interpreter.ts` | Pure TypeScript shell interpreter class |
| `src/app/features/learn/learn-lesson.component.ts` | Modify: embed `<app-playground>` below reflection prompt |
| `package.json` | Add npm dependencies (modify existing) |

**Prerequisites:** Plan A must be complete. The `Lesson` type with `playgroundType` and `starterCode` fields must already exist in `src/app/features/learn/curriculum/types.ts`.

---

## Task 1 — Install npm dependencies

- [ ] From `/Users/amtoc/amtocbot-site/`, run:

```bash
npm install @codemirror/state @codemirror/view @codemirror/lang-html @codemirror/theme-one-dark xterm @xterm/addon-fit
```

- [ ] Verify TypeScript still compiles cleanly:

```bash
npx tsc --noEmit
```

Expected output: `Found 0 errors.`

- [ ] Confirm the following entries now appear in `package.json` under `"dependencies"`:
  - `"@codemirror/state"`
  - `"@codemirror/view"`
  - `"@codemirror/lang-html"`
  - `"@codemirror/theme-one-dark"`
  - `"xterm"`
  - `"@xterm/addon-fit"`

---

## Task 2 — Linux interpreter (`linux-interpreter.ts`)

- [ ] Create `src/app/features/learn/playground/linux-interpreter.ts`:

```typescript
// src/app/features/learn/playground/linux-interpreter.ts

export interface FsNode {
  type: 'file' | 'dir';
  content: string; // empty string for dirs
}

export class LinuxInterpreter {
  private fs: Map<string, FsNode> = new Map();
  private cwd = '/home/student';
  private history: string[] = [];

  constructor() {
    // Seed virtual filesystem
    this.fs.set('/home/student', { type: 'dir', content: '' });
    this.fs.set('/home/student/projects', { type: 'dir', content: '' });
    this.fs.set('/home/student/notes.txt', {
      type: 'file',
      content: 'Welcome to Linux!',
    });
    this.fs.set('/home/student/readme.md', {
      type: 'file',
      content: "This is your home directory.\nUse 'ls' to look around.",
    });
  }

  /** Resolve a path (absolute or relative) to an absolute path. */
  private resolve(path: string): string {
    if (path.startsWith('/')) return this.normalize(path);
    return this.normalize(this.cwd + '/' + path);
  }

  /** Collapse `.` and `..` segments, remove trailing slashes. */
  private normalize(path: string): string {
    const parts = path.split('/').filter(Boolean);
    const stack: string[] = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') stack.pop();
      else stack.push(part);
    }
    return '/' + stack.join('/');
  }

  /** Return the display name shown in the prompt. */
  get promptPath(): string {
    if (this.cwd === '/home/student') return '~';
    if (this.cwd.startsWith('/home/student/')) {
      return '~/' + this.cwd.slice('/home/student/'.length);
    }
    return this.cwd;
  }

  /**
   * Execute a command string and return the output.
   * Returns '__CLEAR__' for the `clear` command.
   */
  run(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '';

    this.history.push(trimmed);

    // Handle `echo text > file` redirection before splitting
    const redirectMatch = trimmed.match(/^echo\s+(.*?)\s*>\s*(\S+)$/);
    if (redirectMatch) {
      return this.cmdEchoRedirect(redirectMatch[1], redirectMatch[2]);
    }

    const [cmd, ...args] = trimmed.split(/\s+/);

    switch (cmd) {
      case 'pwd':
        return this.cmdPwd();
      case 'ls':
        return this.cmdLs(args[0]);
      case 'cd':
        return this.cmdCd(args[0]);
      case 'mkdir':
        return this.cmdMkdir(args[0]);
      case 'touch':
        return this.cmdTouch(args[0]);
      case 'cat':
        return this.cmdCat(args[0]);
      case 'echo':
        return this.cmdEcho(args.join(' '));
      case 'rm':
        return this.cmdRm(args[0]);
      case 'clear':
        return '__CLEAR__';
      case 'whoami':
        return 'student';
      case 'date':
        return new Date().toLocaleString();
      case 'man':
        return this.cmdMan(args[0]);
      case 'help':
        return this.cmdHelp();
      default:
        return `command not found: ${cmd}. Type "help" for available commands.`;
    }
  }

  private cmdPwd(): string {
    return this.cwd;
  }

  private cmdLs(rawPath?: string): string {
    const target = rawPath ? this.resolve(rawPath) : this.cwd;
    const node = this.fs.get(target);
    if (!node) return `ls: cannot access '${rawPath}': No such file or directory`;
    if (node.type === 'file') return target.split('/').pop() ?? target;

    const prefix = target === '/' ? '/' : target + '/';
    const entries: string[] = [];
    for (const key of this.fs.keys()) {
      if (key === target) continue;
      if (!key.startsWith(prefix)) continue;
      const remainder = key.slice(prefix.length);
      if (!remainder.includes('/')) {
        const childNode = this.fs.get(key)!;
        entries.push(childNode.type === 'dir' ? remainder + '/' : remainder);
      }
    }
    if (entries.length === 0) return '';
    return entries.sort().join('  ');
  }

  private cmdCd(rawPath?: string): string {
    const target = rawPath ? this.resolve(rawPath) : '/home/student';
    const node = this.fs.get(target);
    if (!node) return `cd: ${rawPath}: No such file or directory`;
    if (node.type !== 'dir') return `cd: ${rawPath}: Not a directory`;
    this.cwd = target;
    return '';
  }

  private cmdMkdir(name?: string): string {
    if (!name) return 'mkdir: missing operand';
    const target = this.resolve(name);
    if (this.fs.has(target)) return `mkdir: cannot create directory '${name}': File exists`;
    const parent = this.normalize(target + '/..');
    if (!this.fs.has(parent)) return `mkdir: cannot create directory '${name}': No such file or directory`;
    this.fs.set(target, { type: 'dir', content: '' });
    return '';
  }

  private cmdTouch(name?: string): string {
    if (!name) return 'touch: missing file operand';
    const target = this.resolve(name);
    if (!this.fs.has(target)) {
      const parent = this.normalize(target + '/..');
      if (!this.fs.has(parent)) return `touch: cannot touch '${name}': No such file or directory`;
      this.fs.set(target, { type: 'file', content: '' });
    }
    return '';
  }

  private cmdCat(name?: string): string {
    if (!name) return 'cat: missing file operand';
    const target = this.resolve(name);
    const node = this.fs.get(target);
    if (!node) return `cat: ${name}: No such file or directory`;
    if (node.type === 'dir') return `cat: ${name}: Is a directory`;
    return node.content;
  }

  private cmdEcho(text: string): string {
    // Strip surrounding quotes if present
    return text.replace(/^['"]|['"]$/g, '');
  }

  private cmdEchoRedirect(text: string, fileName: string): string {
    const content = text.replace(/^['"]|['"]$/g, '');
    const target = this.resolve(fileName);
    const parent = this.normalize(target + '/..');
    if (!this.fs.has(parent)) return `bash: ${fileName}: No such file or directory`;
    this.fs.set(target, { type: 'file', content });
    return '';
  }

  private cmdRm(name?: string): string {
    if (!name) return 'rm: missing operand';
    const target = this.resolve(name);
    const node = this.fs.get(target);
    if (!node) return `rm: cannot remove '${name}': No such file or directory`;
    if (node.type === 'dir') return `rm: cannot remove '${name}': Is a directory (use rmdir)`;
    this.fs.delete(target);
    return '';
  }

  private cmdMan(cmd?: string): string {
    const docs: Record<string, string> = {
      pwd: 'pwd — print the current working directory path.',
      ls: 'ls [path] — list files and directories in the current (or given) directory.',
      cd: 'cd <dir> — change the current working directory.',
      mkdir: 'mkdir <name> — create a new directory.',
      touch: 'touch <name> — create an empty file, or update its timestamp.',
      cat: 'cat <file> — print the contents of a file to the terminal.',
      echo: 'echo <text> — print text. Use "echo text > file" to write to a file.',
      rm: 'rm <file> — remove a file (not a directory).',
      clear: 'clear — clear the terminal screen.',
      whoami: 'whoami — print the current user name.',
      date: 'date — print the current date and time.',
      man: 'man <cmd> — show the manual entry for a command.',
      help: 'help — list all available commands.',
    };
    if (!cmd) return 'man: what manual page do you want?';
    return docs[cmd] ?? `man: no manual entry for '${cmd}'`;
  }

  private cmdHelp(): string {
    return [
      'Available commands:',
      '  pwd       — print working directory',
      '  ls        — list directory contents',
      '  cd        — change directory',
      '  mkdir     — create directory',
      '  touch     — create empty file',
      '  cat       — print file contents',
      '  echo      — print text (or write to file with >)',
      '  rm        — remove a file',
      '  clear     — clear the screen',
      '  whoami    — print current user',
      '  date      — print current date and time',
      '  man       — show manual for a command',
      '  help      — show this help message',
    ].join('\n');
  }
}
```

- [ ] Run `npx tsc --noEmit` — expected: `Found 0 errors.`

---

## Task 3 — HTML playground (`html-playground.component.ts`)

- [ ] Create `src/app/features/learn/playground/html-playground.component.ts`:

```typescript
// src/app/features/learn/playground/html-playground.component.ts

import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  signal,
  ChangeDetectionStrategy,
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
    .playground-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0;
      border: 1px solid #333;
      border-radius: 8px;
      overflow: hidden;
      min-height: 400px;
    }

    .playground-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #1e1e2e;
      padding: 8px 12px;
      border-bottom: 1px solid #333;
    }

    .toolbar-label {
      color: #cdd6f4;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.02em;
    }

    .panels {
      display: flex;
      flex: 1;
      min-height: 380px;
    }

    .editor-panel {
      flex: 1;
      overflow: auto;
      border-right: 1px solid #333;
    }

    .preview-panel {
      flex: 1;
      background: #fff;
      display: flex;
      flex-direction: column;
    }

    .preview-label {
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
      padding: 4px 12px;
      font-size: 12px;
      color: #666;
      font-family: monospace;
    }

    iframe {
      flex: 1;
      width: 100%;
      border: none;
      min-height: 340px;
    }

    :host ::ng-deep .cm-editor {
      height: 100%;
      min-height: 380px;
      font-size: 14px;
    }

    :host ::ng-deep .cm-scroller {
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    }
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
    if (this.editorView) {
      this.editorView.destroy();
    }

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
            this.debounceTimer = setTimeout(() => {
              this.previewDoc.set(newDoc);
            }, 300);
          }
        }),
      ],
    });

    this.editorView = new EditorView({
      state,
      parent: this.editorHost.nativeElement,
    });
  }

  reset(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.initEditor(this.lesson.starterCode);
    this.previewDoc.set(this.lesson.starterCode);
  }
}
```

- [ ] Run `npx tsc --noEmit` — expected: `Found 0 errors.`

---

## Task 4 — Linux playground (`linux-playground.component.ts`)

- [ ] Create `src/app/features/learn/playground/linux-playground.component.ts`:

```typescript
// src/app/features/learn/playground/linux-playground.component.ts

import {
  Component,
  Input,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { LinuxInterpreter } from './linux-interpreter';
import { Lesson } from '../curriculum/types';

@Component({
  selector: 'app-linux-playground',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .terminal-wrapper {
      display: flex;
      flex-direction: column;
      border: 1px solid #333;
      border-radius: 8px;
      overflow: hidden;
      background: #0d0d0d;
      min-height: 400px;
    }

    .terminal-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #1a1a2e;
      padding: 8px 12px;
      border-bottom: 1px solid #333;
    }

    .toolbar-label {
      color: #00ff41;
      font-size: 13px;
      font-weight: 500;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 0.05em;
    }

    .terminal-host {
      flex: 1;
      padding: 8px;
      min-height: 360px;
    }

    :host ::ng-deep .xterm {
      padding: 4px;
    }

    :host ::ng-deep .xterm-viewport {
      overflow-y: auto !important;
    }
  `],
  template: `
    <div class="terminal-wrapper">
      <div class="terminal-toolbar">
        <span class="toolbar-label">student&#64;learn:{{ promptPath }}$</span>
        <button mat-stroked-button (click)="reset()" style="color:#00ff41;border-color:#00ff41">
          <mat-icon>restart_alt</mat-icon> Reset
        </button>
      </div>
      <div class="terminal-host" #terminalHost></div>
    </div>
  `,
})
export class LinuxPlaygroundComponent implements AfterViewInit, OnDestroy {
  @Input() lesson!: Lesson;
  @ViewChild('terminalHost', { static: true }) terminalHost!: ElementRef<HTMLDivElement>;

  promptPath = '~';

  private terminal!: Terminal;
  private fitAddon!: FitAddon;
  private interpreter = new LinuxInterpreter();
  private inputBuffer = '';
  private commandHistory: string[] = [];
  private historyIndex = -1;

  ngAfterViewInit(): void {
    this.initTerminal();
  }

  ngOnDestroy(): void {
    this.terminal?.dispose();
  }

  private initTerminal(): void {
    this.terminal = new Terminal({
      theme: {
        background: '#0d0d0d',
        foreground: '#00ff41',
        cursor: '#00ff41',
        selectionBackground: '#1a3a1a',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
      fontSize: 14,
      lineHeight: 1.4,
      cursorBlink: true,
      convertEol: true,
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(this.terminalHost.nativeElement);
    this.fitAddon.fit();

    this.terminal.writeln('\x1b[32mWelcome to the Linux Playground!\x1b[0m');
    this.terminal.writeln('\x1b[90mType "help" to see available commands.\x1b[0m');
    this.terminal.writeln('');
    this.writePrompt();

    this.terminal.onKey(({ key, domEvent }) => {
      this.handleKey(key, domEvent);
    });
  }

  private writePrompt(): void {
    this.promptPath = this.interpreter.promptPath;
    this.terminal.write(`\x1b[32mstudent@learn\x1b[0m:\x1b[34m${this.promptPath}\x1b[0m$ `);
  }

  private handleKey(key: string, event: KeyboardEvent): void {
    const code = event.code;

    if (code === 'Enter') {
      this.terminal.writeln('');
      if (this.inputBuffer.trim()) {
        this.commandHistory.push(this.inputBuffer);
        this.historyIndex = this.commandHistory.length;
        this.executeCommand(this.inputBuffer);
      } else {
        this.writePrompt();
      }
      this.inputBuffer = '';
      return;
    }

    if (code === 'Backspace') {
      if (this.inputBuffer.length > 0) {
        this.inputBuffer = this.inputBuffer.slice(0, -1);
        this.terminal.write('\b \b');
      }
      return;
    }

    if (code === 'ArrowUp') {
      if (this.commandHistory.length === 0) return;
      this.historyIndex = Math.max(0, this.historyIndex - 1);
      this.replaceInput(this.commandHistory[this.historyIndex]);
      return;
    }

    if (code === 'ArrowDown') {
      this.historyIndex = Math.min(this.commandHistory.length, this.historyIndex + 1);
      const val = this.historyIndex < this.commandHistory.length
        ? this.commandHistory[this.historyIndex]
        : '';
      this.replaceInput(val);
      return;
    }

    // Ignore other control keys
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (key.length !== 1) return;

    this.inputBuffer += key;
    this.terminal.write(key);
  }

  private replaceInput(newValue: string): void {
    // Erase current input on the line
    this.terminal.write('\b'.repeat(this.inputBuffer.length));
    this.terminal.write(' '.repeat(this.inputBuffer.length));
    this.terminal.write('\b'.repeat(this.inputBuffer.length));
    this.inputBuffer = newValue;
    this.terminal.write(newValue);
  }

  private executeCommand(cmd: string): void {
    const result = this.interpreter.run(cmd);

    if (result === '__CLEAR__') {
      this.terminal.clear();
    } else if (result) {
      const lines = result.split('\n');
      for (const line of lines) {
        this.terminal.writeln(line);
      }
    }

    this.writePrompt();
  }

  reset(): void {
    this.interpreter = new LinuxInterpreter();
    this.inputBuffer = '';
    this.commandHistory = [];
    this.historyIndex = -1;
    this.terminal.clear();
    this.terminal.writeln('\x1b[32mPlayground reset.\x1b[0m');
    this.terminal.writeln('');
    this.writePrompt();
  }
}
```

- [ ] Run `npx tsc --noEmit` — expected: `Found 0 errors.`

---

## Task 5 — Code playground (`code-playground.component.ts`)

- [ ] Create `src/app/features/learn/playground/code-playground.component.ts`:

```typescript
// src/app/features/learn/playground/code-playground.component.ts

import {
  Component,
  Input,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
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
    .playground-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0;
      border: 1px solid #333;
      border-radius: 8px;
      overflow: hidden;
    }

    .playground-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #1e1e2e;
      padding: 8px 12px;
      border-bottom: 1px solid #333;
    }

    .toolbar-label {
      color: #cdd6f4;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.02em;
    }

    .toolbar-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .code-editor {
      width: 100%;
      min-height: 400px;
      background: #1e1e2e;
      color: #cdd6f4;
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.6;
      padding: 16px;
      border: none;
      outline: none;
      resize: vertical;
      tab-size: 4;
      box-sizing: border-box;
    }

    .output-panel {
      background: #0d0d0d;
      border-top: 1px solid #333;
      padding: 12px 16px;
      min-height: 80px;
    }

    .output-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      color: #888;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .output-header mat-icon {
      font-size: 16px;
      height: 16px;
      width: 16px;
    }

    .output-content {
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .output-content.running {
      color: #888;
      font-style: italic;
    }

    .output-content.error {
      color: #f38ba8;
    }

    .output-content.success {
      color: #a6e3a1;
    }

    .exec-time {
      margin-top: 8px;
      font-size: 11px;
      color: #555;
      font-family: monospace;
    }

    .spinner-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #888;
      font-size: 13px;
    }
  `],
  template: `
    <div class="playground-wrapper">
      <div class="playground-toolbar">
        <span class="toolbar-label">
          {{ language === 'csharp' ? 'C#' : 'Java' }} Editor
        </span>
        <div class="toolbar-actions">
          <button mat-stroked-button color="warn" (click)="reset()" [disabled]="running()">
            <mat-icon>restart_alt</mat-icon> Reset
          </button>
          <button
            mat-flat-button
            color="primary"
            (click)="runCode()"
            [disabled]="running()"
          >
            @if (running()) {
              <mat-spinner diameter="16" style="display:inline-block;margin-right:6px;"></mat-spinner>
              Running...
            } @else {
              <mat-icon>play_arrow</mat-icon> Run Code
            }
          </button>
        </div>
      </div>

      <textarea
        class="code-editor"
        [(ngModel)]="codeValue"
        [disabled]="running()"
        spellcheck="false"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        (keydown.tab)="handleTab($event)"
      ></textarea>

      <div class="output-panel">
        <div class="output-header">
          <mat-icon>terminal</mat-icon>
          Output
        </div>

        @if (running()) {
          <div class="spinner-wrapper">
            <mat-spinner diameter="14"></mat-spinner>
            <span>Sending to run server...</span>
          </div>
        } @else if (output()) {
          <div
            class="output-content"
            [class.error]="hasError()"
            [class.success]="!hasError()"
          >{{ output() }}</div>
          @if (execTime()) {
            <div class="exec-time">Execution time: {{ execTime() }}ms</div>
          }
        } @else {
          <div class="output-content running">Click "Run Code" to execute your program.</div>
        }
      </div>
    </div>
  `,
})
export class CodePlaygroundComponent {
  @Input() lesson!: Lesson;
  @Input() language: 'csharp' | 'java' = 'csharp';

  running = signal(false);
  output = signal('');
  execTime = signal<number | null>(null);
  hasError = signal(false);

  codeValue = '';

  ngOnInit(): void {
    this.codeValue = this.lesson.starterCode;
  }

  handleTab(event: KeyboardEvent): void {
    event.preventDefault();
    const textarea = event.target as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    this.codeValue = this.codeValue.slice(0, start) + '    ' + this.codeValue.slice(end);
    // Restore cursor position after Angular updates the value
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 4;
    }, 0);
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

      if (!res.ok) {
        this.hasError.set(true);
        this.output.set(`Server error: ${res.status} ${res.statusText}`);
        return;
      }

      const data = await res.json();
      const elapsed = Date.now() - startTime;
      this.execTime.set(elapsed);

      const compileOutput: string = data?.compile?.output ?? '';
      const runOutput: string = data?.run?.output ?? '';

      if (compileOutput && !runOutput) {
        // Compile-only error
        this.hasError.set(true);
        this.output.set(compileOutput.trim());
      } else if (runOutput) {
        const stderr: string = data?.run?.stderr ?? '';
        this.hasError.set(!!stderr && !runOutput.trim());
        this.output.set(runOutput.trim() || compileOutput.trim() || 'Program exited with no output.');
      } else {
        this.hasError.set(true);
        this.output.set('No output received from run server.');
      }
    } catch (e) {
      this.hasError.set(true);
      this.output.set(
        'Error connecting to run server. Check your internet connection.\n' +
        'The Piston API (emkc.org) must be reachable.'
      );
    } finally {
      this.running.set(false);
    }
  }

  reset(): void {
    this.codeValue = this.lesson.starterCode;
    this.output.set('');
    this.execTime.set(null);
    this.hasError.set(false);
  }
}
```

- [ ] Run `npx tsc --noEmit` — expected: `Found 0 errors.`

---

## Task 6 — Wrapper + lesson integration + build verify + commit

### 6.1 — Create `playground.component.ts`

- [ ] Create `src/app/features/learn/playground/playground.component.ts`:

```typescript
// src/app/features/learn/playground/playground.component.ts

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Lesson } from '../curriculum/types';
import { HtmlPlaygroundComponent } from './html-playground.component';
import { LinuxPlaygroundComponent } from './linux-playground.component';
import { CodePlaygroundComponent } from './code-playground.component';

@Component({
  selector: 'app-playground',
  standalone: true,
  imports: [CommonModule, HtmlPlaygroundComponent, LinuxPlaygroundComponent, CodePlaygroundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .playground-section {
      margin-top: 24px;
    }

    .playground-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--mat-sys-on-surface);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .playground-title::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 18px;
      background: var(--mat-sys-primary);
      border-radius: 2px;
    }
  `],
  template: `
    <div class="playground-section">
      <div class="playground-title">Try It Yourself</div>

      @switch (lesson.playgroundType) {
        @case ('html') {
          <app-html-playground [lesson]="lesson" />
        }
        @case ('linux') {
          <app-linux-playground [lesson]="lesson" />
        }
        @case ('code') {
          <app-code-playground
            [lesson]="lesson"
            [language]="codeLanguage"
          />
        }
        @default {
          <p style="color: #888; font-style: italic;">No playground available for this lesson.</p>
        }
      }
    </div>
  `,
})
export class PlaygroundComponent {
  @Input() lesson!: Lesson;

  get codeLanguage(): 'csharp' | 'java' {
    // Infer from lesson playground type; caller can override via lesson metadata
    // For now, derive from the lesson's language context via the route — default 'csharp'
    return 'csharp';
  }
}
```

### 6.2 — Update `learn-lesson.component.ts`

- [ ] Open `src/app/features/learn/learn-lesson.component.ts` (created in Plan A).
- [ ] Add `PlaygroundComponent` to the `imports` array.
- [ ] Replace the disabled "Practice in Playground" button section with:

```html
<!-- Playground embed (Plan B) -->
<app-playground [lesson]="lesson()!" />
```

- [ ] Keep the "Record Your Understanding" button disabled (that is Plan C).

The modified section in the template should look like:

```html
<!-- Reflection prompt -->
<div class="reflection-section">
  <h3>Reflect</h3>
  <p>{{ lesson()!.reflectionPrompt }}</p>
</div>

<!-- Playground embed (Plan B) -->
<app-playground [lesson]="lesson()!" />

<!-- Journal (Plan C — disabled) -->
<div class="journal-section disabled-notice">
  <button mat-stroked-button disabled>
    <mat-icon>edit_note</mat-icon>
    Record Your Understanding (coming soon)
  </button>
</div>
```

### 6.3 — Fix `codeLanguage` getter in `PlaygroundComponent`

The `PlaygroundComponent` `codeLanguage` getter should return the correct language based on the lesson. Update the getter to read the language from the lesson's `playgroundType` context. Because Plan A routes include the language in the URL but the `Lesson` object does not carry the language field directly, pass the language as a second `@Input()`:

- [ ] In `playground.component.ts`, add a `@Input() language: 'csharp' | 'java' = 'csharp';` input and pass it to `<app-code-playground [language]="language" />`.
- [ ] In `learn-lesson.component.ts`, inject the `ActivatedRoute` (already used for route params in Plan A) to read the `:language` param and pass it: `<app-playground [lesson]="lesson()!" [language]="playgroundLanguage()" />`.
- [ ] Add a `playgroundLanguage` computed signal:

```typescript
protected readonly playgroundLanguage = computed(() => {
  const lang = this.route.snapshot.paramMap.get('language');
  return (lang === 'java' ? 'java' : 'csharp') as 'csharp' | 'java';
});
```

### 6.4 — Build verify

- [ ] Run TypeScript check:

```bash
npx tsc --noEmit
```

Expected: `Found 0 errors.`

- [ ] Run Angular build:

```bash
npx ng build
```

Expected: Build succeeds with no errors. Warnings about bundle size are acceptable.

### 6.5 — Commit

- [ ] Stage all new and modified files:

```bash
git add \
  src/app/features/learn/playground/playground.component.ts \
  src/app/features/learn/playground/html-playground.component.ts \
  src/app/features/learn/playground/linux-playground.component.ts \
  src/app/features/learn/playground/code-playground.component.ts \
  src/app/features/learn/playground/linux-interpreter.ts \
  src/app/features/learn/learn-lesson.component.ts \
  package.json \
  package-lock.json
```

- [ ] Commit:

```bash
git commit -m "feat: tutorial series Plan B — interactive playgrounds (HTML, Linux, C#/Java)

- HTML: CodeMirror 6 editor with live iframe preview
- Linux: Xterm.js terminal with 13-command TypeScript interpreter + virtual filesystem
- C#/Java: textarea editor + Piston API execution with output panel
- Playground auto-switches by lesson.playgroundType

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Acceptance Criteria

| Criterion | How to verify |
|-----------|--------------|
| HTML playground loads CodeMirror 6 with syntax highlighting | Navigate to `/learn/html/beginner/what-is-html` — editor renders with dark theme |
| HTML preview updates live | Edit the HTML in the editor — iframe updates within ~300ms |
| Linux terminal accepts input | Navigate to `/learn/linux/beginner/...` — type `ls` and press Enter |
| `pwd`, `ls`, `cd`, `cat`, `echo`, `mkdir`, `touch`, `rm`, `clear`, `whoami`, `date`, `man`, `help` all work | Run each command in the terminal |
| `echo text > file` then `cat file` shows the text | Verify file write/read round-trip |
| C#/Java playground sends to Piston and shows output | Navigate to a C#/Java lesson — click "Run Code" — output panel shows result |
| Piston network failure shows friendly error | Block emkc.org in browser devtools, click Run Code |
| Reset button restores starter code in all 3 modes | Click Reset in each playground type |
| `npx tsc --noEmit` passes | `Found 0 errors.` |
| `npx ng build` passes | Build completes without errors |

---

## Known Limitations (Out of Scope for Plan B)

- **Tab completion** in the Linux terminal is not implemented (Plan C candidate)
- **`cp`, `mv`, `rmdir`** commands are not implemented — `man` will say "no manual entry"
- **Piston API rate limits**: The free Piston API has no auth and may rate-limit heavy usage; no retry logic is added
- **CodeMirror mobile UX**: Touch/virtual-keyboard interaction on mobile may be suboptimal
- **Lesson `language` field**: The `Lesson` interface from Plan A does not carry the language; the playground infers it from the route param — a future refactor should add `language` to the `Lesson` interface

---

*Plan B of 3. Plan A: routes + curriculum. Plan C: journal / progress tracking.*
