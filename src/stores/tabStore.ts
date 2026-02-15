import { create } from 'zustand'

import type { Tab } from '@/types/editor'

function createTab(filePath: string | null, fileName: string, content: string): Tab {
  return {
    id: crypto.randomUUID(),
    filePath,
    fileName,
    content,
    savedContent: content,
  }
}

const welcomeContent = `# Hello BoltDown!

Welcome to **BoltDown** — a lightning-fast Markdown editor.

![Megumin](https://i.namu.wiki/i/p6amZTd-aBuEQAKgB2M9dbWJ9qn3InFEtM-cs9mCXj3uCZhY3pcgK1hk4133lailOBNG6uAnRowJEDqvAwRWJ6j7g7X6BKAeXq3gMH3YvMcbqxQkm7vC48Un11LikEEGo8oj-4U171hb5Q2bZrze9A.webp)

## Text Formatting

**Bold text**, *italic text*, ~~strikethrough~~, and ***bold italic*** combined.

## Links & Images

[Visit GitHub](https://github.com) — click to open a link.

## Lists

- Bullet item one
- Bullet item two
  - Nested item

1. Numbered item
2. Another item

## Blockquote

> "Make Markdown editing as fast as lightning, as light as air."

## Inline Code & Code Block

Use \`inline code\` in a sentence.

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

## Table

| Feature | Shortcut |
|---------|----------|
| Open    | Cmd+O    |
| Save    | Cmd+S    |
| New Tab | Cmd+N    |
| Mode    | Cmd+\\\\   |

## Math (KaTeX)

Inline math: $E = mc^2$

$$
\\\\int_{-\\\\infty}^{\\\\infty} e^{-x^2} dx = \\\\sqrt{\\\\pi}
$$

## Diagram (Mermaid)

\`\`\`mermaid
graph LR
  A[Write] --> B[Preview]
  B --> C[Export]
\`\`\`

---

*Start writing your own markdown above!*
`

const initialTab = createTab(null, 'Untitled.md', welcomeContent)

interface TabState {
  tabs: Tab[]
  activeTabId: string

  openTab: (filePath: string | null, fileName: string, content: string) => string
  closeTab: (id: string) => void
  closeOtherTabs: (id: string) => void
  setActiveTab: (id: string) => void
  updateContent: (id: string, content: string) => void
  markClean: (id: string, content: string) => void
  renameTab: (id: string, newFileName: string, newFilePath: string | null) => void
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,

  openTab: (filePath, fileName, content) => {
    const { tabs } = get()
    if (filePath) {
      const existing = tabs.find(t => t.filePath === filePath)
      if (existing) {
        set({ activeTabId: existing.id })
        return existing.id
      }
    }
    const tab = createTab(filePath, fileName, content)
    set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
    return tab.id
  },

  closeTab: id => {
    const { tabs, activeTabId } = get()
    if (tabs.length === 1) {
      const fresh = createTab(null, 'Untitled.md', '')
      set({ tabs: [fresh], activeTabId: fresh.id })
      return
    }
    const idx = tabs.findIndex(t => t.id === id)
    const remaining = tabs.filter(t => t.id !== id)
    if (activeTabId === id) {
      const newIdx = Math.min(idx, remaining.length - 1)
      set({ tabs: remaining, activeTabId: remaining[newIdx]!.id })
    } else {
      set({ tabs: remaining })
    }
  },

  closeOtherTabs: id => {
    set(s => ({
      tabs: s.tabs.filter(t => t.id === id),
      activeTabId: id,
    }))
  },

  setActiveTab: id => set({ activeTabId: id }),

  updateContent: (id, content) => {
    set(s => ({
      tabs: s.tabs.map(t => (t.id === id ? { ...t, content } : t)),
    }))
  },

  markClean: (id, content) => {
    set(s => ({
      tabs: s.tabs.map(t => (t.id === id ? { ...t, savedContent: content } : t)),
    }))
  },

  renameTab: (id, newFileName, newFilePath) => {
    set(s => ({
      tabs: s.tabs.map(t =>
        t.id === id ? { ...t, fileName: newFileName, filePath: newFilePath } : t
      ),
    }))
  },
}))
