# MEMORY

## 2026-02-15 — Editor Behavior Sync

### What changed

- Zen WYSIWYG moved to StateField-based block-safe decorations and now supports stable rich blocks (table, math, code, Mermaid) with click-to-edit for interactive widgets.
- Zen Mermaid rendering was added with lazy import, theme-aware init, and code-block fallback when render fails.
- KaTeX warning noise was reduced by aligning both preview and Zen math rendering to `throwOnError: false` + `strict: 'ignore'`.
- Ordered-list `Tab` behavior now nests as `1.` and renumbers following siblings; nested indent uses 4 spaces so split preview parses structure consistently.
- Typewriter mode now avoids drag jitter by pausing recenter while pointer selection is active, then recentering on pointer release.
- Typewriter mode adds subtle active-line highlight to improve current-line visibility.
- Footer selectors were cleaned up to avoid deprecated Zustand equality-callback usage.

### Files touched by these behaviors

- `src/components/editor/extensions/wysiwyg.ts`
- `src/components/editor/MarkdownEditor.tsx`
- `src/components/editor/extensions/typewriter.ts`
- `src/utils/markdownConfig.ts`
- `src/components/layout/Footer.tsx`

### Regression checklist

- Zen mode: table/math/code/mermaid render and click-to-edit each block.
- Split mode: ordered nested list displays as nested list (not flattened numbering).
- Typewriter mode: drag-select around cursor does not force-scroll during drag.
- Preview/Zen math: no repeated KaTeX strict warnings for display-mode newline content.
- Footer: counts update normally with no Zustand deprecation warning.
