// src/app/features/learn/playground/linux-interpreter.ts

export interface FsNode {
  type: 'file' | 'dir';
  content: string;
}

export class LinuxInterpreter {
  private fs: Map<string, FsNode> = new Map();
  private cwd = '/home/student';
  private history: string[] = [];

  constructor() {
    this.fs.set('/home/student', { type: 'dir', content: '' });
    this.fs.set('/home/student/projects', { type: 'dir', content: '' });
    this.fs.set('/home/student/notes.txt', { type: 'file', content: 'Welcome to Linux!' });
    this.fs.set('/home/student/readme.md', { type: 'file', content: "This is your home directory.\nUse 'ls' to look around." });
  }

  private resolve(path: string): string {
    if (path === '~') return '/home/student';
    if (path.startsWith('~/')) return this.normalize('/home/student/' + path.slice(2));
    if (path.startsWith('/')) return this.normalize(path);
    return this.normalize(this.cwd + '/' + path);
  }

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

  get promptPath(): string {
    if (this.cwd === '/home/student') return '~';
    if (this.cwd.startsWith('/home/student/')) return '~/' + this.cwd.slice('/home/student/'.length);
    return this.cwd;
  }

  run(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '';
    this.history.push(trimmed);

    const redirectMatch = trimmed.match(/^echo\s+(.*?)\s*>\s*(\S+)$/);
    if (redirectMatch) return this.cmdEchoRedirect(redirectMatch[1], redirectMatch[2]);

    const [cmd, ...args] = trimmed.split(/\s+/);
    switch (cmd) {
      case 'pwd':    return this.cmdPwd();
      case 'ls':     return this.cmdLs(args[0]);
      case 'cd':     return this.cmdCd(args[0]);
      case 'mkdir':  return this.cmdMkdir(args[0]);
      case 'touch':  return this.cmdTouch(args[0]);
      case 'cat':    return this.cmdCat(args[0]);
      case 'echo':   return this.cmdEcho(args.join(' '));
      case 'rm':     return this.cmdRm(args[0]);
      case 'clear':  return '__CLEAR__';
      case 'whoami': return 'student';
      case 'date':   return new Date().toLocaleString();
      case 'man':    return this.cmdMan(args[0]);
      case 'help':   return this.cmdHelp();
      default:       return `command not found: ${cmd}. Type "help" for available commands.`;
    }
  }

  private cmdPwd(): string { return this.cwd; }

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
    return entries.length === 0 ? '' : entries.sort().join('  ');
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
      ls: 'ls [path] — list files and directories.',
      cd: 'cd <dir> — change directory.',
      mkdir: 'mkdir <name> — create a new directory.',
      touch: 'touch <name> — create an empty file.',
      cat: 'cat <file> — print file contents.',
      echo: 'echo <text> — print text. Use "echo text > file" to write to a file.',
      rm: 'rm <file> — remove a file.',
      clear: 'clear — clear the screen.',
      whoami: 'whoami — print current user.',
      date: 'date — print current date/time.',
      man: 'man <cmd> — show manual for a command.',
      help: 'help — list available commands.',
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
