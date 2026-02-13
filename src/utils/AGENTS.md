<!-- Parent: ../AGENTS.md -->

# utils/ — Shared Utilities

## Purpose

Pure utility functions and configured library instances shared across the frontend.

## Key Files

- `markdownConfig.ts` — Configured markdown-it instance with: KaTeX math plugin (inline `$...$`, block `$$...$$`), Prism.js syntax highlighting (TS, JS, JSX, TSX, CSS, JSON, Bash, Python, Rust, Markdown), HTML escaping. Exports `md` (MarkdownIt instance).
- `tauri.ts` — Runtime environment detection. Exports `isTauri()` — checks `window.__TAURI_INTERNALS__`.
- `directoryLoader.ts` — Bridges Tauri IPC `list_directory` command to `FileTreeNode[]` format. Exports `loadDirectoryEntries(dirPath)`. Used by both Sidebar.tsx and FileTree.tsx (DRY extraction).
- `settingsStorage.ts` — Dual-path settings persistence: Tauri IPC (`read_settings`/`write_settings` via appDataDir) or localStorage (`boltdown-settings` key). Exports `loadSettingsFromStorage()` → `Partial<AppSettings> | null`, `saveSettingsToStorage(settings)` → `Promise<void>`. Uses dynamic `import('@tauri-apps/api/core')` matching App.tsx pattern.

## For AI Agents

- `markdownConfig.ts` is the single source of truth for markdown rendering config
- KaTeX renders math synchronously via `katex.renderToString()`
- Mermaid is NOT handled here — it's post-processed in MarkdownPreview.tsx via `useEffect`
- `directoryLoader.ts` was extracted to eliminate duplicate directory loading code in Sidebar and FileTree
- `isTauri()` enables graceful degradation — app can run in browser without Tauri
- `settingsStorage.ts` follows the same `isTauri()` detection pattern as other Tauri-dependent code
