import { create } from 'zustand'

import { WELCOME_CONTENT } from '@/constants/welcomeContent'
import type { Tab } from '@/types/editor'

function patchTab(tabs: Tab[], id: string, patch: Partial<Tab>): Tab[] {
  return tabs.map(tab => (tab.id === id ? { ...tab, ...patch } : tab))
}

function createTab(filePath: string | null, fileName: string, content: string): Tab {
  return {
    id: crypto.randomUUID(),
    filePath,
    fileName,
    content,
    savedContent: content,
  }
}

const initialTab = createTab(null, 'Untitled.md', WELCOME_CONTENT)

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
    if (idx === -1) return

    const remaining = tabs.filter(t => t.id !== id)
    if (activeTabId === id) {
      const newIdx = Math.min(idx, remaining.length - 1)
      set({ tabs: remaining, activeTabId: remaining[newIdx]!.id })
    } else {
      set({ tabs: remaining })
    }
  },

  closeOtherTabs: id => {
    set(s => {
      const hasTarget = s.tabs.some(tab => tab.id === id)
      if (!hasTarget) return s

      return {
        tabs: s.tabs.filter(tab => tab.id === id),
        activeTabId: id,
      }
    })
  },

  setActiveTab: id => set({ activeTabId: id }),

  updateContent: (id, content) => {
    set(s => ({
      tabs: patchTab(s.tabs, id, { content }),
    }))
  },

  markClean: (id, content) => {
    set(s => ({
      tabs: patchTab(s.tabs, id, { savedContent: content }),
    }))
  },

  renameTab: (id, newFileName, newFilePath) => {
    set(s => ({
      tabs: patchTab(s.tabs, id, { fileName: newFileName, filePath: newFilePath }),
    }))
  },
}))

export function getActiveTabSnapshot(): { tab: Tab | undefined; activeTabId: string } {
  const { tabs, activeTabId } = useTabStore.getState()
  return {
    tab: tabs.find(tab => tab.id === activeTabId),
    activeTabId,
  }
}
