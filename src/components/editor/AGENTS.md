<!-- Parent: ../AGENTS.md -->

# editor/ — CodeMirror 6 Editor Components

## Purpose

Core editing experience: CodeMirror 6 editor, tab management, formatting toolbar, and CM6 extensions.

## Key Files

- `MarkdownEditor.tsx` — Direct CM6 EditorView management (not @uiw/react-codemirror wrapper). Creates EditorView once on mount, caches EditorState per tab in `Map<tabId, EditorState>` (preserves undo history, cursor, scroll). Uses `useRef(new Compartment())` for theme/wysiwyg/gutter compartments. Uses `useSettingsStore` for isDark theme derivation (migrated from useTheme in Phase 2).
- `TabBar.tsx` — Horizontal tab bar: sidebar toggle button (leftmost fixed), scrollable tabs (`w-[160px] shrink-0`), new tab button (after last tab). Derives isDirty as `content !== savedContent`.
- `EditorToolbar.tsx` — 14-button formatting toolbar. Three helper functions (`toggleWrap`, `insertAtLineStart`, `insertBlock`) manipulate CM6 EditorView state directly for bold, italic, headings, links, code, lists, etc.

## Subdirectories

- `extensions/` — CodeMirror 6 extension modules (see extensions/AGENTS.md)

## For AI Agents

### CM6 Architecture (CRITICAL)

```
EditorView (created once in useEffect[])
├── Compartments (useRef, NOT module-level)
│   ├── themeComp → boltdownTheme | boltdownDarkTheme
│   ├── wysiwygComp → wysiwygPlugin | []
│   └── gutterComp → lineNumbers + foldGutter | []
├── EditorState cache: Map<tabId, EditorState>
│   └── Preserves: undo history, cursor position, scroll
└── updateListener → tabStore.updateContent()
```

- **Tab switching**: Save current state → restore cached (or create fresh) → re-apply compartment configs
- **buildExtensions()**: Function (not frozen ref) that reads current React state to avoid stale closures
- **EditorView ref**: Shared via EditorViewContext for toolbar access

### TabBar Layout

```
[Sidebar Toggle] [Tab1] [Tab2] [Tab3...] [+ New Tab]
 ← fixed →       ← scrollable (overflow-x-auto) →
```
