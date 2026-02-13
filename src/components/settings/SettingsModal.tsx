import { clsx } from 'clsx'
import { Eye, Keyboard, Monitor, Moon, Palette, RotateCcw, Settings, Sun, X } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { useSettingsStore } from '@/stores/settingsStore'
import type { FontFamily, SettingsCategory, ThemeMode } from '@/types/settings'

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
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</div>
        {description && (
          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</div>
        )}
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
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50',
        checked ? 'bg-electric-yellow' : 'bg-gray-300 dark:bg-gray-600'
      )}
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
      value={value}
      onChange={e => onChange(e.target.value as T)}
      className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-electric-yellow focus:outline-none focus:ring-1 focus:ring-electric-yellow/50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
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
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={e => {
        const v = parseFloat(e.target.value)
        if (!Number.isNaN(v) && v >= min && v <= max) onChange(v)
      }}
      className="w-20 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:border-electric-yellow focus:outline-none focus:ring-1 focus:ring-electric-yellow/50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
    />
  )
}

// --- Category panels ---

function ThemePanel() {
  const mode = useSettingsStore(s => s.settings.theme.mode)
  const updateTheme = useSettingsStore(s => s.updateTheme)

  const themes: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ]

  return (
    <div>
      <SettingRow label="Color Theme" description="Choose the application theme">
        <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 dark:border-gray-600 dark:bg-gray-700">
          {themes.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => updateTheme({ mode: value })}
              className={clsx(
                'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95',
                value === mode
                  ? 'bg-electric-yellow text-deep-blue shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
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

function EditorPanel() {
  const editor = useSettingsStore(s => s.settings.editor)
  const updateEditor = useSettingsStore(s => s.updateEditor)

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
      <SettingRow label="Font Family" description="Editor font">
        <Select
          value={editor.fontFamily}
          options={fontFamilyOptions}
          onChange={v => updateEditor({ fontFamily: v })}
        />
      </SettingRow>
      <SettingRow label="Font Size" description="10 - 24px">
        <NumberInput
          value={editor.fontSize}
          min={10}
          max={24}
          onChange={v => updateEditor({ fontSize: v })}
        />
      </SettingRow>
      <SettingRow label="Line Height" description="1.2 - 2.4">
        <NumberInput
          value={editor.lineHeight}
          min={1.2}
          max={2.4}
          step={0.1}
          onChange={v => updateEditor({ lineHeight: v })}
        />
      </SettingRow>
      <SettingRow label="Tab Size">
        <Select
          value={String(editor.tabSize)}
          options={tabSizeOptions}
          onChange={v => updateEditor({ tabSize: parseInt(v, 10) })}
        />
      </SettingRow>
      <SettingRow label="Word Wrap" description="Wrap long lines in the editor">
        <Toggle checked={editor.wordWrap} onChange={v => updateEditor({ wordWrap: v })} />
      </SettingRow>
      <SettingRow label="Line Numbers" description="Show line numbers">
        <Toggle checked={editor.lineNumbers} onChange={v => updateEditor({ lineNumbers: v })} />
      </SettingRow>
    </div>
  )
}

function PreviewPanel() {
  const preview = useSettingsStore(s => s.settings.preview)
  const updatePreview = useSettingsStore(s => s.updatePreview)

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
      <SettingRow label="Font Size" description="12 - 24px">
        <NumberInput
          value={preview.fontSize}
          min={12}
          max={24}
          onChange={v => updatePreview({ fontSize: v })}
        />
      </SettingRow>
      <SettingRow label="Line Height" description="1.2 - 2.4">
        <NumberInput
          value={preview.lineHeight}
          min={1.2}
          max={2.4}
          step={0.1}
          onChange={v => updatePreview({ lineHeight: v })}
        />
      </SettingRow>
      <SettingRow label="Code Block Font Size" description="10 - 20px">
        <NumberInput
          value={preview.codeBlockFontSize}
          min={10}
          max={20}
          onChange={v => updatePreview({ codeBlockFontSize: v })}
        />
      </SettingRow>
      <SettingRow label="Max Width" description="600 - 1200px">
        <NumberInput
          value={preview.maxWidth}
          min={600}
          max={1200}
          step={50}
          onChange={v => updatePreview({ maxWidth: v })}
        />
      </SettingRow>
    </div>
  )
}

function GeneralPanel() {
  const general = useSettingsStore(s => s.settings.general)
  const updateGeneral = useSettingsStore(s => s.updateGeneral)

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
      <SettingRow label="Auto Save" description="Automatically save changes">
        <Toggle checked={general.autoSave} onChange={v => updateGeneral({ autoSave: v })} />
      </SettingRow>
      <SettingRow label="Auto Save Delay" description="1000 - 10000ms">
        <NumberInput
          value={general.autoSaveDelay}
          min={1000}
          max={10000}
          step={500}
          onChange={v => updateGeneral({ autoSaveDelay: v })}
        />
      </SettingRow>
      <SettingRow label="Restore Last File" description="Reopen last file on launch">
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
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div className="animate-dropdown flex h-[480px] w-[640px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        {/* Header */}
        <div className="flex h-12 flex-none items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Settings</span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-gray-500 transition-all duration-150 hover:scale-110 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="flex w-40 flex-none flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
            <nav className="flex-1 py-2">
              {categories.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={clsx(
                    'flex w-full items-center gap-2 px-4 py-2 text-xs font-medium transition-colors',
                    key === activeCategory
                      ? 'bg-electric-yellow/10 text-electric-dark dark:text-electric-yellow'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </nav>

            {/* Reset buttons */}
            <div className="border-t border-gray-200 p-2 dark:border-gray-700">
              <button
                onClick={() => resetCategory(activeCategory)}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-[10px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <RotateCcw className="h-3 w-3" />
                Reset {categories.find(c => c.key === activeCategory)?.label}
              </button>
              <button
                onClick={resetAll}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-[10px] text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
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
