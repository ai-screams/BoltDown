<!-- Parent: ../AGENTS.md -->

# stores/ — Zustand State Management

## Purpose

Five independent Zustand stores following SRP. Each store manages a distinct domain of application state.

## Key Files

- `editorStore.ts` — Editor view mode (`'split' | 'source' | 'zen'`) and transient status messages. Exports `useEditorStore` with `mode`, `setMode`, `statusText`, and `flashStatus(text, ms)`.
- `tabStore.ts` — Multi-tab document state. Manages `Tab[]`, `activeTabId`. Methods: `openTab`, `closeTab`, `closeOtherTabs`, `setActiveTab`, `updateContent`, `markClean`. Tab IDs are UUIDs.
- `sidebarStore.ts` — Sidebar UI state (open/close, width, isResizing, file tree data, recent files). Persists width to localStorage with 300ms debounce. Max 20 recent files. `loadParentDirectory()` has `console.error()` logging in catch block for debugging. Exports `useSidebarStore` with `setResizing(boolean)` for cross-component drag coordination.
- `settingsStore.ts` — Application settings state (theme, editor, preview, general). Persists to Tauri appDataDir or localStorage with 500ms debounce. **Module-level helpers** (extracted for testability): `debouncedSave` (500ms debounce save), `getSystemTheme` (reads matchMedia), `resolveThemeMode` (system → light/dark), `applyTheme` (DOM updates), `sanitizeTheme` (validation), `mergeWithDefaults` (deep merge), `initThemeListener` (matchMedia change handler with guard), `migrateLegacyTheme` (one-time migration). Uses `THEME_MODES.includes()` for mode validation (not Set). Exports `useSettingsStore`.
- `findReplaceStore.ts` — Find & Replace UI state (isOpen, showReplace, searchText, replaceText, caseSensitive, useRegex, wholeWord). Persists search preferences (not text) via Zustand persist middleware. Input length limits: 1000 chars (search), 10000 chars (replace). Exports `useFindReplaceStore`.

## For AI Agents

### Selector Pattern (CRITICAL)

```tsx
// ✅ Primitive return — Object.is equality works
const mode = useEditorStore(s => s.mode)
const activeTabId = useTabStore(s => s.activeTabId)

// ✅ Good in high-frequency UI (Footer/status): derive primitives without custom equality callback
const lineCount = useTabStore(s => {
  const tab = s.tabs.find(t => t.id === s.activeTabId)
  return (tab?.content ?? '').split('\n').length
})

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

- `tabStore` is consumed by: MarkdownEditor, TabBar, Header, Footer, App, useFileSystem, useExport, useAutoSave
- `editorStore` is consumed by: MarkdownEditor, Header, MainLayout, App, FileTree, Footer, useAutoSave, useExport, useFileSystem
- `sidebarStore` is consumed by: Sidebar, TabBar, ResizeHandle, MainLayout, App
- `settingsStore` is consumed by: App, Header, MarkdownEditor, MarkdownPreview, SettingsModal, useAutoSave
- `findReplaceStore` is consumed by: App, FindReplaceModal
