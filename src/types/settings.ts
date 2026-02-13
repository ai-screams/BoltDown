export type ThemeMode = 'light' | 'dark' | 'system'

export type FontFamily = 'jetbrains-mono' | 'fira-code' | 'consolas' | 'system-mono'

export interface ThemeSettings {
  mode: ThemeMode
}

export interface EditorSettings {
  fontFamily: FontFamily
  fontSize: number // 10–24, default 14
  lineHeight: number // 1.2–2.4, default 1.6
  tabSize: number // 2 | 4 | 8, default 2
  wordWrap: boolean // default true
  lineNumbers: boolean // default true
}

export interface PreviewSettings {
  fontSize: number // 12–24, default 16
  lineHeight: number // 1.2–2.4, default 1.6
  codeBlockFontSize: number // 10–20, default 14
  maxWidth: number // 600–1200, default 800 (px)
}

export interface GeneralSettings {
  autoSave: boolean // default false
  autoSaveDelay: number // 1000–10000 ms, default 3000
  restoreLastFile: boolean // default true
}

export interface AppSettings {
  theme: ThemeSettings
  editor: EditorSettings
  preview: PreviewSettings
  general: GeneralSettings
}

export type SettingsCategory = keyof AppSettings

export const DEFAULT_THEME: ThemeSettings = {
  mode: 'system',
}

export const DEFAULT_EDITOR: EditorSettings = {
  fontFamily: 'jetbrains-mono',
  fontSize: 14,
  lineHeight: 1.6,
  tabSize: 2,
  wordWrap: true,
  lineNumbers: true,
}

export const DEFAULT_PREVIEW: PreviewSettings = {
  fontSize: 16,
  lineHeight: 1.6,
  codeBlockFontSize: 14,
  maxWidth: 800,
}

export const DEFAULT_GENERAL: GeneralSettings = {
  autoSave: false,
  autoSaveDelay: 3000,
  restoreLastFile: true,
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: DEFAULT_THEME,
  editor: DEFAULT_EDITOR,
  preview: DEFAULT_PREVIEW,
  general: DEFAULT_GENERAL,
}
