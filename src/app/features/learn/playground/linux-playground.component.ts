// src/app/features/learn/playground/linux-playground.component.ts

import {
  Component, Input, AfterViewInit, OnDestroy, ElementRef, ViewChild,
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
    .terminal-wrapper { display: flex; flex-direction: column; border: 1px solid #333; border-radius: 8px; overflow: hidden; background: #0d0d0d; min-height: 400px; }
    .terminal-toolbar { display: flex; align-items: center; justify-content: space-between; background: #1a1a2e; padding: 8px 12px; border-bottom: 1px solid #333; }
    .toolbar-label { color: #00ff41; font-size: 13px; font-weight: 500; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.05em; }
    .terminal-host { flex: 1; padding: 8px; min-height: 360px; }
    :host ::ng-deep .xterm { padding: 4px; }
    :host ::ng-deep .xterm-viewport { overflow-y: auto !important; }
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

  ngAfterViewInit(): void { this.initTerminal(); }
  ngOnDestroy(): void { this.terminal?.dispose(); }

  private initTerminal(): void {
    this.terminal = new Terminal({
      theme: { background: '#0d0d0d', foreground: '#00ff41', cursor: '#00ff41', selectionBackground: '#1a3a1a' },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
      fontSize: 14, lineHeight: 1.4, cursorBlink: true, convertEol: true,
    });
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(this.terminalHost.nativeElement);
    this.fitAddon.fit();
    this.terminal.writeln('\x1b[32mWelcome to the Linux Playground!\x1b[0m');
    this.terminal.writeln('\x1b[90mType "help" to see available commands.\x1b[0m');
    this.terminal.writeln('');
    this.writePrompt();
    this.terminal.onKey(({ key, domEvent }) => this.handleKey(key, domEvent));
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
      const val = this.historyIndex < this.commandHistory.length ? this.commandHistory[this.historyIndex] : '';
      this.replaceInput(val);
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (key.length !== 1) return;
    this.inputBuffer += key;
    this.terminal.write(key);
  }

  private replaceInput(newValue: string): void {
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
      for (const line of result.split('\n')) this.terminal.writeln(line);
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
