# BoltDown — Lightning-Fast Markdown Editor

## Purpose

Cross-platform desktop Markdown editor built with **Tauri 2.0** (Rust backend) + **React 19** (TypeScript frontend) + **CodeMirror 6** (editor engine). Phase 1 MVP complete. Phase 2 (89%): Settings System (4-category modal, Tauri persistence, theme presets, custom CSS editor), Find & Replace (Cmd+F/H, ReDoS protection, keyboard navigation), Tauri 2.0 modular architecture with clean separation of concerns, file save fixes, layout fixes, sidebar improvements (file/outline tabs, auto-sync, file tree icons), WYSIWYG Zen mode (StateField decorations with two-tier reveal, in-place code editing, KaTeX/Mermaid/Prism.js/tables), Focus Mode, Typewriter Mode, Auto-save, Tab Rename, Image Drag & Drop (Tauri native drag events, path resolution), Spellcheck (CM6 contentAttributes). Split view scroll sync (feat/scroll-sync branch): DOM-based mapping + anchor fallback, SmoothScroller, click-to-sync, offset correction. **WIG Compliance**: 18 accessibility fixes across 9 files (TabBar WAI-ARIA tabs, Header export menu keyboard nav, FileTreeNode context menu keyboard nav, SettingsModal form accessibility, FindReplaceModal ARIA, Footer live region, Sidebar decorative icons, App beforeunload guard, index.html preconnect).

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
│  (file ops, directory, settings)                │
│  Modular: commands/{file,directory,settings}    │
│  Error: unified AppError with thiserror         │
│  Utils: path validation with security           │
└─────────────────────────────────────────────────┘
```

## Key Directories

| Directory    | Purpose                                                    |
| ------------ | ---------------------------------------------------------- |
| `src/`       | React frontend — components, stores, hooks, types, utils   |
| `src-tauri/` | Rust backend — modular commands, error handling, utils     |
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
- `tabStore.ts` — Tab management (open/close/switch), content, filePath, dirty state tracking (`content !== savedContent`)
- `sidebarStore.ts` — Sidebar state (open/width/resizing), active tab (files/outline/recent), file tree data, recent files. **Action**: `loadParentDirectory(filePath, openSidebar?)` loads directory entries and optionally opens sidebar
- `settingsStore.ts` — User preferences (theme, font, autosave, preview, editor settings), Tauri persistence
- `findReplaceStore.ts` — Find & replace state (query, replace text, case/regex/whole word, current match)

### Components

- `App.tsx` — Root component with stable slot pattern (tabBar, toolbar, editor, preview hoisted outside render). Watches `activeTabId` via `useEffect`, syncs sidebar via `sidebarStore.loadParentDirectory(tab.filePath)`. Calls `useCustomCss()` hook to inject custom CSS from settings. **WIG**: `beforeunload` event handler warns about unsaved changes when closing window. Lazy-loads SettingsModal and FindReplaceModal with `lazy()` + `Suspense`.

- `Sidebar.tsx` — Three tabs: Files (file tree), Outline (heading navigator), Recent (recent files list). Decorative icon marked with `aria-hidden="true"`.

- `FileTree.tsx` — react-arborist tree with lazy directory loading. `containerHeight` starts at 0, measures via ResizeObserver, Tree only renders when height > 0 (prevents render errors).

- `FileTreeNode.tsx` — File/folder icons via `@react-symbols/icons/utils`: `FileIcon` with `autoAssign` prop, `FolderIcon` with `folderName` prop. Context menu for delete/duplicate with **keyboard navigation** (ArrowDown/Up/Escape), auto-focus first item, `role="menu"`, `role="menuitem"`, clear `aria-label` attributes.

- `TabBar.tsx` — **WAI-ARIA tabs pattern**: `role="tablist"`, `role="tab"`, roving tabindex (active = 0, inactive = -1), keyboard navigation (ArrowLeft/Right/Home/End), programmatic focus on tab switch. F2 triggers rename. Icons marked with `aria-hidden="true"`.

- `Header.tsx` — App header with export dropdown featuring **keyboard navigation** (ArrowDown/Up/Home/End/Escape), auto-focus first menu item on open.

- `Footer.tsx` — Status bar with **`aria-live="polite"` + `aria-atomic="true"`** on status text for screen reader announcements. Word/line/char count on right.

- `SettingsModal.tsx` — 4-category settings. **Form accessibility**: all Toggle components have `role="switch"`, `aria-checked`, `aria-label`; all Select/NumberInput have `aria-label`; dialog has `aria-labelledby` and `aria-modal="true"`; decorative icons marked with `aria-hidden="true"`. 6 theme presets, CustomCssEditor with 10240 char limit, CssReference panel.

- `FindReplaceModal.tsx` — Custom Find & Replace UI. **Full accessibility**: dialog with `aria-labelledby` and `aria-modal="true"`, toggle buttons with `aria-pressed` and `aria-label`, match counter with `role="status"`, `aria-live="polite"`, `aria-atomic="true"`, input fields with `aria-label`, all icons with `aria-hidden="true"`. ReDoS protection, debounced search, lazy line info, memoized rows.

- `MarkdownEditor.tsx` — CM6 editor with per-tab EditorState cache and compartment reconfiguration. Ordered-list Tab behavior, searchKeymap removed (replaced by FindReplaceModal).

- `ResizeHandle.tsx` — Draggable divider with **`role="separator"`, `aria-orientation="vertical"`, `aria-valuenow/min/max`** for current/min/max width.

### Utilities

- `tocPlugin.ts` — Custom markdown-it plugin. Adds slug-based IDs to headings (h1-h6), implements `[TOC]` block rule, generates TOC HTML via core rule with heading collection
- `directoryLoader.ts` — Wraps Tauri `list_directory` command, converts to `FileTreeNode[]` format
- `markdownConfig.ts` — markdown-it config for preview rendering (KaTeX inline/block with `throwOnError: false` + `strict: 'ignore'`, Prism highlighting, TOC plugin)

### Constants

- `constants/theme.ts` — THEME_PRESETS array (6 built-in themes with name/label/description/swatches/info/danger), THEME_MODES, DEFAULT_THEME_NAME, isBuiltInThemeName() validator
- `constants/settingsLimits.ts` — EDITOR_SETTING_LIMITS, PREVIEW_SETTING_LIMITS, GENERAL_SETTING_LIMITS, CUSTOM_CSS_LIMITS (maxLength: 10240, warningThreshold: 8192, debounceMs: 150), SETTINGS_DEFAULTS, SETTINGS_POLICY

## Tauri Backend (Modular Architecture)

### Structure

```
src-tauri/src/
├── lib.rs              — Entry point, plugin registration, command registration
├── commands/
│   ├── mod.rs          — Command module exports
│   ├── file.rs         — 6 file operations (read, write, rename, delete, copy, write_binary)
│   ├── directory.rs    — Directory listing with FileEntry struct
│   └── settings.rs     — Settings persistence via AppHandle.path().app_data_dir()
├── error.rs            — Unified AppError enum with thiserror
└── utils/
    ├── mod.rs          — Utility module exports
    └── path.rs         — Path validation, traversal protection, MAX_FILE_SIZE
