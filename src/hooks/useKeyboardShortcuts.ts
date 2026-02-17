import { useEffect, useRef, type MutableRefObject } from 'react'

import { FILE_DEFAULTS } from '@/constants/file'
import { useEditorStore } from '@/stores/editorStore'
import { useFindReplaceStore } from '@/stores/findReplaceStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useTabStore } from '@/stores/tabStore'
import type { EditorMode } from '@/types/editor'

interface KeyboardShortcutDeps {
  openFile: () => Promise<void>
  saveFile: () => Promise<void>
  saveFileAs: () => Promise<void>
  settingsOpenRef: MutableRefObject<boolean>
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>
  setShortcutsOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export function useKeyboardShortcuts({
  openFile,
  saveFile,
  saveFileAs,
  settingsOpenRef,
  setSettingsOpen,
  setShortcutsOpen,
}: KeyboardShortcutDeps) {
  // Stable refs for file operations
  const openFileRef = useRef(openFile)
  const saveFileRef = useRef(saveFile)
  const saveFileAsRef = useRef(saveFileAs)

  openFileRef.current = openFile
  saveFileRef.current = saveFile
  saveFileAsRef.current = saveFileAs

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target
      const isCodeMirrorTarget =
        target instanceof HTMLElement && !!target.closest('.cm-editor, .cm-panels')
      if (
        target instanceof HTMLElement &&
        !isCodeMirrorTarget &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return
      }

      const mod = e.metaKey || e.ctrlKey
      const mode = useEditorStore.getState().mode
      const findReplaceOpen = useFindReplaceStore.getState().isOpen

      if (
        mode === 'zen' &&
        e.key === 'Escape' &&
        !mod &&
        !e.shiftKey &&
        !findReplaceOpen &&
        !settingsOpenRef.current
      ) {
        e.preventDefault()
        useEditorStore.getState().setMode('source')
        return
      }

      if (mod && e.shiftKey && e.key === 'e') {
        e.preventDefault()
        useSidebarStore.getState().toggle()
        return
      }

      if (mod && e.key === 'n') {
        e.preventDefault()
        useTabStore.getState().openTab(null, FILE_DEFAULTS.untitledName, '')
        return
      }

      if (mod && e.key === '\\') {
        e.preventDefault()
        const cycle: EditorMode[] = ['split', 'source', 'zen']
        const currentMode = useEditorStore.getState().mode
        const idx = cycle.indexOf(currentMode)
        useEditorStore.getState().setMode(cycle[(idx + 1) % cycle.length]!)
        return
      }

      if (mod && e.key === 'o') {
        e.preventDefault()
        void openFileRef.current()
        return
      }

      if (mod && !e.shiftKey && e.key === 's') {
        e.preventDefault()
        void saveFileRef.current()
        return
      }

      if (mod && e.shiftKey && e.key === 's') {
        e.preventDefault()
        void saveFileAsRef.current()
        return
      }

      if (mod && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(prev => !prev)
        return
      }

      if (mod && !e.shiftKey && e.key === 'f') {
        e.preventDefault()
        useFindReplaceStore.getState().open(false)
        return
      }

      if (mod && !e.shiftKey && e.key === 'h') {
        e.preventDefault()
        useFindReplaceStore.getState().open(true)
        return
      }

      if (mod && e.key === '/') {
        e.preventDefault()
        setShortcutsOpen(prev => !prev)
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [settingsOpenRef, setSettingsOpen, setShortcutsOpen])
}
