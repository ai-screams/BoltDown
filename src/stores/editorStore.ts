import { create } from 'zustand'

import { STATUS_TIMEOUT_MS } from '@/constants/feedback'
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
  flashStatus: (text, ms = STATUS_TIMEOUT_MS.default) => {
    if (statusTimer) clearTimeout(statusTimer)
    set({ statusText: text })
    statusTimer = setTimeout(() => set({ statusText: '' }), ms)
  },
}))
