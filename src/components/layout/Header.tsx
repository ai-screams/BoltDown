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
import { useEffect, useRef, useState } from 'react'

import type { EditorMode } from '@/types/editor'

type Theme = 'light' | 'dark' | 'system'

interface HeaderProps {
  fileName: string
  isDirty: boolean
  mode: EditorMode
  onModeChange: (mode: EditorMode) => void
  onOpenFile: () => void
  onSaveFile: () => void
  theme: Theme
  onCycleTheme: () => void
  onExportHtml: () => void
  onExportPdf: () => void
  onCopyHtml: () => void
}

const modes: { mode: EditorMode; icon: typeof Columns2; label: string }[] = [
  { mode: 'split', icon: Columns2, label: 'Split' },
  { mode: 'source', icon: Code2, label: 'Source' },
  { mode: 'wysiwyg', icon: Eye, label: 'WYSIWYG' },
]

const themeIcon = { light: Sun, dark: Moon, system: Monitor }
const themeLabel = { light: 'Light', dark: 'Dark', system: 'System' }

export default function Header({
  fileName,
  isDirty,
  mode,
  onModeChange,
  onOpenFile,
  onSaveFile,
  theme,
  onCycleTheme,
  onExportHtml,
  onExportPdf,
  onCopyHtml,
}: HeaderProps) {
  const ThemeIcon = themeIcon[theme]
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
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {fileName}
          {isDirty && <span className="ml-1 text-electric-yellow">●</span>}
        </span>
        <div className="ml-2 flex items-center gap-0.5">
          <button
            onClick={onOpenFile}
            title="Open (Cmd+O)"
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <FolderOpen className="h-4 w-4" />
          </button>
          <button
            onClick={onSaveFile}
            title="Save (Cmd+S)"
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <Save className="h-4 w-4" />
          </button>

          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(prev => !prev)}
              title="Export"
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <Download className="h-4 w-4" />
            </button>
            {exportOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                <button
                  onClick={() => {
                    onExportHtml()
                    setExportOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Export HTML
                </button>
                <button
                  onClick={() => {
                    onExportPdf()
                    setExportOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print / PDF
                </button>
                <button
                  onClick={() => {
                    void onCopyHtml()
                    setExportOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
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
              onClick={() => onModeChange(m)}
              title={label}
              className={clsx(
                'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
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
          onClick={onCycleTheme}
          title={`Theme: ${themeLabel[theme]}`}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <ThemeIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
