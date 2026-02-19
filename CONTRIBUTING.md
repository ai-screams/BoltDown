# Contributing to BoltDown

Thank you for your interest in contributing to BoltDown! This guide covers everything you need to get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Testing](#testing)
- [Architecture Guidelines](#architecture-guidelines)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

Be respectful, constructive, and collaborative. We welcome contributors of all experience levels.

---

## Getting Started

### Prerequisites

| Tool      | Version | Install                           |
| --------- | ------- | --------------------------------- |
| Node.js   | 20+     | [nodejs.org](https://nodejs.org/) |
| npm       | 9+      | Comes with Node.js                |
| Rust      | stable  | [rustup.rs](https://rustup.rs/)   |
| Tauri CLI | 2.0     | `cargo install tauri-cli`         |

**System dependencies (Linux only):**

```bash
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

---

## Development Setup

```bash
# Clone the repository
git clone https://github.com/ai-screams/BoltDown.git
cd BoltDown

# Install dependencies
npm install

# Start development server (frontend + Tauri)
npm run tauri:dev

# Or frontend only (opens in browser)
npm run dev
```

### Useful Commands

| Command                | Description                                  |
| ---------------------- | -------------------------------------------- |
| `npm run tauri:dev`    | Start Tauri app in development mode          |
| `npm run dev`          | Start Vite dev server (frontend only)        |
| `npm run validate`     | Run all checks (mirrors CI pipeline)         |
| `npm run test:run`     | Run Vitest unit tests                        |
| `npm run test:ui`      | Run Vitest with interactive UI               |
| `npm run lint`         | Run ESLint                                   |
| `npm run lint:fix`     | Run ESLint with auto-fix                     |
| `npm run format`       | Format code with Prettier                    |
| `npm run format:check` | Check formatting without modifying           |
| `npm run type-check`   | TypeScript type checking                     |
| `npm run rust:clippy`  | Run Rust linter                              |
| `npm run rust:test`    | Run Rust unit tests                          |
| `npm run knip`         | Detect unused exports/dependencies           |
| `npm run tauri:build`  | Build production binary for current platform |

### Validate Before Committing

Always run `npm run validate` before pushing. This mirrors the CI pipeline:

```
tsc --noEmit → eslint → prettier --check → cargo fmt --check → cargo clippy → vitest → cargo test
```

---

## Project Structure

```
src/                  React frontend
├── components/       UI components (App, Editor, Sidebar, Settings, etc.)
├── stores/           Zustand state management (5 stores)
├── hooks/            Custom React hooks
├── extensions/       CodeMirror 6 extensions (wysiwyg, vim, find)
├── constants/        Theme presets, settings limits
├── types/            TypeScript type definitions
├── utils/            Utility functions (sanitize, cache, markdown config)
└── styles/           Shared CSS (tokens, code-block styling)

src-tauri/            Rust backend
├── src/
│   ├── lib.rs        Entry point, plugin & command registration
│   ├── error.rs      Unified AppError enum (thiserror)
│   ├── commands/     IPC command modules (file, directory, settings, ime)
│   └── utils/        Path validation, security utilities
├── Cargo.toml        Rust dependencies
└── tauri.conf.json   Tauri configuration

.github/workflows/    CI/CD pipelines
.docs/                Documentation (ADR, PRD, planning)
tests/                E2E tests (Playwright)
```

---

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feat/my-feature    # New feature
git checkout -b fix/bug-name       # Bug fix
git checkout -b docs/update-readme # Documentation
```

Branch naming: `{type}/{short-description}`

### 2. Make Changes

- Follow the [Code Style](#code-style) guidelines
- Write tests for new functionality
- Update documentation if needed

### 3. Validate

```bash
npm run validate
```

### 4. Commit

Follow [Conventional Commits](#commit-messages). Pre-commit hooks (Husky + lint-staged) automatically lint and format staged files.

### 5. Push & Open PR

```bash
git push -u origin feat/my-feature
```

Open a Pull Request against `main`. See [Pull Requests](#pull-requests) for guidelines.

---

## Code Style

### TypeScript / React

- **No semicolons**, single quotes, 100 char line width
- Arrow parens: `avoid` (omit parens for single params)
- Trailing commas: `es5`
- End of line: `lf`
- JSX prop ordering enforced by `eslint-plugin-perfectionist`:
  `key → ref → identity props → aria-* → className → unknown → multiline → shorthand → callbacks`

```typescript
// Good
const greeting = (name: string) => `Hello, ${name}!`

// Bad
const greeting = (name: string) => {
  return `Hello, ${name}!`
}
```

### Zustand Stores

Always use **primitive-returning selectors** — never destructure objects from selectors:

```typescript
// Good
const mode = useEditorStore(s => s.mode)
const filePath = useTabStore(s => s.activeTab?.filePath)

// Bad — causes unnecessary re-renders
const { mode, setMode } = useEditorStore()
```

### CodeMirror 6

- Compartments go in `useRef`, **never** module-level singletons
- Extensions are reconfigured via compartment `.reconfigure()`

```typescript
// Good
const themeCompRef = useRef(new Compartment())

// Bad
const themeComp = new Compartment() // module-level singleton
```

### Rust

- Follow standard Rust formatting (`cargo fmt`)
- All warnings treated as errors (`cargo clippy -- -D warnings`)
- Use `thiserror` for error types
- All file operations must use `validate_path()` for security

### CSS

- Tailwind CSS utility classes preferred
- Dark mode: `class`-based strategy
- Custom component styles in `src/styles/`

---

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint.

### Format

```
type(scope): description

[optional body]

[optional footer]
```

### Types

| Type       | When to use                                             |
| ---------- | ------------------------------------------------------- |
| `feat`     | New feature                                             |
| `fix`      | Bug fix                                                 |
| `docs`     | Documentation only                                      |
| `style`    | Formatting, no code change                              |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                                 |
| `test`     | Adding or updating tests                                |
| `build`    | Build system or external dependencies                   |
| `ci`       | CI/CD configuration                                     |
| `chore`    | Maintenance tasks                                       |
| `revert`   | Reverts a previous commit                               |

### Scopes (25)

| Category           | Scopes                                                                        |
| ------------------ | ----------------------------------------------------------------------------- |
| **Core**           | `editor`, `preview`, `parser`, `math`, `diagram`, `vim`, `find`               |
| **UI**             | `ui`, `sidebar`, `tab`, `tree`, `settings`, `theme`                           |
| **Infrastructure** | `store`, `file`, `export`, `config`, `deps`, `rust`, `tauri`, `ci`, `release` |
| **Cross-cutting**  | `a11y`, `security`, `perf`                                                    |

### Examples

```bash
feat(editor): add bracket auto-closing
fix(preview): resolve scroll sync jitter on large files
docs: update CONTRIBUTING.md with new scopes
perf(editor): memoize expensive decoration computation
refactor(store): extract file operations into separate module
```

### Rules

- Subject: lowercase, no period at end, imperative mood
- Body: wrap at 100 characters, separated by blank line
- Breaking changes: add `!` after type/scope (e.g., `feat(editor)!: redesign extension API`)

---

## Pull Requests

### Requirements

- **1 PR = 1 purpose** — Don't mix features with bug fixes
- All CI checks pass (`npm run validate` locally)
- PR title follows Conventional Commits format (it becomes the squash merge commit message)
- Description explains **what** and **why**

### PR Title Examples

```
feat(editor): add bracket auto-closing
fix(preview): resolve scroll sync jitter on large files
docs: update architecture documentation
```

### Merge Strategy

We use **squash merge only**. Your PR title becomes the commit message on `main`. This means:

- Keep your PR title clean and descriptive
- Individual commits in your PR branch don't need to be perfect
- The squash commit determines version bumps:
  - `feat:` → minor version bump
  - `fix:` → patch version bump

---

## Testing

### Unit Tests (Vitest)

```bash
npm run test:run        # Run once
npm run test            # Watch mode
npm run test:ui         # Interactive UI
npm run test:coverage   # With coverage report
```

Test files live next to their source: `foo.ts` → `foo.test.ts`

### Rust Tests

```bash
npm run rust:test
# or
cd src-tauri && cargo test
```

### E2E Tests (Playwright)

```bash
npm run test:e2e        # Run Playwright tests
npm run test:e2e:ui     # Interactive mode
```

### Manual Cross-Platform Testing

We develop primarily on macOS ARM64. If you have access to **Windows**, **Linux**, or **macOS Intel**, your testing help is invaluable. See [Issue #39](https://github.com/ai-screams/BoltDown/issues/39) for our testing checklist.

---

## Architecture Guidelines

### State Management

- 5 Zustand stores: `editorStore`, `tabStore`, `sidebarStore`, `settingsStore`, `findReplaceStore`
- Derived state computed at render time (e.g., `isDirty = content !== savedContent`)
- No object selectors — always return primitives

### Security

- All HTML rendering passes through DOMPurify (`src/utils/sanitize.ts`)
- All Rust file operations use `validate_path()` to prevent directory traversal
- Custom CSS is sanitized to block `@import`, external URLs, and JS execution
- Max file size: 50 MB for read operations

### Accessibility

- Interactive elements require ARIA attributes
- Decorative icons use `aria-hidden="true"`
- Status updates use `aria-live` regions
- Keyboard navigation for all UI components
- `prefers-reduced-motion` respected in animations

### Performance

- Lazy-load heavy components (`React.lazy` + `Suspense`)
- LRU caching for KaTeX and Mermaid renders
- Vendor chunk splitting (CodeMirror, Mermaid, markdown-it)
- Debounce expensive operations (search, preview render)

---

## Reporting Bugs

[Open a bug report](https://github.com/ai-screams/BoltDown/issues/new?labels=bug) with:

1. **Environment** — OS, architecture, display scale, app version
2. **Steps to reproduce** — Exact sequence to trigger the bug
3. **Expected behavior** — What should happen
4. **Actual behavior** — What actually happens
5. **Screenshots / recordings** — If applicable
6. **Console logs** — Open DevTools with `F12` if relevant

---

## Requesting Features

[Open a feature request](https://github.com/ai-screams/BoltDown/issues/new?labels=enhancement) with:

1. **Problem** — What pain point does this address?
2. **Proposed solution** — How would it work?
3. **Alternatives considered** — Other approaches you thought of
4. **Additional context** — Mockups, examples from other apps, etc.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
