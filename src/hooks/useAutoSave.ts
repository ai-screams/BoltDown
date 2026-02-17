import { useEffect, useRef } from 'react'

import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTabStore } from '@/stores/tabStore'
import { invokeTauri, isTauri } from '@/utils/tauri'

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
  const pendingBlurSaveRef = useRef(false)

  useEffect(() => {
    if (!autoSave) return

    const saveDirtyTabs = async () => {
      if (isSavingRef.current) return
      isSavingRef.current = true

      try {
        const tabs = useTabStore.getState().tabs
        const { markClean } = useTabStore.getState()
        const desktop = isTauri()
        let savedCount = 0

        for (const tab of tabs) {
          // Skip clean tabs
          if (tab.content === tab.savedContent) continue

          // Re-check tab still exists (may have been closed during async gap)
          const current = useTabStore.getState().tabs.find(t => t.id === tab.id)
          if (!current) continue

          if (current.filePath && desktop) {
            // Disk save: Tauri + has file path
            try {
              const contentToSave = current.content
              await invokeTauri('write_file', { path: current.filePath, content: contentToSave })
              markClean(current.id, contentToSave)
              savedCount++
            } catch (e) {
              console.error(`Auto-save failed for ${current.filePath}:`, e)
            }
          } else {
            // In-memory save: untitled tabs or browser mode
            const contentToSave = current.content
            markClean(current.id, contentToSave)
            savedCount++
          }
        }

        if (savedCount > 0) {
          useEditorStore.getState().flashStatus('Auto-saved')
        }
      } finally {
        isSavingRef.current = false
        if (pendingBlurSaveRef.current) {
          pendingBlurSaveRef.current = false
          void saveDirtyTabs()
        }
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
      if (isSavingRef.current) {
        pendingBlurSaveRef.current = true
      } else {
        void saveDirtyTabs()
      }
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
