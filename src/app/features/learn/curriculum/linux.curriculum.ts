// src/app/features/learn/curriculum/linux.curriculum.ts

import { Lesson } from './types';

export const LINUX_BEGINNER: Lesson[] = [
  {
    slug: 'what-is-the-terminal',
    title: 'What Is the Terminal?',
    concept: 'The shell as a direct line to the OS',
    storyTitle: 'The Direct Line',
    storyHtml: `
      <p>Imagine your computer as a large office building. Most visitors use the lobby — the graphical desktop, with its icons and menus and windows. But there is a back corridor known only to those who work there, with a direct telephone line to the building's brain. That corridor is the <strong>terminal</strong>.</p>
      <p>When you open a terminal, you are handed a phone. On the other end is the <strong>shell</strong> — a program that listens to your words (commands) and translates them into instructions the operating system can execute. The most common shell on Linux is <strong>Bash</strong> (Bourne Again SHell); on macOS the default is <strong>Zsh</strong>.</p>
      <p>The shell shows you a <strong>prompt</strong> — usually something like <code>user@hostname:~$</code>. The <code>~</code> means you are currently in your home directory. The <code>$</code> means you are a regular user (not the superuser). When you type a command and press Enter, the shell reads it, finds the right program, runs it, and prints the output back to your screen.</p>
      <p>Why bother when you have a GUI? Because the terminal is <em>precise</em>, <em>fast</em>, and <em>scriptable</em>. Clicking through menus to rename 500 files takes an afternoon. A single terminal command does it in one second. Servers — the machines that run the internet — have no GUI at all. The terminal is the only way in.</p>
      <p>The terminal does not forgive imprecision. A typo produces an error or, worse, does the wrong thing silently. But that precision is also its power: what you type is exactly what happens.</p>
    `,
    playgroundType: 'linux',
    starterCode: 'echo "Hello, terminal!"',
    challenge: 'Type `echo "My first command"` and press Enter. Then try `date` to see what it outputs.',
    reflectionPrompt: 'Why do servers typically have no graphical interface? What advantage does a text-only interface give when managing a machine remotely over a slow network?',
    nextSlug: 'navigating-directories',
  },
  {
    slug: 'navigating-directories',
    title: 'Navigating Directories',
    concept: 'pwd, ls, and cd to move through the filesystem',
    storyTitle: 'The Filing Cabinet',
    storyHtml: `
      <p>The Linux filesystem is one enormous <strong>filing cabinet</strong>. At the very top is a single drawer labelled <code>/</code> — the root. Everything else — every program, config file, document, and device — lives somewhere inside that root, organized into nested folders called <strong>directories</strong>.</p>
      <p>When you open a terminal, you are standing in front of one particular drawer. To find out which one, you ask: <code>pwd</code> (print working directory). It prints your current location, like <code>/home/lexi/projects</code>. You are never lost as long as you can type <code>pwd</code>.</p>
      <p>To see what is inside your current directory, you use <code>ls</code> (list). It shows you the contents: files and subdirectories. Add <code>-l</code> for a detailed view with permissions, sizes, and dates. Add <code>-a</code> to also show hidden files (those starting with a dot, like <code>.bashrc</code>).</p>
      <p>To move into a subdirectory, you use <code>cd dirname</code> (change directory). <code>cd ..</code> moves you one level up toward the root. <code>cd ~</code> teleports you directly home no matter where you are. <code>cd /</code> takes you to the root of the entire filesystem.</p>
      <p>You can chain these: <code>cd ../../other-folder</code> moves two levels up, then into <code>other-folder</code>. With <code>pwd</code>, <code>ls</code>, and <code>cd</code>, you can navigate the entire filesystem without ever touching a mouse.</p>
    `,
    playgroundType: 'linux',
    starterCode: 'pwd\nls\ncd /tmp\npwd',
    challenge: 'Navigate to your home directory, then into a subdirectory of your choice, and use pwd to confirm your location. Then navigate back home with a single command.',
    reflectionPrompt: 'What is the difference between an absolute path (starting with /) and a relative path? When would you prefer one over the other?',
    prevSlug: 'what-is-the-terminal',
    nextSlug: 'creating-files',
  },
  {
    slug: 'creating-files',
    title: 'Creating Files & Directories',
    concept: 'touch and mkdir',
    storyTitle: 'The Blank Page',
    storyHtml: `
      <p>In the old scriptorium of Webville, new documents didn't appear by magic. A scribe had to summon a blank page before writing a single word. In Linux, that summons is the <code>touch</code> command.</p>
      <p><code>touch notes.txt</code> creates an empty file named <code>notes.txt</code> in the current directory. If the file already exists, <code>touch</code> merely updates its last-modified timestamp — it doesn't erase the contents. This makes <code>touch</code> useful both for creation and for nudging build systems that check file timestamps.</p>
      <p>You can create multiple files in one go: <code>touch file1.txt file2.txt file3.txt</code>. Three blank pages, instantly.</p>
      <p>But files need drawers. To create a new directory, the scribe uses <code>mkdir dirname</code> (make directory). <code>mkdir projects</code> creates a folder called <code>projects</code> inside the current directory. If you need to create a whole nested path at once — for example <code>projects/2026/april</code> — add the <code>-p</code> flag: <code>mkdir -p projects/2026/april</code>. Without <code>-p</code>, Linux will refuse if any intermediate directory doesn't exist yet.</p>
      <p>Once you have your directory, use <code>cd</code> to step inside it, then <code>touch</code> your new files there. In minutes you can build an entire project scaffold — folders, sub-folders, and placeholder files — with a handful of commands.</p>
    `,
    playgroundType: 'linux',
    starterCode: 'mkdir my-project\ncd my-project\ntouch index.html styles.css\nls',
    challenge: 'Create a directory called "workshop", navigate into it, create three files named "notes.txt", "draft.md", and "config.json", then list them.',
    reflectionPrompt: 'What happens if you run `touch existing-file.txt` on a file that already has content? Does it erase the file? How would you verify this?',
    prevSlug: 'navigating-directories',
    nextSlug: 'reading-files',
  },
  {
    slug: 'reading-files',
    title: 'Reading Files',
    concept: 'cat, head, and tail for viewing file contents',
    storyTitle: 'The Librarian',
    storyHtml: `
      <p>In Webville's great library, the <strong>Librarian</strong> had three ways to answer a question about a scroll, depending on how much of it you needed to read.</p>
      <p>If you needed the entire scroll, she would unroll it completely on the table. That's <code>cat filename</code> (concatenate — its original purpose was joining files, but reading is its most common use). <code>cat notes.txt</code> prints every line of <code>notes.txt</code> to your terminal. For short files, it's perfect. For a 50,000-line log file, it floods your screen with noise.</p>
      <p>For those enormous scrolls, the librarian used two shortcuts. <code>head -n 20 filename</code> shows only the first 20 lines — the opening chapter. The default without <code>-n</code> is 10 lines. <code>tail -n 20 filename</code> shows the last 20 lines — what happened most recently. The default is also 10.</p>
      <p><code>tail</code> has a superpower: <code>tail -f filename</code> follows the file in real time, printing new lines as they are added. Every system administrator knows this trick for watching a server's error log live as traffic flows through: <code>tail -f /var/log/nginx/error.log</code>.</p>
      <p>There is also <code>less filename</code>, the scroll-and-search reader. It opens the file in a pager — use arrow keys to scroll, <code>/search-term</code> to search, and <code>q</code> to quit. For large files you need to explore, <code>less</code> is your best friend.</p>
      <p>The right command depends on your question: want everything? <code>cat</code>. Want a quick glance? <code>head</code>. Want the latest entries? <code>tail</code>. Want to explore? <code>less</code>.</p>
    `,
    playgroundType: 'linux',
    starterCode: '# Create a sample file\nfor i in $(seq 1 20); do echo "Line $i" >> sample.txt; done\n\n# Now try reading it\ncat sample.txt\nhead -n 5 sample.txt\ntail -n 5 sample.txt',
    challenge: 'Create a file with 30 lines of content. Use head to see only the first 5, tail to see only the last 5, and cat to see all of it.',
    reflectionPrompt: 'When would `tail -f` be more useful than just `cat`? Think about a situation where a file is actively growing while you watch it.',
    prevSlug: 'creating-files',
    nextSlug: 'moving-and-copying',
  },
  {
    slug: 'moving-and-copying',
    title: 'Moving & Copying Files',
    concept: 'cp, mv, and rm',
    storyTitle: 'The Mail Room',
    storyHtml: `
      <p>In Webville's mail room, three clerks handled all the paper work, each with a very different policy about originals.</p>
      <p><strong>Copy Clerk</strong> used <code>cp source destination</code>. When you handed her a letter, she made an exact duplicate and placed it in the new location — but the original stayed exactly where it was. <code>cp report.txt backup/report.txt</code> gives you two identical files: the original untouched, the copy in the <code>backup</code> folder. To copy an entire directory and everything inside it, add <code>-r</code> (recursive): <code>cp -r project/ project-backup/</code>.</p>
      <p><strong>Move Clerk</strong> used <code>mv source destination</code>. He picked up the original and placed it in the new location — no duplicate left behind. <code>mv draft.txt final.txt</code> renames the file in-place. <code>mv final.txt archive/final.txt</code> moves it to a different directory. Move is also the way you rename files in Linux.</p>
      <p><strong>Shred Clerk</strong> used <code>rm filename</code> (remove). She destroyed the document permanently. There is no recycle bin. No undo. <code>rm notes.txt</code> is gone. For ever. <code>rm -r folder/</code> deletes an entire directory tree. The <code>-f</code> flag suppresses confirmation prompts — combine that with <code>-r</code> and you have one of the most dangerous commands in computing.</p>
      <p>A wise rule: before deleting, move to a <code>trash/</code> folder and wait a day. Use <code>rm</code> only when you are certain. The mail room has no lost-and-found.</p>
    `,
    playgroundType: 'linux',
    starterCode: 'touch original.txt\ncp original.txt copy.txt\nls\nmv copy.txt renamed.txt\nls\nrm original.txt\nls',
    challenge: 'Create a file, copy it to a backup directory, rename the copy, then delete the original. Verify each step with ls.',
    reflectionPrompt: 'Linux has no recycle bin for `rm`. What workflow or habit would you adopt to avoid accidentally deleting important files from the command line?',
    prevSlug: 'reading-files',
  },
];
