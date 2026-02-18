import { create } from 'zustand'

import { SETTINGS_POLICY } from '@/constants/settingsLimits'
import { MEDIA_QUERIES, STORAGE_KEYS } from '@/constants/storage'
import { isBuiltInThemeName, THEME_MODES } from '@/constants/theme'
import type {
  AppSettings,
  EditorSettings,
  GeneralSettings,
  PreviewSettings,
  SettingsCategory,
  ThemeName,
  ThemeMode,
  ThemeSettings,
} from '@/types/settings'
import { DEFAULT_SETTINGS, DEFAULT_THEME } from '@/types/settings'
import { loadSettingsFromStorage, saveSettingsToStorage } from '@/utils/settingsStorage'

// --- Module-level helpers (same pattern as sidebarStore's debouncedSaveWidth) ---

let saveTimer: ReturnType<typeof setTimeout> | null = null
let themeListenerRegistered = false
function debouncedSave(settings: AppSettings) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void saveSettingsToStorage(settings)
  }, SETTINGS_POLICY.saveDebounceMs)
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia(MEDIA_QUERIES.prefersDark).matches ? 'dark' : 'light'
}

function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemTheme() : mode
}

function applyTheme(theme: ThemeSettings) {
  const root = document.documentElement
  const resolved = resolveThemeMode(theme.mode)
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = theme.name
  root.dataset.themeMode = theme.mode
  root.dataset.themeResolved = resolved
}

function sanitizeTheme(theme: Partial<ThemeSettings> | undefined): ThemeSettings {
  const mode = THEME_MODES.includes((theme?.mode ?? '') as ThemeMode)
    ? (theme?.mode as ThemeMode)
    : DEFAULT_THEME.mode
  const name =
    typeof theme?.name === 'string' && isBuiltInThemeName(theme.name)
      ? theme.name
      : DEFAULT_THEME.name

  const customCss = typeof theme?.customCss === 'string' ? theme.customCss : DEFAULT_THEME.customCss

  return {
    mode,
    name: name as ThemeName,
    customCss,
  }
}

function mergeWithDefaults(stored: Partial<AppSettings>, defaults: AppSettings): AppSettings {
  return {
    theme: sanitizeTheme({ ...defaults.theme, ...stored.theme }),
    editor: { ...defaults.editor, ...stored.editor },
    preview: { ...defaults.preview, ...stored.preview },
    general: { ...defaults.general, ...stored.general },
  }
}

function initThemeListener(get: () => SettingsState): void {
  if (!themeListenerRegistered) {
    themeListenerRegistered = true
    const mediaQuery = window.matchMedia(MEDIA_QUERIES.prefersDark)
    mediaQuery.addEventListener('change', () => {
      const { settings } = get()
      if (settings.theme.mode === 'system') {
        applyTheme(settings.theme)
      }
    })
  }
}

function migrateLegacyTheme(get: () => SettingsState, stored: Partial<AppSettings> | null): void {
  const oldTheme = localStorage.getItem(STORAGE_KEYS.legacyTheme)
  if (oldTheme && !stored?.theme) {
    const mode = oldTheme as ThemeMode
    if (THEME_MODES.includes(mode)) {
      get().updateTheme({ mode })
    }
    localStorage.removeItem(STORAGE_KEYS.legacyTheme)
  }
}

// --- Store ---

interface SettingsState {
  settings: AppSettings
  isLoaded: boolean

  updateTheme: (patch: Partial<ThemeSettings>) => void
  updateEditor: (patch: Partial<EditorSettings>) => void
  updatePreview: (patch: Partial<PreviewSettings>) => void
  updateGeneral: (patch: Partial<GeneralSettings>) => void
  resetCategory: (category: SettingsCategory) => void
  resetAll: () => void
  loadSettings: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  const patchCategory = <K extends SettingsCategory>(
    category: K,
    patch: Partial<AppSettings[K]>
  ): void => {
    const previous = get().settings
    const next =
      category === 'theme'
        ? ({
            ...previous,
            theme: sanitizeTheme({
              ...previous.theme,
              ...(patch as Partial<ThemeSettings>),
            }),
          } as AppSettings)
        : ({
            ...previous,
            [category]: {
              ...previous[category],
              ...patch,
            },
          } as AppSettings)

    set({ settings: next })
    if (category === 'theme') applyTheme(next.theme)
    debouncedSave(next)
  }

  return {
    settings: DEFAULT_SETTINGS,
    isLoaded: false,

    updateTheme: patch => patchCategory('theme', patch),
    updateEditor: patch => patchCategory('editor', patch),
    updatePreview: patch => patchCategory('preview', patch),
    updateGeneral: patch => patchCategory('general', patch),

    resetCategory: category => {
      const next = { ...get().settings, [category]: DEFAULT_SETTINGS[category] }
      set({ settings: next })
      if (category === 'theme') applyTheme(DEFAULT_THEME)
      debouncedSave(next)
    },

    resetAll: () => {
      set({ settings: DEFAULT_SETTINGS })
      applyTheme(DEFAULT_SETTINGS.theme)
      debouncedSave(DEFAULT_SETTINGS)
    },

    loadSettings: async () => {
      const stored = await loadSettingsFromStorage()
      if (stored) {
        const merged = mergeWithDefaults(stored, DEFAULT_SETTINGS)
        set({ settings: merged, isLoaded: true })
        applyTheme(merged.theme)
      } else {
        set({ isLoaded: true })
        applyTheme(DEFAULT_SETTINGS.theme)
      }
      initThemeListener(get)
      migrateLegacyTheme(get, stored ?? null)
    },
  }
})
