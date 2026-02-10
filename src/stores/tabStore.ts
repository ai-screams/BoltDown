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

const initialTab = createTab(null, 'Untitled.md', '# Hello BoltDown!\n\nStart writing...')

interface TabState {
  tabs: Tab[]
  activeTabId: string

  openTab: (filePath: string | null, fileName: string, content: string) => string
  closeTab: (id: string) => void
  closeOtherTabs: (id: string) => void
  setActiveTab: (id: string) => void
  updateContent: (id: string, content: string) => void
  markClean: (id: string, content: string) => void
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
}))
