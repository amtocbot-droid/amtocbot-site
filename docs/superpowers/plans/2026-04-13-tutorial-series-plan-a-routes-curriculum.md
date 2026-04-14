# Tutorial Series — Plan A: Routes, Curriculum & Lesson Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add /learn routes with story-driven lesson pages for HTML, Linux, C#, Java across beginner/intermediate/advanced levels.

**Architecture:** Static TypeScript curriculum data (no DB needed for content), 3 new Angular standalone components (catalog, track, lesson), lessons loaded via route params. No auth required — fully public.

**Tech Stack:** Angular 21 standalone components, Angular Router, Angular Material cards/chips, Cloudflare Pages (static — no new functions needed for Plan A)

---

## File Map

| File | Purpose |
|------|---------|
| `src/app/features/learn/curriculum/types.ts` | Shared Lesson/LanguageMeta interfaces |
| `src/app/features/learn/curriculum/html.curriculum.ts` | 5 beginner HTML lessons |
| `src/app/features/learn/curriculum/linux.curriculum.ts` | 5 beginner Linux lessons |
| `src/app/features/learn/curriculum/csharp.curriculum.ts` | 5 beginner C# lessons |
| `src/app/features/learn/curriculum/java.curriculum.ts` | 5 beginner Java lessons |
| `src/app/features/learn/learn.service.ts` | `getLesson`, `getLessons`, `getLanguages` |
| `src/app/features/learn/learn-catalog.component.ts` | `/learn` — 4 language cards |
| `src/app/features/learn/learn-track.component.ts` | `/learn/:language` — level tabs + lesson list |
| `src/app/features/learn/learn-lesson.component.ts` | `/learn/:language/:level/:slug` — story + reflection |
| `src/app/app.routes.ts` | Add 3 new routes (modify existing) |
| `src/app/layout/site-layout/site-layout.component.ts` | Add "Tutorials" nav link (modify existing) |

---

## Task 1 — Types + Curriculum Data

### 1.1 — Create shared types

- [ ] Create `src/app/features/learn/curriculum/types.ts`:

```typescript
// src/app/features/learn/curriculum/types.ts

export type Language = 'html' | 'linux' | 'csharp' | 'java';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type PlaygroundType = 'html' | 'linux' | 'code';

export interface Lesson {
  slug: string;
  title: string;
  concept: string;
  storyTitle: string;
  storyHtml: string;        // HTML string with <p>, <strong>, <em>, <code> tags
  playgroundType: PlaygroundType;
  starterCode: string;
  challenge: string;
  reflectionPrompt: string;
  youtubeId?: string;
  nextSlug?: string;
  prevSlug?: string;
}

export interface LanguageMeta {
  id: Language;
  label: string;
  icon: string;             // Material icon name
  description: string;
  color: string;            // CSS color for accent
}
```

### 1.2 — Create HTML curriculum

- [ ] Create `src/app/features/learn/curriculum/html.curriculum.ts`:

```typescript
// src/app/features/learn/curriculum/html.curriculum.ts

import { Lesson } from './types';

export const HTML_BEGINNER: Lesson[] = [
  {
    slug: 'what-is-html',
    title: 'What Is HTML?',
    concept: 'HTML as a set of instructions to the browser',
    storyTitle: "The Builder's Blueprint",
    storyHtml: `
      <p>In a bustling town called <strong>Webville</strong>, nothing could be built without a blueprint. The town architect, <em>Ada</em>, discovered this the hard way when she tried to describe a house out loud — the builders kept getting confused. "Just tell me what it should look like on paper," said the lead builder.</p>
      <p>So Ada learned to write blueprints. She used special marks: <code>&lt;house&gt;</code> meant "start building a house here," and <code>&lt;/house&gt;</code> meant "the house ends here." Every object had an opening mark and a closing mark. The builder — the browser — could read those marks without any confusion.</p>
      <p>HTML is Ada's blueprint language. When you write <code>&lt;p&gt;Hello&lt;/p&gt;</code>, you are telling the browser: "Start a paragraph, put the word Hello inside it, then end the paragraph." The browser reads every tag as an instruction, not as text to display.</p>
      <p>Tags nest inside each other, just like rooms inside a house. A <code>&lt;div&gt;</code> might hold a <code>&lt;h1&gt;</code> which holds a word. The structure matters as much as the words themselves — a blueprint with walls in the wrong order produces a broken building.</p>
      <p>You are now the architect. Every file you write is a blueprint, and the browser is your faithful builder, ready to construct exactly what your tags describe.</p>
    `,
    playgroundType: 'html',
    starterCode: '<!DOCTYPE html>\n<html>\n  <body>\n    <p>Hello, Webville!</p>\n  </body>\n</html>',
    challenge: 'Add a second paragraph below the first one that says "I am learning HTML."',
    reflectionPrompt: 'If HTML tags are instructions to the browser, what do you think happens when you forget a closing tag like </p>? Why might the browser get confused?',
    nextSlug: 'headings-and-paragraphs',
  },
  {
    slug: 'headings-and-paragraphs',
    title: 'Headings & Paragraphs',
    concept: 'h1–h6 for hierarchy, p for body text',
    storyTitle: 'The Town Crier',
    storyHtml: `
      <p>Every morning in Webville, the <strong>Town Crier</strong> stood in the square and delivered the news. He had a strict system: the most important announcement — the day's headline — was always shouted at full volume. That was the <code>&lt;h1&gt;</code>. Secondary news was announced at a slightly lower volume: <code>&lt;h2&gt;</code>. By the time he reached <code>&lt;h6&gt;</code>, he was practically whispering a footnote to himself.</p>
      <p>After each announcement, he would read out the details in a calm, even voice — paragraphs of context. Those were the <code>&lt;p&gt;</code> tags: steady, readable prose that filled in the story behind the headline.</p>
      <p>Hierarchy matters enormously. A town where every announcement was shouted at full volume (<code>&lt;h1&gt;</code> for everything) would be chaos — nobody could tell the important news from the trivial. Likewise, a webpage where every piece of text is a <code>&lt;p&gt;</code> has no structure, no hierarchy, no way for the reader's eye to navigate.</p>
      <p>Search engines read your <code>&lt;h1&gt;</code> the same way the crowd listens to the Town Crier's opening shout: it tells them what the whole page is about. Use exactly one <code>&lt;h1&gt;</code> per page, and let your subheadings cascade logically beneath it.</p>
      <p>Structure is communication. When your headings and paragraphs are properly nested, both humans and machines can skim your page and instantly understand its shape.</p>
    `,
    playgroundType: 'html',
    starterCode: '<h1>Breaking News</h1>\n<p>Something important happened today.</p>\n<h2>Details</h2>\n<p>Here are the specifics...</p>',
    challenge: 'Create a page with an h1 title, two h2 subheadings, and a paragraph under each subheading.',
    reflectionPrompt: 'Why should a page have only one h1 tag? What signal does it send to both the reader and a search engine?',
    prevSlug: 'what-is-html',
    nextSlug: 'links-and-anchors',
  },
  {
    slug: 'links-and-anchors',
    title: 'Links & Anchors',
    concept: 'The <a> tag and href attribute',
    storyTitle: 'The Magic Door',
    storyHtml: `
      <p>Deep in the Webville library, the wizard <strong>Linker</strong> had a peculiar collection: doors. Not ordinary doors — <em>magic doors</em> that could open onto any street in any city in the world, or even onto pages within the same building. Each door was an <code>&lt;a&gt;</code> tag.</p>
      <p>But a door without a destination is just a wall decoration. That's where the <strong>href</strong> attribute came in. The wizard would inscribe the address on each door: <code>&lt;a href="https://example.com"&gt;Visit Example&lt;/a&gt;</code>. The text between the tags was the door's label — what visitors read before deciding whether to walk through.</p>
      <p>Some doors led to other rooms in the same library. For those, Linker wrote relative paths: <code>href="about.html"</code>. Other doors led to far-off kingdoms — absolute URLs starting with <code>https://</code>. And some doors led to a specific spot on the current page using an anchor ID: <code>href="#section-two"</code>.</p>
      <p>Linker had one strict rule: every link must describe its destination honestly. A door labeled "Click here" tells nobody where it leads. A door labeled "Read the installation guide" tells visitors exactly what to expect. Good link text is both accessible and clear.</p>
      <p>The <code>target="_blank"</code> attribute opens the door into a new room rather than replacing the current one — useful for external sites, but always paired with <code>rel="noopener"</code> for security. The wizard was careful never to let an outside kingdom take control of his library.</p>
    `,
    playgroundType: 'html',
    starterCode: '<p>Visit <a href="https://example.com">Example Site</a> to learn more.</p>',
    challenge: 'Create three links: one to an external site, one that links to a section on the same page using an id, and one that opens in a new tab.',
    reflectionPrompt: 'What makes a link accessible? How does a screen reader user experience a link labeled "click here" versus one labeled "read the HTML tutorial"?',
    prevSlug: 'headings-and-paragraphs',
    nextSlug: 'images',
  },
  {
    slug: 'images',
    title: 'Images',
    concept: 'The img tag, src and alt attributes',
    storyTitle: 'The Photo Frame',
    storyHtml: `
      <p>In Webville's portrait gallery, every frame on the wall was an <code>&lt;img&gt;</code> tag. But an empty frame is unsettling — and a frame without a label is a mystery. The gallery's curator, <strong>Ima</strong>, had two rules for every frame she hung.</p>
      <p>First: every frame must know where its photo lives. The <strong>src</strong> attribute is the address of the image file. It might be a relative path like <code>src="images/hero.png"</code> pointing to a file in the same project, or an absolute URL pointing to a photo on another server. Get the path wrong and visitors see a broken frame icon — embarrassing, and bad for trust.</p>
      <p>Second: every frame must carry a text description in the <strong>alt</strong> attribute. When a visitor is blind, or when the network is slow and the image fails to load, the alt text is the only thing they see or hear. <code>alt="A developer staring at a monitor at 2am"</code> paints a picture in words. <code>alt=""</code> is valid too — but only for purely decorative images that convey no information.</p>
      <p>Ima also cared about performance. Large uncompressed images slow down a page dramatically. She always added <code>width</code> and <code>height</code> attributes so the browser could reserve layout space before the image loaded, preventing the jarring jumps known as <em>cumulative layout shift</em>.</p>
      <p>Images are not just decoration — they are content. Treat them with the same care as your words, and your visitors (and search engines) will thank you.</p>
    `,
    playgroundType: 'html',
    starterCode: '<img src="https://via.placeholder.com/400x200" alt="A placeholder image" width="400" height="200">',
    challenge: 'Add an image with a meaningful alt text. Then add a second image that is purely decorative — what should its alt attribute contain?',
    reflectionPrompt: 'Why does the alt attribute exist? What happens to a user of a screen reader when an img tag has no alt attribute at all versus an empty alt=""?',
    prevSlug: 'links-and-anchors',
    nextSlug: 'lists',
  },
  {
    slug: 'lists',
    title: 'Lists',
    concept: 'ol for ordered, ul for unordered, li for items',
    storyTitle: 'The Packing List',
    storyHtml: `
      <p>The explorer <strong>Lexi</strong> was preparing for her first expedition into the mountains of Webville. She had two kinds of things to pack.</p>
      <p>Some things had to be done in order. First, charge the battery. Second, download the maps. Third, pack the tent. The order was critical — downloading maps before charging the battery was a disaster waiting to happen. For these, Lexi used an <strong>ordered list</strong>: <code>&lt;ol&gt;</code>. The browser automatically numbered the items, making the sequence unmistakable.</p>
      <p>Other things were just a collection with no particular sequence. Granola bars. Sunscreen. A notebook. It didn't matter which order she threw them in the bag — they all needed to be there. For these, Lexi used an <strong>unordered list</strong>: <code>&lt;ul&gt;</code>. The browser rendered bullets instead of numbers.</p>
      <p>Each individual item — whether in an <code>&lt;ol&gt;</code> or a <code>&lt;ul&gt;</code> — lived inside an <code>&lt;li&gt;</code> tag (list item). An <code>&lt;li&gt;</code> outside a list, or a list without <code>&lt;li&gt;</code> children, is malformed HTML.</p>
      <p>Lists can nest, too. A main list item can contain its own sub-list. Lexi's "Clothing" item expanded into its own <code>&lt;ul&gt;</code> of socks, a jacket, and hiking boots. Nesting gives structure to complex information without needing a table or custom layout.</p>
      <p>Choose your list type based on whether order matters. That single decision communicates meaning before a reader processes a single word.</p>
    `,
    playgroundType: 'html',
    starterCode: '<ol>\n  <li>Charge the battery</li>\n  <li>Download the maps</li>\n  <li>Pack the tent</li>\n</ol>\n\n<ul>\n  <li>Granola bars</li>\n  <li>Sunscreen</li>\n  <li>Notebook</li>\n</ul>',
    challenge: 'Create a recipe with an ordered list of steps and an unordered list of ingredients. Add a nested list inside one of the steps.',
    reflectionPrompt: 'When would you choose an ordered list over an unordered list? Give a real example from a webpage you use regularly where both types appear.',
    prevSlug: 'images',
  },
];
```

