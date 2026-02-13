import { clsx } from 'clsx'
import {
  Clipboard,
  Code2,
  Columns2,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Monitor,
  Moon,
  Printer,
  Save,
  Sun,
  Zap,
} from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'

import { useExport } from '@/hooks/useExport'
import { useFileSystem } from '@/hooks/useFileSystem'
import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import type { EditorMode } from '@/types/editor'
import type { ThemeMode } from '@/types/settings'

const modes: { mode: EditorMode; icon: typeof Columns2; label: string }[] = [
  { mode: 'split', icon: Columns2, label: 'Split' },
  { mode: 'source', icon: Code2, label: 'Source' },
  { mode: 'zen', icon: Eye, label: 'Zen' },
]

const themeIcon = { light: Sun, dark: Moon, system: Monitor }
const themeLabel = { light: 'Light', dark: 'Dark', system: 'System' }

export default memo(function Header() {
  const mode = useEditorStore(s => s.mode)
  const setMode = useEditorStore(s => s.setMode)
  const { openFile, saveFile } = useFileSystem()
  const themeMode = useSettingsStore(s => s.settings.theme.mode)
  const updateTheme = useSettingsStore(s => s.updateTheme)
  const { exportHtml, exportPdf, copyHtml } = useExport()

  const cycleTheme = () => {
    const order: ThemeMode[] = ['light', 'dark', 'system']
    const idx = order.indexOf(themeMode)
    updateTheme({ mode: order[(idx + 1) % order.length]! })
  }

  const ThemeIcon = themeIcon[themeMode]
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

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

  return (
    <header className="flex h-12 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-electric-yellow" fill="currentColor" />
        <span className="text-sm font-semibold text-gray-900 dark:text-white">BoltDown</span>
        <div className="ml-2 flex items-center gap-0.5">
          <button
            onClick={openFile}
            title="Open (Cmd+O)"
            className="rounded p-1.5 text-gray-500 transition-all duration-150 hover:scale-110 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <FolderOpen className="h-4 w-4" />
          </button>
          <button
            onClick={saveFile}
            title="Save (Cmd+S)"
            className="rounded p-1.5 text-gray-500 transition-all duration-150 hover:scale-110 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <Save className="h-4 w-4" />
          </button>

          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(prev => !prev)}
              title="Export"
              className="rounded p-1.5 text-gray-500 transition-all duration-150 hover:scale-110 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <Download className="h-4 w-4" />
            </button>
            {exportOpen && (
              <div className="animate-dropdown absolute left-0 top-full z-50 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                <button
                  onClick={() => {
                    exportHtml()
                    setExportOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Export HTML
                </button>
                <button
                  onClick={() => {
                    exportPdf()
                    setExportOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print / PDF
                </button>
                <button
                  onClick={() => {
                    void copyHtml()
                    setExportOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  Copy HTML
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 dark:border-gray-600 dark:bg-gray-700">
          {modes.map(({ mode: m, icon: Icon, label }) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              title={label}
              className={clsx(
                'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95',
                m === mode
                  ? 'bg-electric-yellow text-deep-blue shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={cycleTheme}
          title={`Theme: ${themeLabel[themeMode]}`}
          className="rounded p-1.5 text-gray-500 transition-all duration-150 hover:scale-110 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <ThemeIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
})
