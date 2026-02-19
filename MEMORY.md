# MEMORY

## 2026-02-15 — Editor Behavior Sync

### What changed

- WYSIWYG (live + zen) moved to StateField-based block-safe decorations and now supports stable rich blocks (table, math, code, Mermaid) with click-to-edit for interactive widgets.
- Zen Mermaid rendering was added with lazy import, theme-aware init, and code-block fallback when render fails.
- KaTeX warning noise was reduced by aligning both preview and Zen math rendering to `throwOnError: false` + `strict: 'ignore'`.
- Ordered-list `Tab` behavior now nests as `1.` and renumbers following siblings; nested indent uses 4 spaces so split preview parses structure consistently.
- Typewriter mode now avoids drag jitter by pausing recenter while pointer selection is active, then recentering on pointer release.
- Typewriter mode adds subtle active-line highlight to improve current-line visibility.
- Footer selectors were cleaned up to avoid deprecated Zustand equality-callback usage.

### Files touched by these behaviors

- `src/components/editor/extensions/wysiwyg/index.ts`
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

- `git branch --show-current` returns the active workspace branch (historical check on 2026-02-18 was `feat/phase2-completion`).
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

## 2026-02-19 — Live Parity + Table Editing Stabilization

### What changed

- Split sync was hardened with DOM-first mapping, anchor fallback, endpoint clamp, click-to-sync offset decay, and mode re-entry stabilization.
- Live mode parity was expanded: `[toc]` rendering, task list rendering/toggling, and inline HTML (`<u>`, `<sup>`, `<sub>`) decorations now align with split preview expectations.
- Ordered-list `Tab` / `Shift-Tab` behavior was normalized to be symmetric and tree-aware with deterministic renumbering.
- Table editing moved from value-only to structured controls: row/column add-delete, column alignment, and resize (rows/cols input).
- Table undo/focus/history paths were stabilized (selection anchoring near table, nested update retry guard, control-action immediate undo behavior).

### Commits

- `d5c58fc` — split sync hardening + live TOC render
- `3cc1120` — live/split parity for inline HTML + task list
- `17683a5` — inline math reveal consistency fix
- `3d8f30f` — ordered list indent/outdent normalization
- `e54398a` — live task checkbox click-to-toggle
- `ea745e5` — live table in-place cell editing baseline
- `ae1b2e4` — structured table controls + resize panel
- `c19505c` — table undo/focus/history stabilization

### Files touched (high level)

- `src/hooks/useSplitScrollSync.ts`
- `src/components/editor/editorUtils.ts`
- `src/components/editor/MarkdownEditor.tsx`
- `src/components/editor/extensions/wysiwyg/buildDecorations.ts`
- `src/components/editor/extensions/wysiwyg/inlineHtmlDecorations.ts`
- `src/components/editor/extensions/wysiwyg/TaskCheckboxWidget.ts`
- `src/components/editor/extensions/wysiwyg/TocWidget.ts`
- `src/components/editor/extensions/wysiwyg/TableWidget.ts`
- `src/components/editor/extensions/wysiwyg/tableModel.ts`

### Regression checklist

- Split mode: editor/preview bottom reachability and mode-toggle re-entry sync still stable.
- Live mode: `[toc]` renders; clicking TOC item moves editor cursor.
- Live mode: task checkbox click toggles `[ ]`/`[x]` in source.
- Live mode: `<u>/<sup>/<sub>` render unless cursor is inside target range.
- Ordered list: `Tab` then `Shift-Tab` preserves indentation symmetry and numbering.
- Table: row/col controls, resize, and column alignment operate without forcing raw markdown reveal.
- Table: control action followed by `Cmd+Z` works without scroll jump to unrelated position.

## 2026-02-19 — Code Block Boundary Navigation + Docs Fact-Check

### What changed

- Added fenced code-block boundary navigation model + keymap wiring for live/zen editor mode.
- `ArrowUp`/`ArrowDown` now handle boundary transitions around fenced blocks, including opening the language editor from the first code line.
- `Mod+A` now selects code text only when caret is inside a fenced block (including hidden fence lines); outside blocks it falls back to normal editor select-all.
- Documentation was synced to current architecture (live+zen wording, compartment list, widget event handling, and current file paths).

### Evidence anchors

