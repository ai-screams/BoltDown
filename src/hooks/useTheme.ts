import { useCallback } from 'react'
import { create } from 'zustand'

type Theme = 'light' | 'dark' | 'system'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
}

const useThemeStore = create<ThemeState>(set => {
  const stored = localStorage.getItem('boltdown-theme') as Theme | null
  const initial = stored ?? 'system'
  // Apply on store creation
  applyTheme(initial)

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = useThemeStore.getState()
    if (theme === 'system') applyTheme('system')
    // Force re-render by touching state
    set(s => ({ ...s }))
  })

  return {
    theme: initial,
    setTheme: t => {
      localStorage.setItem('boltdown-theme', t)
      applyTheme(t)
      set({ theme: t })
    },
  }
})

export function useTheme() {
  const theme = useThemeStore(s => s.theme)
  const setTheme = useThemeStore(s => s.setTheme)

  const cycleTheme = useCallback(() => {
    const order: Theme[] = ['light', 'dark', 'system']
    const idx = order.indexOf(theme)
    setTheme(order[(idx + 1) % order.length]!)
  }, [theme, setTheme])

  const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark')

  return { theme, setTheme, cycleTheme, isDark }
}
