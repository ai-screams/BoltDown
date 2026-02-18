<!-- Parent: ../AGENTS.md -->

# extensions/ — CodeMirror 6 Extensions

## Purpose

Modular CM6 extensions for markdown language support, editor theming, and WYSIWYG decorations.

## Key Files

- `markdown.ts` — Wraps `@codemirror/lang-markdown` with `markdownLanguage` base. Exports `markdownExtension()` factory function.
- `theme.ts` — Two CM6 `EditorView.theme()` objects with BoltDown brand styling: JetBrains Mono font, Electric Yellow (#FACC15) cursor/selection, 1.6 line-height. Exports `boltdownTheme` (light) and `boltdownDarkTheme` (dark).
- `wysiwyg/` — **Modular WYSIWYG extension** split from monolithic wysiwyg.ts into 10 files for maintainability. Zen mode **StateField** (not ViewPlugin) providing inline WYSIWYG decorations.
  - `index.ts` — Entry point. Exports `wysiwygExtension(mermaidSecurityLevel)` factory function. StateField definition with `provide: field => EditorView.decorations.from(field)`. Rebuilds decorations on `docChanged || tr.selection`.
  - `buildDecorations.ts` — Main decoration builder. Implements **two-tier reveal logic**: `revealBlock` (line-level, cursor on or in node) vs `revealInline` (character-level, cursor inside node). **Active formatting**: inline elements (bold, italic, code, strikethrough, links) always styled; markers dimmed when cursor inside (revealInline), hidden when cursor outside. **Blockquote always-on**: recursive QuoteMark walk via tree cursor, styled without cursor guard. Exports `buildDecorations()` and `applyInlineFormatting()` helper.
  - `ImageWidget.ts` — Image widget with **dependency injection**: `markdownFilePath` passed via constructor (not global), resolves paths via `resolveImageSrcForDisplay()`.
  - `InlineMathWidget.ts` — Inline KaTeX widget ($...$). Exports `wysiwygKatexCache` (200-entry LRU cache, shared with block math).
  - `BlockMathWidget.ts` — Block KaTeX widget ($$...$$). Exports `appendMathDecorations()` helper for mark-based rendering when cursor inside.
  - `CodeBlockWidget.ts` — Code block widget with **in-place editing**: cursor outside = full widget replacement; cursor inside = fences hidden, code editable with Prism.js syntax highlighting via mark decorations. Exports `CodeBlockWidget`, `LanguageBadgeWidget`, `applyPrismTokens()`, `getCodeBlockPalette()`, `getPrismTokenColor()`. Sanitization via `sanitizeCodeHtml()`.
  - `MermaidWidget.ts` — Mermaid diagram widget with **async lazy loading**: `import('mermaid')` on-demand, theme-aware init, token-based staleness guard prevents async race conditions. Exports `mermaidSvgCache` (50-entry LRU), `getMermaid()`, `renderMermaidInto()`. Sanitization via `sanitizeSvgHtml()`. Fallback to code block on error.
  - `TableWidget.ts` — Table rendering widget. HTML table with styled borders/padding.
  - `BulletWidget.ts` — Bullet list marker widget. Styled list markers with theme-aware colors.
  - `utils.ts` — Shared utilities. Exports `scheduleEditorMeasure()` (defers layout recalculation for dynamic widget heights), `DocRange` type, `headingStyles` constant (font-size/weight per level), range helper functions (`createRangeChecker`, `isCursorOnRangeLine`, `isSelectionInRange`).
  - **Architecture notes**: All widgets expose `ignoreEvent() { return false }` for click-to-edit behavior. Uses `ensureSyntaxTree()` with 50ms timeout fallback. Configurable `MermaidSecurityLevel` from settings (default 'strict'). Image widget no longer uses global `markdownFilePath` — DI pattern for testability.
- `focus.ts` — Focus Mode ViewPlugin that dims non-cursor lines. Uses `cm-focus-dimmed` and `cm-focus-context` CSS classes. Configurable `contextLines` parameter controls how many lines around cursor remain bright. Only decorates visible ranges for performance. Exports `focusExtension(contextLines: number): Extension`.
- `typewriter.ts` — Typewriter Mode extension (`ViewPlugin` + `scrollPastEnd`). Keeps caret line centered with RAF scheduling, defers recenter while pointer drag-selection is active, recenters on pointer release, and applies subtle active-line highlight.

## For AI Agents

- Extensions are loaded via CM6 Compartments in MarkdownEditor.tsx
- Theme switching: `themeComp.reconfigure(isDark ? boltdownDarkTheme : boltdownTheme)`
- Zen mode toggle: `wysiwygComp.reconfigure(mode === 'zen' ? wysiwygExtension(mermaidSecurityLevel) : [])`
- `wysiwygExtension()` returns a StateField (not ViewPlugin) — supports `block: true` on widget decorations
- `wysiwygExtension()` traverses the syntax tree and compares cursor position to decide show/hide decorations
- Focus mode: separate extension, toggled independently
- Typewriter mode: separate extension, toggled independently; drag-selection guard prevents recenter jitter
- Internal names kept as `wysiwyg*` even though UI label is "Zen" (KISS — no unnecessary renames)
