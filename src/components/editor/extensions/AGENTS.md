<!-- Parent: ../AGENTS.md -->

# extensions/ — CodeMirror 6 Extensions

## Purpose

Modular CM6 extensions for markdown language support, editor theming, and WYSIWYG decorations.

## Key Files

- `markdown.ts` — Wraps `@codemirror/lang-markdown` with `markdownLanguage` base. Exports `markdownExtension()` factory function.
- `theme.ts` — Two CM6 `EditorView.theme()` objects with BoltDown brand styling: JetBrains Mono font, Electric Yellow (#FACC15) cursor/selection, 1.6 line-height. Exports `boltdownTheme` (light) and `boltdownDarkTheme` (dark).
- `wysiwyg.ts` — Zen mode **StateField** (not ViewPlugin) providing inline WYSIWYG decorations. Uses `StateField.define()` with `provide: field => EditorView.decorations.from(field)`. Rebuilds decorations on `docChanged || tr.selection`. **Two-tier reveal logic**: `revealBlock` (line-level, cursor on or in node) vs `revealInline` (character-level, cursor inside node). **Active formatting**: inline elements (bold, italic, code, strikethrough, links) always styled; markers dimmed when cursor inside (revealInline), hidden when cursor outside. **Blockquote always-on**: recursive QuoteMark walk via tree cursor, styled without cursor guard. **Code block in-place editing**: cursor outside = full widget replacement; cursor inside = fences hidden, code editable with Prism.js syntax highlighting via mark decorations. **Widgets**: HeadingStyles (font-size/weight per level), InlineMathWidget (KaTeX $...$), BlockMathWidget (KaTeX $$...$$), TableWidget (HTML table rendering), CodeBlockWidget (Prism.js syntax highlighting), LanguageBadgeWidget (language label), MermaidWidget (lazy-loaded async rendering with fallback to code block), ImageWidget (embedded images), BulletWidget (styled list markers), HorizontalRule, Links (clickable, always styled), Blockquotes (always styled). **Helpers**: `applyInlineFormatting()` (symmetric marker logic with revealInline flag), `applyPrismTokens()` (recursive token traversal with mark decorations), `getCodeBlockPalette()` (theme-aware color map), `getPrismTokenColor()` (token type → color mapping). Mermaid uses lazy `import('mermaid')` with theme-aware init. Editable block widgets expose `ignoreEvent() { return false }` for click-to-edit behavior. Exports `wysiwygExtension(mermaidSecurityLevel)` factory function. Configurable `MermaidSecurityLevel` from settings (default 'strict'). Uses `ensureSyntaxTree()` with 50ms timeout fallback. Image paths resolved via `resolveImageSrcForDisplay()` from `@/utils/imagePath`. Token-based Mermaid staleness guard prevents async race conditions. `scheduleEditorMeasure(view)` defers layout recalculation for dynamic widget heights.
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
