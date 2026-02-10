import { useEffect } from 'react'

import { EditorViewProvider } from '@/contexts/EditorViewContext'
import { useFileSystem } from '@/hooks/useFileSystem'
import { useEditorStore } from '@/stores/editorStore'
import type { EditorMode } from '@/types/editor'
import EditorToolbar from '@components/editor/EditorToolbar'
import MarkdownEditor from '@components/editor/MarkdownEditor'
import Footer from '@components/layout/Footer'
import Header from '@components/layout/Header'
import MainLayout from '@components/layout/MainLayout'
import MarkdownPreview from '@components/preview/MarkdownPreview'

// Stable slot elements — never recreated on App re-render
const toolbar = <EditorToolbar />
const editor = <MarkdownEditor />
const preview = <MarkdownPreview />

function App() {
  const mode = useEditorStore(s => s.mode)
  const setMode = useEditorStore(s => s.setMode)
  const { openFile, saveFile, saveFileAs } = useFileSystem()

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
    <EditorViewProvider>
      <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
        <Header />
        <MainLayout toolbar={toolbar} editor={editor} preview={preview} />
        <Footer />
      </div>
    </EditorViewProvider>
  )
}

export default App
