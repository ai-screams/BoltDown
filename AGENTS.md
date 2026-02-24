# BoltDown — Lightning-Fast Markdown Editor

## Purpose

Cross-platform desktop Markdown editor built with **Tauri 2.0** (Rust backend) + **React 19** (TypeScript frontend) + **CodeMirror 6** (editor engine). Phase 1 and Phase 2 are complete, and post-Phase-2 waves are also merged (live mode parity updates, ordered-list normalization, split sync hardening, table editing stabilization, and fenced code-block boundary navigation with code-block-scoped `Mod+A`). WYSIWYG decorations run in both **live** and **zen** modes via StateField-based rendering. **Vim Mode**: Optional vim keybindings via `@replit/codemirror-vim` with CJK IME auto-switch (macOS Carbon FFI for Normal→ASCII, Insert→restore). **WIG Compliance**: 18 accessibility fixes across 9 files (TabBar WAI-ARIA tabs, Header export menu keyboard nav, FileTreeNode context menu keyboard nav, SettingsModal form accessibility, FindReplaceModal ARIA, Footer live region, Sidebar decorative icons, App beforeunload guard, index.html preconnect). **Auto-Updater**: In-app update system via `tauri-plugin-updater` with Tauri signing keys (not Apple codesign), GitHub Releases `latest.json` endpoint, module-level pub/sub state management, and `useSyncExternalStore` for React integration.

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
│  (file ops, directory, settings, IME)           │
│  Modular: commands/{file,directory,settings,ime}│
│  Error: unified AppError with thiserror         │
│  Utils: path validation with security           │
└─────────────────────────────────────────────────┘
```

## Key Directories

| Directory     | Purpose                                                    |
| ------------- | ---------------------------------------------------------- |
| `src/`        | React frontend — components, stores, hooks, types, utils   |
| `src/styles/` | Shared CSS layers (tokens, code-block line/badge styling)  |
| `src-tauri/`  | Rust backend — modular commands, error handling, utils     |
| `.docs/`      | Documentation — ADR, PRD, brand guidelines, wiki, planning |
| `tests/`      | E2E tests (Playwright, placeholder)                        |

## Configuration Files

| File                            | Purpose                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `package.json`                  | Dependencies, scripts (dev/build/lint/validate)                                 |
| `vite.config.ts`                | Build: path aliases, vendor chunk splitting (CM/Mermaid/markdown)               |
| `tsconfig.json`                 | Strict TS, path aliases (@/, @components/, etc.)                                |
| `tailwind.config.js`            | Brand colors (electric-yellow, deep-blue), Inter/Pretendard fonts               |
| `eslint.config.js`              | ESLint v9 flat config, TS/React/a11y/import-order, perfectionist sort-jsx-props |
| `.prettierrc`                   | No semi, single quote, 100 width, Tailwind class sort                           |
| `commitlint.config.js`          | Conventional Commits enforcement (25 scopes)                                    |
| `package-lock.json`             | npm dependency lockfile                                                         |
| `release-please-config.json`    | Release-please: node release type, extra-files (Cargo.toml, tauri.conf.json)    |
| `.release-please-manifest.json` | Release-please: current version tracking                                        |
| `.node-version`                 | Node.js version pin (22) for CI `node-version-file` and local tooling           |
| `src-tauri/rust-toolchain.toml` | Rust toolchain pin (stable) with rustfmt + clippy components                    |

## Key Components & Stores

### Stores (Zustand)

- `editorStore.ts` — Editor mode (split/source/live/zen), status messages, flash notifications
- `tabStore.ts` — Tab management (open/close/switch), content, filePath, dirty state tracking (`content !== savedContent`)
- `sidebarStore.ts` — Sidebar state (open/width/resizing), active tab (files/outline/recent), file tree data, recent files. **Action**: `loadParentDirectory(filePath, openSidebar?)` loads directory entries and optionally opens sidebar
- `settingsStore.ts` — User preferences (theme, font, autosave, preview, editor settings incl. vimMode), Tauri persistence
- `findReplaceStore.ts` — Find & replace state (query, replace text, case/regex/whole word, current match)

### Components

- `App.tsx` — Root component with stable slot pattern (tabBar, toolbar, editor, preview hoisted outside render). Watches `activeTabId` via `useEffect`, syncs sidebar via `sidebarStore.loadParentDirectory(tab.filePath)`. Calls `useCustomCss()` hook to inject custom CSS from settings. Calls `useAutoUpdate()` hook and renders `<UpdateNotification />` banner. **WIG**: `beforeunload` event handler warns about unsaved changes when closing window. Lazy-loads SettingsModal, FindReplaceModal, ShortcutsModal, ChangelogModal, and AboutModal with `lazy()` + `Suspense`.

- `Sidebar.tsx` — Three tabs: Files (file tree), Outline (heading navigator), Recent (recent files list). Decorative icon marked with `aria-hidden="true"`.

- `FileTree.tsx` — react-arborist tree with lazy directory loading. `containerHeight` starts at 0, measures via ResizeObserver, Tree only renders when height > 0 (prevents render errors).

- `FileTreeNode.tsx` — File/folder icons via `@react-symbols/icons/utils`: `FileIcon` with `autoAssign` prop, `FolderIcon` with `folderName` prop. Context menu for delete/duplicate with **keyboard navigation** (ArrowDown/Up/Escape), auto-focus first item, `role="menu"`, `role="menuitem"`, clear `aria-label` attributes.

- `TabBar.tsx` — **WAI-ARIA tabs pattern**: `role="tablist"`, `role="tab"`, roving tabindex (active = 0, inactive = -1), keyboard navigation (ArrowLeft/Right/Home/End), programmatic focus on tab switch. F2 triggers rename. Icons marked with `aria-hidden="true"`.

- `Header.tsx` — App header with mode toggle button and export dropdown. **Mode toggle**: Visual order is `[Live, Split, Source]` (intuitive first impression); actual `Cmd+\` cycle is `split → source → live`. All controls feature **keyboard navigation** (ArrowDown/Up/Home/End/Escape), auto-focus first menu item on open.

- `Footer.tsx` — Status bar with **`aria-live="polite"` + `aria-atomic="true"`** on status text for screen reader announcements. Word/line/char count on right.

- `SettingsModal.tsx` — 4-category settings. **Form accessibility**: all Toggle components have `role="switch"`, `aria-checked`, `aria-label`; all Select/NumberInput have `aria-label`; dialog has `aria-labelledby` and `aria-modal="true"`; decorative icons marked with `aria-hidden="true"`. 6 theme presets, CustomCssEditor with 10240 char limit, CssReference panel. EditorPanel includes **Vim Mode** toggle. GeneralPanel includes **Auto Update** toggle + **Check Now** button.

- `FindReplaceModal.tsx` — Custom Find & Replace UI. **Full accessibility**: dialog with `aria-labelledby` and `aria-modal="true"`, toggle buttons with `aria-pressed` and `aria-label`, match counter with `role="status"`, `aria-live="polite"`, `aria-atomic="true"`, input fields with `aria-label`, all icons with `aria-hidden="true"`. ReDoS protection, debounced search, lazy line info, memoized rows.

- `MarkdownEditor.tsx` — CM6 editor with per-tab EditorState cache and compartment reconfiguration. Ordered-list Tab behavior, code-block boundary keymap compartment (`codeBlockArrowNavCompRef`) for `ArrowUp`/`ArrowDown` + code-block-scoped `Mod+A` in live/zen mode, searchKeymap removed (replaced by FindReplaceModal). **Vim mode**: `vimCompRef` compartment hot-toggles `@replit/codemirror-vim` extension + CJK IME guard (`vimIME.ts`); `Vim.defineEx` registers `:w`/`:q`/`:wq` commands. **UI Polish**: Live/zen modes apply `max-w-4xl` (896px) with `mx-auto` centering for optimal markdown reading width (~112 chars/line).

- `UpdateNotification.tsx` — Update banner with `useSyncExternalStore` subscribing to module-level pub/sub store. Shows available/downloading/ready/error states, download progress bar (bytes/percentage separated), restart button. Full accessibility: `role="status"`, `aria-live="polite"`, `aria-valuemin`/`aria-valuemax`/`aria-valuenow` on progress bar.

- `ResizeHandle.tsx` — Draggable divider with **`role="separator"`, `aria-orientation="vertical"`, `aria-label="Resize sidebar"`**.

### Utilities

- `tocPlugin.ts` — Custom markdown-it plugin. Adds slug-based IDs to headings (h1-h6), implements `[TOC]` block rule, generates TOC HTML via core rule with heading collection
- `directoryLoader.ts` — Wraps Tauri `list_directory` command, converts to `FileTreeNode[]` format
- `markdownConfig.ts` — markdown-it config for preview rendering (KaTeX inline/block with `throwOnError: false` + `strict: 'ignore'`, Prism highlighting, TOC plugin)
- `sanitize.ts` — DOMPurify sanitization with 5 profiles: `sanitizePreviewHtml` (preview + scroll sync data-\* attrs), `sanitizeKatexHtml` (WYSIWYG widgets), `sanitizeCodeHtml` (Prism.js), `sanitizeSvgHtml` (Mermaid), `sanitizeCustomCss` (blocks @import, external URLs, JS execution)
- `cache.ts` — Generic `LruCache<V>` class (Map-based LRU eviction). Used by wysiwyg/ extension modules (KaTeX/Mermaid caching) and MarkdownPreview.tsx (Mermaid caching)
- `fileCopy.ts` — `findAvailableCopyPath()` — single `list_directory` IPC call for duplicate file naming (generates "file (copy).md", "file (copy 2).md", etc.)

### Constants

- `constants/theme.ts` — THEME_PRESETS array (6 built-in themes with name/label/description/swatches/info/danger), THEME_MODES, DEFAULT_THEME_NAME, isBuiltInThemeName() validator
- `constants/settingsLimits.ts` — EDITOR_SETTING_LIMITS, PREVIEW_SETTING_LIMITS, GENERAL_SETTING_LIMITS, CUSTOM_CSS_LIMITS (maxLength: 10240, warningThreshold: 8192, debounceMs: 150), SETTINGS_DEFAULTS (incl. `vimMode: false`, `autoUpdate: true`), SETTINGS_POLICY

## Tauri Backend (Modular Architecture)

### Structure

```
src-tauri/src/
├── lib.rs              — Entry point, plugin registration, command registration
├── commands/
│   ├── mod.rs          — Command module exports
│   ├── file.rs         — 6 file operations (read, write, rename, delete, copy, write_binary)
│   ├── directory.rs    — Directory listing with FileEntry struct
│   ├── settings.rs     — Settings persistence via AppHandle.path().app_data_dir()
│   └── ime.rs          — macOS IME control via Carbon FFI (TIS API)
├── error.rs            — Unified AppError enum with thiserror
└── utils/
    ├── mod.rs          — Utility module exports
    └── path.rs         — Path validation, traversal protection, MAX_FILE_SIZE
