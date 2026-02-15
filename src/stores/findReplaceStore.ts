import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_SEARCH_LENGTH = 1000
const MAX_REPLACE_LENGTH = 10000

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
          searchText: text.length > MAX_SEARCH_LENGTH ? text.slice(0, MAX_SEARCH_LENGTH) : text,
        }),
      setReplaceText: (text: string) =>
        set({
          replaceText: text.length > MAX_REPLACE_LENGTH ? text.slice(0, MAX_REPLACE_LENGTH) : text,
        }),
      toggleCaseSensitive: () => set(s => ({ caseSensitive: !s.caseSensitive })),
      toggleRegex: () => set(s => ({ useRegex: !s.useRegex })),
      toggleWholeWord: () => set(s => ({ wholeWord: !s.wholeWord })),
    }),
    {
      name: 'find-replace-preferences',
      partialize: state => ({
        caseSensitive: state.caseSensitive,
        useRegex: state.useRegex,
        wholeWord: state.wholeWord,
      }),
    }
  )
)
