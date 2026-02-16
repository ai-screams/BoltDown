import { clsx } from 'clsx'
import { FileText, PanelLeft, Plus, X } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useEditorStore } from '@/stores/editorStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useTabStore } from '@/stores/tabStore'

export default memo(function TabBar() {
  const { tabs, activeTabId } = useTabStore(
    useShallow(s => ({ tabs: s.tabs, activeTabId: s.activeTabId }))
  )
  const setActiveTab = useTabStore(s => s.setActiveTab)
  const closeTab = useTabStore(s => s.closeTab)
  const openTab = useTabStore(s => s.openTab)
  const renameTab = useTabStore(s => s.renameTab)
  const sidebarOpen = useSidebarStore(s => s.isOpen)
  const toggleSidebar = useSidebarStore(s => s.toggle)

  const [renamingTabId, setRenamingTabId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const handleNewTab = useCallback(() => {
    openTab(null, 'Untitled.md', '')
  }, [openTab])

  const handleClose = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      closeTab(id)
    },
    [closeTab]
  )

  const startRename = useCallback((tabId: string, fileName: string) => {
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, '')
    setRenamingTabId(tabId)
    setRenameValue(nameWithoutExt)
  }, [])

  const commitRename = useCallback(
    async (tabId: string) => {
      setRenamingTabId(null)
      const trimmed = renameValue.trim()
      if (!trimmed) return

      const tab = useTabStore.getState().tabs.find(t => t.id === tabId)
      if (!tab) return

      const newFileName = /\.[^.]+$/.test(trimmed) ? trimmed : `${trimmed}.md`
      if (newFileName === tab.fileName) return

      if (tab.filePath) {
        try {
          const dir = tab.filePath.substring(0, tab.filePath.lastIndexOf('/') + 1)
          const newPath = dir + newFileName
          const { invoke } = await import('@tauri-apps/api/core')
          await invoke('rename_file', { oldPath: tab.filePath, newPath })
          renameTab(tabId, newFileName, newPath)
        } catch (e) {
          console.warn('Failed to rename file:', e)
          useEditorStore.getState().flashStatus('Rename failed', 3000)
        }
      } else {
        renameTab(tabId, newFileName, null)
      }
    },
    [renameValue, renameTab]
  )

  const cancelRename = useCallback(() => {
    setRenamingTabId(null)
  }, [])

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent, tabId: string, fileName: string) => {
      e.preventDefault()
      startRename(tabId, fileName)
    },
    [startRename]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && !renamingTabId) {
        const activeId = useTabStore.getState().activeTabId
        const activeTab = useTabStore.getState().tabs.find(t => t.id === activeId)
        if (activeTab) {
          e.preventDefault()
          startRename(activeId, activeTab.fileName)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [renamingTabId, startRename])

  useEffect(() => {
    if (renamingTabId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingTabId])

  return (
    <div className="flex h-8 flex-none items-center border-b border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900">
      <button
        onClick={toggleSidebar}
        title="Toggle Sidebar (Cmd+Shift+E)"
        className={clsx(
          'flex h-8 w-8 flex-none items-center justify-center border-r border-gray-200 transition-colors dark:border-gray-700',
          sidebarOpen
            ? 'bg-electric-yellow/30 text-electric-dark'
            : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300'
        )}
      >
        <PanelLeft className="h-3.5 w-3.5" />
      </button>
      <div className="flex flex-1 items-center overflow-x-auto">
        {tabs.map(tab => {
          const isRenaming = tab.id === renamingTabId
          return (
            <div
              key={tab.id}
              role="tab"
              onClick={() => !isRenaming && setActiveTab(tab.id)}
              onDoubleClick={e => !isRenaming && handleDoubleClick(e, tab.id, tab.fileName)}
              className={clsx(
                'group flex h-8 w-[160px] shrink-0 cursor-pointer items-center gap-1.5 border-r px-3 text-xs transition-colors duration-150',
                isRenaming
                  ? 'border-electric-yellow bg-electric-yellow/10 dark:border-electric-yellow dark:bg-electric-yellow/10'
                  : tab.id === activeTabId
                    ? 'border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
              )}
            >
              <FileText className="h-3 w-3 flex-none" />
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void commitRename(tab.id)
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelRename()
                    }
                    e.stopPropagation()
                  }}
                  onBlur={() => void commitRename(tab.id)}
                  className="min-w-0 flex-1 rounded border border-electric-yellow bg-white px-1 py-0.5 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-electric-yellow/50 dark:bg-gray-700 dark:text-white"
                />
              ) : (
                <>
                  <span className="truncate">{tab.fileName}</span>
                  {tab.content !== tab.savedContent && (
                    <span className="flex-none text-electric-yellow">●</span>
                  )}
                </>
              )}
              {!isRenaming && (
                <span
                  onClick={e => handleClose(e, tab.id)}
                  className="ml-auto flex-none rounded p-0.5 opacity-0 hover:bg-gray-200 group-hover:opacity-100 dark:hover:bg-gray-600"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </div>
          )
        })}
        <button
          onClick={handleNewTab}
          title="New Tab (Cmd+N)"
          className="flex h-8 w-8 flex-none items-center justify-center text-gray-400 transition-all duration-150 hover:scale-110 hover:bg-gray-50 hover:text-gray-600 active:scale-95 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
})
