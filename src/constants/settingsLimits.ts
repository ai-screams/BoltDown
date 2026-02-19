export const EDITOR_SETTING_LIMITS = {
  fontSize: { min: 10, max: 24 },
  lineHeight: { min: 1.2, max: 2.4, step: 0.1 },
  focusContextLines: { min: 0, max: 3 },
} as const

export const PREVIEW_SETTING_LIMITS = {
  fontSize: { min: 12, max: 24 },
  lineHeight: { min: 1.2, max: 2.4, step: 0.1 },
  codeBlockFontSize: { min: 10, max: 20 },
  maxWidth: { min: 600, max: 1200, step: 50 },
} as const

export const GENERAL_SETTING_LIMITS = {
  autoSaveDelay: { min: 1000, max: 10000, step: 500 },
} as const

export const SETTINGS_DEFAULTS = {
  editor: {
    fontSize: 14,
    lineHeight: 1.6,
    tabSize: 2,
    wordWrap: true,
    spellcheck: true,
    lineNumbers: true,
    focusMode: false,
    focusContextLines: 0,
    typewriterMode: false,
    vimMode: false,
  },
  preview: {
    fontSize: 16,
    lineHeight: 1.6,
    codeBlockFontSize: 14,
    maxWidth: 800,
  },
  general: {
    autoSave: false,
    autoSaveDelay: 3000,
    restoreLastFile: true,
    autoUpdate: true,
  },
} as const

export const CUSTOM_CSS_LIMITS = {
  maxLength: 10240,
  warningThreshold: 8192,
  debounceMs: 150,
} as const

export const SETTINGS_POLICY = {
  saveDebounceMs: 500,
} as const
