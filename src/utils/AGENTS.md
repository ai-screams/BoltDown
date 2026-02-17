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
- `imagePath.ts` — Image path resolution utilities. Exports `resolveImageSrcForDisplay(url, filePath)` — resolves relative/absolute/web image URLs for display in both preview and Zen mode. Handles `file://` URLs via `fromFileUrl()`, POSIX path normalization via `toPosixPath()`, relative path resolution against document directory. Also exports: `isWebUrl`, `isAbsoluteFilePath`, `normalizeMarkdownUrl`, `joinPath`, `getDirectoryPath`, `safeDecodeUri`, `toFileUrl`, `resolveRelativePath`.
- `markdownText.ts` — Shared markdown text processing. Exports `escapeHtml(str)` for safe HTML entity escaping and `stripInlineMarkdown(text)` for removing markdown formatting (bold, italic, code, links, strikethrough) from heading text. Extracted from inline usage for DRY reuse across outline/preview/export.
- `sanitize.ts` — DOMPurify sanitization with 5 profiles: `sanitizePreviewHtml` (markdown preview with KaTeX MathML/SVG + data-\* attrs for scroll sync), `sanitizeKatexHtml` (WYSIWYG widgets), `sanitizeCodeHtml` (Prism.js spans), `sanitizeSvgHtml` (Mermaid/SVG with foreignObject), `sanitizeCustomCss` (blocks @import, external URLs, JS execution vectors).
- `cache.ts` — Generic `LruCache<V>` class. Map-based LRU eviction (first key = oldest entry). Used by wysiwyg.ts (KaTeX/Mermaid widget caching) and MarkdownPreview.tsx (Mermaid diagram caching).
- `fileCopy.ts` — Exports `findAvailableCopyPath(filePath)` — single `list_directory` IPC call for duplicate file naming. Generates `file (copy).md`, `file (copy 2).md`, etc. Used by FileTree.tsx copy operation.

## For AI Agents

- `markdownConfig.ts` is the single source of truth for markdown rendering config
- KaTeX renders math synchronously via `katex.renderToString()`
- Mermaid is NOT handled here — it's post-processed in MarkdownPreview.tsx via `useEffect`
- Keep KaTeX options in preview aligned with Zen widgets (`throwOnError: false`, `strict: 'ignore'`) to avoid inconsistent warnings/output
- TOC plugin (`tocPlugin.ts`) is registered in `markdownConfig.ts` — processes `[toc]` markers into HTML lists
- `directoryLoader.ts` was extracted to eliminate duplicate directory loading code in Sidebar and FileTree
- `isTauri()` enables graceful degradation — app can run in browser without Tauri
- `settingsStorage.ts` follows the same `isTauri()` detection pattern as other Tauri-dependent code
- `imagePath.ts` is used by both wysiwyg.ts (Zen mode image rendering) and MarkdownPreview.tsx (split mode)
- `markdownText.ts` is used by `useOutline.ts` (heading text extraction) and `useExport.ts`
