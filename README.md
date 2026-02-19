# ⚡ BoltDown

**Lightning-fast Markdown editor. 10x smaller than Electron apps.**

<div align="center">

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131.svg)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev)

[📦 Download](https://github.com/ai-screams/BoltDown/releases) · [🐛 Report Bug](https://github.com/ai-screams/BoltDown/issues) · [📐 Architecture](.docs/adr/)

</div>

---

## 🤔 Why BoltDown?

> **Electron apps are gas-guzzling SUVs. BoltDown is a Tesla.**

|             | ⚡ BoltDown         | Typora      | Obsidian    |
| ----------- | ------------------- | ----------- | ----------- |
| **Size**    | **~7 MB** 🪶        | ~120 MB     | ~100 MB     |
| **Memory**  | **50-100 MB** 💨    | 200-500 MB  | 300-400 MB  |
| **Startup** | **< 1 second** 🚀   | 2-3 seconds | 2-3 seconds |
| **Price**   | **Free** 🎉         | $14.99      | Free        |
| **Engine**  | **Tauri (Rust)** 🦀 | Electron    | Electron    |

BoltDown is a native desktop Markdown editor built with Tauri 2.0 and Rust. It launches instantly, stays light on memory, and gives you a complete writing experience — without the Electron baggage.

---

## ✨ Features

### ✍️ Writing Experience

- **Live Preview** — WYSIWYG editing that renders Markdown as you type. Bold, italic, headings, links, and images display inline with real formatting.
- **Split View** — Source code on the left, rendered preview on the right, with synchronized scrolling.
- **Source Mode** — Clean, distraction-free code editing when you want full control.
- **Zen Mode** 🧘 — Full-screen writing with nothing but your text. Press `Escape` to return.

### 📦 Rich Content

- **Math** 🧮 — LaTeX equations with KaTeX. Inline `$E=mc^2$` and block `$$...$$` with real-time rendering.
- **Diagrams** 📊 — Mermaid flowcharts, sequence diagrams, Gantt charts, and more — rendered live in the editor.
- **Code Blocks** 💻 — Syntax highlighting for 100+ languages with language badges, autocomplete, and boundary navigation.
- **Tables** 📋 — Interactive WYSIWYG table editing. Add/remove rows and columns, set alignment, resize — all in place.
- **Table of Contents** 🗂️ — Type `[TOC]` anywhere to generate a linked table of contents from your headings.

### 🛠️ Editor Features

- **Tabs** — Work with multiple files at once. Drag, rename, close — with unsaved change indicators.
- **File Tree** 📂 — Sidebar with folder navigation, file icons by type, and context menus for file operations.
- **Outline Panel** — Navigate your document by heading structure.
- **Find & Replace** 🔍 — Full-featured search with regex, case sensitivity, whole word matching, and live match counter.
- **Focus Mode** 🎯 — Dims all lines except where your cursor is, helping you concentrate on the current paragraph.
- **Typewriter Mode** ⌨️ — Keeps your active line vertically centered as you type.
- **Vim Mode** 🖥️ — Optional vim keybindings with `:w`, `:q`, `:wq` commands. CJK users get automatic input method switching (Normal → English, Insert → restore previous).
- **Auto-Save** 💾 — Configurable automatic saving so you never lose work.
- **Spellcheck** ✏️ — Native spellcheck with underline indicators.
- **Export** 📤 — Save your work as HTML or PDF.

### 🎨 Customization

- **6 Built-in Themes** — Bolt, Sepia, Nord, Contrast, Meadow, and Vivid — each with light and dark variants.
- **Custom CSS** — Write your own CSS overrides with a built-in editor, live preview, and reference guide.
- **Editor Settings** — Font family, font size, line height, tab size, line numbers, and more.

### ♿ Accessibility

- Full keyboard navigation throughout the app
- WAI-ARIA compliant tabs, menus, dialogs, and form controls
- Screen reader support with live regions for status updates
- `prefers-reduced-motion` respected

---

## 📥 Install

### 🍎 macOS

Download the `.dmg` file from the [latest release](https://github.com/ai-screams/BoltDown/releases), open it, and drag BoltDown to your Applications folder.

> 💡 **Apple Silicon and Intel** — We provide separate builds for each architecture for the best native performance.

### 🪟 Windows

Download the `.msi` installer from the [latest release](https://github.com/ai-screams/BoltDown/releases) and run it.

### 🐧 Linux

Download the `.AppImage` or `.deb` package from the [latest release](https://github.com/ai-screams/BoltDown/releases).

```bash
# Debian / Ubuntu
sudo dpkg -i boltdown_*.deb

# AppImage (any distro)
chmod +x BoltDown_*.AppImage
./BoltDown_*.AppImage
```

---

## ⌨️ Keyboard Shortcuts

| Action         | macOS         | Windows/Linux  |
| -------------- | ------------- | -------------- |
| New tab        | `Cmd+N`       | `Ctrl+N`       |
| Open file      | `Cmd+O`       | `Ctrl+O`       |
| Save           | `Cmd+S`       | `Ctrl+S`       |
| Save as        | `Cmd+Shift+S` | `Ctrl+Shift+S` |
| Find           | `Cmd+F`       | `Ctrl+F`       |
| Find & Replace | `Cmd+H`       | `Ctrl+H`       |
| Cycle mode     | `Cmd+\`       | `Ctrl+\`       |
| Zen mode       | `Cmd+Shift+Z` | `Ctrl+Shift+Z` |
| Toggle sidebar | `Cmd+Shift+E` | `Ctrl+Shift+E` |
| Settings       | `Cmd+,`       | `Ctrl+,`       |
| Shortcuts help | `Cmd+Shift+/` | `Ctrl+Shift+/` |

---

## 🧑‍💻 Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (stable)
- [Tauri CLI](https://tauri.app/start/create-project/) 2.0

### Setup

```bash
git clone https://github.com/ai-screams/BoltDown.git
cd BoltDown
npm install
npm run tauri:dev
```

### Build

```bash
# Build for your current platform
npm run tauri:build

# macOS DMG only
npm run tauri build -- --bundles dmg

# Validate before committing
npm run validate
```

### Project Structure

```
src/              ⚛️  React frontend (components, stores, hooks)
src-tauri/        🦀  Rust backend (file ops, settings, IME)
.docs/            📚  Documentation (ADR, PRD, planning)
tests/            🧪  E2E tests (Playwright)
```

### Quality Gates

| Check          | Command                       |
| -------------- | ----------------------------- |
| Type check     | `npx tsc --noEmit`            |
| Lint           | `npx eslint src/`             |
| Unit tests     | `npm run test:run`            |
| Frontend build | `npx vite build`              |
| Rust check     | `cd src-tauri && cargo check` |
| Dead code      | `npm run knip`                |

---

## 🏗️ Tech Stack

| Layer       | Technology                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🖥️ Shell    | [Tauri 2.0](https://tauri.app) (Rust)                                                                                                                        |
| ⚛️ UI       | [React 19](https://react.dev) + TypeScript                                                                                                                   |
| ✏️ Editor   | [CodeMirror 6](https://codemirror.net)                                                                                                                       |
| 📝 Markdown | [markdown-it](https://github.com/markdown-it/markdown-it) + [KaTeX](https://katex.org) + [Mermaid](https://mermaid.js.org) + [Prism.js](https://prismjs.com) |
| 🗃️ State    | [Zustand](https://zustand.docs.pmnd.rs/)                                                                                                                     |
| 🎨 Styling  | [Tailwind CSS](https://tailwindcss.com)                                                                                                                      |
| 🖥️ Vim      | [@replit/codemirror-vim](https://github.com/replit/codemirror-vim)                                                                                           |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit with [Conventional Commits](https://www.conventionalcommits.org/) (`feat(editor): add feature`)
4. Push and open a Pull Request

Pre-commit hooks enforce linting, formatting, and commit message style automatically. ✅

---

## 📄 License

[MIT](LICENSE) — Copyright 2026 PignuAnte ([Ai-Scream](https://github.com/ai-screams))

---

<div align="center">

⚡ **Built with Rust. Powered by open source.** ⚡

Made by [PignuAnte](https://github.com/ai-screams) @ Ai-Scream

[GitHub](https://github.com/ai-screams/BoltDown) · [Releases](https://github.com/ai-screams/BoltDown/releases) · [Issues](https://github.com/ai-screams/BoltDown/issues)

</div>
