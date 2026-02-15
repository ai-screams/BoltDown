import { useCallback, useEffect, useState } from 'react'

import { EditorViewProvider } from '@/contexts/EditorViewContext'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useFileSystem } from '@/hooks/useFileSystem'
import { useEditorStore } from '@/stores/editorStore'
import { useFindReplaceStore } from '@/stores/findReplaceStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useTabStore } from '@/stores/tabStore'
import type { EditorMode } from '@/types/editor'
import EditorToolbar from '@components/editor/EditorToolbar'
import MarkdownEditor from '@components/editor/MarkdownEditor'
import TabBar from '@components/editor/TabBar'
import FindReplaceModal from '@components/findreplace/FindReplaceModal'
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
  useAutoSave()
  const sidebarOpen = useSidebarStore(s => s.isOpen)
  const sidebarResizing = useSidebarStore(s => s.isResizing)
  const toggleSidebar = useSidebarStore(s => s.toggle)
  const addRecentFile = useSidebarStore(s => s.addRecentFile)
  const openTab = useTabStore(s => s.openTab)
  const openFindReplace = useFindReplaceStore(s => s.open)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const loadSettings = useSettingsStore(s => s.loadSettings)

  // Load persisted settings on mount
  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  // Sync sidebar file tree when active tab changes
  const activeTabId = useTabStore(s => s.activeTabId)
  useEffect(() => {
    const tab = useTabStore.getState().tabs.find(t => t.id === activeTabId)
    if (tab?.filePath) {
      void useSidebarStore.getState().loadParentDirectory(tab.filePath)
    }
  }, [activeTabId])

  const handleFileOpen = useCallback(
    async (path: string, name: string) => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const text = await invoke<string>('read_file', { path })
        openTab(path, name, text)
        addRecentFile(path, name)

        // Auto-load parent directory into sidebar file tree
        await useSidebarStore.getState().loadParentDirectory(path)
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

      if (mod && !e.shiftKey && e.key === 'f') {
        e.preventDefault()
        openFindReplace(false)
        return
      }

      if (mod && !e.shiftKey && e.key === 'h') {
        e.preventDefault()
        openFindReplace(true)
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, setMode, openFile, saveFile, saveFileAs, toggleSidebar, openTab, openFindReplace])

  return (
    <EditorViewProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar onFileOpen={handleFileOpen} />
          {sidebarOpen && <ResizeHandle />}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {tabBar}
            <MainLayout toolbar={toolbar} editor={editor} preview={preview} />
          </div>
        </div>
        <Footer />
      </div>
      {sidebarResizing && <div className="fixed inset-0 z-40 cursor-col-resize" />}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <FindReplaceModal />
    </EditorViewProvider>
  )
}

export default App
