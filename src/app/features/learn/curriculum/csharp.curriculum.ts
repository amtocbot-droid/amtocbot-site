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
      <p>In the Codeville factory, every product moved along an <strong>assembly line</strong>. The line manager — a loop — made sure the same operation was applied to every item, again and again, until the batch was done.</p>
      <p>The <strong>for loop</strong> is for when you know exactly how many times the operation runs: <code>for (int i = 0; i &lt; 10; i++) { Console.WriteLine(i); }</code>. Three parts: initialize the counter (<code>int i = 0</code>), set the condition to keep running (<code>i &lt; 10</code>), and increment the counter after each pass (<code>i++</code>). The loop runs exactly 10 times.</p>
      <p>The <strong>while loop</strong> is for when you keep going until a signal says stop: <code>while (factoryRunning) { ProcessItem(); }</code>. It checks the condition before each pass. If the condition is false from the start, the loop body never runs. Be careful: if the condition never becomes false, you have an infinite loop — the factory never shuts down.</p>
      <p>The <strong>foreach loop</strong> is the ergonomic version of for, designed for collections: <code>foreach (string item in shoppingList) { Console.WriteLine(item); }</code>. It handles the counter automatically, visiting every element in order.</p>
      <p>Loops are the backbone of processing: batch jobs, API pagination, rendering lists, searching arrays. Every non-trivial program uses them constantly. Master the when and which, and repetitive tasks become trivial.</p>
    `,
    playgroundType: 'code',
    starterCode: 'using System;\n\nclass Program\n{\n    static void Main()\n    {\n        // for loop\n        for (int i = 1; i <= 5; i++)\n        {\n            Console.WriteLine($"Item {i} processed");\n        }\n\n        // while loop\n        int count = 0;\n        while (count < 3)\n        {\n            Console.WriteLine($"Round {count + 1}");\n            count++;\n        }\n    }\n}',
    challenge: 'Write a for loop that prints the multiplication table of 7 (7×1 through 7×10). Then rewrite it as a while loop.',
    reflectionPrompt: 'What is the risk of a while loop compared to a for loop? Can you think of a scenario where a while loop is the right choice and a for loop would be awkward?',
    prevSlug: 'if-else',
    nextSlug: 'methods',
  },
  {
    slug: 'methods',
    title: 'Methods',
    concept: 'Reusable named blocks of code',
    storyTitle: 'The Toolbox',
    storyHtml: `
      <p>In the Codeville workshop, every craftsman kept a <strong>toolbox</strong>. Each tool had a name and did exactly one job. The hammer drove nails. The wrench turned bolts. You didn't explain how the hammer worked every time you needed to drive a nail — you just picked it up and used it.</p>
      <p>Methods in C# are the tools in your toolbox. You define a method once — give it a name, specify what inputs it needs (parameters), and describe what it does. After that, you can call it anywhere in your program just by name: <code>DriveNail(woodBoard);</code></p>
      <p>A method can return a result, or not. A <strong>void method</strong> does work and returns nothing — like a hammer blow. A <strong>returning method</strong> produces a value — like a measuring tape that returns a length: <code>double Measure(string item) { return GetLength(item); }</code>.</p>
      <p>Parameters let you customize each use. <code>void Greet(string name) { Console.WriteLine($"Hello, {name}!"); }</code> — call it with <code>Greet("Alice")</code> or <code>Greet("Bob")</code>, and the tool adapts to each use without rewriting.</p>
      <p>Good methods follow the <em>single responsibility principle</em>: one method, one job. A method that logs the user in, sends an email, and updates the database is three tools crammed into one handle — brittle and hard to fix. The best toolboxes contain many small, focused tools.</p>
    `,
    playgroundType: 'code',
    starterCode: 'using System;\n\nclass Program\n{\n    static void Greet(string name)\n    {\n        Console.WriteLine($"Hello, {name}!");\n    }\n\n    static int Add(int a, int b)\n    {\n        return a + b;\n    }\n\n    static void Main()\n    {\n        Greet("Alice");\n        Greet("Bob");\n        int result = Add(5, 3);\n        Console.WriteLine($"5 + 3 = {result}");\n    }\n}',
    challenge: 'Write a method called `Multiply` that takes two integers and returns their product. Write a method called `IsEven` that takes an int and returns a bool. Test both in Main.',
    reflectionPrompt: 'What is the single responsibility principle, and why does it matter for methods? What problems arise when a single method tries to do too many things?',
    prevSlug: 'loops',
  },
];
