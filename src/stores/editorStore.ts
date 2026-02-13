import { create } from 'zustand'

import type { EditorMode } from '@/types/editor'

interface EditorState {
  mode: EditorMode
  setMode: (mode: EditorMode) => void
  statusText: string
  flashStatus: (text: string, ms?: number) => void
}

let statusTimer: ReturnType<typeof setTimeout> | null = null

export const useEditorStore = create<EditorState>(set => ({
  mode: 'split',
  setMode: mode => set({ mode }),
  statusText: '',
  flashStatus: (text, ms = 2000) => {
    if (statusTimer) clearTimeout(statusTimer)
    set({ statusText: text })
    statusTimer = setTimeout(() => set({ statusText: '' }), ms)
  },
}))
