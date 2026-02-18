import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { EditorViewProvider } from '@/contexts/EditorViewContext'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useCustomCss } from '@/hooks/useCustomCss'
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
import Footer from '@components/layout/Footer'
import Header from '@components/layout/Header'
import MainLayout from '@components/layout/MainLayout'
import MarkdownPreview from '@components/preview/MarkdownPreview'
import ResizeHandle from '@components/sidebar/ResizeHandle'
import Sidebar from '@components/sidebar/Sidebar'

// Lazy-load modals (only loaded when opened)
const SettingsModal = lazy(() => import('@components/settings/SettingsModal'))
const FindReplaceModal = lazy(() => import('@components/findreplace/FindReplaceModal'))
const ShortcutsModal = lazy(() => import('@components/shortcuts/ShortcutsModal'))
const ChangelogModal = lazy(() => import('@components/about/ChangelogModal'))
const AboutModal = lazy(() => import('@components/about/AboutModal'))

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
  useCustomCss()
  const { isOpen: sidebarOpen, isResizing: sidebarResizing } = useSidebarStore(
    useShallow(s => ({ isOpen: s.isOpen, isResizing: s.isResizing }))
  )
  const addRecentFile = useSidebarStore(s => s.addRecentFile)
  const openTab = useTabStore(s => s.openTab)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const settingsOpenRef = useRef(settingsOpen)
  const loadSettings = useSettingsStore(s => s.loadSettings)

  // Sync settingsOpenRef with settingsOpen state
  settingsOpenRef.current = settingsOpen

  // Keyboard shortcuts
  useKeyboardShortcuts({
    openFile,
    saveFile,
    saveFileAs,
    settingsOpenRef,
    setSettingsOpen,
    setShortcutsOpen,
  })

  const handleSettingsClose = useCallback(() => {
    setSettingsOpen(false)
  }, [])
  const handleShortcutsClose = useCallback(() => {
    setShortcutsOpen(false)
  }, [])
  const handleChangelogClose = useCallback(() => {
    setChangelogOpen(false)
  }, [])
  const handleAboutClose = useCallback(() => {
    setAboutOpen(false)
  }, [])
  const handleOpenShortcuts = useCallback(() => {
    setShortcutsOpen(true)
  }, [])
  const handleOpenChangelog = useCallback(() => {
    setChangelogOpen(true)
  }, [])
  const handleOpenAbout = useCallback(() => {
    setAboutOpen(true)
  }, [])

  // Load persisted settings on mount
  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  // Warn before closing with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const hasDirty = useTabStore.getState().tabs.some(t => t.content !== t.savedContent)
      if (hasDirty) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

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
          <Header
            onOpenAbout={handleOpenAbout}
            onOpenChangelog={handleOpenChangelog}
            onOpenFile={() => void openFile()}
            onOpenShortcuts={handleOpenShortcuts}
            onSaveFile={() => void saveFile()}
          />
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
            <MainLayout editor={editor} preview={preview} toolbar={toolbar} />
          </div>
        </div>
        <Footer className={mode === 'zen' ? 'zen-footer-dim' : ''} />
      </div>
      {sidebarResizing && <div className="fixed inset-0 z-40 cursor-col-resize" />}
      <Suspense fallback={null}>
        <SettingsModal isOpen={settingsOpen} onClose={handleSettingsClose} />
      </Suspense>
      <Suspense fallback={null}>
        <FindReplaceModal />
      </Suspense>
      <Suspense fallback={null}>
        <ShortcutsModal isOpen={shortcutsOpen} onClose={handleShortcutsClose} />
      </Suspense>
      <Suspense fallback={null}>
        <ChangelogModal isOpen={changelogOpen} onClose={handleChangelogClose} />
      </Suspense>
      <Suspense fallback={null}>
        <AboutModal
          isOpen={aboutOpen}
          onClose={handleAboutClose}
          onOpenChangelog={handleOpenChangelog}
        />
      </Suspense>
    </EditorViewProvider>
  )
}

export default App
