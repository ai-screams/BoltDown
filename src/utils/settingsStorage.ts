import { STORAGE_KEYS } from '@/constants/storage'
import type { AppSettings } from '@/types/settings'
import { invokeTauri, isTauri } from '@/utils/tauri'

function parseSettingsJson(raw: string): Partial<AppSettings> | null {
  try {
    return JSON.parse(raw) as Partial<AppSettings>
  } catch {
    return null
  }
}

export async function loadSettingsFromStorage(): Promise<Partial<AppSettings> | null> {
  if (isTauri()) {
    try {
      const raw = await invokeTauri<string>('read_settings')
      if (raw === 'null' || !raw) return null
      return parseSettingsJson(raw)
    } catch (e) {
      console.error('Failed to load settings from Tauri:', e)
      return null
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings)
    return raw ? parseSettingsJson(raw) : null
  } catch (e) {
    console.error('Failed to load settings from localStorage:', e)
    return null
  }
}

export async function saveSettingsToStorage(settings: AppSettings): Promise<void> {
  const json = JSON.stringify(settings, null, 2)

  if (isTauri()) {
    try {
      await invokeTauri('write_settings', { settings: json })
    } catch (e) {
      console.error('Failed to save settings to Tauri:', e)
    }
    return
  }

  try {
    localStorage.setItem(STORAGE_KEYS.settings, json)
  } catch (e) {
    console.error('Failed to save settings to localStorage:', e)
  }
}
