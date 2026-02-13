import { useCallback, useEffect, useState } from 'react'

import { EditorViewProvider } from '@/contexts/EditorViewContext'
import { useFileSystem } from '@/hooks/useFileSystem'
import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useTabStore } from '@/stores/tabStore'
import type { EditorMode } from '@/types/editor'
import EditorToolbar from '@components/editor/EditorToolbar'
import MarkdownEditor from '@components/editor/MarkdownEditor'
import TabBar from '@components/editor/TabBar'
import Footer from '@components/layout/Footer'
import Header from '@components/layout/Header'
import MainLayout from '@components/layout/MainLayout'
import MarkdownPreview from '@components/preview/MarkdownPreview'
import SettingsModal from '@components/settings/SettingsModal'
import ResizeHandle from '@components/sidebar/ResizeHandle'
import Sidebar from '@components/sidebar/Sidebar'

// Stable slot elements — never recreated on App re-render
const tabBar = <TabBar />
const toolbar = <EditorToolbar />
const editor = <MarkdownEditor />
const preview = <MarkdownPreview />

function App() {
  const mode = useEditorStore(s => s.mode)
  const setMode = useEditorStore(s => s.setMode)
  const { openFile, saveFile, saveFileAs } = useFileSystem()
  const sidebarOpen = useSidebarStore(s => s.isOpen)
  const toggleSidebar = useSidebarStore(s => s.toggle)
  const addRecentFile = useSidebarStore(s => s.addRecentFile)
  const openTab = useTabStore(s => s.openTab)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const loadSettings = useSettingsStore(s => s.loadSettings)

  // Load persisted settings on mount
  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const handleFileOpen = useCallback(
    async (path: string, name: string) => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const text = await invoke<string>('read_file', { path })
        openTab(path, name, text)
        addRecentFile(path, name)
      } catch (e) {
        console.warn('Failed to open file:', path, e)
      }
    },
    [openTab, addRecentFile]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.shiftKey && e.key === 'e') {
        e.preventDefault()
        toggleSidebar()
        return
      }

      if (mod && e.key === 'n') {
        e.preventDefault()
        openTab(null, 'Untitled.md', '')
        return
      }

      if (mod && e.key === '\\') {
        e.preventDefault()
        const cycle: EditorMode[] = ['split', 'source', 'zen']
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

      if (mod && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(prev => !prev)
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, setMode, openFile, saveFile, saveFileAs, toggleSidebar, openTab])

  return (
    <EditorViewProvider>
      <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar onFileOpen={handleFileOpen} />
          {sidebarOpen && <ResizeHandle />}
          <div className="flex flex-1 flex-col overflow-hidden">
            {tabBar}
            <MainLayout toolbar={toolbar} editor={editor} preview={preview} />
          </div>
        </div>
        <Footer />
      </div>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </EditorViewProvider>
  )
}

export default App
