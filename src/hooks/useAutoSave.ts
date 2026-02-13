import { useEffect, useRef } from 'react'

import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTabStore } from '@/stores/tabStore'
import { isTauri } from '@/utils/tauri'

/**
 * useAutoSave — debounced auto-save for all dirty tabs.
 * - Tabs with filePath (Tauri only): write to disk + markClean
 * - Tabs without filePath / browser mode: in-memory markClean
 * Mount once in App.tsx.
 */
export function useAutoSave(): void {
  const autoSave = useSettingsStore(s => s.settings.general.autoSave)
  const autoSaveDelay = useSettingsStore(s => s.settings.general.autoSaveDelay)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)

  useEffect(() => {
    if (!autoSave) return

    const saveDirtyTabs = async () => {
      if (isSavingRef.current) return
      isSavingRef.current = true

      try {
        const tabs = useTabStore.getState().tabs
        const { markClean } = useTabStore.getState()
        let savedCount = 0

        for (const tab of tabs) {
          // Skip clean tabs
          if (tab.content === tab.savedContent) continue

          // Re-check tab still exists (may have been closed during async gap)
          const current = useTabStore.getState().tabs.find(t => t.id === tab.id)
          if (!current) continue

          if (current.filePath && isTauri()) {
            // Disk save: Tauri + has file path
            try {
              const { invoke } = await import('@tauri-apps/api/core')
              await invoke('write_file', { path: current.filePath, content: current.content })
              markClean(current.id, current.content)
              savedCount++
            } catch (e) {
              console.error(`Auto-save failed for ${current.filePath}:`, e)
            }
          } else {
            // In-memory save: untitled tabs or browser mode
            markClean(current.id, current.content)
            savedCount++
          }
        }

        if (savedCount > 0) {
          useEditorStore.getState().flashStatus('Auto-saved')
        }
      } finally {
        isSavingRef.current = false
      }
    }

    const scheduleSave = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        void saveDirtyTabs()
      }, autoSaveDelay)
    }

    // Subscribe to tab content changes
    const unsubscribe = useTabStore.subscribe((state, prev) => {
      if (state.tabs !== prev.tabs) {
        scheduleSave()
      }
    })

    // Save immediately on window blur
    const handleBlur = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      void saveDirtyTabs()
    }
    window.addEventListener('blur', handleBlur)

    return () => {
      unsubscribe()
      window.removeEventListener('blur', handleBlur)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [autoSave, autoSaveDelay])
}
