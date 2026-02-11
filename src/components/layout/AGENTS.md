<!-- Parent: ../AGENTS.md -->

# layout/ — App Shell Layout Components

## Purpose

Top-level layout components that compose the application structure: header, footer, and main content area.

## Key Files

- `Header.tsx` — App header (h-12): logo (Zap icon + "BoltDown"), active filename + isDirty indicator, file operations (open/save/export dropdown), 3-mode toggle (Split/Source/Zen with icons), theme toggle (Sun/Moon/Monitor cycle). Uses split primitive selectors (`useActiveFileName()`, `useActiveIsDirty()`).
- `Footer.tsx` — Status bar (h-8): word count, reading time (225 wpm), character count. Computed via `useActiveCharCount()` and `useActiveWordCount()` — primitive-returning Zustand selectors.
- `MainLayout.tsx` — Flex-based split layout with draggable divider. Accepts `editor`, `preview`, `toolbar` ReactNode slots. Reads `editorStore.mode` to toggle panels. Divider uses requestAnimationFrame, clamps ratio 0.2–0.8, double-click resets to 50/50.

## For AI Agents

- Header and Footer are memoized with `memo()`
- Selectors in Header/Footer are defined as standalone functions (not inline) for reuse and primitive returns
- MainLayout receives children as slots from App.tsx (pre-created as stable JSX constants)
- Mode display: `split` = both panels, `source` = editor only, `zen` = editor with WYSIWYG decorations
- Export dropdown uses click-outside detection via `useEffect` + `document.addEventListener('mousedown')`
