<!-- Parent: ../AGENTS.md -->

# hooks/ — Custom React Hooks

## Purpose

Reusable React hooks that bridge UI components with Tauri APIs, store state, and rendering logic.

## Key Files

- `useFileSystem.ts` — File open/save/saveAs/delete/duplicate via Tauri dialog + invoke. Web fallback uses file input for open, in-memory save for web mode. Tauri mode: in-memory save for untitled docs (no filePath), disk save for files with filePath. All Tauri paths wrapped in try-catch with `flashStatus` error feedback (displays error message with 5s duration). Uses `getActiveTab()` callback with `getState()` to avoid stale closures. `openFile` auto-loads parent directory via `sidebarStore.loadParentDirectory(path, true)`. Requires `src-tauri/capabilities/default.json` for Tauri 2.0 ACL. Returns `{ openFile, saveFile, saveFileAs, deleteFile, duplicateFile }`.
- `useMarkdownParser.ts` — Thin `useMemo` wrapper around markdown-it's `md.render()`. Returns rendered HTML string.
- `useExport.ts` — Export markdown as standalone HTML file (Tauri save or blob download), print/PDF via `window.print()`, copy HTML to clipboard. Returns `{ exportHtml, exportPdf, copyHtml }`.
- `useOutline.ts` — Extracts heading structure from active tab content. Parses markdown headings (h1-h6) with inline formatting stripped. Returns `HeadingNode[]` with level, text, and line number. Re-computes only when active tab content changes (useMemo).
- `useAutoSave.ts` — Auto-save hook for dirty tabs. Reads `autoSave` and `autoSaveDelay` from settingsStore. Subscribes to tabStore changes and schedules debounced saves. Disk save via Tauri `write_file` invoke for files with path, in-memory `markClean` for untitled/browser. `isSavingRef` guard prevents concurrent saves. Also saves immediately on window blur. Flashes "Auto-saved" status via editorStore. Returns void (side-effect only hook). Called in App.tsx.

## For AI Agents

- `useFileSystem` uses `getActiveTab()` callback (not direct selector) which internally calls `useTabStore.getState()` at call time (not render time) to prevent stale closures in async operations
- `useFileSystem` has different save behavior: web mode = always in-memory, Tauri mode = in-memory for untitled (no filePath), disk save for files with filePath
- Error messages in `useFileSystem` use `flashStatus(message, duration)` — normal saves show "Saved", errors show descriptive message with 5s duration
- `useFileSystem.openFile` calls `sidebarStore.loadParentDirectory(path, true)` to auto-load and display the parent directory in sidebar file tree
- `useFileSystem.deleteFile` and `duplicateFile` close/open tabs as needed and trigger file tree refresh
- `useMarkdownParser` re-renders only when content string changes (useMemo dependency)
- `useExport` generates standalone HTML with embedded KaTeX CSS for portable export
- `useOutline` strips markdown inline formatting (bold, italic, code, links, strikethrough) before extracting heading text
- Theme management moved to `settingsStore.ts` in Phase 2 (useTheme.ts deleted)
