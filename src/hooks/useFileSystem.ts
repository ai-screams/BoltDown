import { useCallback } from 'react'

import { useEditorStore } from '@/stores/editorStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useTabStore } from '@/stores/tabStore'
import { isTauri } from '@/utils/tauri'

export function useFileSystem() {
  const openTab = useTabStore(s => s.openTab)
  const markClean = useTabStore(s => s.markClean)
  const renameTab = useTabStore(s => s.renameTab)
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

    try {
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

      // Auto-load parent directory into sidebar file tree
      await useSidebarStore.getState().loadParentDirectory(path, true)
    } catch (e) {
      console.error('Open file failed:', e)
      useEditorStore.getState().flashStatus('Open failed', 3000)
    }
  }, [openTab, addRecentFile])

  const saveFile = useCallback(async () => {
    const { tab, activeTabId } = getActiveTab()
    if (!tab) return

    if (!isTauri()) {
      markClean(activeTabId, tab.content)
      useEditorStore.getState().flashStatus('Saved')
      return
    }

    if (!tab.filePath) {
      markClean(activeTabId, tab.content)
      useEditorStore.getState().flashStatus('Saved (in memory)')
      return
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('write_file', { path: tab.filePath, content: tab.content })
      markClean(activeTabId, tab.content)
      useEditorStore.getState().flashStatus('Saved')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('Save failed:', msg, e)
      useEditorStore.getState().flashStatus(`Save failed: ${msg}`, 5000)
    }
  }, [getActiveTab, markClean])

  const saveFileAs = useCallback(async () => {
    const { tab, activeTabId } = getActiveTab()
    if (!tab) return

    if (!isTauri()) {
      markClean(activeTabId, tab.content)
      useEditorStore.getState().flashStatus('Saved')
      return
    }

    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { invoke } = await import('@tauri-apps/api/core')
      const path = await save({
        filters: [{ name: 'Markdown', extensions: ['md'] }],
        defaultPath: tab.filePath ?? tab.fileName,
      })
      if (!path) return
      await invoke('write_file', { path, content: tab.content })
      const name = path.split(/[/\\]/).pop() ?? tab.fileName
      renameTab(activeTabId, name, path)
      addRecentFile(path, name)
      await useSidebarStore.getState().loadParentDirectory(path, true)
      markClean(activeTabId, tab.content)
      useEditorStore.getState().flashStatus('Saved')
    } catch (e) {
      console.error('Save as failed:', e)
      useEditorStore.getState().flashStatus('Save failed', 3000)
    }
  }, [getActiveTab, markClean, renameTab, addRecentFile])

  const deleteFile = useCallback(async (filePath: string) => {
    if (!isTauri()) return false
    try {
      const { ask } = await import('@tauri-apps/plugin-dialog')
      const fileName = filePath.split('/').pop() ?? filePath
      const confirmed = await ask(`Delete "${fileName}"? This cannot be undone.`, {
        title: 'Delete File',
        kind: 'warning',
      })
      if (!confirmed) return false

      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('delete_file', { path: filePath })

      // Close any tab with this file
      const { tabs, closeTab } = useTabStore.getState()
      const tab = tabs.find(t => t.filePath === filePath)
      if (tab) closeTab(tab.id)

      return true
    } catch (e) {
      const flashStatus = useEditorStore.getState().flashStatus
      flashStatus(`Delete failed: ${e}`)
      return false
    }
  }, [])

  const duplicateFile = useCallback(async (filePath: string) => {
    if (!isTauri()) return null
    try {
      const { invoke } = await import('@tauri-apps/api/core')

      // Generate copy name: "file.md" → "file (copy).md"
      const lastSlash = filePath.lastIndexOf('/')
      const dir = filePath.slice(0, lastSlash + 1)
      const fullName = filePath.slice(lastSlash + 1)
      const dotIdx = fullName.lastIndexOf('.')
      const name = dotIdx > 0 ? fullName.slice(0, dotIdx) : fullName
      const ext = dotIdx > 0 ? fullName.slice(dotIdx) : ''

      // Find available name
      let copyName = `${name} (copy)${ext}`
      let copyPath = `${dir}${copyName}`
      let counter = 2
      while (true) {
        try {
          await invoke<string>('read_file', { path: copyPath })
          // File exists, try next
          copyName = `${name} (copy ${counter})${ext}`
          copyPath = `${dir}${copyName}`
          counter++
        } catch {
          break // File doesn't exist, use this name
        }
      }

      await invoke('copy_file', { srcPath: filePath, destPath: copyPath })

      // Read and open the copy in a new tab
      const content = await invoke<string>('read_file', { path: copyPath })
      useTabStore.getState().openTab(copyPath, copyName, content)

      return copyPath
    } catch (e) {
      const flashStatus = useEditorStore.getState().flashStatus
      flashStatus(`Duplicate failed: ${e}`)
      return null
    }
  }, [])

  return { openFile, saveFile, saveFileAs, deleteFile, duplicateFile }
}
