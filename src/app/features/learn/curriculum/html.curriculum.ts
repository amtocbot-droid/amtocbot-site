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
      <p>First: every frame must know where its photo lives. The <strong>src</strong> attribute is the address of the image file. It might be a relative path like <code>src="images/hero.png"</code> pointing to a file in the same project, or an absolute URL pointing to a photo on another server. Get the path wrong and visitors see a broken frame icon.</p>
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
