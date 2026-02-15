<!-- Parent: ../AGENTS.md -->

# utils/ — Shared Utilities

## Purpose

Pure utility functions and configured library instances shared across the frontend.

## Key Files

- `markdownConfig.ts` — Configured markdown-it instance with: KaTeX math plugin (inline `$...$`, block `$$...$$`, `throwOnError: false`, `strict: 'ignore'`), Prism.js syntax highlighting (TS, JS, JSX, TSX, CSS, JSON, Bash, Python, Rust, Markdown), HTML escaping, TOC plugin. Exports `md` (MarkdownIt instance).
- `tauri.ts` — Runtime environment detection. Exports `isTauri()` — checks `window.__TAURI_INTERNALS__`.
- `directoryLoader.ts` — Bridges Tauri IPC `list_directory` command to `FileTreeNode[]` format. Exports `loadDirectoryEntries(dirPath)`. Used by both Sidebar.tsx and FileTree.tsx (DRY extraction).
- `settingsStorage.ts` — Dual-path settings persistence: Tauri IPC (`read_settings`/`write_settings` via appDataDir) or localStorage (`boltdown-settings` key). Exports `loadSettingsFromStorage()` → `Partial<AppSettings> | null`, `saveSettingsToStorage(settings)` → `Promise<void>`. Uses dynamic `import('@tauri-apps/api/core')` matching App.tsx pattern.
- `tocPlugin.ts` — Custom markdown-it plugin for Table of Contents generation. Recognizes `[toc]` marker (case-insensitive), generates slug-based heading IDs with `-N` suffix for duplicates, two-pass rendering (collects headings, then injects TOC HTML). Exports `tocPlugin(md)` function.

## For AI Agents

- `markdownConfig.ts` is the single source of truth for markdown rendering config
- KaTeX renders math synchronously via `katex.renderToString()`
- Mermaid is NOT handled here — it's post-processed in MarkdownPreview.tsx via `useEffect`
- Keep KaTeX options in preview aligned with Zen widgets (`throwOnError: false`, `strict: 'ignore'`) to avoid inconsistent warnings/output
- TOC plugin (`tocPlugin.ts`) is registered in `markdownConfig.ts` — processes `[toc]` markers into HTML lists
- `directoryLoader.ts` was extracted to eliminate duplicate directory loading code in Sidebar and FileTree
- `isTauri()` enables graceful degradation — app can run in browser without Tauri
- `settingsStorage.ts` follows the same `isTauri()` detection pattern as other Tauri-dependent code
