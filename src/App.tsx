import { useEffect } from 'react'

import { useExport } from '@/hooks/useExport'
import { useFileSystem } from '@/hooks/useFileSystem'
import { useTheme } from '@/hooks/useTheme'
import { useEditorStore } from '@/stores/editorStore'
import type { EditorMode } from '@/types/editor'
import MarkdownEditor from '@components/editor/MarkdownEditor'
import Footer from '@components/layout/Footer'
import Header from '@components/layout/Header'
import MainLayout from '@components/layout/MainLayout'
import MarkdownPreview from '@components/preview/MarkdownPreview'

function App() {
  const { content, setContent, fileName, isDirty, mode, setMode, wordCount, readingTime } =
    useEditorStore()
  const { openFile, saveFile, saveFileAs } = useFileSystem()
  const { theme, cycleTheme, isDark } = useTheme()
  const { exportHtml, exportPdf, copyHtml } = useExport()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key === '\\') {
        e.preventDefault()
        const cycle: EditorMode[] = ['split', 'source', 'wysiwyg']
        const idx = cycle.indexOf(mode)
        setMode(cycle[(idx + 1) % cycle.length]!)
        return
      }

      if (mod && e.key === 'o') {
        e.preventDefault()
        void openFile()
        return
      }

      if (mod && !e.shiftKey && e.key === 's') {
        e.preventDefault()
        void saveFile()
        return
      }

      if (mod && e.shiftKey && e.key === 's') {
        e.preventDefault()
        void saveFileAs()
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, setMode, openFile, saveFile, saveFileAs])

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <Header
        fileName={fileName}
        isDirty={isDirty}
        mode={mode}
        onModeChange={setMode}
        onOpenFile={openFile}
        onSaveFile={saveFile}
        theme={theme}
        onCycleTheme={cycleTheme}
        onExportHtml={() => void exportHtml()}
        onExportPdf={exportPdf}
        onCopyHtml={() => void copyHtml()}
      />
      <MainLayout
        mode={mode}
        editor={
          <MarkdownEditor value={content} onChange={setContent} isDark={isDark} mode={mode} />
        }
        preview={<MarkdownPreview content={content} />}
      />
      <Footer charCount={content.length} wordCount={wordCount} readingTime={readingTime} />
    </div>
  )
}

export default App
