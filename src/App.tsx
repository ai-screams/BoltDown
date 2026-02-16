import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { EditorViewProvider } from '@/contexts/EditorViewContext'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useFileSystem } from '@/hooks/useFileSystem'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useTabStore } from '@/stores/tabStore'
import { invokeTauri } from '@/utils/tauri'
import { ErrorBoundary } from '@components/common/ErrorBoundary'
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
const editor = (
  <ErrorBoundary>
    <MarkdownEditor />
  </ErrorBoundary>
)
const preview = (
  <ErrorBoundary>
    <MarkdownPreview />
  </ErrorBoundary>
)

function App() {
  const { openFile, saveFile, saveFileAs } = useFileSystem()
  useAutoSave()
  const { isOpen: sidebarOpen, isResizing: sidebarResizing } = useSidebarStore(
    useShallow(s => ({ isOpen: s.isOpen, isResizing: s.isResizing }))
  )
  const addRecentFile = useSidebarStore(s => s.addRecentFile)
  const openTab = useTabStore(s => s.openTab)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsOpenRef = useRef(settingsOpen)
  const loadSettings = useSettingsStore(s => s.loadSettings)

  // Sync settingsOpenRef with settingsOpen state
  settingsOpenRef.current = settingsOpen

  // Keyboard shortcuts
  useKeyboardShortcuts({ openFile, saveFile, saveFileAs, settingsOpenRef, setSettingsOpen })

  const handleSettingsClose = useCallback(() => {
    setSettingsOpen(false)
  }, [])

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
        const text = await invokeTauri<string>('read_file', { path })
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

  const mode = useEditorStore(s => s.mode)

  return (
    <EditorViewProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
        <div className={mode === 'zen' ? 'zen-slide-up' : 'zen-slide-down'}>
          <Header onOpenFile={() => void openFile()} onSaveFile={() => void saveFile()} />
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {mode !== 'zen' && (
            <ErrorBoundary>
              <Sidebar onFileOpen={handleFileOpen} />
            </ErrorBoundary>
          )}
          {mode !== 'zen' && sidebarOpen && <ResizeHandle />}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className={mode === 'zen' ? 'zen-slide-up' : 'zen-slide-down'}>{tabBar}</div>
            <MainLayout toolbar={toolbar} editor={editor} preview={preview} />
          </div>
        </div>
        <Footer className={mode === 'zen' ? 'zen-footer-dim' : ''} />
      </div>
      {sidebarResizing && <div className="fixed inset-0 z-40 cursor-col-resize" />}
      <SettingsModal isOpen={settingsOpen} onClose={handleSettingsClose} />
      <FindReplaceModal />
    </EditorViewProvider>
  )
}

export default App
