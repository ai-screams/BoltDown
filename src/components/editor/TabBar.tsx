import { clsx } from 'clsx'
import { FileText, PanelLeft, Plus, X } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { STATUS_TIMEOUT_MS } from '@/constants/feedback'
import { FILE_DEFAULTS } from '@/constants/file'
import { useEditorStore } from '@/stores/editorStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useTabStore } from '@/stores/tabStore'
import { getDirectoryPath, joinPath } from '@/utils/imagePath'
import { invokeTauri } from '@/utils/tauri'

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
  const renameCommitInFlightRef = useRef<string | null>(null)

  const handleNewTab = useCallback(() => {
    openTab(null, FILE_DEFAULTS.untitledName, '')
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
      if (renameCommitInFlightRef.current === tabId) {
        return
      }

      renameCommitInFlightRef.current = tabId

      setRenamingTabId(null)
      const trimmed = renameValue.trim()
      if (!trimmed) {
        renameCommitInFlightRef.current = null
        return
      }

      const tab = useTabStore.getState().tabs.find(t => t.id === tabId)
      if (!tab) {
        renameCommitInFlightRef.current = null
        return
      }

      const newFileName = /\.[^.]+$/.test(trimmed) ? trimmed : `${trimmed}.md`
      if (newFileName === tab.fileName) {
        renameCommitInFlightRef.current = null
        return
      }

      try {
        if (tab.filePath) {
          const newPath = joinPath(getDirectoryPath(tab.filePath), newFileName)
          await invokeTauri('rename_file', { oldPath: tab.filePath, newPath })
          renameTab(tabId, newFileName, newPath)
        } else {
          renameTab(tabId, newFileName, null)
        }
      } catch (e) {
        console.warn('Failed to rename file:', e)
        useEditorStore.getState().flashStatus('Rename failed', STATUS_TIMEOUT_MS.error)
      } finally {
        renameCommitInFlightRef.current = null
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

  const handleTabListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = tabs.findIndex(t => t.id === activeTabId)
      if (currentIndex === -1) return

      let nextIndex = currentIndex

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          nextIndex = (currentIndex + 1) % tabs.length
          break
        case 'ArrowLeft':
          e.preventDefault()
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
          break
        case 'Home':
          e.preventDefault()
          nextIndex = 0
          break
        case 'End':
          e.preventDefault()
          nextIndex = tabs.length - 1
          break
        default:
          return
      }

      const nextTab = tabs[nextIndex]
      if (nextTab) {
        setActiveTab(nextTab.id)
        // Focus will be managed by tabIndex pattern
        const tabButton = document.querySelector(
          `button[role="tab"][data-tab-id="${nextTab.id}"]`
        ) as HTMLButtonElement
        tabButton?.focus()
      }
    },
    [tabs, activeTabId, setActiveTab]
  )

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false
      }

      const tagName = target.tagName
      return (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT' ||
        target.isContentEditable
      )
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && !renamingTabId && !isEditableTarget(e.target)) {
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
    <div className="flex h-8 flex-none items-center border-b border-line bg-surface-muted">
      <button
        aria-label="Toggle sidebar"
        className={clsx(
          'flex h-8 w-8 flex-none items-center justify-center border-r border-line transition-colors',
          sidebarOpen
            ? 'bg-electric-yellow/30 text-electric-dark'
            : 'text-fg-muted hover:bg-surface hover:text-fg-secondary'
        )}
        title="Toggle Sidebar (Cmd+Shift+E)"
        onClick={toggleSidebar}
      >
        <PanelLeft aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <div
        role="tablist"
        aria-label="Open tabs"
        className="flex flex-1 items-center overflow-x-auto"
        onKeyDown={handleTabListKeyDown}
      >
        {tabs.map(tab => {
          const isRenaming = tab.id === renamingTabId
          return (
            <div
              key={tab.id}
              role="presentation"
              className={clsx(
                'group flex h-8 w-[160px] shrink-0 cursor-pointer items-center gap-1.5 border-r px-3 text-xs transition-colors duration-150',
                isRenaming
                  ? 'border-electric-yellow bg-electric-yellow/10 dark:border-electric-yellow dark:bg-electric-yellow/10'
                  : tab.id === activeTabId
                    ? 'border-line bg-surface text-fg'
                    : 'border-line text-fg-muted hover:bg-surface hover:text-fg-secondary'
              )}
              onDoubleClick={e => !isRenaming && handleDoubleClick(e, tab.id, tab.fileName)}
            >
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  className="min-w-0 flex-1 rounded border border-electric-yellow bg-surface px-1 py-0.5 text-xs text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric-yellow/50"
                  value={renameValue}
                  onBlur={() => void commitRename(tab.id)}
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
                />
              ) : (
                <>
                  <button
                    role="tab"
                    type="button"
                    aria-selected={tab.id === activeTabId}
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50"
                    data-tab-id={tab.id}
                    tabIndex={tab.id === activeTabId ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <FileText aria-hidden="true" className="h-3 w-3 flex-none" />
                    <span className="truncate">{tab.fileName}</span>
                    {tab.content !== tab.savedContent && (
                      <span className="flex-none text-electric-yellow">●</span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="Close tab"
                    className="ml-auto flex-none rounded p-0.5 opacity-0 hover:bg-surface-muted group-focus-within:opacity-100 group-hover:opacity-100"
                    onClick={e => handleClose(e, tab.id)}
                  >
                    <X aria-hidden="true" className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          )
        })}
        <button
          aria-label="New tab"
          className="flex h-8 w-8 flex-none items-center justify-center text-fg-muted transition-[color,background-color,opacity,transform] duration-150 hover:scale-110 hover:bg-surface hover:text-fg-secondary active:scale-95"
          title="New Tab (Cmd+N)"
          onClick={handleNewTab}
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
})
