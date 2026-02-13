<!-- Parent: ../AGENTS.md -->

# layout/ — App Shell Layout Components

## Purpose

Top-level layout components that compose the application structure: header, footer, and main content area.

## Key Files

- `Header.tsx` — App header (h-12, flex-none): logo (Zap icon + "BoltDown"), file operations (open/save/export dropdown with z-50), 3-mode toggle (Split/Source/Zen with icons, segmented button group), theme cycle button (Sun/Moon/Monitor icons). Uses `useSettingsStore` for theme state (migrated from useTheme hook in Phase 2). Export dropdown uses click-outside detection via `useEffect` + `document.addEventListener('mousedown')`. Memoized with `memo()`.
- `Footer.tsx` — Status bar (h-8, flex-none): left side shows `editorStore.statusText` (or "Ready"), right side shows word count, reading time (225 wpm), character count with `toLocaleString()` formatting. Computed via `useActiveCharCount()` and `useActiveWordCount()` — primitive-returning Zustand selectors defined as standalone functions. Memoized with `memo()`.
- `MainLayout.tsx` — Flex-based split layout with draggable divider. Accepts `editor`, `preview`, `toolbar` ReactNode slots. Reads `editorStore.mode` to toggle panels ('split' = both, 'source'/'zen' = editor only). Divider uses `requestAnimationFrame` for 60fps resize, clamps ratio 0.2–0.8, double-click resets to 50/50. Window blur safety (cleanup on window blur). Pointer overlay during drag (fixed inset-0 z-40 with cursor-col-resize) prevents text selection. Preview container has `overscroll-contain` to prevent scroll chaining.

## For AI Agents

- All three components are memoized with `memo()`
- Selectors in Footer are defined as standalone functions (not inline) for reuse and primitive returns
- MainLayout receives children as slots from App.tsx (pre-created as stable JSX constants)
- Mode display: `split` = both panels, `source` = editor only, `zen` = editor with WYSIWYG decorations
- Export dropdown uses click-outside detection via `useEffect` + `document.addEventListener('mousedown')`
- Layout scroll prevention: html/body/#root have `height:100% + overflow:hidden` in index.css
- Header has `flex-none h-12`, Footer has `flex-none h-8` — prevents them from scrolling away with content
