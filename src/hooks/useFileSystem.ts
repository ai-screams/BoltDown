import { useCallback } from 'react'

import { useEditorStore } from '@/stores/editorStore'
import { isTauri } from '@/utils/tauri'

export function useFileSystem() {
  const { content, filePath, setContent, setFile, markClean } = useEditorStore()

  const openFile = useCallback(async () => {
    if (!isTauri()) {
      // Browser fallback: use file input
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.md,.markdown,.txt'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        const text = await file.text()
        setContent(text)
        setFile(null, file.name)
        markClean()
      }
      input.click()
      return
    }

    const { invoke } = await import('@tauri-apps/api/core')
    // Use Tauri dialog plugin via invoke
    const path = await invoke<string | null>('open_file_dialog')
    if (!path) return
    const text = await invoke<string>('read_file', { path })
    setContent(text)
    const name = path.split(/[/\\]/).pop() ?? 'Untitled.md'
    setFile(path, name)
    markClean()
  }, [setContent, setFile, markClean])

  const saveFile = useCallback(async () => {
    if (!isTauri()) return

    const { invoke } = await import('@tauri-apps/api/core')
    let path = filePath
    if (!path) {
      path = await invoke<string | null>('save_file_dialog')
    }
    if (!path) return
    await invoke('write_file', { path, content })
    const name = path.split(/[/\\]/).pop() ?? 'Untitled.md'
    setFile(path, name)
    markClean()
  }, [content, filePath, setFile, markClean])

  const saveFileAs = useCallback(async () => {
    if (!isTauri()) return

    const { invoke } = await import('@tauri-apps/api/core')
    const path = await invoke<string | null>('save_file_dialog')
    if (!path) return
    await invoke('write_file', { path, content })
    const name = path.split(/[/\\]/).pop() ?? 'Untitled.md'
    setFile(path, name)
    markClean()
  }, [content, setFile, markClean])

  return { openFile, saveFile, saveFileAs }
}
