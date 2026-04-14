// src/app/features/learn/curriculum/java.curriculum.ts

import { Lesson } from './types';

export const JAVA_BEGINNER: Lesson[] = [
  {
    slug: 'what-is-java',
    title: 'What Is Java?',
    concept: 'Write once, run anywhere via the JVM',
    storyTitle: 'Write Once, Run Anywhere',
    storyHtml: `
      <p>In the land of Byteville, every kingdom had its own language. Programs written for the Windows Kingdom could not run in the Linux Realm. The macOS Highlands used a different dialect entirely. A developer who wanted to reach everyone had to write the same program three separate times.</p>
      <p>Then came <strong>Java</strong>, with a radical idea: a universal translator. You write your program once, in Java. A tool called the <strong>compiler</strong> translates it into a neutral language called <strong>bytecode</strong> — instructions that belong to no single kingdom. Each kingdom then has its own <strong>JVM (Java Virtual Machine)</strong>, which reads the bytecode and translates it into native instructions on the fly.</p>
      <p>The result: write once, run anywhere. The same <code>.class</code> file runs on Windows, Linux, macOS, Android, and smart cards. This portability made Java the dominant language of enterprise software for two decades, and it still powers the Android platform for billions of devices.</p>
      <p>Java is <strong>strongly typed</strong> and <strong>object-oriented</strong>: every piece of data has a declared type, and most code lives inside classes. The language was designed for reliability in large teams — it catches many mistakes at compile time, before the program ever runs.</p>
      <p>When you run a Java program, the JVM also manages memory automatically via <strong>garbage collection</strong> — you create objects, and the JVM cleans up those no longer in use. No manual memory management required.</p>
    `,
    playgroundType: 'code',
    starterCode: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n        System.out.println("Running on: " + System.getProperty("os.name"));\n    }\n}',
    challenge: 'Add two more System.out.println lines: one that prints the Java version, and one that prints a greeting using your name.',
    reflectionPrompt: 'What problem does the JVM solve? Before Java, how would a developer targeting both Windows and Linux have to approach the same program?',
    nextSlug: 'classes-and-objects',
  },
  {
    slug: 'classes-and-objects',
    title: 'Classes & Objects',
    concept: 'Class as blueprint, object as instance',
    storyTitle: 'The Cookie Cutter',
    storyHtml: `
      <p>In Byteville's famous bakery, the pastry chef <strong>Java Jean</strong> had a collection of cookie cutters. Each cutter was a precise shape — a star, a heart, a tree. The cutters themselves were never eaten. They were just tools for making cookies.</p>
      <p>In Java, a <strong>class</strong> is the cookie cutter: a blueprint that describes a shape. It defines what properties each cookie will have (fields) and what each cookie can do (methods). A class called <code>Cookie</code> might have a <code>flavour</code> field and a <code>bake()</code> method.</p>
      <p>An <strong>object</strong> is the actual cookie made by pressing the cutter into dough: <code>Cookie myCookie = new Cookie();</code>. You can make as many cookies as you like from the same cutter, and each cookie can have its own flavour independently: <code>myCookie.flavour = "chocolate";</code></p>
      <p>The <strong>constructor</strong> is the moment the dough gets pressed. It runs automatically when you write <code>new Cookie()</code> and sets up the object's initial state. You can define a custom constructor to require certain values upfront: <code>new Cookie("vanilla")</code> — no flavour-less cookies allowed.</p>
      <p>This is the foundation of object-oriented programming: model the real world as blueprints (classes) and instances (objects). A banking system has a <code>BankAccount</code> class; every customer's actual account is an object. Understanding this distinction unlocks everything else in Java.</p>
    `,
    playgroundType: 'code',
    starterCode: 'public class Main {\n    static class Cookie {\n        String flavour;\n\n        Cookie(String flavour) {\n            this.flavour = flavour;\n        }\n\n        void describe() {\n            System.out.println("A " + flavour + " cookie.");\n        }\n    }\n\n    public static void main(String[] args) {\n        Cookie c1 = new Cookie("chocolate");\n        Cookie c2 = new Cookie("vanilla");\n        c1.describe();\n        c2.describe();\n    }\n}',
    challenge: 'Add a `size` field (small/medium/large) to Cookie. Update the constructor to take both flavour and size. Print both in describe().',
    reflectionPrompt: 'What is the difference between a class and an object? If you have a class called `Car`, what would some objects of type Car look like in the real world?',
    prevSlug: 'what-is-java',
    nextSlug: 'variables-and-types',
  },
  {
    slug: 'variables-and-types',
    title: 'Variables & Types',
    concept: 'Primitive types: int, double, boolean, String',
    storyTitle: 'The Typed Mailbox',
    storyHtml: `
      <p>Byteville's post office had a strict sorting system. Each mailbox was labeled with the kind of mail it could receive. The <strong>int</strong> mailbox accepted only whole numbers — packages labeled 1, 42, -100. Trying to slip in a decimal was grounds for immediate rejection.</p>
      <p>The <strong>double</strong> mailbox accepted decimal numbers — 3.14, 99.99, -0.001. Perfect for prices, temperatures, and scientific measurements where whole numbers are too imprecise.</p>
      <p>The <strong>boolean</strong> mailbox had just two slots: <code>true</code> and <code>false</code>. Is the package delivered? Is the account active? Exactly one answer, no ambiguity.</p>
      <p>The <strong>String</strong> mailbox (capital S — it's a class, not a primitive) accepted text of any length: names, sentences, URLs, even empty strings <code>""</code>. Strings in Java are immutable — once created, their content never changes. Operations like <code>toUpperCase()</code> return a new String rather than modifying the original.</p>
      <p>Java also has <code>char</code> (single character), <code>long</code> (large integers), and <code>float</code> (lower-precision decimal). But for most everyday programming, <code>int</code>, <code>double</code>, <code>boolean</code>, and <code>String</code> cover 90% of cases. Declare the type that matches the data, and the compiler becomes your first line of defense against type errors.</p>
    `,
    playgroundType: 'code',
    starterCode: 'public class Main {\n    public static void main(String[] args) {\n        int age = 30;\n        double price = 9.99;\n        boolean isActive = true;\n        String name = "ByteVille Resident";\n\n        System.out.println(name + " is " + age + " years old.");\n        System.out.println("Price: $" + price);\n        System.out.println("Account active: " + isActive);\n    }\n}',
    challenge: 'Create variables for a bank account: accountNumber (int), balance (double), isOpen (boolean), ownerName (String). Print a formatted account summary.',
    reflectionPrompt: 'Why is String capitalized in Java while int and boolean are lowercase? What does that tell you about how Java treats them differently under the hood?',
    prevSlug: 'classes-and-objects',
    nextSlug: 'methods',
  },
  {
    slug: 'methods',
    title: 'Methods',
    concept: 'Defining and calling reusable methods',
    storyTitle: 'The Vending Machine',
    storyHtml: `
      <p>The vending machine in Byteville's break room was a marvel of encapsulation. You pressed a button — <code>B3</code> — and out came a bag of chips. You had no idea what happened inside: the motor that moved the spiral, the sensor that detected the drop, the mechanism that accepted payment. All you knew was: press button, get chips.</p>
      <p>In Java, a <strong>method</strong> is a vending machine button. You define it once — give it a name, specify what inputs it takes (parameters), and write the hidden machinery (the body). Anyone who wants a bag of chips just calls the method by name, without caring about the internals.</p>
      <p>Methods that return a value use a return type: <code>int add(int a, int b) { return a + b; }</code>. The caller receives the result and can use it: <code>int total = add(5, 3);</code>. Methods that just do work and return nothing use <code>void</code>: <code>void printReceipt(String item) { System.out.println("Dispensed: " + item); }</code></p>
      <p><strong>Method overloading</strong> lets you have multiple methods with the same name but different parameter lists: <code>add(int, int)</code> and <code>add(double, double)</code>. Java chooses the right one based on what types you pass in. Same button label, different machine inside.</p>
      <p>Well-named methods make code self-documenting. <code>calculateMonthlyInterest()</code> tells you exactly what it does without a comment. Prefer many small methods over one large one — each button on a good vending machine does exactly one thing reliably.</p>
    `,
    playgroundType: 'code',
    starterCode: 'public class Main {\n    static int add(int a, int b) {\n        return a + b;\n    }\n\n    static void printGreeting(String name) {\n        System.out.println("Welcome, " + name + "!");\n    }\n\n    public static void main(String[] args) {\n        printGreeting("Alice");\n        int result = add(10, 25);\n        System.out.println("10 + 25 = " + result);\n    }\n}',
    challenge: 'Write a method `isEven(int n)` that returns boolean. Write a method `repeat(String word, int times)` that returns the word repeated. Test both in main.',
    reflectionPrompt: 'What does "encapsulation" mean in the context of methods? Why is it beneficial that the caller of a method does not need to know how it works internally?',
    prevSlug: 'variables-and-types',
    nextSlug: 'if-else',
  },
  {
    slug: 'if-else',
    title: 'If / Else',
    concept: 'Conditional logic and branching',
    storyTitle: 'The Traffic Light',
    storyHtml: `
      <p>At every intersection in Byteville, a <strong>traffic light</strong> made decisions. It checked its internal timer and the state of the intersection, then chose: green, yellow, or red. The same intersection, the same light — but three different outcomes depending on the condition.</p>
      <p>In Java, this branching logic is written as: <code>if (condition) { ... } else if (otherCondition) { ... } else { ... }</code>. The condition must be a <code>boolean</code> expression — something that evaluates to <code>true</code> or <code>false</code>. Java does not allow integers as conditions (unlike C or JavaScript).</p>
      <p>Common boolean expressions: <code>x == 10</code> (equals), <code>x != 10</code> (not equals), <code>x &gt; 5</code>, <code>x &lt;= 100</code>. Combine them with <code>&amp;&amp;</code> (both must be true) and <code>||</code> (either must be true).</p>
      <p>Nested ifs are lights within lights. The outer light checks if it is rush hour; the inner light then checks traffic volume. Deeply nested ifs become hard to read — a sign that the logic should be refactored into methods.</p>
      <p>Java also has the <strong>switch</strong> statement for when you have many branches on the same variable: <code>switch (dayOfWeek) { case "Monday": ...; break; case "Tuesday": ...; break; default: ...; }</code>. It's cleaner than a chain of <code>else if</code> when the branches are discrete values.</p>
    `,
    playgroundType: 'code',
    starterCode: 'public class Main {\n    public static void main(String[] args) {\n        int score = 75;\n\n        if (score >= 90) {\n            System.out.println("Grade: A");\n        } else if (score >= 80) {\n            System.out.println("Grade: B");\n        } else if (score >= 70) {\n            System.out.println("Grade: C");\n        } else {\n            System.out.println("Grade: F");\n        }\n    }\n}',
    challenge: 'Write a method `classify(int n)` that returns "positive", "negative", or "zero". Then write a traffic light simulator that cycles through green/yellow/red based on a timer value (0-29=green, 30-34=yellow, 35+=red).',
    reflectionPrompt: 'Java requires the if condition to be a boolean expression — you cannot write `if (1)` as you could in C. Why might the Java designers have made this stricter choice?',
    prevSlug: 'methods',
  },
];
