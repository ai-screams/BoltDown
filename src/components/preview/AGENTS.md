<!-- Parent: ../AGENTS.md -->

# preview/ — Markdown Preview Renderer

## Purpose

Renders parsed markdown HTML with post-processing for Mermaid diagrams and code block enhancements.

## Key Files

- `MarkdownPreview.tsx` — Renders markdown-it output via `dangerouslySetInnerHTML`. Two post-processing steps in `useEffect`: (1) converts `\`\`\`mermaid\`\`\``code blocks to SVG diagrams via lazy-loaded Mermaid library, (2) injects copy-to-clipboard buttons on code blocks. Uses`useMarkdownParser()` hook.

## For AI Agents

- Mermaid is lazy-loaded (`import('mermaid')`) — 534KB vendor chunk only loaded when diagrams exist
- KaTeX math is handled upstream in `markdownConfig.ts` (pre-rendered to HTML)
- Copy buttons are injected via DOM manipulation after render (not React-managed)
- The `.prose` and `.dark:prose-invert` Tailwind classes provide base typography styling
- Preview is hidden in `source` mode, visible in `split` and `zen` modes
