import { clsx } from 'clsx'
import {
  Check,
  Eye,
  Keyboard,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Settings,
  Sun,
  X,
} from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import {
  EDITOR_SETTING_LIMITS,
  GENERAL_SETTING_LIMITS,
  PREVIEW_SETTING_LIMITS,
} from '@/constants/settingsLimits'
import { THEME_MODES, THEME_PRESETS } from '@/constants/theme'
import { useSettingsStore } from '@/stores/settingsStore'
import type {
  FontFamily,
  MermaidSecurityLevel,
  SettingsCategory,
  ThemeMode,
} from '@/types/settings'

// --- Category definitions ---

const categories: { key: SettingsCategory; label: string; icon: typeof Settings }[] = [
  { key: 'theme', label: 'Theme', icon: Palette },
  { key: 'editor', label: 'Editor', icon: Keyboard },
  { key: 'preview', label: 'Preview', icon: Eye },
  { key: 'general', label: 'General', icon: Settings },
]

// --- Shared control components ---

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-fg">{label}</div>
        {description && <div className="mt-0.5 text-xs text-fg-muted">{description}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      className={clsx(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50',
        checked ? 'bg-electric-yellow' : 'bg-surface-muted'
      )}
      onClick={() => onChange(!checked)}
    >
      <span
        className={clsx(
          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        )}
      />
    </button>
  )
}

function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <select
      className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg-secondary focus:border-electric-yellow focus:outline-none focus:ring-1 focus:ring-electric-yellow/50"
      value={value}
      onChange={e => onChange(e.target.value as T)}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function NumberInput({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)

  // Sync draft when value changes externally (e.g. reset)
  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  const commit = () => {
    const v = parseFloat(draft)
    if (!Number.isNaN(v) && v >= min && v <= max) {
      onChange(v)
    } else {
      setDraft(String(value))
    }
  }

  return (
    <input
      type="number"
      className="w-20 rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg-secondary focus:border-electric-yellow focus:outline-none focus:ring-1 focus:ring-electric-yellow/50"
      max={max}
      min={min}
      step={step ?? 1}
      value={focused ? draft : String(value)}
      onBlur={() => {
        setFocused(false)
        commit()
      }}
      onChange={e => {
        const raw = e.target.value
        setDraft(raw)
        const v = parseFloat(raw)
        if (!Number.isNaN(v) && v >= min && v <= max) onChange(v)
      }}
      onFocus={() => setFocused(true)}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.currentTarget.blur()
        }
      }}
    />
  )
}

// --- Category panels ---

const themeModeMeta: Record<ThemeMode, { icon: typeof Sun; label: string }> = {
  light: { icon: Sun, label: 'Light' },
  dark: { icon: Moon, label: 'Dark' },
  system: { icon: Monitor, label: 'System' },
}

