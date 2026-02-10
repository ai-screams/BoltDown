import { create } from 'zustand'

import type { EditorMode } from '@/types/editor'

interface EditorState {
  mode: EditorMode
  setMode: (mode: EditorMode) => void
}

export const useEditorStore = create<EditorState>(set => ({
  mode: 'split',
  setMode: mode => set({ mode }),
}))