### 1.3 — Create Linux curriculum

- [ ] Create `src/app/features/learn/curriculum/linux.curriculum.ts`:

```typescript
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
      <p><strong>Shred Clerk</strong> used <code>rm filename</code> (remove). She destroyed the document permanently. There is no recycle bin. No undo. <code>rm notes.txt</code> is gone. For ever. <code>rm -r folder/</code> deletes an entire directory tree. The <code>-f</code> flag suppresses confirmation prompts — combine that with <code>-r</code> and you have one of the most dangerous commands in computing: <code>rm -rf /</code> would erase your entire filesystem if run as root.</p>
      <p>A wise rule: before deleting, move to a <code>trash/</code> folder and wait a day. Use <code>rm</code> only when you are certain. The mail room has no lost-and-found.</p>
    `,
    playgroundType: 'linux',
    starterCode: 'touch original.txt\ncp original.txt copy.txt\nls\nmv copy.txt renamed.txt\nls\nrm original.txt\nls',
    challenge: 'Create a file, copy it to a backup directory, rename the copy, then delete the original. Verify each step with ls.',
    reflectionPrompt: 'Linux has no recycle bin for `rm`. What workflow or habit would you adopt to avoid accidentally deleting important files from the command line?',
    prevSlug: 'reading-files',
  },
];
```

### 1.4 — Create C# curriculum

- [ ] Create `src/app/features/learn/curriculum/csharp.curriculum.ts`:

```typescript
// src/app/features/learn/curriculum/csharp.curriculum.ts

import { Lesson } from './types';

