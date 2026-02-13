import type { AppSettings } from '@/types/settings'
import { isTauri } from '@/utils/tauri'

const STORAGE_KEY = 'boltdown-settings'

export async function loadSettingsFromStorage(): Promise<Partial<AppSettings> | null> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const raw = await invoke<string>('read_settings')
      if (raw === 'null' || !raw) return null
      return JSON.parse(raw) as Partial<AppSettings>
    } catch (e) {
      console.error('Failed to load settings from Tauri:', e)
      return null
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<AppSettings>) : null
  } catch {
    return null
  }
}

export async function saveSettingsToStorage(settings: AppSettings): Promise<void> {
  const json = JSON.stringify(settings, null, 2)

  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('write_settings', { settings: json })
    } catch (e) {
      console.error('Failed to save settings to Tauri:', e)
    }
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, json)
  } catch (e) {
    console.error('Failed to save settings to localStorage:', e)
  }
}
