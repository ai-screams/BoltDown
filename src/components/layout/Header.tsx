import { clsx } from 'clsx'
import {
  Clipboard,
  Code2,
  Columns2,
  Download,
  Eye,
  FileText,
  FolderOpen,
  HelpCircle,
  Info,
  Keyboard,
  Monitor,
  Moon,
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
  { mode: 'split', icon: Columns2, label: 'Split' },
  { mode: 'source', icon: Code2, label: 'Source' },
  { mode: 'zen', icon: Eye, label: 'Zen' },
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
          'rounded p-1.5 transition-[color,background-color,opacity,transform] duration-150 hover:scale-110 hover:bg-surface-muted hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95',
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
          className="animate-dropdown absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-line bg-surface py-1 shadow-lg"
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
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-fg-secondary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50"
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
    <header className="flex h-12 flex-none items-center justify-between border-b border-line bg-surface px-4">
      <div className="flex items-center gap-2">
        <Zap aria-hidden="true" className="h-5 w-5 text-electric-yellow" fill="currentColor" />
        <span className="text-sm font-semibold text-fg">BoltDown</span>
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
              className="rounded p-1.5 text-fg-muted transition-[color,background-color,opacity,transform] duration-150 hover:scale-110 hover:bg-surface-muted hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95"
              title="Export"
              onClick={toggleExportOpen}
            >
              <Download aria-hidden="true" className="h-4 w-4" />
            </button>
            {exportOpen && (
              <div
                id={EXPORT_MENU_ID}
                role="menu"
                className="animate-dropdown absolute left-0 top-full z-50 mt-1 w-40 rounded-lg border border-line bg-surface py-1 shadow-lg"
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
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-fg-secondary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50"
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
        <div className="flex rounded-lg border border-line bg-surface-muted p-0.5">
          {modes.map(({ mode: m, icon: Icon, label }) => (
            <button
              key={m}
              type="button"
              aria-label={`Switch to ${label} mode`}
              aria-pressed={m === mode}
              className={clsx(
                'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-[color,background-color,opacity,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95',
                m === mode
                  ? 'bg-electric-yellow text-deep-blue shadow-sm'
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
          className="rounded p-1.5 text-fg-muted transition-[color,background-color,opacity,transform] duration-150 hover:scale-110 hover:bg-surface-muted hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95"
          title={`Theme mode: ${themeLabel[themeMode]}`}
          onClick={cycleTheme}
        >
          <ThemeIcon aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
})
