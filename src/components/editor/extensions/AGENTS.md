<!-- Parent: ../AGENTS.md -->

# extensions/ — CodeMirror 6 Extensions

## Purpose

Modular CM6 extensions for markdown language support, editor theming, and WYSIWYG decorations used in live/zen modes.

## Key Files

- `markdown.ts` — Wraps `@codemirror/lang-markdown` with `markdownLanguage` base. Exports `markdownExtension()` factory function.
- `theme.ts` — Two CM6 `EditorView.theme()` objects with BoltDown styling: JetBrains Mono font, token-driven accent cursor/selection (`--s-accent`), 1.6 line-height. Exports `boltdownTheme` (light) and `boltdownDarkTheme` (dark).
- `wysiwyg/` — **Modular WYSIWYG extension** directory (widgets, decoration builder, table model, code-block navigation model/keymap, tests). Live/zen mode **StateField** (not ViewPlugin) provides decorations.
  - `index.ts` — Entry point. Exports `wysiwygExtension(mermaidSecurityLevel)` factory function. StateField definition with `provide: field => EditorView.decorations.from(field)`. Rebuilds decorations on `docChanged || tr.selection`.
  - `buildDecorations.ts` — Main decoration builder. Implements **two-tier reveal logic**: `revealBlock` (line-level, cursor on or in node) vs `revealInline` (character-level, cursor inside node). **Active formatting**: inline elements (bold, italic, code, strikethrough, links) always styled; markers dimmed when cursor inside (revealInline), hidden when cursor outside. **Blockquote always-on**: recursive QuoteMark walk via tree cursor, styled without cursor guard. Exports `buildDecorations()` and `applyInlineFormatting()` helper.
  - `ImageWidget.ts` — Image widget with **dependency injection**: `markdownFilePath` passed via constructor (not global), resolves paths via `resolveImageSrcForDisplay()`.
  - `InlineMathWidget.ts` — Inline KaTeX widget ($...$). Exports `wysiwygKatexCache` (200-entry LRU cache, shared with block math).
  - `BlockMathWidget.ts` — Block KaTeX widget ($$...$$). Exports `appendMathDecorations()` helper for mark-based rendering when cursor inside.
  - `CodeBlockWidget.ts` — Code block widget utilities with Prism token styling, language badge/popover, and shared `KNOWN_LANGUAGES` list used by both badge autocomplete and fence completion.
  - `codeBlockArrowNavigationModel.ts` — Fenced code-block boundary model for `ArrowUp`/`ArrowDown` and code-block-scoped `Mod+A` range resolution.
  - `codeBlockArrowNavigationKeymap.ts` — CM6 keymap wrapper that executes model actions and opens language popovers through badge metadata.
  - `MermaidWidget.ts` — Mermaid diagram widget with **async lazy loading**: `import('mermaid')` on-demand, theme-aware init, token-based staleness guard prevents async race conditions. Exports `mermaidSvgCache` (50-entry LRU), `getMermaid()`, `renderMermaidInto()`. Sanitization via `sanitizeSvgHtml()`. Fallback to code block on error.
- `TableWidget.ts` — Interactive table widget: editable header/body cells, row/column add-delete, L/C/R alignment controls, resize (rows/cols), and undo/redo-safe update handling.
  - `BulletWidget.ts` — Bullet list marker widget. Styled list markers with theme-aware colors.
  - `utils.ts` — Shared utilities. Exports `scheduleEditorMeasure()` (defers layout recalculation for dynamic widget heights), `DocRange` type, `headingStyles` constant (font-size/weight per level), range helper functions (`createRangeChecker`, `isCursorOnRangeLine`, `isSelectionInRange`).
  - **Architecture notes**: `ignoreEvent()` varies by widget (`TableWidget` returns `true`, badge/TOC/task/image widgets intercept mouse events, math/mermaid/code widget can return `false`). Uses `ensureSyntaxTree()` with 50ms timeout fallback. Configurable `MermaidSecurityLevel` from settings (default 'strict'). Image widget uses DI (`markdownFilePath`) for testability.
- `focus.ts` — Focus Mode ViewPlugin that dims non-cursor lines. Uses `cm-focus-dimmed` and `cm-focus-context` CSS classes. Configurable `contextLines` parameter controls how many lines around cursor remain bright. Only decorates visible ranges for performance. Exports `focusExtension(contextLines: number): Extension`.
- `typewriter.ts` — Typewriter Mode extension (`ViewPlugin` + `scrollPastEnd`). Keeps caret line centered with RAF scheduling, defers recenter while pointer drag-selection is active, recenters on pointer release, and applies subtle active-line highlight.

## For AI Agents

- Extensions are loaded via CM6 Compartments in MarkdownEditor.tsx
- Theme switching: `themeComp.reconfigure(isDark ? boltdownDarkTheme : boltdownTheme)`
- Live/zen toggle: `wysiwygComp.reconfigure(mode === 'live' || mode === 'zen' ? wysiwygExtension(mermaidSecurityLevel) : [])`
- Code-block arrow keymap toggle: `codeBlockArrowNavComp.reconfigure(mode === 'live' || mode === 'zen' ? codeBlockArrowNavigationKeymap() : [])`
- `wysiwygExtension()` returns a StateField (not ViewPlugin) — supports `block: true` on widget decorations
- `wysiwygExtension()` traverses the syntax tree and compares cursor position to decide show/hide decorations
- Focus mode: separate extension, toggled independently
- Typewriter mode: separate extension, toggled independently; drag-selection guard prevents recenter jitter
- Internal names kept as `wysiwyg*` even though UI modes are live + zen.

## Code Block Edit Checklist

- Keep `buildDecorations.ts` classes/attributes aligned with `src/styles/codeblock.css` (`codeblock-line`, `codeblock-fence-hidden-line`, badge/popover selectors, and `data-*` attributes).
- Keep language list coupling intact: update `KNOWN_LANGUAGES` in `CodeBlockWidget.ts` and verify `fenceLanguageCompletion.ts` behavior.
- Keep keymap wiring aligned across `codeBlockArrowNavigationModel.ts`, `codeBlockArrowNavigationKeymap.ts`, and `MarkdownEditor.tsx` compartment reconfigure paths.
- Update tests when behavior changes: at least `codeBlockArrowNavigationModel.test.ts` and `codeBlockBadge.test.ts`; include widget tests for `ignoreEvent`, dataset metadata, and popover behavior.
- Quick verification command: `npm run test:run -- src/components/editor/extensions/wysiwyg/codeBlockArrowNavigationModel.test.ts src/components/editor/extensions/wysiwyg/codeBlockBadge.test.ts`