export const CSHARP_BEGINNER: Lesson[] = [
  {
    slug: 'what-is-csharp',
    title: 'What Is C#?',
    concept: 'C# as a typed, compiled recipe language',
    storyTitle: 'The Recipe Book',
    storyHtml: `
      <p>In the town of Codeville, every cook worked from a <strong>Recipe Book</strong>. The book was written in a precise language called <strong>C#</strong> — pronounced "C Sharp." Every recipe had to be written down completely before any cooking could begin. You couldn't improvise mid-dish; the compiler (the kitchen inspector) checked every instruction before the stove was even lit.</p>
      <p>A <strong>class</strong> in C# is a recipe card. It describes what ingredients you need (fields), what tools are required (properties), and what steps to follow (methods). A class called <code>Cake</code> might describe how to bake any cake — but it's just instructions on paper. No actual cake exists yet.</p>
      <p>An <strong>object</strong> is the cake you actually bake by following the recipe. You create an object with the <code>new</code> keyword: <code>Cake myCake = new Cake();</code>. Now you have a real cake in your hands, not just a card in a book.</p>
      <p>C# is <strong>strongly typed</strong>: every ingredient must be declared with its exact type before you use it. You cannot add a number where a string is expected — the kitchen inspector will refuse to allow it. This strictness feels annoying at first, but it catches a huge category of mistakes before your code ever runs.</p>
      <p>C# runs on the <strong>.NET runtime</strong>, which means the same code can run on Windows, macOS, or Linux. It is the primary language of enterprise applications, game development (via Unity), and cloud services on Microsoft Azure. Learning C# opens doors to all of these kitchens.</p>
    `,
    playgroundType: 'code',
    starterCode: 'using System;\n\nclass Cake\n{\n    public string Flavour = "chocolate";\n\n    public void Bake()\n    {\n        Console.WriteLine($"Baking a {Flavour} cake!");\n    }\n}\n\nclass Program\n{\n    static void Main()\n    {\n        Cake myCake = new Cake();\n        myCake.Bake();\n    }\n}',
    challenge: 'Add a second property `Size` to the Cake class and print it inside Bake(). Create two different Cake objects with different flavours.',
    reflectionPrompt: 'What is the difference between a class and an object? Can you think of three real-world "recipes" (classes) and the specific "dishes" (objects) made from them?',
    nextSlug: 'variables-and-types',
  },
  {
    slug: 'variables-and-types',
    title: 'Variables & Types',
    concept: 'int, string, bool, double — typed storage',
    storyTitle: 'The Labeled Jars',
    storyHtml: `
      <p>In the Codeville pantry, <strong>Chef Marco</strong> kept a wall of labeled jars. Each jar was designed for exactly one kind of ingredient. The jar labeled <strong>int</strong> was made of rigid glass — it held whole numbers only: 1, 42, -7. You could not pour honey (a decimal) into it. You could not stuff a word inside it.</p>
      <p>The jar labeled <strong>string</strong> held text — any sequence of characters, wrapped in double quotes. <code>string name = "Marco";</code> — the jar now holds the word Marco. Strings can hold sentences, URLs, a single letter, or even an empty sequence <code>""</code>.</p>
      <p>The jar labeled <strong>bool</strong> was the simplest: it held exactly one of two values, <code>true</code> or <code>false</code>. Is the oven hot? <code>bool ovenReady = true;</code>. Has the timer gone off? <code>bool timerDone = false;</code>. Booleans are the light switches of programming.</p>
      <p>The jar labeled <strong>double</strong> held decimal numbers: <code>3.14</code>, <code>99.99</code>, <code>-0.5</code>. Use it whenever a whole number is not precise enough — prices, measurements, scientific values.</p>
      <p>C# also has <code>var</code>, which lets the compiler infer the type: <code>var score = 100;</code> — the compiler knows this is an <code>int</code>. <code>var</code> is convenient but doesn't make C# dynamically typed; once assigned, the type is locked. You still can't pour soup into the dry-goods jar.</p>
    `,
    playgroundType: 'code',
    starterCode: 'using System;\n\nclass Program\n{\n    static void Main()\n    {\n        int age = 25;\n        string name = "Alex";\n        bool isLoggedIn = true;\n        double temperature = 36.6;\n\n        Console.WriteLine($"{name} is {age} years old.");\n        Console.WriteLine($"Logged in: {isLoggedIn}");\n        Console.WriteLine($"Temperature: {temperature}°C");\n    }\n}',
    challenge: 'Declare variables for a product in an online store: name (string), price (double), quantity (int), and inStock (bool). Print a summary sentence using all four.',
    reflectionPrompt: 'What happens in C# if you try to store a decimal number like 3.14 in an int variable? Why does a strongly typed language refuse to do this automatically?',
    prevSlug: 'what-is-csharp',
    nextSlug: 'if-else',
  },
  {
    slug: 'if-else',
    title: 'If / Else',
    concept: 'Conditional branching',
    storyTitle: 'The Bouncer',
    storyHtml: `
      <p>Outside the most exclusive club in Codeville stood <strong>Bruno the Bouncer</strong>. Bruno had one job: evaluate each person at the door and decide their fate. He did this with a single mental structure: <strong>if this condition is true, do this; else, do that.</strong></p>
      <p>In C#, Bruno's logic looks like this:<br><code>if (age &gt;= 18) { Console.WriteLine("Welcome in."); } else { Console.WriteLine("Not tonight."); }</code></p>
      <p>The condition inside the parentheses must evaluate to a <code>bool</code> — either <code>true</code> or <code>false</code>. Common comparisons: <code>==</code> (equals), <code>!=</code> (not equals), <code>&gt;</code>, <code>&lt;</code>, <code>&gt;=</code>, <code>&lt;=</code>. Combine conditions with <code>&amp;&amp;</code> (and) or <code>||</code> (or).</p>
      <p>When Bruno had more than two outcomes, he chained conditions: <code>if … else if … else if … else</code>. Perhaps members got a VIP entrance, guests with a reservation got a regular entrance, and everyone else was turned away. Each <code>else if</code> block is checked in order — the first one whose condition is <code>true</code> runs, and the rest are skipped entirely.</p>
      <p>A common beginner mistake is using <code>=</code> (assignment) instead of <code>==</code> (comparison) inside an if condition. <code>if (age = 18)</code> doesn't compare — it tries to assign, which is a compile error in C# for this context. The compiler will catch it, but it is still a habit worth building early.</p>
      <p>Conditionals are the decision points of any program. Almost every real feature — login checks, input validation, business rules — is built from chains of if/else logic.</p>
    `,
    playgroundType: 'code',
    starterCode: 'using System;\n\nclass Program\n{\n    static void Main()\n    {\n        int age = 20;\n\n        if (age >= 18)\n        {\n            Console.WriteLine("Access granted.");\n        }\n        else\n        {\n            Console.WriteLine("Access denied.");\n        }\n    }\n}',
    challenge: 'Write a program that takes a score (0-100) and prints "Excellent" for 90+, "Pass" for 60-89, and "Fail" for below 60. Use if/else if/else.',
    reflectionPrompt: 'What is the difference between `=` and `==` in C#? Why does this distinction matter, and what kind of bug can it cause in languages that are less strict?',
    prevSlug: 'variables-and-types',
    nextSlug: 'loops',
  },
  {
    slug: 'loops',
    title: 'Loops',
    concept: 'for and while loops for repetition',
    storyTitle: 'The Assembly Line',
    storyHtml: `
      <p>In Codeville's famous widget factory, the <strong>Assembly Line</strong> ran day and night. Workers didn't perform each task manually for each widget — that would take forever. Instead, a supervisor would set the line running with a set of instructions that repeated automatically for every item on the belt.</p>
      <p>The <strong>for loop</strong> is for when you know exactly how many times to repeat. The supervisor would say: "For widget number 1 through 100, do this." In C#: <code>for (int i = 0; i &lt; 100; i++) { ProcessWidget(i); }</code>. The three parts of the for loop are: <em>initialiser</em> (<code>int i = 0</code>), <em>condition</em> (<code>i &lt; 100</code>), and <em>increment</em> (<code>i++</code>). The loop runs as long as the condition is true.</p>
      <p>The <strong>while loop</strong> is for when you don't know how many times to repeat — you only know the stopping condition. "Keep running the machine while there are widgets on the belt." <code>while (beltHasWidgets) { ProcessNext(); }</code>. If the condition is never false, the loop runs forever — a classic beginner bug called an <em>infinite loop</em>.</p>
      <p>The <strong>foreach loop</strong> is C#'s most readable loop for collections: <code>foreach (var widget in widgetList) { Console.WriteLine(widget.Id); }</code>. You don't manage a counter; you just say "do this for each item in the collection."</p>
      <p>Inside any loop, <code>break</code> exits immediately and <code>continue</code> skips to the next iteration. Use them carefully — overuse makes loops hard to reason about. The cleanest loops have a single entry point, a single exit condition, and no surprises.</p>
    `,
    playgroundType: 'code',
    starterCode: 'using System;\n\nclass Program\n{\n    static void Main()\n    {\n        // for loop\n        for (int i = 1; i <= 5; i++)\n        {\n            Console.WriteLine($"Widget #{i} processed");\n        }\n\n        // while loop\n        int count = 0;\n        while (count < 3)\n        {\n            Console.WriteLine($"Round {count + 1}");\n            count++;\n        }\n    }\n}',
    challenge: 'Write a program that prints the multiplication table for 7 (7×1 through 7×10) using a for loop. Then rewrite it using a while loop.',
    reflectionPrompt: 'What is an infinite loop and how does it happen? How would you detect one while your program is running, and how would you stop it?',
    prevSlug: 'if-else',
    nextSlug: 'methods',
  },
  {
    slug: 'methods',
    title: 'Methods',
    concept: 'Defining and calling reusable methods',
    storyTitle: 'The Toolbox',
    storyHtml: `
      <p>Every skilled craftsperson in Codeville kept a <strong>toolbox</strong>. Not a box of hammers and wrenches — a box of <em>procedures</em>. Each tool was a method: a named set of instructions you could pick up and use anywhere, without re-explaining how it worked every time.</p>
      <p>A method in C# has four parts: a <em>return type</em>, a <em>name</em>, zero or more <em>parameters</em>, and a <em>body</em>. <code>static int Add(int a, int b) { return a + b; }</code> — this tool takes two numbers and hands back their sum. Calling it is as simple as <code>int result = Add(3, 7);</code>.</p>
      <p>If a method doesn't need to return anything — it just <em>does</em> something, like printing — its return type is <code>void</code>. <code>static void Greet(string name) { Console.WriteLine($"Hello, {name}!"); }</code>. You call it, it runs, nothing comes back.</p>
      <p>Parameters let a method work on different inputs each time. <code>Add(1, 2)</code> and <code>Add(10, 20)</code> use the same tool with different materials. C# also supports <em>default parameters</em>: <code>static void Greet(string name = "World")</code> — if you call <code>Greet()</code> without arguments, it uses "World".</p>
      <p>Methods prevent repetition. If the same block of code appears three times in your program, extract it into a method. Now when the logic needs to change, you change it in one place — not three. This principle, <strong>Don't Repeat Yourself (DRY)</strong>, is the foundation of maintainable software.</p>
    `,
    playgroundType: 'code',
    starterCode: 'using System;\n\nclass Program\n{\n    static int Add(int a, int b)\n    {\n        return a + b;\n    }\n\n    static void Greet(string name = "World")\n    {\n        Console.WriteLine($"Hello, {name}!");\n    }\n\n    static void Main()\n    {\n        Console.WriteLine(Add(3, 7));\n        Greet("Alex");\n        Greet();\n    }\n}',
    challenge: 'Write a method `int Multiply(int a, int b)` and another `bool IsEven(int n)`. Call both from Main and print the results.',
    reflectionPrompt: 'What does the DRY principle mean, and why does it matter? What problems arise when the same logic is copy-pasted in three different places?',
    prevSlug: 'loops',
  },
];
```

### 1.5 — Create Java curriculum

- [ ] Create `src/app/features/learn/curriculum/java.curriculum.ts`:

```typescript
// src/app/features/learn/curriculum/java.curriculum.ts

