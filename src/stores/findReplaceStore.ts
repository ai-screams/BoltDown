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
      open: (showReplace = false) => set({ isOpen: true, showReplace }),
      close: () => set({ isOpen: false }),
      toggleReplace: () => set(s => ({ showReplace: !s.showReplace })),
      setSearchText: (text: string) =>
        set({
          searchText:
            text.length > FIND_REPLACE_INPUT_LIMITS.searchMaxChars
              ? text.slice(0, FIND_REPLACE_INPUT_LIMITS.searchMaxChars)
              : text,
        }),
      setReplaceText: (text: string) =>
        set({
          replaceText:
            text.length > FIND_REPLACE_INPUT_LIMITS.replaceMaxChars
              ? text.slice(0, FIND_REPLACE_INPUT_LIMITS.replaceMaxChars)
              : text,
        }),
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
