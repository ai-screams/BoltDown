import { SETTINGS_DEFAULTS } from '@/constants/settingsLimits'
import { DEFAULT_THEME_NAME, THEME_MODES, THEME_PRESETS } from '@/constants/theme'

export type ThemeMode = (typeof THEME_MODES)[number]
export type BuiltInThemeName = (typeof THEME_PRESETS)[number]['name']
export type ThemeName = BuiltInThemeName | (string & {})
export type MermaidSecurityLevel = 'strict' | 'loose'

export type FontFamily = 'jetbrains-mono' | 'fira-code' | 'consolas' | 'system-mono'

export interface ThemeSettings {
  mode: ThemeMode
  name: ThemeName
  customCss: string // user-defined CSS override, default ''
}

export interface EditorSettings {
  fontFamily: FontFamily
  fontSize: number // 10–24, default 14
  lineHeight: number // 1.2–2.4, default 1.6
  tabSize: number // 2 | 4 | 8, default 2
  wordWrap: boolean // default true
  spellcheck: boolean // default true
  lineNumbers: boolean // default true
  focusMode: boolean // default false
  focusContextLines: number // 0–3, default 0
  typewriterMode: boolean // default false
}

export interface PreviewSettings {
  fontSize: number // 12–24, default 16
  lineHeight: number // 1.2–2.4, default 1.6
  codeBlockFontSize: number // 10–20, default 14
  maxWidth: number // 600–1200, default 800 (px)
  mermaidSecurityLevel: MermaidSecurityLevel // default strict
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
  name: DEFAULT_THEME_NAME,
  customCss: '',
}

export const DEFAULT_EDITOR: EditorSettings = {
  fontFamily: 'jetbrains-mono',
  fontSize: SETTINGS_DEFAULTS.editor.fontSize,
  lineHeight: SETTINGS_DEFAULTS.editor.lineHeight,
  tabSize: SETTINGS_DEFAULTS.editor.tabSize,
  wordWrap: SETTINGS_DEFAULTS.editor.wordWrap,
  spellcheck: SETTINGS_DEFAULTS.editor.spellcheck,
  lineNumbers: SETTINGS_DEFAULTS.editor.lineNumbers,
  focusMode: SETTINGS_DEFAULTS.editor.focusMode,
  focusContextLines: SETTINGS_DEFAULTS.editor.focusContextLines,
  typewriterMode: SETTINGS_DEFAULTS.editor.typewriterMode,
}

export const DEFAULT_PREVIEW: PreviewSettings = {
  fontSize: SETTINGS_DEFAULTS.preview.fontSize,
  lineHeight: SETTINGS_DEFAULTS.preview.lineHeight,
  codeBlockFontSize: SETTINGS_DEFAULTS.preview.codeBlockFontSize,
  maxWidth: SETTINGS_DEFAULTS.preview.maxWidth,
  mermaidSecurityLevel: 'strict',
}

export const DEFAULT_GENERAL: GeneralSettings = {
  autoSave: SETTINGS_DEFAULTS.general.autoSave,
  autoSaveDelay: SETTINGS_DEFAULTS.general.autoSaveDelay,
  restoreLastFile: SETTINGS_DEFAULTS.general.restoreLastFile,
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: DEFAULT_THEME,
  editor: DEFAULT_EDITOR,
  preview: DEFAULT_PREVIEW,
  general: DEFAULT_GENERAL,
}
