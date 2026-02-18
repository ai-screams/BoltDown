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

## 2026-02-18 — Phase 3: Zen Restructure, Formatting Shortcuts, Toolbar Expansion

### What changed

#### Zen Mode Restructure

- `EditorMode` expanded from `'split' | 'source' | 'zen'` to `'split' | 'source' | 'live' | 'zen'`.
- **Live mode**: WYSIWYG editor with full UI visible (header, tabbar, sidebar, toolbar all present). Replaces zen in the normal mode cycle.
- **Zen mode**: Full immersion — WYSIWYG + hides header/tabbar/sidebar, dims footer. Accessed via `Cmd+Shift+Z` only (not in Cmd+\ cycle).
- Mode cycle (`Cmd+\`): `split → source → live`. Zen excluded from cycle.
- Escape from zen → live (both WYSIWYG, just toggles immersion).
- Header mode toggle: `[Split] [Source] [Live]` with PenLine icon for Live.

#### Markdown Formatting Shortcuts

- Extracted `formatCommands.ts` from EditorToolbar — shared module with raw functions + CM6 command wrappers + keymap.
- Registered formatting keymap in CM6 (higher priority than browser defaults):
  - `Cmd+B` Bold, `Cmd+I` Italic, `Cmd+Shift+X` Strikethrough
  - `Cmd+E` Inline code, `Cmd+K` Link
  - `Cmd+Shift+.` Blockquote, `Cmd+Shift+8` Bullet list, `Cmd+Shift+7` Numbered list

#### EditorToolbar Expansion

- Expanded from 13 to 22 buttons organized in 6 groups:
  - **Text formatting**: Bold, Italic, Underline (`<u>`), Strikethrough, Highlight (`==`), Superscript (`<sup>`), Subscript (`<sub>`)
  - **Headings**: H1, H2, H3, H4
  - **Links & media**: Link, Image
  - **Code & math**: Inline Code, Code Block (fenced), Math (KaTeX `$$`)
  - **Block elements**: Blockquote, Bullet List, Numbered List, Task List (`- [ ]`)
  - **Insert**: Table (3x3 template), Horizontal Rule
- Toolbar scrolls horizontally on narrow screens (`overflow-x: auto` + `scrollbar-none`).

### Files touched

- `src/types/editor.ts` — EditorMode union expanded
- `src/components/editor/formatCommands.ts` — **NEW** shared formatting module
- `src/components/editor/EditorToolbar.tsx` — expanded toolbar, imports from formatCommands
- `src/components/editor/MarkdownEditor.tsx` — formatting keymap + `isWysiwyg` for live+zen
- `src/components/layout/Header.tsx` — PenLine icon, Live mode in toggle group
- `src/hooks/useKeyboardShortcuts.ts` — new cycle, Cmd+Shift+Z zen toggle, escape→live
- `src/constants/shortcuts.ts` — Formatting group, updated View group
- `src/index.css` — scrollbar-none utility

### Key gotchas

- `Cmd+B`/`Cmd+I` must be in CM6 keymap (not global) so they override browser defaults only when editor is focused.
- `isWysiwyg` is derived from `mode` — used in dep array of `buildReconfigureEffects` instead of `mode` to satisfy ESLint exhaustive-deps.
- HTML-tag formatting (`<u>`, `<sup>`, `<sub>`) requires DOMPurify to allow these tags through for preview rendering.
- `formattingKeymap` is placed first in the keymap array to take priority over default keymaps.

### Regression checklist

- Mode cycle (Cmd+\): split → source → live → split (zen not in cycle).
- Cmd+Shift+Z toggles zen from any mode; Escape from zen goes to live.
- Live mode: WYSIWYG renders, full UI visible.
- Zen mode: WYSIWYG renders, header/tabbar/sidebar hidden, footer dimmed.
- All formatting shortcuts work when editor is focused.
- All 22 toolbar buttons insert correct markdown.
- Toolbar scrolls horizontally on narrow viewports.
