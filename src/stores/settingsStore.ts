import { create } from 'zustand'

import type {
  AppSettings,
  EditorSettings,
  GeneralSettings,
  PreviewSettings,
  SettingsCategory,
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
  }, 500)
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(mode: ThemeMode) {
  const resolved = mode === 'system' ? getSystemTheme() : mode
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

function mergeWithDefaults(stored: Partial<AppSettings>, defaults: AppSettings): AppSettings {
  return {
    theme: { ...defaults.theme, ...stored.theme },
    editor: { ...defaults.editor, ...stored.editor },
    preview: { ...defaults.preview, ...stored.preview },
    general: { ...defaults.general, ...stored.general },
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
    const next = {
      ...previous,
      [category]: {
        ...previous[category],
        ...patch,
      },
    } as AppSettings

    set({ settings: next })
    if (category === 'theme') applyTheme(next.theme.mode)
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
      if (category === 'theme') applyTheme(DEFAULT_THEME.mode)
      debouncedSave(next)
    },

    resetAll: () => {
      set({ settings: DEFAULT_SETTINGS })
      applyTheme(DEFAULT_SETTINGS.theme.mode)
      debouncedSave(DEFAULT_SETTINGS)
    },

    loadSettings: async () => {
      const stored = await loadSettingsFromStorage()
      if (stored) {
        const merged = mergeWithDefaults(stored, DEFAULT_SETTINGS)
        set({ settings: merged, isLoaded: true })
        applyTheme(merged.theme.mode)
      } else {
        set({ isLoaded: true })
        applyTheme(DEFAULT_SETTINGS.theme.mode)
      }

      if (!themeListenerRegistered) {
        themeListenerRegistered = true
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        mediaQuery.addEventListener('change', () => {
          const { settings } = get()
          if (settings.theme.mode === 'system') {
            applyTheme('system')
          }
        })
      }

      const oldTheme = localStorage.getItem('boltdown-theme')
      if (oldTheme && !stored?.theme) {
        const mode = oldTheme as ThemeMode
        if (['light', 'dark', 'system'].includes(mode)) {
          get().updateTheme({ mode })
        }
        localStorage.removeItem('boltdown-theme')
      }
    },
  }
})
