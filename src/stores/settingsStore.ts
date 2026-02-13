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

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,

  updateTheme: patch => {
    const next = { ...get().settings, theme: { ...get().settings.theme, ...patch } }
    set({ settings: next })
    applyTheme(next.theme.mode)
    debouncedSave(next)
  },

  updateEditor: patch => {
    const next = { ...get().settings, editor: { ...get().settings.editor, ...patch } }
    set({ settings: next })
    debouncedSave(next)
  },

  updatePreview: patch => {
    const next = { ...get().settings, preview: { ...get().settings.preview, ...patch } }
    set({ settings: next })
    debouncedSave(next)
  },

  updateGeneral: patch => {
    const next = { ...get().settings, general: { ...get().settings.general, ...patch } }
    set({ settings: next })
    debouncedSave(next)
  },

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

    // System theme change listener (migrated from useTheme.ts)
    if (!themeListenerRegistered) {
      themeListenerRegistered = true
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const { settings } = useSettingsStore.getState()
        if (settings.theme.mode === 'system') {
          applyTheme('system')
        }
      })
    }

    // One-time migration: old boltdown-theme localStorage key
    const oldTheme = localStorage.getItem('boltdown-theme')
    if (oldTheme && !stored?.theme) {
      const mode = oldTheme as ThemeMode
      if (['light', 'dark', 'system'].includes(mode)) {
        useSettingsStore.getState().updateTheme({ mode })
      }
      localStorage.removeItem('boltdown-theme')
    }
  },
}))
