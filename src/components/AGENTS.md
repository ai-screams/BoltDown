<!-- Parent: ../AGENTS.md -->

# components/ — React UI Components

## Purpose

All React UI components organized by feature area. Every exported component uses `memo()` wrapper.

## Subdirectories

- `editor/` — CodeMirror 6 editor, tab bar, toolbar, CM6 extensions (see editor/AGENTS.md)
- `layout/` — App shell: Header, Footer, MainLayout (see layout/AGENTS.md)
- `preview/` — Markdown preview renderer (see preview/AGENTS.md)
- `sidebar/` — File tree, recent files, resize handle (see sidebar/AGENTS.md)
- `common/` — Shared UI primitives (see common/AGENTS.md)
- `settings/` — Settings modal and controls (see settings/AGENTS.md)
- `findreplace/` — Find & Replace modal with CM6 integration (see findreplace/AGENTS.md)

## For AI Agents

- All components: `export default memo(function ComponentName() { ... })`
- Props are minimal — most data comes from Zustand stores via selectors
- Zustand selectors must return primitives (string, number, boolean) to avoid re-renders
- Use `clsx` for conditional classNames, `lucide-react` for icons
- Dark mode via Tailwind `dark:` variants (class-based)