```

### Commands

- **File Operations**: `read_file` (50MB limit), `write_file` (atomic .tmp), `rename_file`, `delete_file`, `copy_file`, `write_binary_file`
- **Directory**: `list_directory` (filters hidden/system dirs, returns FileEntry[])
- **Settings**: `read_settings`, `write_settings` (atomic .tmp, AppHandle pattern)
- **IME**: `get_input_source`, `select_ascii_input`, `select_input_source`, `ime_save_and_switch_ascii` (macOS Carbon TIS API for CJK vim mode support)

### Security

- All file operations use `validate_path()` to prevent directory traversal
- Paths are canonicalized to resolve symlinks and relative components
- New files validated by checking parent directory existence
- 50MB max file size for read operations

## For AI Agents

- **Code style**: `semi: false`, `singleQuote: true`, `arrowParens: 'avoid'`, `printWidth: 100`
- **JSX prop order**: eslint-plugin-perfectionist enforces: key → ref → identity props → aria-\* → className → unknown → multiline → shorthand → callbacks
- **Keyboard shortcuts**: Cmd+O (open), Cmd+S (save), Cmd+Shift+S (save as), Cmd+N (new tab), Cmd+\\ (mode cycle: split → source → live, repeats), Cmd+Shift+Z (toggle zen from any mode), Escape (zen → live), Cmd+, (settings), Cmd+F (find), Cmd+H (find & replace), Shift+Cmd+E (toggle sidebar), Shift+Cmd+/ (shortcuts help). **Note**: Header toggle button shows visual order [Live, Split, Source] for UX, but actual cycle is [split, source, live]
- **Path aliases**: `@/` → `src/`, `@components/` → `src/components/`, etc.
- **Zustand pattern**: Always use primitive-returning selectors (not object destructuring)
- **CM6 pattern**: Compartments in `useRef`, not module-level singletons
- **Vim mode pattern**: `vimCompRef` compartment hot-toggles vim extension + IME guard; `Vim.defineEx` for Ex commands; CJK IME auto-switch via `vim-mode-change` synchronous event + `compositionstart` defense
- **Code-block keymap wiring**: keep `codeBlockArrowNavigationKeymap()` model/keymap/compartment wiring aligned (`codeBlockArrowNavigationModel.ts` ↔ `codeBlockArrowNavigationKeymap.ts` ↔ `MarkdownEditor.tsx` compartment reconfigure path)
- **Derived state**: `isDirty = content !== savedContent` (not stored)
- **Sidebar sync**: `loadParentDirectory(filePath, openSidebar?)` consolidates directory loading logic
- **File tree icons**: Use `@react-symbols/icons/utils` — `FileIcon` auto-assigns by extension, `FolderIcon` by folder name
- **UI Layout Constraints**: Live/zen modes apply `max-w-4xl` (896px, ~112 chars/line optimal for markdown reading), split mode applies `max-w-3xl` (768px, ~96 chars/line) to preview with editor full-width, source mode has no preview. Choices based on typography research (Wikipedia Line Length).
- **Accessibility**: ARIA attributes on interactive elements, prefers-reduced-motion support in CSS, decorative icons with `aria-hidden="true"`
- **Error boundaries**: Use ErrorBoundary component to wrap potentially error-throwing components
- **Type checking**: `npx tsc --noEmit` before committing
- **Linting**: `npx eslint src/` before committing
- **Dead code**: `npm run knip` to detect unused exports/dependencies
- **Build**: `npx vite build` to verify; `npm run tauri:build` for DMG

## Code Block Maintenance Contract

- Keep decoration/CSS coupling in sync: `buildDecorations.ts` emits `codeblock-line`, `codeblock-fence-hidden-line`, badge/popover classes and `data-*` attributes that are consumed by `src/styles/codeblock.css`.
- Keep language list coupling in sync: `KNOWN_LANGUAGES` in `CodeBlockWidget.ts` drives both badge popover autocomplete and fence completion via `fenceLanguageCompletion.ts`.
- Keep keymap model wiring in sync: update both `codeBlockArrowNavigationModel.ts` and `codeBlockArrowNavigationKeymap.ts`, and keep `MarkdownEditor.tsx` `codeBlockArrowNavCompRef` live/zen reconfigure behavior intact.
- Update tests with behavior changes: at minimum `codeBlockArrowNavigationModel.test.ts` and `codeBlockBadge.test.ts`; include widget-level tests when `ignoreEvent`, dataset attributes, or popover behavior changes.

## Tech Stack

| Layer          | Technology                                                       |
| -------------- | ---------------------------------------------------------------- |
| Desktop Shell  | Tauri 2.0 (Rust, modular architecture)                           |
| UI Framework   | React 19 + TypeScript (strict)                                   |
| Editor         | CodeMirror 6 (direct API) + @replit/codemirror-vim (optional)    |
| Markdown       | markdown-it + KaTeX + Mermaid + Prism.js + tocPlugin             |
| State          | Zustand (5 stores: editor, tab, sidebar, settings, findReplace)  |
| Styling        | Tailwind CSS (dark mode: class-based)                            |
| Icons          | lucide-react + @react-symbols/icons (file/folder icons)          |
| File Tree      | react-arborist                                                   |
| Build          | Vite 7 + esbuild                                                 |
| Auto-Update    | tauri-plugin-updater + tauri-plugin-process (Tauri signing keys) |
| Error Handling | thiserror (Rust backend)                                         |

## CI/CD

### Workflows

| Workflow        | File                   | Trigger                             | Purpose                                                  |
| --------------- | ---------------------- | ----------------------------------- | -------------------------------------------------------- |
| CI              | `ci.yaml`              | PR to main/develop, push to develop | Orchestrator: lint → (test ∥ build), security (parallel) |
| Lint & Format   | `quality-lint.yaml`    | `workflow_call`                     | TS type-check, ESLint, Prettier, rustfmt, clippy         |
| Test            | `quality-test.yaml`    | `workflow_call`                     | Vitest + Cargo test                                      |
| Build           | `build.yaml`           | `workflow_call`                     | Vite build + cargo check verification (Linux only)       |
| Security Scan   | `security-scan.yaml`   | `workflow_call`                     | npm audit + cargo audit                                  |
| Weekly Security | `security-weekly.yaml` | cron (Sun 00:00 UTC)                | Scheduled security scan                                  |
| Release         | `release-please.yaml`  | push to main                        | release-please + tauri-action cross-platform build       |

### CI Job DAG

```
PR / push(develop)
    │
    ├── lint ──┬── test     (parallel after lint)
    │          └── build    (parallel after lint)
    └── security            (independent, parallel)
