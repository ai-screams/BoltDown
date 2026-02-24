import { clsx } from 'clsx'
import {
  Clipboard,
  Code2,
  Columns2,
  Download,
  FileText,
  FolderOpen,
  HelpCircle,
  Info,
  Keyboard,
  Monitor,
  Moon,
  PenLine,
  Printer,
  Save,
  ScrollText,
  Sun,
  Zap,
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { THEME_MODES } from '@/constants/theme'
import { useExport } from '@/hooks/useExport'
import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { EditorMode } from '@/types/editor'
import IconButton from '@components/common/IconButton'

const modes: { mode: EditorMode; icon: typeof Columns2; label: string }[] = [
  { mode: 'live', icon: PenLine, label: 'Live' },
  { mode: 'split', icon: Columns2, label: 'Split' },
  { mode: 'source', icon: Code2, label: 'Source' },
]

const themeIcon = { light: Sun, dark: Moon, system: Monitor }
const themeLabel = { light: 'Light', dark: 'Dark', system: 'System' }
const EXPORT_MENU_ID = 'header-export-menu'
const HELP_MENU_ID = 'header-help-menu'

const helpActions = [
  { key: 'shortcuts', icon: Keyboard, label: 'Keyboard Shortcuts', action: 'onOpenShortcuts' },
  { key: 'changelog', icon: ScrollText, label: 'Changelog', action: 'onOpenChangelog' },
  { key: 'about', icon: Info, label: 'About BoltDown', action: 'onOpenAbout' },
] as const

interface HelpMenuProps {
  onOpenShortcuts: () => void
  onOpenChangelog: () => void
  onOpenAbout: () => void
}

const HelpMenu = memo(function HelpMenu({
  onOpenShortcuts,
  onOpenChangelog,
  onOpenAbout,
}: HelpMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handlers: Record<string, () => void> = {
    onOpenShortcuts,
    onOpenChangelog,
    onOpenAbout,
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open && itemRefs.current[0]) {
      itemRefs.current[0]?.focus()
    }
  }, [open])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const focusedIndex = itemRefs.current.findIndex(r => r === document.activeElement)
    if (focusedIndex === -1) return

    let nextIndex = focusedIndex
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        nextIndex = (focusedIndex + 1) % helpActions.length
        break
      case 'ArrowUp':
        e.preventDefault()
        nextIndex = (focusedIndex - 1 + helpActions.length) % helpActions.length
        break
      case 'Home':
        e.preventDefault()
        nextIndex = 0
        break
      case 'End':
        e.preventDefault()
        nextIndex = helpActions.length - 1
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        return
      default:
        return
    }
    itemRefs.current[nextIndex]?.focus()
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-controls={HELP_MENU_ID}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Help"
        className={clsx(
          'hover:bg-surface-muted hover:text-fg-secondary focus-visible:ring-electric-yellow/50 rounded-sm p-1.5 transition-[color,background-color,opacity,transform] duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:outline-hidden active:scale-95',
          open ? 'bg-surface-muted text-fg-secondary' : 'text-fg-muted'
        )}
        title="Help"
        onClick={() => setOpen(prev => !prev)}
      >
        <HelpCircle aria-hidden="true" className="h-4 w-4" />
      </button>
      {open && (
        <div
          id={HELP_MENU_ID}
          role="menu"
          className="animate-dropdown border-line bg-surface absolute top-full right-0 z-50 mt-1 w-48 rounded-lg border py-1 shadow-lg"
          onKeyDown={handleKeyDown}
        >
          {helpActions.map((item, index) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                ref={el => {
                  itemRefs.current[index] = el
                }}
                role="menuitem"
                type="button"
                className="text-fg-secondary hover:bg-surface-muted focus-visible:ring-electric-yellow/50 flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
                onClick={() => {
                  handlers[item.action]?.()
                  setOpen(false)
                }}
              >
                <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})

interface HeaderProps {
  onOpenFile: () => void
  onSaveFile: () => void
  onOpenShortcuts: () => void
  onOpenChangelog: () => void
  onOpenAbout: () => void
}

export default memo(function Header({
  onOpenFile,
  onSaveFile,
  onOpenShortcuts,
  onOpenChangelog,
  onOpenAbout,
}: HeaderProps) {
  const mode = useEditorStore(s => s.mode)
  const setMode = useEditorStore(s => s.setMode)
  const themeMode = useSettingsStore(s => s.settings.theme.mode)
  const updateTheme = useSettingsStore(s => s.updateTheme)
  const { exportHtml, exportPdf, copyHtml } = useExport()

  const cycleTheme = useCallback(() => {
    const idx = THEME_MODES.indexOf(themeMode)
    updateTheme({ mode: THEME_MODES[(idx + 1) % THEME_MODES.length]! })
  }, [themeMode, updateTheme])

  const toggleExportOpen = useCallback(() => {
    setExportOpen(prev => !prev)
  }, [])

  const ThemeIcon = themeIcon[themeMode]
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const menuItemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const exportActions = useMemo(
    () => [
      {
        key: 'export-html',
        icon: FileText,
        label: 'Export HTML',
        run: () => {
          void exportHtml()
        },
      },
      {
        key: 'export-pdf',
        icon: Printer,
        label: 'Print / PDF',
        run: exportPdf,
      },
      {
        key: 'copy-html',
        icon: Clipboard,
        label: 'Copy HTML',
        run: () => {
          void copyHtml()
        },
      },
    ],
    [exportHtml, exportPdf, copyHtml]
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!exportOpen) return
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportOpen])

  // Focus first menu item when menu opens
  useEffect(() => {
    if (exportOpen && menuItemRefs.current[0]) {
      menuItemRefs.current[0]?.focus()
    }
  }, [exportOpen])

  const handleMenuKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const focusedIndex = menuItemRefs.current.findIndex(ref => ref === document.activeElement)
      if (focusedIndex === -1) return

      let nextIndex = focusedIndex

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          nextIndex = (focusedIndex + 1) % exportActions.length
          break
        case 'ArrowUp':
          e.preventDefault()
          nextIndex = (focusedIndex - 1 + exportActions.length) % exportActions.length
          break
        case 'Home':
          e.preventDefault()
          nextIndex = 0
          break
        case 'End':
          e.preventDefault()
          nextIndex = exportActions.length - 1
          break
        case 'Escape':
          e.preventDefault()
          setExportOpen(false)
          return
        default:
          return
      }

      menuItemRefs.current[nextIndex]?.focus()
    },
    [exportActions.length]
  )

  return (
    <header className="border-line bg-surface flex h-12 flex-none items-center justify-between border-b px-4">
      <div className="flex items-center gap-2">
        <Zap aria-hidden="true" className="text-electric-yellow h-5 w-5" fill="currentColor" />
        <span className="text-fg text-sm font-semibold">BoltDown</span>
        <div className="ml-2 flex items-center gap-0.5">
          <IconButton icon={FolderOpen} label="Open file" shortcut="Cmd+O" onClick={onOpenFile} />
          <IconButton icon={Save} label="Save file" shortcut="Cmd+S" onClick={onSaveFile} />

          <div ref={exportRef} className="relative">
            <button
              type="button"
              aria-controls={EXPORT_MENU_ID}
              aria-expanded={exportOpen}
              aria-haspopup="menu"
              aria-label="Export"
              className="text-fg-muted hover:bg-surface-muted hover:text-fg-secondary focus-visible:ring-electric-yellow/50 rounded-sm p-1.5 transition-[color,background-color,opacity,transform] duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:outline-hidden active:scale-95"
              title="Export"
              onClick={toggleExportOpen}
            >
              <Download aria-hidden="true" className="h-4 w-4" />
            </button>
            {exportOpen && (
              <div
                id={EXPORT_MENU_ID}
                role="menu"
                className="animate-dropdown border-line bg-surface absolute top-full left-0 z-50 mt-1 w-40 rounded-lg border py-1 shadow-lg"
                onKeyDown={handleMenuKeyDown}
              >
                {exportActions.map((action, index) => {
                  const ActionIcon = action.icon
                  return (
                    <button
                      key={action.key}
                      ref={el => {
                        menuItemRefs.current[index] = el
                      }}
                      role="menuitem"
                      type="button"
                      className="text-fg-secondary hover:bg-surface-muted focus-visible:ring-electric-yellow/50 flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
                      onClick={() => {
                        action.run()
                        setExportOpen(false)
                      }}
                    >
                      <ActionIcon aria-hidden="true" className="h-3.5 w-3.5" />
                      {action.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="border-line bg-surface-muted flex rounded-lg border p-0.5">
          {modes.map(({ mode: m, icon: Icon, label }) => (
            <button
              key={m}
              type="button"
              aria-label={`Switch to ${label} mode`}
              aria-pressed={m === mode}
              className={clsx(
                'focus-visible:ring-electric-yellow/50 flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-[color,background-color,opacity,transform] duration-150 focus-visible:ring-2 focus-visible:outline-hidden active:scale-95',
                m === mode
                  ? 'bg-electric-yellow text-deep-blue shadow-xs'
                  : 'text-fg-muted hover:text-fg-secondary'
              )}
              title={label}
              onClick={() => setMode(m)}
            >
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <HelpMenu
          onOpenAbout={onOpenAbout}
          onOpenChangelog={onOpenChangelog}
          onOpenShortcuts={onOpenShortcuts}
        />

        <button
          type="button"
          aria-label={`Theme mode: ${themeLabel[themeMode]}`}
          className="text-fg-muted hover:bg-surface-muted hover:text-fg-secondary focus-visible:ring-electric-yellow/50 rounded-sm p-1.5 transition-[color,background-color,opacity,transform] duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:outline-hidden active:scale-95"
          title={`Theme mode: ${themeLabel[themeMode]}`}
          onClick={cycleTheme}
        >
          <ThemeIcon aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
})
