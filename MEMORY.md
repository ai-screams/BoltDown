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

## 2026-02-16 — Backlog Notes

### Open issue

- Spellcheck setting now toggles `spellcheck` + `writingsuggestions` on the CodeMirror content DOM, but inline misspelling underlines remain inconsistent on macOS Tauri WebView.
- Manual spell-check action can still run, so this is tracked as a follow-up for native menu + WebView behavior validation (and optional internal dictionary pipeline if needed).

## 2026-02-18 — Docs & Memory Fact-Check Sync

### What changed

- Root and scoped `AGENTS.md` files were fact-checked against the current codebase and corrected where drift existed (Phase 2 status wording, current branch, ResizeHandle ARIA docs, hook references, Tauri ACL wording).
- Planning docs were aligned so active status stays in the unified backlog and archived plans are explicitly marked as historical snapshots.
- Serena memory entries were refreshed to reflect current branch/state and to remove stale Phase 2 tracking assumptions.

### Evidence anchors

- `AGENTS.md`
- `.docs/project/planning/backlog.md`
- `.docs/project/planning/archive/phase2-plan.md`
- `src/components/sidebar/ResizeHandle.tsx`
- `src/hooks/useSplitScrollSync.ts`

### Quick verification checklist

- `git branch --show-current` returns `feat/phase2-completion`.
- `ResizeHandle.tsx` exposes `role="separator"`, `aria-orientation="vertical"`, and `aria-label` (no `aria-valuenow/min/max`).
- Split scroll sync is implemented and wired (`src/hooks/useSplitScrollSync.ts`, `src/components/layout/MainLayout.tsx`).
