<!-- Parent: ../AGENTS.md -->

# src/ — React Frontend

## Purpose

React 19 + TypeScript frontend for BoltDown. Contains all UI components, state management, hooks, utilities, and type definitions.

## Key Files

- `App.tsx` — Root component: keyboard shortcuts (Cmd+O/S/N/\/Shift+E), layout composition, file open handler
- `main.tsx` — React 19 entry point (StrictMode wrapper)
- `index.css` — Tailwind base + `.prose` preview styles + brand CSS variables + KaTeX CSS import
- `vite-env.d.ts` — Vite type definitions

## Subdirectories

- `components/` — React UI components (see components/AGENTS.md)
- `stores/` — Zustand state stores (see stores/AGENTS.md)
- `hooks/` — Custom React hooks (see hooks/AGENTS.md)
- `types/` — TypeScript type definitions (see types/AGENTS.md)
- `utils/` — Shared utilities (see utils/AGENTS.md)
- `contexts/` — React context providers (see contexts/AGENTS.md)
- `test/` — Test setup (Vitest config)

## For AI Agents

- All components use `memo()` wrapper pattern: `export default memo(function Name() { ... })`
- Import order: external → internal (@/ aliases) → relative
- Path aliases: `@/` = `src/`, `@components/` = `src/components/`, etc.
- No barrel files (index.ts) — always import directly from the file
- Types file uses `.ts` extension (not `.d.ts`)

## Component Hierarchy

```
App
├── Header (logo, file ops, mode toggle, theme)
├── Sidebar + ResizeHandle
└── main content
    ├── TabBar (sidebar toggle, tabs, new tab)
    └── MainLayout
        ├── EditorToolbar
        ├── MarkdownEditor (CM6)
        └── MarkdownPreview (markdown-it)
    Footer
```
