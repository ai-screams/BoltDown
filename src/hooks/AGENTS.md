<!-- Parent: ../AGENTS.md -->

# hooks/ — Custom React Hooks

## Purpose

Reusable React hooks that bridge UI components with Tauri APIs, store state, and rendering logic.

## Key Files

- `useFileSystem.ts` — File open/save/saveAs/delete/duplicate via Tauri dialog + invoke. Web fallback uses file input for open, in-memory save for web mode. Tauri mode: in-memory save for untitled docs (no filePath), disk save for files with filePath. All Tauri paths wrapped in try-catch with `flashStatus` error feedback (displays error message with 5s duration). Uses `getActiveTab()` callback with `getState()` to avoid stale closures. `openFile` auto-loads parent directory via `sidebarStore.loadParentDirectory(path, true)`. Requires `src-tauri/capabilities/default.json` for Tauri 2.0 ACL. Returns `{ openFile, saveFile, saveFileAs, deleteFile, duplicateFile }`.
- `useMarkdownParser.ts` — Lazy-loads markdown-it instance (module-level cache), renders with `md.render()`, applies `sanitizePreviewHtml()`. Returns sanitized HTML string. Re-renders only when content changes (useMemo).
- `useExport.ts` — Export as standalone HTML (Tauri save or blob download), print/PDF via `window.print()`, copy HTML to clipboard. `exportHtml` builds full HTML document with embedded KaTeX CSS link, CSP meta tag, theme tokens resolved via `resolveCssToken()` with depth guard (max 10). All outputs use `sanitizePreviewHtml()`. Returns `{ exportHtml, exportPdf, copyHtml }`.
- `useOutline.ts` — Extracts heading structure from active tab content. Parses markdown headings (h1-h6) with inline formatting stripped. Returns `HeadingNode[]` with level, text, and line number. Re-computes only when active tab content changes (useMemo).
- `useAutoSave.ts` — Auto-save hook for dirty tabs. Reads `autoSave` and `autoSaveDelay` from settingsStore. Subscribes to tabStore changes and schedules debounced saves. Disk save via Tauri `write_file` invoke for files with path, in-memory `markClean` for untitled/browser. `isSavingRef` guard prevents concurrent saves. `pendingBlurSaveRef` prevents race condition: if blur triggers during active save, schedules another save after current completes. Snapshots `current.content` before async operations to prevent stale-closure bugs. Flashes "Auto-saved" status via editorStore. Returns void (side-effect only hook). Called in App.tsx.
- `useDocumentStats.ts` — Computes document statistics (chars, words, lines) with debouncing (150ms default). Returns `DocumentStats` object. Used by Footer component for real-time stats display.
- `useKeyboardShortcuts.ts` — Global keyboard shortcut handler extracted from App.tsx. Manages Cmd+O/S/N/\\/,/F/H, Shift+Cmd+E, and Escape (Zen exit). Takes file operation callbacks and settings modal state as dependencies. Uses stable refs to prevent stale closures.
- `useCustomCss.ts` — Injects custom CSS from settingsStore into `<style id="boltdown-custom-css">` element. Applies `sanitizeCustomCss()` before injection (blocks @import, external URLs, JS execution). Debounced with CUSTOM_CSS_LIMITS.debounceMs. Creates style element on mount if customCss is non-empty, removes on unmount or when customCss becomes empty. Uses two useEffect hooks: one for debounced injection, one for cleanup. Called in App.tsx.
- `useSplitScrollSync.ts` — Split view scroll synchronization between CodeMirror editor and HTML preview (~630 lines). **Primary mapping**: `mapEditorToPreviewViaDOM()` — uses `view.lineBlockAtHeight()` to find top visible editor line, queries `[data-source-line]` elements in preview DOM for exact positioning with sub-line fraction. **Fallback**: `buildScrollAnchors()` + `interpolateScroll()` — piecewise linear interpolation via binary search on anchor pairs. **Animation**: `SmoothScroller` class (RAF lerp, α=0.25, ~120ms settle). **Click-to-sync**: `syncCursorToPreview()` — editor mouseup triggers preview scroll to matching `data-source-line` element at same viewport fraction. **Offset correction**: exponential decay (τ=150ms) bridges click↔scroll position differences. **Feedback prevention**: driver lock (DRIVER_LOCK_MS=160) + programmatic scroll value tracking. **Change detection**: MutationObserver (class/style/src/data-source-line), ResizeObserver, image load/error tracking for anchor invalidation. **WKWebView compat**: RAF polling for editor scroll (no passive scroll event on WKWebView `.cm-scroller`). Called in MainLayout.tsx with `{ enabled: mode === 'split', previewScrollRef }`. Returns void (side-effect only). Technical reference: `docs/ref/scroll-sync.md`.

## For AI Agents

- `useFileSystem` uses `getActiveTab()` callback (not direct selector) which internally calls `useTabStore.getState()` at call time (not render time) to prevent stale closures in async operations
- `useFileSystem` has different save behavior: web mode = always in-memory, Tauri mode = in-memory for untitled (no filePath), disk save for files with filePath
- Error messages in `useFileSystem` use `flashStatus(message, duration)` — normal saves show "Saved", errors show descriptive message with 5s duration
- `useFileSystem.openFile` calls `sidebarStore.loadParentDirectory(path, true)` to auto-load and display the parent directory in sidebar file tree only if sidebar is open
- `useFileSystem.deleteFile` and `duplicateFile` close/open tabs as needed and trigger file tree refresh; `duplicateFile` uses shared `findAvailableCopyPath()` utility
- `useMarkdownParser` lazy-loads md instance (module-level cache), applies `sanitizePreviewHtml()`, re-renders only when content changes
- `useExport` generates standalone HTML with embedded KaTeX CSS, CSP meta tag, theme token resolution with `resolveCssToken()` depth guard (max 10), applies `sanitizePreviewHtml()` to all outputs
- `useAutoSave` prevents race conditions: snapshots content before async ops, uses `pendingBlurSaveRef` to queue blur-triggered saves if already saving
- `useOutline` strips markdown inline formatting (bold, italic, code, links, strikethrough) before extracting heading text
- `useKeyboardShortcuts` extracted from App.tsx for modularity — handles all global keyboard shortcuts
- `useDocumentStats` provides debounced statistics computation for Footer component
- `useCustomCss` applies `sanitizeCustomCss()` to block dangerous patterns (@import, external URLs, JS execution) before injecting into style element
- `useSplitScrollSync` uses DOM-based mapping as primary strategy (O(1) exact match, O(n) bracket fallback), anchor interpolation as last resort. Anchor array invalidated by MutationObserver/ResizeObserver/image loads. SmoothScroller animates preview, editor scroll set directly. Click-to-sync only fires when mouseup doesn't cause scroll (SCROLL_EPSILON_PX=1 check). Offset decay uses `Math.exp(-elapsed / TAU)` with TAU=150ms.
- Theme management moved to `settingsStore.ts` in Phase 2 (useTheme.ts deleted)