```

### Release Flow

```
feat/fix commits merge to main
    → release-please creates Release PR (version bump + CHANGELOG)
    → maintainer merges Release PR
    → GitHub Release created + build-tauri 4-way parallel
    → Assets uploaded: DMG (ARM64/x64), MSI, NSIS exe, deb, AppImage, rpm
    → Signed updater artifacts (.sig files) + latest.json for auto-update
```

### Trigger Optimization

- **PR merge to main**: CI skipped (already validated in PR), only release-please runs
- **docs-only changes**: CI skipped via `paths-ignore` (`**.md`, `.docs/**`, `LICENSE`)
- **concurrency**: PR-number-based grouping, cancel-in-progress on new push
- **GITHUB_TOKEN limitation**: tag-triggered workflows won't fire from GITHUB_TOKEN-created tags, so build-tauri is integrated into release-please.yaml as conditional job

### Release Versioning (Semantic)

- `feat:` → minor bump (0.1.0 → 0.2.0)
- `fix:` → patch bump (0.1.0 → 0.1.1)
- `feat!:` / `BREAKING CHANGE:` → minor during 0.x, major after 1.0
- Version sync: `package.json` + `Cargo.toml` + `tauri.conf.json` via release-please `extra-files`

## Git

- Branch strategy: feature branches → PR → main
- Commit style: Conventional Commits (`feat(editor):`, `fix(preview):`, etc.)
- Scopes (25): editor, preview, parser, math, diagram, vim, find, ui, sidebar, tab, tree, settings, theme, store, file, export, config, deps, rust, tauri, ci, release, a11y, security, perf
- Pre-commit: Husky + lint-staged + commitlint
- Current branch is workspace-dependent; verify with `git branch --show-current`

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
