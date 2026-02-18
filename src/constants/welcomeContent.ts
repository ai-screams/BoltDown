export const WELCOME_CONTENT = `# Hello BoltDown!

Welcome to **BoltDown** — a lightning-fast Markdown editor.

![Megumin](https://i.namu.wiki/i/p6amZTd-aBuEQAKgB2M9dbWJ9qn3InFEtM-cs9mCXj3uCZhY3pcgK1hk4133lailOBNG6uAnRowJEDqvAwRWJ6j7g7X6BKAeXq3gMH3YvMcbqxQkm7vC48Un11LikEEGo8oj-4U171hb5Q2bZrze9A.webp)

## Text Formatting

**Bold text**, *italic text*, ~~strikethrough~~, and ***bold italic*** combined.

<u>Underlined text</u>, <sup>superscript</sup>, <sub>subscript</sub>, and ==highlighted text==.

Chemical formula: H<sub>2</sub>O, Einstein: E = mc<sup>2</sup>

## Links & Images

[Visit GitHub](https://github.com) — click to open a link.

## Lists

- Bullet item one
- Bullet item two
  - Nested item

1. Numbered item
2. Another item
   1. Nested numbered

### Numbered List Stress Test (Indent / Outdent)

1. Phase One
   1. Setup
      1. Create project
      2. Configure tooling
   2. Build feature
      1. Editor
         1. Keymap
         2. WYSIWYG
      2. Preview
   3. Validate
2. Phase Two
   1. Refactor
      1. Split modules
      2. Remove duplication
   2. QA
      1. Unit tests
         1. Edge cases
      2. Manual checks
3. Phase Three
   1. Release prep
   2. Post-release notes

### Task List

- [ ] Unchecked task
- [x] Completed task
- [ ] Another pending task

## Blockquote

> "Make Markdown editing as fast as lightning, as light as air."
>
> — BoltDown

## Inline Code & Code Block

Use \`inline code\` in a sentence.

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

## Table

| Feature      | Shortcut     | Description              |
|--------------|--------------|--------------------------|
| Open         | Cmd+O        | Open a file              |
| Save         | Cmd+S        | Save current file        |
| New Tab      | Cmd+N        | Create new tab           |
| Cycle Mode   | Cmd+\\       | Split / Source / Live     |
| Zen Mode     | Cmd+Shift+Z  | Full immersion mode      |
| Bold         | Cmd+B        | Toggle bold              |
| Italic       | Cmd+I        | Toggle italic            |
| Code         | Cmd+E        | Toggle inline code       |
| Link         | Cmd+K        | Insert link              |
| Strikethrough| Cmd+Shift+X  | Toggle strikethrough     |

## Math (KaTeX)

Inline math: $E = mc^2$, quadratic: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

## Diagram (Mermaid)

\`\`\`mermaid
graph LR
  A[Write] --> B[Preview]
  B --> C[Export]
  C --> D{Format?}
  D -->|HTML| E[HTML File]
  D -->|PDF| F[Print / PDF]
\`\`\`

## Heading Levels

### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

---

## View Modes

- **Split** — Editor + Preview side by side
- **Source** — Editor only (code view)
- **Live** — WYSIWYG editor with full UI
- **Zen** — Full immersion (Cmd+Shift+Z), Escape to exit

[toc]

---

*Start writing your own markdown above!*
`
