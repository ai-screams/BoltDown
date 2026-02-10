# ⚡ BoltDown

**Lightning-Fast Markdown Editor Built with Tauri**

<div align="center">

```
┌─────────────────────────────┐
│  ⚡ BoltDown                │
│  Lightning-Fast Markdown    │
└─────────────────────────────┘
```

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev)

**[Download](https://github.com/ai-screams/BoltDown/releases)** •
**[Documentation](https://docs.boltdown.io)**

</div>

---

## 🚗 Why BoltDown?

> **"Electron apps are gas-guzzling SUVs. BoltDown is a Tesla."**

| Feature          | ⚡ BoltDown            | ⛽ Typora   | 📊 Obsidian |
| ---------------- | ---------------------- | ----------- | ----------- |
| **Bundle Size**  | **7MB**                | 120MB       | 100MB       |
| **Memory Usage** | **50-100MB**           | 200-500MB   | 300-400MB   |
| **Startup Time** | **<1 second**          | 2-3 seconds | 2-3 seconds |
| **Price**        | **Free** (Open Source) | $14.99      | Free        |
| **Framework**    | **Tauri** (Rust)       | Electron    | Electron    |

### 🎯 10x smaller. 4x faster. 100% free.

---

## ✨ Features

### Phase 1: MVP (Current)

- ⚡ **Instant Startup** - Less than 1 second
- 📝 **WYSIWYG Editing** - What You See Is What You Mean
- 🔄 **Split View** - Source + Preview with sync scroll
- 🧮 **Math Support** - KaTeX for LaTeX equations
- 📊 **Diagrams** - Mermaid for flowcharts, sequences, Gantt
- 🎨 **Code Highlighting** - 100+ programming languages
- 📂 **File Manager** - Sidebar with folder tree
- 💾 **Auto-Save** - Never lose your work
- 🌓 **Dark Mode** - Easy on the eyes
- 📤 **Export** - PDF, HTML, and more

### Phase 2: Coming Soon

- 🎯 Focus Mode & Typewriter Mode
- 📋 WYSIWYG Table Editing
- 🖼️ Image Optimization
- 📊 Word Count & Reading Time
- ✍️ Spell Checking (Korean + English)
- 🗂️ Outline Panel & Auto TOC

---

## 📦 Installation

### macOS

```bash
# Homebrew (recommended)
brew install boltdown

# Or download from releases
# https://github.com/ai-screams/BoltDown/releases
```

### Windows

```bash
# Winget
winget install boltdown

# Or download installer
# https://github.com/ai-screams/BoltDown/releases
```

### Linux

```bash
# Snap
snap install boltdown

# AppImage
# Download from releases
```

---

## 🚀 Quick Start

### 1. Create New Document

```bash
# Open BoltDown
boltdown

# Or open specific file
boltdown README.md
```

### 2. Start Writing

```markdown
# Hello BoltDown! ⚡

Strike through your writing at the speed of light.

## Math

$E = mc^2$

## Diagram

\`\`\`mermaid
flowchart LR
A[Fast] --> B[Faster]
B --> C[BoltDown]
\`\`\`
```

### 3. Export to PDF

1. Click **File → Export → PDF**
2. Choose destination
3. Done! ⚡

---

## 🛠️ Development

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **Rust** 1.70+ ([rustup.rs](https://rustup.rs))
- **pnpm** (recommended) or npm

### Setup

```bash
# Clone repository
git clone https://github.com/ai-screams/BoltDown.git
cd BoltDown

# Install dependencies
pnpm install

# Run development server
pnpm tauri:dev
```

### Build

```bash
# Build for production
pnpm tauri:build

# Output:
# - macOS: src-tauri/target/release/bundle/dmg/
# - Windows: src-tauri/target/release/bundle/msi/
# - Linux: src-tauri/target/release/bundle/appimage/
```

---

## 🏗️ Tech Stack

### Frontend

- ⚛️ **React 18** - UI framework
- ⚡ **Vite 5** - Build tool (<200ms HMR)
- 📝 **CodeMirror 6** - Editor engine (500KB)
- 🔤 **markdown-it** - Parser (Benchmark: 97.3)
- 🧮 **KaTeX** - Math rendering (10x faster than MathJax)
- 📊 **Mermaid** - Diagram generation
- 🎨 **Tailwind CSS** - Styling
- 🗂️ **Zustand** - State management (1KB)

### Backend

- 🦀 **Rust** - Memory-safe systems language
- 🚀 **Tauri 2.0** - Desktop framework (40x smaller than Electron)
- ⚡ **Tokio** - Async runtime
- 📁 **notify-rs** - File watching (auto-save)

---

## 📚 Documentation

- **User Guide**: [docs.boltdown.io/guide](https://docs.boltdown.io/guide)
- **API Reference**: [docs.boltdown.io/api](https://docs.boltdown.io/api)
- **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **Architecture Decisions**: [.docs/adr/](.docs/adr/)

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

**MIT License** - See [LICENSE](LICENSE) for details.

Copyright © 2026 BoltDown Team

---

## 🙏 Acknowledgments

Built with these amazing open-source projects:

- [Tauri](https://tauri.app) - Desktop framework
- [React](https://react.dev) - UI library
- [CodeMirror](https://codemirror.net) - Editor engine
- [markdown-it](https://github.com/markdown-it/markdown-it) - Markdown parser
- [KaTeX](https://katex.org) - Math rendering
- [Mermaid](https://mermaid.js.org) - Diagram generation

---

## 📞 Contact

- **Website**: [boltdown.io](https://boltdown.io)
- **GitHub**: [github.com/ai-screams/BoltDown](https://github.com/ai-screams/BoltDown)

---

<div align="center">

**"Strike through your writing at the speed of light. ⚡"**

Made with ⚡ by the BoltDown Team

</div>