import { Lesson } from './types';

export const JAVA_BEGINNER: Lesson[] = [
  {
    slug: 'what-is-java',
    title: 'What Is Java?',
    concept: 'Write once, run anywhere via the JVM',
    storyTitle: 'Write Once, Run Anywhere',
    storyHtml: `
      <p>Long before the internet was born, software developers faced a maddening problem: code written for one machine refused to run on another. A program for Windows was useless on a Sun workstation. You rewrote everything for every platform. Then in 1995, a team at <strong>Sun Microsystems</strong> invented a universal translator — and called it <strong>Java</strong>.</p>
      <p>The key insight was a middle layer: the <strong>Java Virtual Machine (JVM)</strong>. When you write Java code, the compiler doesn't translate it into machine instructions for your specific hardware. Instead, it compiles into <strong>bytecode</strong> — a neutral, platform-independent format. The JVM on each machine then translates that bytecode into whatever the local hardware needs.</p>
      <p>Write the code once. The JVM on Windows reads it. The JVM on Linux reads it. The JVM on a phone reads it. Same bytecode, same result, everywhere. This was so revolutionary that "Write Once, Run Anywhere" became Java's official slogan.</p>
      <p>Today Java powers the backends of some of the world's largest systems — Netflix, LinkedIn, Amazon. It is the primary language of Android app development. It runs inside ATMs, spacecraft controllers, and industrial machinery. The JVM has become a platform in its own right, hosting languages like Kotlin, Scala, and Clojure.</p>
      <p>Java is <strong>object-oriented</strong>, <strong>strongly typed</strong>, and <strong>verbose by design</strong>. That verbosity means more code to write, but also more clarity about what the code does — a deliberate tradeoff that makes Java a strong choice for large teams working on large systems.</p>
    `,
    playgroundType: 'code',
    starterCode: 'public class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println("Hello, Java!");\n        System.out.println("Write once, run anywhere.");\n    }\n}',
    challenge: 'Modify the program to print your name and the current year. Notice that every Java program needs a class with a main method — why do you think that is?',
    reflectionPrompt: 'What is bytecode and how does it differ from machine code? Why was this abstraction so significant for software distribution in the 1990s?',
    nextSlug: 'classes-and-objects',
  },
  {
    slug: 'classes-and-objects',
    title: 'Classes & Objects',
    concept: 'Class as blueprint, object as instance',
    storyTitle: 'The Cookie Cutter',
    storyHtml: `
      <p>In the Codeville bakery, the master baker <strong>Javi</strong> had a beautiful collection of <strong>cookie cutters</strong>. Each cutter had a specific shape: star, heart, gingerbread person. A cutter is not a cookie — it's the <em>blueprint</em> for making cookies. You could use the star cutter a hundred times and get a hundred star cookies, each made from different dough, with different decorations, but all sharing the same star shape.</p>
      <p>In Java, a <strong>class</strong> is the cookie cutter. It defines what every cookie of that type will look like — what data it will hold (fields) and what it can do (methods). A <strong>object</strong> is the actual cookie: an instance created from the cutter with the <code>new</code> keyword.</p>
      <p><code>Cookie c1 = new Cookie();</code> — this creates one cookie. <code>Cookie c2 = new Cookie();</code> — a second cookie, completely independent. Changing <code>c1.flavour</code> does not affect <code>c2.flavour</code>. Each object holds its own copy of the fields defined in the class.</p>
      <p>A <strong>constructor</strong> is the initial shaping step — the moment you press the cutter into the dough and decide its starting state. <code>public Cookie(String flavour) { this.flavour = flavour; }</code> lets you create flavoured cookies right from the start: <code>new Cookie("vanilla")</code>.</p>
      <p>This model — classes as blueprints, objects as instances — is the foundation of object-oriented programming. Almost everything in Java is an object, and almost all behaviour is defined inside classes.</p>
    `,
    playgroundType: 'code',
    starterCode: 'public class Cookie {\n    String flavour;\n    String decoration;\n\n    public Cookie(String flavour) {\n        this.flavour = flavour;\n        this.decoration = "plain";\n    }\n\n    public void describe() {\n        System.out.println(flavour + " cookie with " + decoration + " decoration");\n    }\n\n    public static void main(String[] args) {\n        Cookie c1 = new Cookie("chocolate chip");\n        Cookie c2 = new Cookie("vanilla");\n        c2.decoration = "sprinkles";\n        c1.describe();\n        c2.describe();\n    }\n}',
    challenge: 'Add a `size` field (String: "small", "medium", "large") to the Cookie class. Update the constructor to accept it, create three cookies of different sizes, and print their descriptions.',
    reflectionPrompt: 'If two Cookie objects are created from the same class, are their fields shared or independent? What would happen to a program if fields were shared between all instances?',
    prevSlug: 'what-is-java',
    nextSlug: 'variables-and-types',
  },
  {
    slug: 'variables-and-types',
    title: 'Variables & Types',
    concept: 'Primitive types and typed declarations in Java',
    storyTitle: 'The Typed Mailbox',
    storyHtml: `
      <p>On every street in Codeville, mailboxes came in carefully labelled sizes. The <strong>int mailbox</strong> only accepted whole-number envelopes. The <strong>String mailbox</strong> only accepted text parcels. The <strong>boolean mailbox</strong> was the simplest — it had two slots: one for <code>true</code>, one for <code>false</code>. Try stuffing the wrong type of mail into any of them, and the postal inspector (the Java compiler) would refuse the delivery before it even left the sorting office.</p>
      <p>Java's primitive types are the smallest mailboxes: <code>int</code> (whole numbers), <code>double</code> (decimals), <code>boolean</code> (true/false), <code>char</code> (a single character), <code>long</code> (very large whole numbers), and a few others. They are not objects — they hold their value directly, making them fast and memory-efficient.</p>
      <p><code>String</code> is different: it is a full object (note the capital S). It holds a sequence of characters and comes with many built-in methods: <code>name.length()</code>, <code>name.toUpperCase()</code>, <code>name.contains("x")</code>.</p>
      <p>Every variable in Java must be declared with its type before use: <code>int age = 30;</code>. Java does not guess. This contract — declaring the type upfront — means the compiler can catch the entire category of "wrong type" bugs before your program runs. In large codebases, this saves enormous amounts of debugging time.</p>
      <p>Since Java 10, you can use <code>var</code> for local variable type inference: <code>var score = 95;</code> — the compiler infers <code>int</code>. But <code>var</code> is still statically typed; the type is fixed at compile time. The mailbox is still the right size — you just didn't have to write the label yourself.</p>
    `,
    playgroundType: 'code',
    starterCode: 'public class TypedMailbox {\n    public static void main(String[] args) {\n        int age = 28;\n        double salary = 72500.50;\n        boolean isEmployed = true;\n        String name = "Jordan";\n        char grade = \'A\';\n\n        System.out.println(name + " is " + age + " years old.");\n        System.out.println("Employed: " + isEmployed);\n        System.out.println("Grade: " + grade);\n        System.out.printf("Salary: $%.2f%n", salary);\n    }\n}',
    challenge: 'Declare variables to represent a book: title (String), pages (int), price (double), isAvailable (boolean). Print a formatted summary of the book.',
    reflectionPrompt: 'What is the difference between `int` and `Integer` in Java? Why does Java have both a primitive `int` and an object wrapper `Integer`?',
    prevSlug: 'classes-and-objects',
    nextSlug: 'methods',
  },
  {
    slug: 'methods',
    title: 'Methods',
    concept: 'Defining and calling methods with return values',
    storyTitle: 'The Vending Machine',
    storyHtml: `
      <p>In the Codeville break room stood a magnificent <strong>vending machine</strong>. You pressed a button — a specific code, like B3 — and the machine carried out a precise internal sequence: checked inventory, dispensed the item, updated the count, printed a receipt. You didn't need to know how it worked. You pressed the button, you got the snack. That's a method.</p>
      <p>A Java method has a <em>return type</em>, a <em>name</em>, and zero or more <em>parameters</em>. <code>public int add(int a, int b) { return a + b; }</code> — press the button, provide the inputs, get a result back. The <code>return</code> statement is the machine dispensing your snack.</p>
      <p>If the method doesn't hand back a value — maybe it just prints something, or updates a field — its return type is <code>void</code>. <code>public void printReceipt(String item) { System.out.println("Dispensed: " + item); }</code>.</p>
      <p>Java supports <strong>method overloading</strong>: two methods can share a name as long as their parameter lists differ. <code>double area(double radius)</code> and <code>double area(double width, double height)</code> are different machines with the same label on the button — the compiler picks the right one based on what you pass in.</p>
      <p>The <code>static</code> keyword means the method belongs to the class itself, not to any particular object. <code>public static void main(String[] args)</code> is always static — it runs before any object exists. Instance methods (without <code>static</code>) run on a specific object and have access to its fields via <code>this</code>.</p>
    `,
    playgroundType: 'code',
    starterCode: 'public class VendingMachine {\n    private int stock = 10;\n\n    public String dispense(String item) {\n        if (stock > 0) {\n            stock--;\n            return "Dispensed: " + item + ". Stock left: " + stock;\n        } else {\n            return "Out of stock!";\n        }\n    }\n\n    public static void main(String[] args) {\n        VendingMachine vm = new VendingMachine();\n        System.out.println(vm.dispense("Chips"));\n        System.out.println(vm.dispense("Water"));\n    }\n}',
    challenge: 'Add a `restock(int amount)` method that adds to the stock. Add an `int getStock()` method that returns the current count. Test both from main.',
    reflectionPrompt: 'What is method overloading and when is it useful? Give an example where you would want two methods with the same name but different parameters.',
    prevSlug: 'variables-and-types',
    nextSlug: 'if-else',
  },
  {
    slug: 'if-else',
    title: 'If / Else',
    concept: 'Conditional logic and nested conditions',
    storyTitle: 'The Traffic Light',
    storyHtml: `
      <p>At the busiest intersection in Codeville stood a <strong>traffic light</strong> that every driver understood intuitively. It checked one condition — the timer — and acted on the result: green meant go, red meant stop, yellow meant slow. The light didn't think about other intersections. It evaluated its condition and executed its branch. That is an if/else statement.</p>
      <p>In Java: <code>if (timer &lt; 30) { signal = "green"; } else if (timer &lt; 35) { signal = "yellow"; } else { signal = "red"; }</code>. Each condition is checked in order. The first one that is <code>true</code> wins; the rest are skipped entirely.</p>
      <p>Conditions in Java use the same comparison operators as most languages: <code>==</code>, <code>!=</code>, <code>&lt;</code>, <code>&gt;</code>, <code>&lt;=</code>, <code>&gt;=</code>. Logical operators combine them: <code>&amp;&amp;</code> (both must be true), <code>||</code> (at least one must be true), <code>!</code> (invert). <code>if (isGreen &amp;&amp; !isPedestrian)</code> — proceed only if the light is green and no pedestrian is crossing.</p>
      <p>Java also has the <strong>ternary operator</strong> for simple cases: <code>String result = (score &gt;= 60) ? "Pass" : "Fail";</code>. One line instead of five. Use it for simple, readable conditions — not for nested logic, where it becomes a maintenance trap.</p>
      <p>Nested ifs — lights within lights — handle more complex scenarios. But deep nesting (more than 2-3 levels) is a warning sign. If your if-tree is growing beyond that, refactor it into separate methods or use a switch statement. Clarity beats cleverness every time.</p>
    `,
    playgroundType: 'code',
    starterCode: 'public class TrafficLight {\n    public static String getSignal(int timer) {\n        if (timer < 30) {\n            return "GREEN - Go";\n        } else if (timer < 35) {\n            return "YELLOW - Slow down";\n        } else {\n            return "RED - Stop";\n        }\n    }\n\n    public static void main(String[] args) {\n        System.out.println(getSignal(15));\n        System.out.println(getSignal(32));\n        System.out.println(getSignal(40));\n    }\n}',
    challenge: 'Extend the traffic light to handle a pedestrian crossing button. If the pedestrian button is pressed AND the timer is over 30 seconds, the light immediately turns red. Use nested if/else.',
    reflectionPrompt: 'What is the ternary operator and when is it appropriate to use it? When does it make code clearer, and when does it make code harder to read?',
    prevSlug: 'methods',
  },
];
```

- [ ] Verify TypeScript compiles: `cd /Users/amtoc/amtocbot-site && npx tsc --noEmit`

---

## Task 2 — LearnService

- [ ] Create `src/app/features/learn/learn.service.ts`:

```typescript
// src/app/features/learn/learn.service.ts

