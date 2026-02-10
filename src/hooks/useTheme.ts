import { useCallback, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('boltdown-theme') as Theme | null
    return stored ?? 'system'
  })

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem('boltdown-theme', t)
    applyTheme(t)
  }, [])

  const cycleTheme = useCallback(() => {
    const order: Theme[] = ['light', 'dark', 'system']
    const idx = order.indexOf(theme)
    setTheme(order[(idx + 1) % order.length]!)
  }, [theme, setTheme])

  // Apply on mount and listen for system changes
  useEffect(() => {
    applyTheme(theme)

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const isDark = theme === 'dark' || (theme === 'system' && getSystemTheme() === 'dark')

  return { theme, setTheme, cycleTheme, isDark }
}
