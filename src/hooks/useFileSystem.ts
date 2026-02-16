import { useCallback } from 'react'

import { STATUS_TIMEOUT_MS } from '@/constants/feedback'
import { FILE_DEFAULTS, FILE_POLICY, MARKDOWN_FILE_TYPES } from '@/constants/file'
import { useEditorStore } from '@/stores/editorStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { getActiveTabSnapshot, useTabStore } from '@/stores/tabStore'
import { getDirectoryPath, joinPath } from '@/utils/imagePath'
import { invokeTauri, isTauri } from '@/utils/tauri'

function getFileName(path: string, fallback: string): string {
  return path.split(/[/\\]/).pop() ?? fallback
}

export function useFileSystem() {
  const openTab = useTabStore(s => s.openTab)
  const markClean = useTabStore(s => s.markClean)
  const renameTab = useTabStore(s => s.renameTab)
  const addRecentFile = useSidebarStore(s => s.addRecentFile)

  const openFile = useCallback(async () => {
    if (!isTauri()) {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = MARKDOWN_FILE_TYPES.inputAccept
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
      const selected = await open({
        filters: [{ name: 'Markdown', extensions: [...MARKDOWN_FILE_TYPES.extensions] }],
      })
      if (!selected) return
      const path = typeof selected === 'string' ? selected : selected[0]
      if (!path) return
      const text = await invokeTauri<string>('read_file', { path })
      const name = getFileName(path, FILE_DEFAULTS.untitledName)
      openTab(path, name, text)
      addRecentFile(path, name)

      // Auto-load parent directory into sidebar file tree
      await useSidebarStore.getState().loadParentDirectory(path, true)
    } catch (e) {
      console.error('Open file failed:', e)
      useEditorStore.getState().flashStatus('Open failed', STATUS_TIMEOUT_MS.error)
    }
  }, [openTab, addRecentFile])

  const saveFile = useCallback(async () => {
    const { tab, activeTabId } = getActiveTabSnapshot()
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
      await invokeTauri('write_file', { path: tab.filePath, content: tab.content })
      markClean(activeTabId, tab.content)
      useEditorStore.getState().flashStatus('Saved')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('Save failed:', msg, e)
      useEditorStore.getState().flashStatus(`Save failed: ${msg}`, STATUS_TIMEOUT_MS.critical)
    }
  }, [markClean])

  const saveFileAs = useCallback(async () => {
    const { tab, activeTabId } = getActiveTabSnapshot()
    if (!tab) return

    if (!isTauri()) {
      markClean(activeTabId, tab.content)
      useEditorStore.getState().flashStatus('Saved')
      return
    }

    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const path = await save({
        filters: [{ name: 'Markdown', extensions: [...MARKDOWN_FILE_TYPES.extensions] }],
        defaultPath: tab.filePath ?? tab.fileName,
      })
      if (!path) return
      await invokeTauri('write_file', { path, content: tab.content })
      const name = getFileName(path, tab.fileName)
      renameTab(activeTabId, name, path)
      addRecentFile(path, name)
      await useSidebarStore.getState().loadParentDirectory(path, true)
      markClean(activeTabId, tab.content)
      useEditorStore.getState().flashStatus('Saved')
    } catch (e) {
      console.error('Save as failed:', e)
      useEditorStore.getState().flashStatus('Save failed', STATUS_TIMEOUT_MS.error)
    }
  }, [markClean, renameTab, addRecentFile])

  const deleteFile = useCallback(async (filePath: string) => {
    if (!isTauri()) return false
    try {
      const { ask } = await import('@tauri-apps/plugin-dialog')
      const fileName = getFileName(filePath, filePath)
      const confirmed = await ask(`Delete "${fileName}"? This cannot be undone.`, {
        title: 'Delete File',
        kind: 'warning',
      })
      if (!confirmed) return false

      await invokeTauri('delete_file', { path: filePath })

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
      // Generate copy name: "file.md" → "file (copy).md"
      const dir = getDirectoryPath(filePath)
      const fullName = getFileName(filePath, filePath)
      const dotIdx = fullName.lastIndexOf('.')
      const name = dotIdx > 0 ? fullName.slice(0, dotIdx) : fullName
      const ext = dotIdx > 0 ? fullName.slice(dotIdx) : ''

      // Find available name
      let copyName = `${name} (copy)${ext}`
      let copyPath = joinPath(dir, copyName)
      let nextCopyIndex = 2
      let available = false
      for (let attempt = 0; attempt < FILE_POLICY.maxCopyAttempts; attempt++) {
        try {
          await invokeTauri<string>('read_file', { path: copyPath })
          // File exists, try next
          copyName = `${name} (copy ${nextCopyIndex})${ext}`
          copyPath = joinPath(dir, copyName)
          nextCopyIndex += 1
        } catch {
          available = true
          break // File doesn't exist, use this name
        }
      }

      if (!available) {
        useEditorStore
          .getState()
          .flashStatus('Duplicate failed: too many copies', STATUS_TIMEOUT_MS.warning)
        return null
      }

      await invokeTauri('copy_file', { srcPath: filePath, destPath: copyPath })

      // Read and open the copy in a new tab
      const content = await invokeTauri<string>('read_file', { path: copyPath })
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