import { Injectable } from '@angular/core';
import { Language, LanguageMeta, Lesson, Level } from './curriculum/types';
import { HTML_BEGINNER } from './curriculum/html.curriculum';
import { LINUX_BEGINNER } from './curriculum/linux.curriculum';
import { CSHARP_BEGINNER } from './curriculum/csharp.curriculum';
import { JAVA_BEGINNER } from './curriculum/java.curriculum';

const LANGUAGE_META: LanguageMeta[] = [
  {
    id: 'html',
    label: 'HTML',
    icon: 'code',
    description: 'Learn the building blocks of every webpage. Master tags, structure, and semantics.',
    color: '#e44d26',
  },
  {
    id: 'linux',
    label: 'Linux',
    icon: 'terminal',
    description: 'Master the command line. Navigate filesystems, manage files, and automate tasks.',
    color: '#f5a623',
  },
  {
    id: 'csharp',
    label: 'C#',
    icon: 'data_object',
    description: 'Build enterprise apps, games with Unity, and cloud services on .NET.',
    color: '#9b4f96',
  },
  {
    id: 'java',
    label: 'Java',
    icon: 'coffee',
    description: 'Write once, run anywhere. Power backend systems and Android applications.',
    color: '#007396',
  },
];

const CURRICULUM: Record<Language, Record<Level, Lesson[]>> = {
  html: {
    beginner: HTML_BEGINNER,
    intermediate: [],
    advanced: [],
  },
  linux: {
    beginner: LINUX_BEGINNER,
    intermediate: [],
    advanced: [],
  },
  csharp: {
    beginner: CSHARP_BEGINNER,
    intermediate: [],
    advanced: [],
  },
  java: {
    beginner: JAVA_BEGINNER,
    intermediate: [],
    advanced: [],
  },
};

@Injectable({ providedIn: 'root' })
export class LearnService {
  getLanguages(): LanguageMeta[] {
    return LANGUAGE_META;
  }

  getLanguageMeta(id: Language): LanguageMeta | undefined {
    return LANGUAGE_META.find(l => l.id === id);
  }

  getLessons(language: Language, level: Level): Lesson[] {
    return CURRICULUM[language]?.[level] ?? [];
  }

  getLesson(language: Language, level: Level, slug: string): Lesson | undefined {
    return this.getLessons(language, level).find(l => l.slug === slug);
  }

  isValidLanguage(value: string): value is Language {
    return ['html', 'linux', 'csharp', 'java'].includes(value);
  }

  isValidLevel(value: string): value is Level {
    return ['beginner', 'intermediate', 'advanced'].includes(value);
  }
}
```

- [ ] Verify TypeScript compiles: `cd /Users/amtoc/amtocbot-site && npx tsc --noEmit`

---

## Task 3 — LearnCatalogComponent

- [ ] Create `src/app/features/learn/learn-catalog.component.ts`:

```typescript
// src/app/features/learn/learn-catalog.component.ts

import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LearnService } from './learn.service';
import { LanguageMeta } from './curriculum/types';

