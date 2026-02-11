<!-- Parent: ../AGENTS.md -->

# extensions/ — CodeMirror 6 Extensions

## Purpose

Modular CM6 extensions for markdown language support, editor theming, and WYSIWYG decorations.

## Key Files

- `markdown.ts` — Wraps `@codemirror/lang-markdown` with `markdownLanguage` base. Exports `markdownExtension()` factory function.
- `theme.ts` — Two CM6 `EditorView.theme()` objects with BoltDown brand styling: JetBrains Mono font, Electric Yellow (#FACC15) cursor/selection, 1.6 line-height. Exports `boltdownTheme` (light) and `boltdownDarkTheme` (dark).
- `wysiwyg.ts` — Zen mode `ViewPlugin` that applies live decorations: styled headings (font-size/weight), bold/italic/strikethrough (hide markers when cursor is outside), inline code background, embedded images via widgets, horizontal rules. Exports `wysiwygPlugin`.

## For AI Agents

- Extensions are loaded via CM6 Compartments in MarkdownEditor.tsx
- Theme switching: `themeComp.reconfigure(isDark ? boltdownDarkTheme : boltdownTheme)`
- Zen mode toggle: `wysiwygComp.reconfigure(mode === 'zen' ? wysiwygPlugin : [])`
- `wysiwygPlugin` traverses the syntax tree and compares cursor position to decide show/hide decorations
- Internal names kept as `wysiwyg*` even though UI label is "Zen" (KISS — no unnecessary renames)
