# BoltDown — Lightning-Fast Markdown Editor

## Purpose

Cross-platform desktop Markdown editor built with **Tauri 2.0** (Rust backend) + **React 19** (TypeScript frontend) + **CodeMirror 6** (editor engine). Phase 1 MVP is fully implemented: 3-mode editing (Split/Source/Zen), multi-tab, file sidebar, dark mode, KaTeX/Mermaid, export.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Tauri 2.0 Shell               │
│  ┌───────────────────────────────────────────┐  │
│  │            React 19 Frontend              │  │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────┐  │  │
│  │  │ Sidebar │ │ Editor   │ │ Preview   │  │  │
│  │  │ (tree)  │ │ (CM6)    │ │ (md-it)   │  │  │
│  │  └─────────┘ └──────────┘ └───────────┘  │  │
│  │        Zustand Stores (3 stores)          │  │
│  └───────────────────────────────────────────┘  │
│              Rust IPC Commands                  │
│         (read_file, write_file, list_dir)       │
└─────────────────────────────────────────────────┘
```

## Key Directories

| Directory    | Purpose                                                  |
| ------------ | -------------------------------------------------------- |
| `src/`       | React frontend — components, stores, hooks, types, utils |
| `src-tauri/` | Rust backend — Tauri commands, app config, icons         |
| `.docs/`     | Documentation — ADR, PRD, brand guidelines, wiki         |
| `tests/`     | E2E tests (Playwright, placeholder)                      |

## Configuration Files

| File                   | Purpose                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `package.json`         | Dependencies, scripts (dev/build/lint/validate)                   |
| `vite.config.ts`       | Build: path aliases, vendor chunk splitting (CM/Mermaid/markdown) |
| `tsconfig.json`        | Strict TS, path aliases (@/, @components/, etc.)                  |
| `tailwind.config.js`   | Brand colors (electric-yellow, deep-blue), Inter/Pretendard fonts |
| `eslint.config.js`     | ESLint v9 flat config, TS/React/a11y/import-order                 |
| `.prettierrc`          | No semi, single quote, 100 width, Tailwind class sort             |
| `commitlint.config.js` | Conventional Commits enforcement                                  |

## For AI Agents

- **Code style**: `semi: false`, `singleQuote: true`, `arrowParens: 'avoid'`, `printWidth: 100`
- **Path aliases**: `@/` → `src/`, `@components/` → `src/components/`, etc.
- **Zustand pattern**: Always use primitive-returning selectors (not object destructuring)
- **CM6 pattern**: Compartments in `useRef`, not module-level singletons
- **Derived state**: `isDirty = content !== savedContent` (not stored)
- **Type checking**: `npx tsc --noEmit` before committing
- **Linting**: `npx eslint src/` before committing
- **Build**: `npx vite build` to verify; `npm run tauri:build` for DMG

## Tech Stack

| Layer         | Technology                               |
| ------------- | ---------------------------------------- |
| Desktop Shell | Tauri 2.0 (Rust)                         |
| UI Framework  | React 19 + TypeScript (strict)           |
| Editor        | CodeMirror 6 (direct API)                |
| Markdown      | markdown-it + KaTeX + Mermaid + Prism.js |
| State         | Zustand (3 stores: editor, tab, sidebar) |
| Styling       | Tailwind CSS (dark mode: class-based)    |
| Icons         | lucide-react                             |
| File Tree     | react-arborist                           |
| Build         | Vite 5 + esbuild                         |

## Git

- Branch: `feat/phase1-3mode-editor`
- Commit style: Conventional Commits (`feat(editor):`, `fix(preview):`, etc.)
- Pre-commit: Husky + lint-staged + commitlint
