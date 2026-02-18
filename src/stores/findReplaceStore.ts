import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { FIND_REPLACE_INPUT_LIMITS } from '@/constants/findReplace'
import { STORAGE_KEYS } from '@/constants/storage'

interface FindReplaceState {
  isOpen: boolean
  showReplace: boolean
  searchText: string
  replaceText: string
  caseSensitive: boolean
  useRegex: boolean
  wholeWord: boolean
  searchTruncated: boolean
  replaceTruncated: boolean
  open: (showReplace?: boolean) => void
  close: () => void
  toggleReplace: () => void
  setSearchText: (text: string) => void
  setReplaceText: (text: string) => void
  toggleCaseSensitive: () => void
  toggleRegex: () => void
  toggleWholeWord: () => void
}

export const useFindReplaceStore = create<FindReplaceState>()(
  persist(
    set => ({
      isOpen: false,
      showReplace: false,
      searchText: '',
      replaceText: '',
      caseSensitive: false,
      useRegex: false,
      wholeWord: false,
      searchTruncated: false,
      replaceTruncated: false,
      open: (showReplace = false) => set({ isOpen: true, showReplace }),
      close: () => set({ isOpen: false, searchTruncated: false, replaceTruncated: false }),
      toggleReplace: () => set(s => ({ showReplace: !s.showReplace })),
      setSearchText: (text: string) => {
        const truncated = text.length > FIND_REPLACE_INPUT_LIMITS.searchMaxChars
        set({
          searchText: truncated ? text.slice(0, FIND_REPLACE_INPUT_LIMITS.searchMaxChars) : text,
          searchTruncated: truncated,
        })
      },
      setReplaceText: (text: string) => {
        const truncated = text.length > FIND_REPLACE_INPUT_LIMITS.replaceMaxChars
        set({
          replaceText: truncated ? text.slice(0, FIND_REPLACE_INPUT_LIMITS.replaceMaxChars) : text,
          replaceTruncated: truncated,
        })
      },
      toggleCaseSensitive: () => set(s => ({ caseSensitive: !s.caseSensitive })),
      toggleRegex: () => set(s => ({ useRegex: !s.useRegex })),
      toggleWholeWord: () => set(s => ({ wholeWord: !s.wholeWord })),
    }),
    {
      name: STORAGE_KEYS.findReplacePreferences,
      partialize: (state): Pick<FindReplaceState, 'caseSensitive' | 'useRegex' | 'wholeWord'> => ({
        caseSensitive: state.caseSensitive,
        useRegex: state.useRegex,
        wholeWord: state.wholeWord,
      }),
    }
  )
)