```

### Commands

- **File Operations**: `read_file` (50MB limit), `write_file` (atomic .tmp), `rename_file`, `delete_file`, `copy_file`, `write_binary_file`
- **Directory**: `list_directory` (filters hidden/system dirs, returns FileEntry[])
- **Settings**: `read_settings`, `write_settings` (atomic .tmp, AppHandle pattern)

### Security

- All file operations use `validate_path()` to prevent directory traversal
- Paths are canonicalized to resolve symlinks and relative components
- New files validated by checking parent directory existence
- 50MB max file size for read operations

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
- **Accessibility**: ARIA attributes on interactive elements, prefers-reduced-motion support in CSS, decorative icons with `aria-hidden="true"`
- **Error boundaries**: Use ErrorBoundary component to wrap potentially error-throwing components
- **Type checking**: `npx tsc --noEmit` before committing
- **Linting**: `npx eslint src/` before committing
- **Dead code**: `npm run knip` to detect unused exports/dependencies
- **Build**: `npx vite build` to verify; `npm run tauri:build` for DMG

## Tech Stack

| Layer          | Technology                                                      |
| -------------- | --------------------------------------------------------------- |
| Desktop Shell  | Tauri 2.0 (Rust, modular architecture)                          |
| UI Framework   | React 19 + TypeScript (strict)                                  |
| Editor         | CodeMirror 6 (direct API)                                       |
| Markdown       | markdown-it + KaTeX + Mermaid + Prism.js + tocPlugin            |
| State          | Zustand (5 stores: editor, tab, sidebar, settings, findReplace) |
| Styling        | Tailwind CSS (dark mode: class-based)                           |
| Icons          | lucide-react + @react-symbols/icons (file/folder icons)         |
| File Tree      | react-arborist                                                  |
| Build          | Vite 7 + esbuild                                                |
| Error Handling | thiserror (Rust backend)                                        |

## Git

- Branch strategy: feature branches → PR → main
- Commit style: Conventional Commits (`feat(editor):`, `fix(preview):`, etc.)
- Pre-commit: Husky + lint-staged + commitlint
- Current branch: `refactor/tauri-backend` (modular Rust architecture)

## WIG Compliance Summary

✅ **18 Accessibility Fixes Across 9 Files**:

1. **TabBar**: WAI-ARIA tabs pattern with roving tabindex, keyboard nav (ArrowLeft/Right/Home/End)
2. **Header**: Export menu keyboard nav (ArrowDown/Up/Home/End/Escape), auto-focus first item
3. **FileTreeNode**: Context menu keyboard nav (ArrowDown/Up/Escape), auto-focus first item
4. **SettingsModal**: Form accessibility (aria-label on Toggle/Select/NumberInput), aria-labelledby on dialog, aria-hidden on decorative icons
5. **FindReplaceModal**: aria-labelledby on dialog, toggle buttons with aria-pressed, live region for match counter
6. **Footer**: aria-live="polite" + aria-atomic="true" on status text
7. **Sidebar**: aria-hidden on decorative icon
8. **App.tsx**: beforeunload guard for unsaved changes
9. **index.html**: preconnect for KaTeX CDN
