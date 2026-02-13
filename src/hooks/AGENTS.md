<!-- Parent: ../AGENTS.md -->

# hooks/ — Custom React Hooks

## Purpose

Reusable React hooks that bridge UI components with Tauri APIs, store state, and rendering logic.

## Key Files

- `useFileSystem.ts` — File open/save/saveAs via Tauri dialog + invoke. Uses `getState()` to avoid stale closures. Returns `{ openFile, saveFile, saveFileAs }`.
- `useMarkdownParser.ts` — Thin `useMemo` wrapper around markdown-it's `md.render()`. Returns rendered HTML string.
- `useTheme.ts` — Light/Dark/System theme cycling with localStorage persistence and `matchMedia` listener. Returns `{ theme, setTheme, cycleTheme, isDark }`.
- `useExport.ts` — Export markdown as standalone HTML file (Tauri save or blob download), print/PDF via `window.print()`, copy HTML to clipboard. Returns `{ exportHtml, exportPdf, copyHtml }`.

## For AI Agents

- `useFileSystem` uses `useTabStore.getState()` at call time (not render time) to prevent stale closures in async operations
- `useMarkdownParser` re-renders only when content string changes (useMemo dependency)
- `useTheme` applies `document.documentElement.classList` for Tailwind dark mode
- `useExport` generates standalone HTML with embedded KaTeX CSS for portable export
