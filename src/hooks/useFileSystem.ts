import { useCallback } from 'react'

import { useEditorStore } from '@/stores/editorStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useTabStore } from '@/stores/tabStore'
import { isTauri } from '@/utils/tauri'

export function useFileSystem() {
  const openTab = useTabStore(s => s.openTab)
  const markClean = useTabStore(s => s.markClean)
  const addRecentFile = useSidebarStore(s => s.addRecentFile)

  const getActiveTab = useCallback(() => {
    const { tabs, activeTabId } = useTabStore.getState()
    return { tab: tabs.find(t => t.id === activeTabId), activeTabId }
  }, [])

  const openFile = useCallback(async () => {
    if (!isTauri()) {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.md,.markdown,.txt'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        const text = await file.text()
        openTab(null, file.name, text)
      }
      input.click()
      return
    }

    const { open } = await import('@tauri-apps/plugin-dialog')
    const { invoke } = await import('@tauri-apps/api/core')
    const selected = await open({
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    })
    if (!selected) return
    const path = typeof selected === 'string' ? selected : selected[0]
    if (!path) return
    const text = await invoke<string>('read_file', { path })
    const name = path.split(/[/\\]/).pop() ?? 'Untitled.md'
    openTab(path, name, text)
    addRecentFile(path, name)
  }, [openTab, addRecentFile])

  const saveFile = useCallback(async () => {
    if (!isTauri()) return

    const { tab, activeTabId } = getActiveTab()
    if (!tab) return

    const { save } = await import('@tauri-apps/plugin-dialog')
    const { invoke } = await import('@tauri-apps/api/core')
    let path = tab.filePath
    if (!path) {
      const selected = await save({
        filters: [{ name: 'Markdown', extensions: ['md'] }],
        defaultPath: tab.fileName,
      })
      path = selected
    }
    if (!path) return
    await invoke('write_file', { path, content: tab.content })
    markClean(activeTabId, tab.content)
    useEditorStore.getState().flashStatus('Saved')
  }, [getActiveTab, markClean])

  const saveFileAs = useCallback(async () => {
    if (!isTauri()) return

    const { tab, activeTabId } = getActiveTab()
    if (!tab) return

    const { save } = await import('@tauri-apps/plugin-dialog')
    const { invoke } = await import('@tauri-apps/api/core')
    const path = await save({
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      defaultPath: tab.filePath ?? tab.fileName,
    })
    if (!path) return
    await invoke('write_file', { path, content: tab.content })
    markClean(activeTabId, tab.content)
    useEditorStore.getState().flashStatus('Saved')
  }, [getActiveTab, markClean])

  return { openFile, saveFile, saveFileAs }
}