const ThemeModeControl = memo(function ThemeModeControl() {
  const mode = useSettingsStore(s => s.settings.theme.mode)
  const updateTheme = useSettingsStore(s => s.updateTheme)

  return (
    <div className="flex rounded-lg border border-line bg-surface-muted p-0.5">
      {THEME_MODES.map(value => {
        const Icon = themeModeMeta[value].icon
        const label = themeModeMeta[value].label

        return (
          <button
            key={value}
            type="button"
            aria-pressed={value === mode}
            className={clsx(
              'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95',
              value === mode
                ? 'bg-electric-yellow text-deep-blue shadow-sm'
                : 'text-fg-muted hover:text-fg-secondary'
            )}
            onClick={() => updateTheme({ mode: value })}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
})

const ThemePresetControl = memo(function ThemePresetControl() {
  const name = useSettingsStore(s => s.settings.theme.name)
  const updateTheme = useSettingsStore(s => s.updateTheme)

  return (
    <div className="grid w-72 grid-cols-2 gap-2">
      {THEME_PRESETS.map(preset => {
        const isActive = preset.name === name

        return (
          <button
            key={preset.name}
            type="button"
            aria-label={`${preset.label} theme`}
            aria-pressed={isActive}
            className={clsx(
              'rounded-lg border px-2.5 py-2 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50',
              isActive
                ? 'border-electric-yellow bg-electric-yellow/10'
                : 'border-line bg-surface hover:border-electric-yellow/60'
            )}
            onClick={() => updateTheme({ name: preset.name })}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-fg">{preset.label}</span>
              {isActive && <Check className="h-3.5 w-3.5 text-electric-yellow" />}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-fg-secondary">{preset.description}</p>
            <div className="mt-2 flex flex-col gap-1">
              <div className="flex items-center gap-0.5">
                {preset.swatches.map((swatch, index) => (
                  <span
                    key={`${preset.name}-${index}`}
                    aria-hidden
                    className="h-3 w-3 rounded-full border border-black/10 dark:border-white/20"
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full border border-black/10 dark:border-white/20"
                  style={{ backgroundColor: preset.info }}
                />
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full border border-black/10 dark:border-white/20"
                  style={{ backgroundColor: preset.danger }}
                />
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
})

function ThemePanel() {
  return (
    <div className="divide-y divide-line">
      <SettingRow description="Light, dark, or follow system preference" label="Theme Mode">
        <ThemeModeControl />
      </SettingRow>
      <SettingRow description="Choose a color set for the interface" label="Theme Preset">
        <ThemePresetControl />
      </SettingRow>
    </div>
  )
}

const fontFamilyOptions: { value: FontFamily; label: string }[] = [
  { value: 'jetbrains-mono', label: 'JetBrains Mono' },
  { value: 'fira-code', label: 'Fira Code' },
  { value: 'consolas', label: 'Consolas' },
  { value: 'system-mono', label: 'System Mono' },
]

const tabSizeOptions = [
  { value: '2', label: '2' },
  { value: '4', label: '4' },
  { value: '8', label: '8' },
]

const mermaidSecurityOptions: { value: MermaidSecurityLevel; label: string }[] = [
  { value: 'strict', label: 'Strict (Recommended)' },
  { value: 'loose', label: 'Loose (Compat)' },
]

function EditorPanel() {
  const editor = useSettingsStore(s => s.settings.editor)
  const updateEditor = useSettingsStore(s => s.updateEditor)

  return (
    <div className="divide-y divide-line">
      <SettingRow description="Editor font" label="Font Family">
        <Select
          options={fontFamilyOptions}
          value={editor.fontFamily}
          onChange={v => updateEditor({ fontFamily: v })}
        />
      </SettingRow>
      <SettingRow
        description={`${EDITOR_SETTING_LIMITS.fontSize.min} - ${EDITOR_SETTING_LIMITS.fontSize.max}px`}
        label="Font Size"
      >
        <NumberInput
          max={EDITOR_SETTING_LIMITS.fontSize.max}
          min={EDITOR_SETTING_LIMITS.fontSize.min}
          value={editor.fontSize}
          onChange={v => updateEditor({ fontSize: v })}
        />
      </SettingRow>
      <SettingRow
        description={`${EDITOR_SETTING_LIMITS.lineHeight.min} - ${EDITOR_SETTING_LIMITS.lineHeight.max}`}
        label="Line Height"
      >
        <NumberInput
          max={EDITOR_SETTING_LIMITS.lineHeight.max}
          min={EDITOR_SETTING_LIMITS.lineHeight.min}
          step={EDITOR_SETTING_LIMITS.lineHeight.step}
          value={editor.lineHeight}
          onChange={v => updateEditor({ lineHeight: v })}
        />
      </SettingRow>
      <SettingRow label="Tab Size">
        <Select
          options={tabSizeOptions}
          value={String(editor.tabSize)}
          onChange={v => updateEditor({ tabSize: parseInt(v, 10) })}
        />
      </SettingRow>
      <SettingRow description="Wrap long lines in the editor" label="Word Wrap">
        <Toggle checked={editor.wordWrap} onChange={v => updateEditor({ wordWrap: v })} />
      </SettingRow>
      <SettingRow description="Underline misspelled words while typing" label="Spellcheck">
        <Toggle checked={editor.spellcheck} onChange={v => updateEditor({ spellcheck: v })} />
      </SettingRow>
      <SettingRow description="Show line numbers" label="Line Numbers">
        <Toggle checked={editor.lineNumbers} onChange={v => updateEditor({ lineNumbers: v })} />
      </SettingRow>
      <SettingRow description="Dim lines except cursor line" label="Focus Mode">
        <Toggle checked={editor.focusMode} onChange={v => updateEditor({ focusMode: v })} />
      </SettingRow>
      {editor.focusMode && (
        <SettingRow
          description={`Bright lines around cursor (${EDITOR_SETTING_LIMITS.focusContextLines.min}-${EDITOR_SETTING_LIMITS.focusContextLines.max})`}
          label="Focus Context Lines"
        >
          <NumberInput
            max={EDITOR_SETTING_LIMITS.focusContextLines.max}
            min={EDITOR_SETTING_LIMITS.focusContextLines.min}
            value={editor.focusContextLines}
            onChange={v => updateEditor({ focusContextLines: v })}
          />
        </SettingRow>
      )}
      <SettingRow description="Keep cursor line vertically centered" label="Typewriter Mode">
        <Toggle
          checked={editor.typewriterMode}
          onChange={v => updateEditor({ typewriterMode: v })}
        />
      </SettingRow>
    </div>
  )
}

function PreviewPanel() {
  const preview = useSettingsStore(s => s.settings.preview)
  const updatePreview = useSettingsStore(s => s.updatePreview)

  return (
    <div className="divide-y divide-line">
      <SettingRow
        description={`${PREVIEW_SETTING_LIMITS.fontSize.min} - ${PREVIEW_SETTING_LIMITS.fontSize.max}px`}
        label="Font Size"
      >
        <NumberInput
          max={PREVIEW_SETTING_LIMITS.fontSize.max}
          min={PREVIEW_SETTING_LIMITS.fontSize.min}
          value={preview.fontSize}
          onChange={v => updatePreview({ fontSize: v })}
        />
      </SettingRow>
      <SettingRow
        description={`${PREVIEW_SETTING_LIMITS.lineHeight.min} - ${PREVIEW_SETTING_LIMITS.lineHeight.max}`}
        label="Line Height"
      >
        <NumberInput
          max={PREVIEW_SETTING_LIMITS.lineHeight.max}
          min={PREVIEW_SETTING_LIMITS.lineHeight.min}
          step={PREVIEW_SETTING_LIMITS.lineHeight.step}
          value={preview.lineHeight}
          onChange={v => updatePreview({ lineHeight: v })}
        />
      </SettingRow>
      <SettingRow
        description={`${PREVIEW_SETTING_LIMITS.codeBlockFontSize.min} - ${PREVIEW_SETTING_LIMITS.codeBlockFontSize.max}px`}
        label="Code Block Font Size"
      >
        <NumberInput
          max={PREVIEW_SETTING_LIMITS.codeBlockFontSize.max}
          min={PREVIEW_SETTING_LIMITS.codeBlockFontSize.min}
          value={preview.codeBlockFontSize}
          onChange={v => updatePreview({ codeBlockFontSize: v })}
        />
      </SettingRow>
      <SettingRow
        description={`${PREVIEW_SETTING_LIMITS.maxWidth.min} - ${PREVIEW_SETTING_LIMITS.maxWidth.max}px`}
        label="Max Width"
      >
        <NumberInput
          max={PREVIEW_SETTING_LIMITS.maxWidth.max}
          min={PREVIEW_SETTING_LIMITS.maxWidth.min}
          step={PREVIEW_SETTING_LIMITS.maxWidth.step}
          value={preview.maxWidth}
          onChange={v => updatePreview({ maxWidth: v })}
        />
      </SettingRow>
      <SettingRow
        description="Strict is safer. Loose allows broader diagram HTML behavior"
        label="Mermaid Security"
      >
        <Select
          options={mermaidSecurityOptions}
          value={preview.mermaidSecurityLevel}
          onChange={v => updatePreview({ mermaidSecurityLevel: v })}
        />
      </SettingRow>
    </div>
  )
}

function GeneralPanel() {
  const general = useSettingsStore(s => s.settings.general)
  const updateGeneral = useSettingsStore(s => s.updateGeneral)

  return (
    <div className="divide-y divide-line">
      <SettingRow description="Automatically save changes" label="Auto Save">
        <Toggle checked={general.autoSave} onChange={v => updateGeneral({ autoSave: v })} />
      </SettingRow>
      <SettingRow
        description={`${GENERAL_SETTING_LIMITS.autoSaveDelay.min} - ${GENERAL_SETTING_LIMITS.autoSaveDelay.max}ms`}
        label="Auto Save Delay"
      >
        <NumberInput
          max={GENERAL_SETTING_LIMITS.autoSaveDelay.max}
          min={GENERAL_SETTING_LIMITS.autoSaveDelay.min}
          step={GENERAL_SETTING_LIMITS.autoSaveDelay.step}
          value={general.autoSaveDelay}
          onChange={v => updateGeneral({ autoSaveDelay: v })}
        />
      </SettingRow>
      <SettingRow description="Reopen last file on launch" label="Restore Last File">
        <Toggle
          checked={general.restoreLastFile}
          onChange={v => updateGeneral({ restoreLastFile: v })}
        />
      </SettingRow>
    </div>
  )
}

const panels: Record<SettingsCategory, React.FC> = {
  theme: ThemePanel,
  editor: EditorPanel,
  preview: PreviewPanel,
  general: GeneralPanel,
}

// --- Main modal ---

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default memo(function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('theme')
  const resetCategory = useSettingsStore(s => s.resetCategory)
  const resetAll = useSettingsStore(s => s.resetAll)
  const backdropRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose()
    },
    [onClose]
  )

  if (!isOpen) return null

  const Panel = panels[activeCategory]

  return (
    <div
      ref={backdropRef}
      className="z-60 fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="animate-dropdown flex h-[480px] w-[640px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex h-12 flex-none items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-fg-muted" />
            <span className="text-sm font-semibold text-fg">Settings</span>
          </div>
          <button
            className="rounded p-1.5 text-fg-muted transition-all duration-150 hover:scale-110 hover:bg-surface-muted hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="flex w-40 flex-none flex-col border-r border-line bg-surface-canvas">
            <nav className="flex-1 py-2">
              {categories.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  className={clsx(
                    'flex w-full items-center gap-2 px-4 py-2 text-xs font-medium transition-colors',
                    key === activeCategory
                      ? 'bg-electric-yellow/10 text-electric-dark'
                      : 'text-fg-secondary hover:bg-surface-muted hover:text-fg'
                  )}
                  onClick={() => setActiveCategory(key)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </nav>

            {/* Reset buttons */}
            <div className="border-t border-line p-2">
              <button
                className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-[10px] text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg-secondary"
                onClick={() => resetCategory(activeCategory)}
              >
                <RotateCcw className="h-3 w-3" />
                Reset {categories.find(c => c.key === activeCategory)?.label}
              </button>
              <button
                className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-[10px] text-fg-muted transition-colors hover:bg-danger/10 hover:text-danger"
                onClick={resetAll}
              >
                <RotateCcw className="h-3 w-3" />
                Reset All
              </button>
            </div>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Panel />
          </div>
        </div>
      </div>
    </div>
  )
})