@Component({
  selector: 'app-learn-catalog',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="catalog-page">
      <div class="catalog-header">
        <h1 class="catalog-title">Learn to Code</h1>
        <p class="catalog-sub">Story-driven lessons that make programming concepts stick. Pick a language and start your first lesson in seconds — no account required.</p>
      </div>

      <div class="language-grid">
        @for (lang of languages; track lang.id) {
          <div class="language-card" [style.--accent]="lang.color">
            <div class="language-card-icon">
              <span class="material-symbols-outlined lang-icon">{{ lang.icon }}</span>
            </div>
            <div class="language-card-body">
              <h2 class="language-name">{{ lang.label }}</h2>
              <p class="language-desc">{{ lang.description }}</p>
            </div>
            <a [routerLink]="['/learn', lang.id]" class="start-btn">
              Start Learning →
            </a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .catalog-page {
      max-width: 960px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }

    .catalog-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .catalog-title {
      font-size: 2.5rem;
      font-weight: 700;
      margin: 0 0 1rem;
      background: linear-gradient(135deg, var(--color-primary, #6366f1), var(--color-accent, #8b5cf6));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .catalog-sub {
      font-size: 1.125rem;
      color: var(--color-muted, #6b7280);
      max-width: 600px;
      margin: 0 auto;
      line-height: 1.6;
    }

    .language-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
    }

    @media (max-width: 600px) {
      .language-grid {
        grid-template-columns: 1fr;
      }
    }

    .language-card {
      background: var(--color-surface, #ffffff);
      border: 1px solid var(--color-border, #e5e7eb);
      border-top: 4px solid var(--accent);
      border-radius: 12px;
      padding: 1.75rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      transition: box-shadow 0.2s, transform 0.2s;
    }

    .language-card:hover {
      box-shadow: 0 8px 24px rgba(0,0,0,0.1);
      transform: translateY(-2px);
    }

    .language-card-icon {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .lang-icon {
      font-size: 1.75rem;
      color: var(--accent);
    }

    .language-card-body {
      flex: 1;
    }

    .language-name {
      font-size: 1.375rem;
      font-weight: 700;
      margin: 0 0 0.5rem;
      color: var(--color-text, #111827);
    }

    .language-desc {
      font-size: 0.9375rem;
      color: var(--color-muted, #6b7280);
      line-height: 1.5;
      margin: 0;
    }

    .start-btn {
      display: inline-block;
      padding: 0.625rem 1.25rem;
      background: var(--accent);
      color: #fff;
      border-radius: 8px;
      text-decoration: none;
      font-size: 0.9375rem;
      font-weight: 600;
      text-align: center;
      transition: opacity 0.2s;
    }

    .start-btn:hover {
      opacity: 0.88;
    }
  `],
})
export class LearnCatalogComponent {
  private learnService = inject(LearnService);
  languages: LanguageMeta[] = this.learnService.getLanguages();
}
```

- [ ] Verify TypeScript compiles: `cd /Users/amtoc/amtocbot-site && npx tsc --noEmit`

---

## Task 4 — LearnTrackComponent

- [ ] Create `src/app/features/learn/learn-track.component.ts`:

```typescript
// src/app/features/learn/learn-track.component.ts

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LearnService } from './learn.service';
import { Language, LanguageMeta, Lesson, Level } from './curriculum/types';

const LEVELS: { id: Level; label: string }[] = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

@Component({
  selector: 'app-learn-track',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="track-page">
      @if (languageMeta()) {
        <div class="track-header" [style.--accent]="languageMeta()!.color">
          <a routerLink="/learn" class="breadcrumb-back">← All Languages</a>
          <div class="track-title-row">
            <span class="material-symbols-outlined track-lang-icon">{{ languageMeta()!.icon }}</span>
            <h1 class="track-title">{{ languageMeta()!.label }}</h1>
          </div>
          <p class="track-desc">{{ languageMeta()!.description }}</p>
        </div>

        <div class="level-tabs">
          @for (lvl of levelList; track lvl.id) {
            <button
              class="level-tab"
              [class.active]="activeLevel() === lvl.id"
              (click)="activeLevel.set(lvl.id)">
              {{ lvl.label }}
              <span class="lesson-count">{{ getLessonCount(lvl.id) }}</span>
            </button>
          }
        </div>

        <div class="lesson-list">
          @if (lessons().length === 0) {
            <div class="empty-state">
              <span class="material-symbols-outlined empty-icon">construction</span>
              <p>{{ levelLabel() }} lessons are coming soon. Start with Beginner!</p>
            </div>
          } @else {
            @for (lesson of lessons(); track lesson.slug; let i = $index) {
              <a
                [routerLink]="['/learn', language(), activeLevel(), lesson.slug]"
                class="lesson-card">
                <span class="lesson-number">{{ i + 1 }}</span>
                <div class="lesson-info">
                  <div class="lesson-title">{{ lesson.title }}</div>
                  <div class="lesson-concept">{{ lesson.concept }}</div>
                </div>
                <span class="lesson-arrow">→</span>
              </a>
            }
          }
        </div>
      } @else {
        <div class="not-found">
          <h2>Language not found</h2>
          <a routerLink="/learn">← Back to catalog</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .track-page {
      max-width: 780px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }

    .breadcrumb-back {
      display: inline-block;
      color: var(--color-muted, #6b7280);
      text-decoration: none;
      font-size: 0.9rem;
      margin-bottom: 1.25rem;
    }

    .breadcrumb-back:hover { color: var(--color-text, #111827); }

    .track-title-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .track-lang-icon {
      font-size: 2rem;
      color: var(--accent);
    }

    .track-title {
      font-size: 2rem;
      font-weight: 700;
      margin: 0;
      color: var(--color-text, #111827);
    }

    .track-desc {
      color: var(--color-muted, #6b7280);
      font-size: 1rem;
      line-height: 1.5;
      margin: 0 0 2rem;
    }

    .level-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
      border-bottom: 2px solid var(--color-border, #e5e7eb);
      padding-bottom: 0;
    }

    .level-tab {
      padding: 0.625rem 1.25rem;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--color-muted, #6b7280);
      border-bottom: 3px solid transparent;
      margin-bottom: -2px;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: color 0.15s;
    }

    .level-tab.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }

    .level-tab:hover:not(.active) {
      color: var(--color-text, #111827);
    }

    .lesson-count {
      background: var(--color-border, #e5e7eb);
      color: var(--color-muted, #6b7280);
      font-size: 0.75rem;
      border-radius: 10px;
      padding: 1px 7px;
    }

    .level-tab.active .lesson-count {
      background: color-mix(in srgb, var(--accent) 15%, transparent);
      color: var(--accent);
    }

    .lesson-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .lesson-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
      background: var(--color-surface, #ffffff);
      border: 1px solid var(--color-border, #e5e7eb);
      border-radius: 10px;
      text-decoration: none;
      color: inherit;
      transition: box-shadow 0.15s, border-color 0.15s;
    }

    .lesson-card:hover {
      border-color: var(--accent);
      box-shadow: 0 2px 12px rgba(0,0,0,0.07);
    }

    .lesson-number {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      color: var(--accent);
      font-size: 0.875rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .lesson-info { flex: 1; min-width: 0; }

    .lesson-title {
      font-weight: 600;
      font-size: 1rem;
      color: var(--color-text, #111827);
    }

    .lesson-concept {
      font-size: 0.875rem;
      color: var(--color-muted, #6b7280);
      margin-top: 0.125rem;
    }

    .lesson-arrow {
      color: var(--color-muted, #6b7280);
      font-size: 1.125rem;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--color-muted, #6b7280);
    }

    .empty-icon {
      font-size: 3rem;
      display: block;
      margin-bottom: 0.75rem;
    }

    .not-found {
      text-align: center;
      padding: 4rem 1rem;
    }
  `],
})
export class LearnTrackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private learnService = inject(LearnService);

  levelList = LEVELS;
  language = signal<Language>('html');
  activeLevel = signal<Level>('beginner');
  languageMeta = signal<LanguageMeta | undefined>(undefined);

  lessons = computed(() =>
    this.learnService.getLessons(this.language(), this.activeLevel())
  );

  levelLabel = computed(() =>
    LEVELS.find(l => l.id === this.activeLevel())?.label ?? ''
  );

  ngOnInit(): void {
    const langParam = this.route.snapshot.paramMap.get('language') ?? '';
    if (this.learnService.isValidLanguage(langParam)) {
      this.language.set(langParam);
      this.languageMeta.set(this.learnService.getLanguageMeta(langParam));
    }
  }

  getLessonCount(level: Level): number {
    return this.learnService.getLessons(this.language(), level).length;
  }
}
```

- [ ] Verify TypeScript compiles: `cd /Users/amtoc/amtocbot-site && npx tsc --noEmit`

---

## Task 5 — LearnLessonComponent

- [ ] Create `src/app/features/learn/learn-lesson.component.ts`:

```typescript
// src/app/features/learn/learn-lesson.component.ts

import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LearnService } from './learn.service';
import { Language, Lesson, Level } from './curriculum/types';

@Component({
  selector: 'app-learn-lesson',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="lesson-page">
      @if (lesson()) {
        <!-- Breadcrumb -->
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a routerLink="/learn" class="bc-link">Tutorials</a>
          <span class="bc-sep">›</span>
          <a [routerLink]="['/learn', language()]" class="bc-link bc-lang">{{ languageLabel() }}</a>
          <span class="bc-sep">›</span>
          <span class="bc-level">{{ levelLabel() }}</span>
          <span class="bc-sep">›</span>
          <span class="bc-current">{{ lesson()!.title }}</span>
        </nav>

        <!-- Lesson header -->
        <header class="lesson-header">
          <div class="lesson-meta-chips">
            <span class="chip chip-lang">{{ languageLabel() }}</span>
            <span class="chip chip-level">{{ levelLabel() }}</span>
          </div>
          <h1 class="lesson-title">{{ lesson()!.title }}</h1>
          <p class="lesson-concept">{{ lesson()!.concept }}</p>
        </header>

        <!-- Story section -->
        <section class="story-section" aria-label="Story">
          <div class="story-label">
            <span class="material-symbols-outlined story-icon">menu_book</span>
            {{ lesson()!.storyTitle }}
          </div>
          <div class="story-body" [innerHTML]="lesson()!.storyHtml"></div>
        </section>

        <!-- Reflection prompt -->
        <section class="reflection-section" aria-label="Reflection">
          <blockquote class="reflection-card">
            <span class="material-symbols-outlined reflection-icon">psychology</span>
            <div>
              <div class="reflection-label">Reflect</div>
              <p class="reflection-text">{{ lesson()!.reflectionPrompt }}</p>
            </div>
          </blockquote>
        </section>

        <!-- Action buttons -->
        <section class="actions-section">
          <div class="action-btn-group">
            <button class="action-btn disabled" disabled title="Coming in next update — Plan B adds interactive playgrounds">
              <span class="material-symbols-outlined">code</span>
              Practice in Playground
            </button>
            <button class="action-btn disabled" disabled title="Coming in next update — Plan C adds voice recording">
              <span class="material-symbols-outlined">mic</span>
              Record Your Understanding
            </button>
          </div>
          <p class="coming-soon-note">Interactive playground and recording coming in the next update.</p>
        </section>

        <!-- Prev / Next navigation -->
        <nav class="lesson-nav" aria-label="Lesson navigation">
          @if (lesson()!.prevSlug) {
            <a
              [routerLink]="['/learn', language(), level(), lesson()!.prevSlug]"
              class="lesson-nav-btn prev-btn">
              ← Previous Lesson
            </a>
          } @else {
            <span class="lesson-nav-placeholder"></span>
          }

          <a [routerLink]="['/learn', language()]" class="lesson-nav-track">
            All {{ levelLabel() }} Lessons
          </a>

          @if (lesson()!.nextSlug) {
            <a
              [routerLink]="['/learn', language(), level(), lesson()!.nextSlug]"
              class="lesson-nav-btn next-btn">
              Next Lesson →
            </a>
          } @else {
            <span class="lesson-nav-placeholder"></span>
          }
        </nav>
      } @else {
        <div class="not-found">
          <h2>Lesson not found</h2>
          <a routerLink="/learn">← Back to catalog</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .lesson-page {
      max-width: 760px;
      margin: 0 auto;
      padding: 2rem 1.5rem 4rem;
    }

    /* Breadcrumb */
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.85rem;
      color: var(--color-muted, #6b7280);
      margin-bottom: 1.75rem;
      flex-wrap: wrap;
    }

    .bc-link {
      color: var(--color-primary, #6366f1);
      text-decoration: none;
    }

    .bc-link:hover { text-decoration: underline; }

    .bc-sep { color: var(--color-border, #d1d5db); }

    .bc-current { font-weight: 500; color: var(--color-text, #111827); }

    /* Header */
    .lesson-header {
      margin-bottom: 2.5rem;
    }

    .lesson-meta-chips {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .chip {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.8125rem;
      font-weight: 600;
    }

    .chip-lang {
      background: color-mix(in srgb, var(--color-primary, #6366f1) 12%, transparent);
      color: var(--color-primary, #6366f1);
    }

    .chip-level {
      background: color-mix(in srgb, #22c55e 12%, transparent);
      color: #16a34a;
    }

    .lesson-title {
      font-size: 2rem;
      font-weight: 700;
      margin: 0 0 0.5rem;
      color: var(--color-text, #111827);
      line-height: 1.25;
    }

    .lesson-concept {
      font-size: 1.0625rem;
      color: var(--color-muted, #6b7280);
      margin: 0;
    }

    /* Story */
    .story-section {
      background: var(--color-surface, #f9fafb);
      border: 1px solid var(--color-border, #e5e7eb);
      border-radius: 12px;
      padding: 1.75rem;
      margin-bottom: 1.75rem;
    }

    .story-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 700;
      font-size: 1.0625rem;
      color: var(--color-text, #111827);
      margin-bottom: 1.25rem;
    }

    .story-icon {
      color: var(--color-primary, #6366f1);
      font-size: 1.375rem;
    }

    .story-body {
      font-size: 1rem;
      line-height: 1.75;
      color: var(--color-text, #374151);
    }

    .story-body :global(p) {
      margin: 0 0 1rem;
    }

    .story-body :global(p:last-child) {
      margin-bottom: 0;
    }

    .story-body :global(strong) {
      font-weight: 700;
      color: var(--color-text, #111827);
    }

    .story-body :global(em) {
      font-style: italic;
    }

    .story-body :global(code) {
      background: var(--color-code-bg, #1e1e2e);
      color: var(--color-code-text, #cdd6f4);
      padding: 0.125rem 0.4rem;
      border-radius: 4px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 0.875em;
    }

    /* Reflection */
    .reflection-section {
      margin-bottom: 1.75rem;
    }

    .reflection-card {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      background: color-mix(in srgb, var(--color-primary, #6366f1) 6%, var(--color-surface, #ffffff));
      border-left: 4px solid var(--color-primary, #6366f1);
      border-radius: 0 10px 10px 0;
      padding: 1.25rem 1.5rem;
      margin: 0;
    }

    .reflection-icon {
      font-size: 1.5rem;
      color: var(--color-primary, #6366f1);
      flex-shrink: 0;
      margin-top: 0.125rem;
    }

    .reflection-label {
      font-weight: 700;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-primary, #6366f1);
      margin-bottom: 0.375rem;
    }

    .reflection-text {
      margin: 0;
      font-size: 1rem;
      line-height: 1.6;
      color: var(--color-text, #374151);
    }

    /* Actions */
    .actions-section {
      margin-bottom: 2.5rem;
    }

    .action-btn-group {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 0.625rem;
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border-radius: 8px;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      border: 2px solid var(--color-border, #e5e7eb);
      background: var(--color-surface, #ffffff);
      color: var(--color-text, #111827);
      transition: all 0.15s;
    }

    .action-btn.disabled {
      opacity: 0.45;
      cursor: not-allowed;
      pointer-events: none;
    }

    .coming-soon-note {
      font-size: 0.8125rem;
      color: var(--color-muted, #9ca3af);
      margin: 0;
    }

    /* Lesson nav */
    .lesson-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding-top: 2rem;
      border-top: 1px solid var(--color-border, #e5e7eb);
      flex-wrap: wrap;
    }

    .lesson-nav-btn {
      padding: 0.625rem 1.125rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9375rem;
      background: var(--color-surface, #f9fafb);
      border: 1px solid var(--color-border, #e5e7eb);
      color: var(--color-text, #111827);
      transition: border-color 0.15s, color 0.15s;
    }

    .lesson-nav-btn:hover {
      border-color: var(--color-primary, #6366f1);
      color: var(--color-primary, #6366f1);
    }

    .lesson-nav-track {
      font-size: 0.875rem;
      color: var(--color-muted, #6b7280);
      text-decoration: none;
    }

    .lesson-nav-track:hover {
      color: var(--color-text, #111827);
      text-decoration: underline;
    }

    .lesson-nav-placeholder {
      width: 140px;
    }

    /* Not found */
    .not-found {
      text-align: center;
      padding: 4rem 1rem;
    }
  `],
})
export class LearnLessonComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private learnService = inject(LearnService);

  language = signal<Language>('html');
  level = signal<Level>('beginner');
  lesson = signal<Lesson | undefined>(undefined);

  languageLabel = signal('');
  levelLabel = signal('');

  ngOnInit(): void {
    const langParam = this.route.snapshot.paramMap.get('language') ?? '';
    const levelParam = this.route.snapshot.paramMap.get('level') ?? '';
    const slugParam = this.route.snapshot.paramMap.get('slug') ?? '';

    if (this.learnService.isValidLanguage(langParam)) {
      this.language.set(langParam);
      const meta = this.learnService.getLanguageMeta(langParam);
      this.languageLabel.set(meta?.label ?? langParam);
    }

    if (this.learnService.isValidLevel(levelParam)) {
      this.level.set(levelParam);
      const label = levelParam.charAt(0).toUpperCase() + levelParam.slice(1);
      this.levelLabel.set(label);
    }

    this.lesson.set(
      this.learnService.getLesson(this.language(), this.level(), slugParam)
    );
  }
}
```

- [ ] Verify TypeScript compiles: `cd /Users/amtoc/amtocbot-site && npx tsc --noEmit`

---

## Task 6 — Add Routes to app.routes.ts

- [ ] Edit `src/app/app.routes.ts` — add 3 new routes inside the `SiteLayoutComponent` children array, before the closing `]`:

Add after the `about` route and before `planner`:

```typescript
      { path: 'learn', loadComponent: () => import('./features/learn/learn-catalog.component').then(m => m.LearnCatalogComponent) },
      { path: 'learn/:language', loadComponent: () => import('./features/learn/learn-track.component').then(m => m.LearnTrackComponent) },
      { path: 'learn/:language/:level/:slug', loadComponent: () => import('./features/learn/learn-lesson.component').then(m => m.LearnLessonComponent) },
```

Full updated file for reference:

```typescript
// src/app/app.routes.ts

import { Routes } from '@angular/router';
import { SiteLayoutComponent } from './layout/site-layout/site-layout.component';
import { authGuard } from './shared/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: SiteLayoutComponent,
    children: [
      { path: '', loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent) },
      { path: 'blog', loadComponent: () => import('./features/blog/blog.component').then(m => m.BlogComponent) },
      { path: 'videos', loadComponent: () => import('./features/videos/videos.component').then(m => m.VideosComponent) },
      { path: 'podcasts', loadComponent: () => import('./features/podcasts/podcasts.component').then(m => m.PodcastsComponent) },
      { path: 'podcasts/:id', loadComponent: () => import('./features/podcasts/podcast-detail.component').then(m => m.PodcastDetailComponent) },
      { path: 'metrics', loadComponent: () => import('./features/metrics/metrics.component').then(m => m.MetricsComponent) },
      { path: 'resources', loadComponent: () => import('./features/resources/resources.component').then(m => m.ResourcesComponent) },
      { path: 'about', loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent) },
      { path: 'learn', loadComponent: () => import('./features/learn/learn-catalog.component').then(m => m.LearnCatalogComponent) },
      { path: 'learn/:language', loadComponent: () => import('./features/learn/learn-track.component').then(m => m.LearnTrackComponent) },
      { path: 'learn/:language/:level/:slug', loadComponent: () => import('./features/learn/learn-lesson.component').then(m => m.LearnLessonComponent) },
      {
        path: 'planner',
        loadComponent: () => import('./features/planner/planner.component').then(m => m.PlannerComponent),
        canActivate: [authGuard],
      },
      {
        path: 'admin',
        loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent),
        canActivate: [authGuard],
        data: { roles: ['superadmin', 'admin'] },
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [authGuard],
        data: { roles: ['superadmin', 'admin', 'tester', 'approver', 'reviewer'] },
      },
      {
        path: 'report',
        loadComponent: () => import('./features/report/report.component').then(m => m.ReportComponent),
        canActivate: [authGuard],
        data: { roles: ['superadmin', 'admin', 'tester'] },
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
```

- [ ] Verify TypeScript compiles: `cd /Users/amtoc/amtocbot-site && npx tsc --noEmit`

---

## Task 7 — Add "Tutorials" Nav Link to site-layout

The existing desktop nav has a "Learn" dropdown containing Blog, Videos, Podcasts. Add a "Tutorials" link to that same dropdown so it sits alongside the existing content links.

- [ ] Edit `src/app/layout/site-layout/site-layout.component.ts`:

**Desktop nav** — inside the existing `<div class="dropdown-menu">` under the "Learn" `<button>`, add after the Podcasts link:

```html
<a routerLink="/learn" routerLinkActive="dropdown-active" class="dropdown-item">Tutorials</a>
```

**Mobile nav** — inside the existing `<details open>` block under `<summary class="mobile-section">Learn</summary>`, add after the Podcasts mobile link:

```html
<a routerLink="/learn" (click)="mobileOpen.set(false)" class="mobile-link">Tutorials</a>
```

The full modified sections look like this:

```html
<!-- Desktop nav dropdown — Learn section -->
<div class="nav-dropdown">
  <button class="nav-btn">Learn <span class="chevron">▾</span></button>
  <div class="dropdown-menu">
    <a routerLink="/blog" routerLinkActive="dropdown-active" class="dropdown-item">Blog</a>
    <a routerLink="/videos" routerLinkActive="dropdown-active" class="dropdown-item">Videos</a>
    <a routerLink="/podcasts" routerLinkActive="dropdown-active" class="dropdown-item">Podcasts</a>
    <a routerLink="/learn" routerLinkActive="dropdown-active" class="dropdown-item">Tutorials</a>
  </div>
</div>
```

```html
<!-- Mobile nav — Learn section -->
<details open>
  <summary class="mobile-section">Learn</summary>
  <a routerLink="/blog" (click)="mobileOpen.set(false)" class="mobile-link">Blog</a>
  <a routerLink="/videos" (click)="mobileOpen.set(false)" class="mobile-link">Videos</a>
  <a routerLink="/podcasts" (click)="mobileOpen.set(false)" class="mobile-link">Podcasts</a>
  <a routerLink="/learn" (click)="mobileOpen.set(false)" class="mobile-link">Tutorials</a>
</details>
```

- [ ] Verify TypeScript compiles: `cd /Users/amtoc/amtocbot-site && npx tsc --noEmit`

Expected output: `Found 0 errors.`

---

## Task 8 — Build Verify + Commit

- [ ] Run full TypeScript check from project root:

```bash
cd /Users/amtoc/amtocbot-site && npx tsc --noEmit
```

Expected output: `Found 0 errors.`

- [ ] Stage all new and modified files:

```bash
git add \
  src/app/features/learn/curriculum/types.ts \
  src/app/features/learn/curriculum/html.curriculum.ts \
  src/app/features/learn/curriculum/linux.curriculum.ts \
  src/app/features/learn/curriculum/csharp.curriculum.ts \
  src/app/features/learn/curriculum/java.curriculum.ts \
  src/app/features/learn/learn.service.ts \
  src/app/features/learn/learn-catalog.component.ts \
  src/app/features/learn/learn-track.component.ts \
  src/app/features/learn/learn-lesson.component.ts \
  src/app/app.routes.ts \
  src/app/layout/site-layout/site-layout.component.ts
```

- [ ] Commit:

```bash
git commit -m "$(cat <<'EOF'
feat: tutorial series Plan A — learn routes, curriculum, lesson pages

- /learn catalog: HTML, Linux, C#, Java language cards
- /learn/:language: beginner/intermediate/advanced track with lesson list
- /learn/:language/:level/:slug: story-driven lesson page with reflection prompt
- 20 beginner lessons across 4 languages (5 per language)
- Playground and recording buttons present but disabled (Plans B & C)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## What Plans B & C Will Add

This plan intentionally leaves two buttons disabled with the tooltip "Coming in next update":

| Button | Plan | What it adds |
|--------|------|-------------|
| Practice in Playground | Plan B | Embedded iframe sandbox — HTML live preview, Linux Xterm.js terminal, Monaco code editor for C#/Java |
| Record Your Understanding | Plan C | MediaRecorder API, playback, optional Whisper transcription stored in KV |

Plan A is entirely static — no new Cloudflare Functions, no KV reads, no auth. It deploys as-is to Cloudflare Pages with zero backend changes.