- `src/components/editor/extensions/wysiwyg/codeBlockArrowNavigationModel.ts`
- `src/components/editor/extensions/wysiwyg/codeBlockArrowNavigationKeymap.ts`
- `src/components/editor/MarkdownEditor.tsx`
- `src/components/editor/extensions/wysiwyg/codeBlockArrowNavigationModel.test.ts`
- `src/components/editor/extensions/wysiwyg/codeBlockBadge.test.ts`

## 2026-02-19 — UI Polish: Mode Cycling Reorder + Preview Max-Width Constraints

### What changed

#### Editor Mode Cycling Reorder (Commit: d8c0706)

- **Mode toggle button visual order** changed from `[split, source, live]` to `[live, split, source]`
- **Intent**: Live (WYSIWYG) is primary writing experience; reordered header display for intuitive first impression
- **Important**: Keyboard cycle via `Cmd+\` remains `split → source → live` (canonical order). The header toggle button order is **visual display only**, not the actual cycle order
- **Implementation**: `Header.tsx` line 30–34, modes array reordered; cycle logic unchanged in `useKeyboardShortcuts.ts`

#### Preview Max-Width Constraints (Commit: e9e08d9)

- **Live/Zen modes**: Preview constrained to `max-w-4xl` (896px ≈ 56rem), centered with `mx-auto`
  - **Rationale**: Optimal markdown reading width is 50–100 characters per line. At 16px base font, 896px yields ~112 chars/line, perfect for document reading + code blocks
  - **Basis**: Wikipedia Line Length research (printed prose: 45–75 cpl optimal; digital: 55–112 cpl depending on use)
- **Split mode**: Preview constrained to `max-w-3xl` (768px ≈ 48rem), left-aligned (no `mx-auto`)
  - **Rationale**: Split pairs editor + preview side-by-side. Preview needs readable width (~96 chars/line) while preserving editor space
  - **Behavior**: Editor takes full width (code space priority), preview takes constrained width (readability priority)
- **Source mode**: No constraint (preview hidden)
- **Implementation**: `MarkdownEditor.tsx` line 315–318 (live/zen), `MarkdownPreview.tsx` line 261–264 (split vs. others)

### Typography & Readability Decisions

- **Max-width values are data-driven**, not arbitrary
- **Live/Zen**: 896px chosen to hit sweet spot of ~112 chars/line (optimal for both prose + code)
- **Split**: 768px (96 chars/line) balances readability with split-panel space constraints
- **Responsive**: Tailwind classes (`max-w-4xl`, `max-w-3xl`) automatically disable on narrow viewports (<768px), reverting to full-width

### Files touched

- `src/components/layout/Header.tsx` — modes array reorder (visual display order)
- `src/components/editor/MarkdownEditor.tsx` — dynamic className for live/zen max-width
- `src/components/preview/MarkdownPreview.tsx` — dynamic className for split vs. other mode widths

### Key gotchas

1. **Header toggle visual order ≠ keyboard cycle order**
   - Header shows `[live, split, source]` for intuitive first impression
   - `Cmd+\` cycle is `split → source → live` (unchanged)
   - This asymmetry is intentional: new users see live first, power users have muscle memory for cycle
2. **Preview inline `maxWidth` CSS overrides Tailwind classes**
   - Settings store `preview.maxWidth` (px value) applied as inline style
   - Takes precedence over `max-w-*` Tailwind classes
   - User control preserved, but can override typography constraints
3. **No max-width on live/zen outside editor container**
   - `max-w-4xl` only applies inside `MarkdownEditor` container
   - If container < 896px, constraint is naturally effective but invisible
   - Works as intended (constraint respects parent width)

### Regression checklist

- Header mode toggle: clicking cycles through visually displayed order (live → split → source → live)
- Keyboard `Cmd+\`: cycles through canonical order (split → source → live → split)
- Live mode preview: max-width 896px applied, centered with left/right margins on large screens
- Zen mode preview: same as live (centered, 896px max)
- Split mode preview: max-width 768px applied, left-aligned (no auto margins), divider at 50/50 ratio shows asymmetric layout
- Source mode: editor only, no preview visible, keyboard/ui cycle unchanged
- Responsive: all modes full-width on tablets/mobile (<768px), max-widths disable naturally
