<!-- Parent: ../AGENTS.md -->

# editor/ — CodeMirror 6 Editor Components

## Purpose

Core editing experience: CodeMirror 6 editor, tab management with keyboard navigation, formatting toolbar, and CM6 extensions.

## Key Files

- `MarkdownEditor.tsx` — Direct CM6 EditorView management (not @uiw/react-codemirror wrapper). Creates EditorView once on mount, caches EditorState per tab in `Map<tabId, EditorState>` (preserves undo history, cursor, scroll). Uses `useRef(new Compartment())` for theme/wysiwyg/gutter/focus/spellcheck/typewriter/**codeBlockArrowNav** compartments. Live+Zen modes enable WYSIWYG decorations. Ordered-list `Tab` / `Shift-Tab` run list-aware indent/outdent with tree renumber normalization after each operation. In live/zen, fenced code blocks also get boundary navigation (`ArrowUp`/`ArrowDown`) and code-block-scoped `Mod+A` through `codeBlockArrowNavigationKeymap()`. Uses `useSettingsStore` for isDark theme derivation and focus/typewriter/spellcheck settings. Removed built-in searchKeymap (replaced by custom FindReplaceModal UI). Exports EditorView via EditorViewContext for toolbar/find access.

- `TabBar.tsx` — Horizontal tab bar with WAI-ARIA tabs pattern: sidebar toggle button (leftmost fixed), scrollable tabs (`w-[160px] shrink-0`), new tab button (after last tab). Keyboard navigation with ArrowLeft/Right/Home/End, roving tabindex (active tab = 0, others = -1). F2 triggers rename. Double-click to rename tab. Derives isDirty as `content !== savedContent`. Uses `joinPath()`/`getDirectoryPath()` from `@/utils/imagePath` for cross-platform file path manipulation during rename. Icons marked with `aria-hidden="true"`. Memoized with `memo()`.

- `EditorToolbar.tsx` — Expanded formatting toolbar with grouped controls (text, headings, links/media, code/math, lists, table, hr). Uses shared helpers from `formatCommands.ts` (`toggleWrap`, `toggleCode`, `insertAtLineStart`, `insertBlock`, `insertCodeBlock`, `insertMathBlock`, `insertTaskList`, `insertTable`).

## Subdirectories

- `extensions/` — CodeMirror 6 extension modules (see extensions/AGENTS.md)

## Accessibility Features

### TabBar

- **WAI-ARIA Tabs Pattern**: `role="tablist"` on container, `role="tab"` on buttons
- **Roving Tabindex**: Active tab has `tabIndex={0}`, inactive tabs have `tabIndex={-1}`
- **Keyboard Navigation**:
  - ArrowRight: Next tab (wrap to first)
  - ArrowLeft: Previous tab (wrap to last)
  - Home: First tab
  - End: Last tab
- **Focus Management**: Programmatic focus on tab activation via `tabButton?.focus()`
- **ARIA Labels**: `aria-label="Toggle sidebar"`, `aria-label="New tab"`, `aria-label="Close tab"`
- **Decorative Icons**: All icons marked with `aria-hidden="true"`

```tsx
// Keyboard navigation handler
handleTabListKeyDown(e: React.KeyboardEvent) {
  const currentIndex = tabs.findIndex(t => t.id === activeTabId)

  switch (e.key) {
    case 'ArrowRight': nextIndex = (currentIndex + 1) % tabs.length; break
    case 'ArrowLeft': nextIndex = (currentIndex - 1 + tabs.length) % tabs.length; break
    case 'Home': nextIndex = 0; break
    case 'End': nextIndex = tabs.length - 1; break
  }

  setActiveTab(nextTab.id)
  document.querySelector(`button[role="tab"][data-tab-id="${nextTab.id}"]`)?.focus()
}
```

## For AI Agents

### CM6 Architecture (CRITICAL)

```
EditorView (created once in useEffect[])
├── Compartments (useRef, NOT module-level)
│   ├── themeComp → boltdownTheme | boltdownDarkTheme
│   ├── wysiwygComp → wysiwygPlugin | []
│   ├── gutterComp → lineNumbers + foldGutter | []
│   ├── focusComp → focusExtension(contextLines) | []
│   ├── spellcheckComp → EditorView.contentAttributes.of(...) | []
│   ├── typewriterComp → typewriterExtension() | []
│   └── codeBlockArrowNavComp → codeBlockArrowNavigationKeymap() | []
├── EditorState cache: Map<tabId, EditorState>
│   └── Preserves: undo history, cursor position, scroll
└── updateListener → tabStore.updateContent()
```

- **Tab switching**: Save current state → restore cached (or create fresh) → re-apply compartment configs
- **buildExtensions()**: Function (not frozen ref) that reads current React state to avoid stale closures
- **EditorView ref**: Shared via EditorViewContext for toolbar access
- **Ordered-list Tab behavior**: Custom keymap runs before `indentWithTab`; `Tab`/`Shift-Tab` only apply to caret selection inside ordered-list items (skip code blocks), move current item subtree, and renumber ordered-list trees after each change.
- **Code-block keymap behavior**: `codeBlockArrowNavigationKeymap()` is enabled only for `mode === 'live' || mode === 'zen'`; outside WYSIWYG modes it must be reconfigured to `[]`.

### TabBar Layout

```
[Sidebar Toggle] [Tab1] [Tab2] [Tab3...] [+ New Tab]
 ← fixed →       ← scrollable (overflow-x-auto) →
```

### TabBar Rename Flow

1. Double-click tab → enters rename mode (input replaces label)
2. F2 key on active tab → enters rename mode
3. Input auto-focused and selected
4. Enter → commits rename (strips extension, re-adds .md if needed)
5. Escape → cancels rename
6. Blur → commits rename
7. If file has `filePath`, invokes Tauri `rename_file` command

## WIG Compliance

### TabBar

- ✅ WAI-ARIA tabs pattern (`role="tablist"`, `role="tab"`)
- ✅ Roving tabindex (active = 0, inactive = -1)
- ✅ Keyboard navigation (ArrowLeft/Right/Home/End)
- ✅ Focus management on tab switch
- ✅ ARIA labels on interactive buttons
- ✅ Decorative icons hidden from screen readers
