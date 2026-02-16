# BoltDown — Lightning-Fast Markdown Editor

## Purpose

Cross-platform desktop Markdown editor built with **Tauri 2.0** (Rust backend) + **React 19** (TypeScript frontend) + **CodeMirror 6** (editor engine). Phase 1 MVP complete. Phase 2 complete: Settings System (4-category modal, Tauri persistence), Find & Replace (Cmd+F/H, ReDoS protection, keyboard navigation), Tauri 2.0 ACL capabilities, file save fixes, layout fixes, sidebar improvements (file/outline tabs, auto-sync, file tree icons), WYSIWYG Zen mode (StateField decorations with KaTeX/Mermaid/Prism.js/tables), Focus Mode, Typewriter Mode, Auto-save, Tab Rename, Image Drag & Drop (Tauri native drag events, path resolution, spellcheck settings).

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
│  │        Zustand Stores (5 stores)          │  │
│  └───────────────────────────────────────────┘  │
│              Rust IPC Commands                  │
│  (read_file, write_file, list_directory,        │
│   read_settings, write_settings)                │
└─────────────────────────────────────────────────┘
```

## Key Directories

| Directory    | Purpose                                                    |
| ------------ | ---------------------------------------------------------- |
| `src/`       | React frontend — components, stores, hooks, types, utils   |
| `src-tauri/` | Rust backend — Tauri commands, app config, icons           |
| `.docs/`     | Documentation — ADR, PRD, brand guidelines, wiki, planning |
| `tests/`     | E2E tests (Playwright, placeholder)                        |

## Configuration Files

| File                   | Purpose                                                                         |
| ---------------------- | ------------------------------------------------------------------------------- |
| `package.json`         | Dependencies, scripts (dev/build/lint/validate)                                 |
| `vite.config.ts`       | Build: path aliases, vendor chunk splitting (CM/Mermaid/markdown)               |
| `tsconfig.json`        | Strict TS, path aliases (@/, @components/, etc.)                                |
| `tailwind.config.js`   | Brand colors (electric-yellow, deep-blue), Inter/Pretendard fonts               |
| `eslint.config.js`     | ESLint v9 flat config, TS/React/a11y/import-order, perfectionist sort-jsx-props |
| `.prettierrc`          | No semi, single quote, 100 width, Tailwind class sort                           |
| `commitlint.config.js` | Conventional Commits enforcement                                                |
| `knip.config.js`       | Dead code detection configuration                                               |

## Key Components & Stores

### Stores (Zustand)

- `editorStore.ts` — Editor mode (split/source/zen), status messages, flash notifications
- `tabStore.ts` — Tab management (open/close/switch), content, filePath, dirty state tracking
- `sidebarStore.ts` — Sidebar state (open/width/resizing), active tab (files/outline/recent), file tree data, recent files. **Action**: `loadParentDirectory(filePath, openSidebar?)` loads directory entries and optionally opens sidebar
- `settingsStore.ts` — User preferences (theme, font, autosave, preview, editor settings), Tauri persistence
- `findReplaceStore.ts` — Find & replace state (query, replace text, case/regex/whole word, current match)

### Components

- `Sidebar.tsx` — Three tabs: Files (file tree), Outline (heading navigator), Recent (recent files list)
- `FileTree.tsx` — react-arborist tree with lazy directory loading. `containerHeight` starts at 0, measures via ResizeObserver, Tree only renders when height > 0 (prevents render errors)
- `FileTreeNode.tsx` — File/folder icons via `@react-symbols/icons/utils`: `FileIcon` with `autoAssign` prop, `FolderIcon` with `folderName` prop. Context menu for delete/duplicate
- `OutlinePanel.tsx` — Uses `flex-1 + min-h-0 + overflow-y-auto` for proper flex layout. Extracts headings from active tab via `useOutline` hook, click scrolls editor to line
- `App.tsx` — Watches `activeTabId` (useEffect), syncs sidebar via `sidebarStore.loadParentDirectory(tab.filePath)` when tab changes
- `MarkdownEditor.tsx` — CM6 editor with per-tab EditorState cache and compartment reconfiguration (theme/wysiwyg/gutter/focus/typewriter). Includes ordered-list `Tab` behavior that nests current item as `1.` (4-space indent) and renumbers following siblings.

### Utilities

- `tocPlugin.ts` — Custom markdown-it plugin. Adds slug-based IDs to headings (h1-h6), implements `[TOC]` block rule, generates TOC HTML via core rule with heading collection
- `directoryLoader.ts` — Wraps Tauri `list_directory` command, converts to `FileTreeNode[]` format
- `markdownConfig.ts` — markdown-it config for preview rendering (KaTeX inline/block with `throwOnError: false` + `strict: 'ignore'`, Prism highlighting, TOC plugin)

## For AI Agents

- **Code style**: `semi: false`, `singleQuote: true`, `arrowParens: 'avoid'`, `printWidth: 100`
- **JSX prop order**: eslint-plugin-perfectionist enforces: key → ref → identity props → aria-\* → className → unknown → multiline → shorthand → callbacks
- **Keyboard shortcuts**: Cmd+O (open), Cmd+S (save), Cmd+N (new tab), Cmd+\\ (mode cycle split/source/zen), Cmd+, (settings), Cmd+F (find), Cmd+H (find & replace), Shift+Cmd+E (toggle sidebar)
- **Path aliases**: `@/` → `src/`, `@components/` → `src/components/`, etc.
- **Zustand pattern**: Always use primitive-returning selectors (not object destructuring)
- **CM6 pattern**: Compartments in `useRef`, not module-level singletons
- **Derived state**: `isDirty = content !== savedContent` (not stored)
- **Sidebar sync**: `loadParentDirectory(filePath, openSidebar?)` consolidates directory loading logic
- **File tree icons**: Use `@react-symbols/icons/utils` — `FileIcon` auto-assigns by extension, `FolderIcon` by folder name
- **Accessibility**: ARIA attributes on interactive elements, prefers-reduced-motion support in CSS
- **Error boundaries**: Use ErrorBoundary component to wrap potentially error-throwing components
- **Type checking**: `npx tsc --noEmit` before committing
- **Linting**: `npx eslint src/` before committing
- **Dead code**: `npm run knip` to detect unused exports/dependencies
- **Build**: `npx vite build` to verify; `npm run tauri:build` for DMG

## Tech Stack

| Layer         | Technology                                                      |
| ------------- | --------------------------------------------------------------- |
| Desktop Shell | Tauri 2.0 (Rust)                                                |
| UI Framework  | React 19 + TypeScript (strict)                                  |
| Editor        | CodeMirror 6 (direct API)                                       |
| Markdown      | markdown-it + KaTeX + Mermaid + Prism.js + tocPlugin            |
| State         | Zustand (5 stores: editor, tab, sidebar, settings, findReplace) |
| Styling       | Tailwind CSS (dark mode: class-based)                           |
| Icons         | lucide-react + @react-symbols/icons (file/folder icons)         |
| File Tree     | react-arborist                                                  |
| Build         | Vite 7 + esbuild                                                |

## Git

- Branch strategy: feature branches → PR → main
- Commit style: Conventional Commits (`feat(editor):`, `fix(preview):`, etc.)
- Pre-commit: Husky + lint-staged + commitlint
