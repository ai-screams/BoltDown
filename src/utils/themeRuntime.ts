export type ResolvedTheme = 'light' | 'dark'

export function getResolvedThemeFromDom(): ResolvedTheme {
  const resolved = document.documentElement.dataset.themeResolved
  if (resolved === 'dark') return 'dark'
  if (resolved === 'light') return 'light'

  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function getMermaidThemeFromDom(): 'dark' | 'default' {
  return getResolvedThemeFromDom() === 'dark' ? 'dark' : 'default'
}
