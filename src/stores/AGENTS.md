<!-- Parent: ../AGENTS.md -->

# stores/ — Zustand State Management

## Purpose

Five independent Zustand stores following SRP. Each store manages a distinct domain of application state.

## Key Files

- `editorStore.ts` — Editor view mode (`'split' | 'source' | 'zen'`) and transient status messages. Exports `useEditorStore` with `mode`, `setMode`, `statusText`, and `flashStatus(text, ms)`.
- `tabStore.ts` — Multi-tab document state. Manages `Tab[]`, `activeTabId`. Methods: `openTab`, `closeTab`, `closeOtherTabs`, `setActiveTab`, `updateContent`, `markClean`. Tab IDs are UUIDs.
- `sidebarStore.ts` — Sidebar UI state (open/close, width, isResizing, file tree data, recent files). Persists width to localStorage with 300ms debounce. Max 20 recent files. Exports `useSidebarStore` with `setResizing(boolean)` for cross-component drag coordination.
- `settingsStore.ts` — Application settings state (theme, editor, preview, general). Persists to Tauri appDataDir or localStorage with 500ms debounce. Module-level helpers: `debouncedSave`, `getSystemTheme`, `applyTheme`, `mergeWithDefaults`. Migrates legacy `boltdown-theme` key. Has `matchMedia` listener guard. Exports `useSettingsStore`.
- `findReplaceStore.ts` — Find & Replace UI state (isOpen, showReplace, searchText, replaceText, caseSensitive, useRegex, wholeWord). Persists search preferences (not text) via Zustand persist middleware. Input length limits: 1000 chars (search), 10000 chars (replace). Exports `useFindReplaceStore`.

## For AI Agents

### Selector Pattern (CRITICAL)

```tsx
// ✅ Primitive return — Object.is equality works
const mode = useEditorStore(s => s.mode)
const activeTabId = useTabStore(s => s.activeTabId)

// ❌ Object return — re-renders every time
const { mode, fileName } = useEditorStore(s => ({ mode: s.mode, fileName: s.fileName }))
```

### Stale Closure Prevention

```tsx
// ✅ Read at call time for async/callbacks
const { tabs, activeTabId } = useTabStore.getState()

// ❌ Captured at render time — stale in async
const tab = tabs.find(t => t.id === activeTabId) // in closure
```

### Derived State

- `isDirty` is NOT stored in `Tab` — derive as `tab.content !== tab.savedContent`
- `wordCount`, `charCount`, `readingTime` are computed in Footer selectors

## Dependencies

- `tabStore` is consumed by: MarkdownEditor, TabBar, Header, Footer, App, useFileSystem, useExport
- `editorStore` is consumed by: MarkdownEditor, Header, MainLayout, App
- `sidebarStore` is consumed by: Sidebar, TabBar, ResizeHandle, MainLayout, App
- `settingsStore` is consumed by: App, Header, MarkdownEditor, MarkdownPreview, SettingsModal
- `findReplaceStore` is consumed by: App, FindReplaceModal
