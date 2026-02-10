import { create } from 'zustand'

import type { EditorMode } from '@/types/editor'

interface EditorState {
  content: string
  setContent: (content: string) => void

  filePath: string | null
  fileName: string
  isDirty: boolean
  setFile: (path: string | null, name: string) => void
  markDirty: () => void
  markClean: () => void

  mode: EditorMode
  setMode: (mode: EditorMode) => void

  wordCount: number
  readingTime: number
}

export const useEditorStore = create<EditorState>(set => ({
  content: '# Hello BoltDown!\n\nStart writing...',
  setContent: content => {
    const words = content.split(/\s+/).filter(Boolean).length
    set({
      content,
      isDirty: true,
      wordCount: words,
      readingTime: Math.max(1, Math.ceil(words / 225)),
    })
  },

  filePath: null,
  fileName: 'Untitled.md',
  isDirty: false,
  setFile: (path, name) => set({ filePath: path, fileName: name, isDirty: false }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),

  mode: 'split',
  setMode: mode => set({ mode }),

  wordCount: 0,
  readingTime: 1,
}))
