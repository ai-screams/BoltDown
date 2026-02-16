import { clsx } from 'clsx'
import { FolderOpen } from 'lucide-react'
import { memo, type MouseEvent, useCallback } from 'react'

import { useSidebarStore } from '@/stores/sidebarStore'
import type { SidebarTab } from '@/types/sidebar'
import { loadDirectoryEntries } from '@/utils/directoryLoader'
import { isTauri } from '@/utils/tauri'

import FileTree from './FileTree'
import { OutlinePanel } from './OutlinePanel'
import RecentFiles from './RecentFiles'

const tabs: { key: SidebarTab; label: string }[] = [
  { key: 'files', label: 'FILES' },
  { key: 'recent', label: 'RECENT' },
  { key: 'outline', label: 'OUTLINE' },
]

interface SidebarProps {
  onFileOpen: (path: string, name: string) => void
}

export default memo(function Sidebar({ onFileOpen }: SidebarProps) {
  const isOpen = useSidebarStore(s => s.isOpen)
  const width = useSidebarStore(s => s.width)
  const isResizing = useSidebarStore(s => s.isResizing)
  const activeTab = useSidebarStore(s => s.activeTab)
  const setActiveTab = useSidebarStore(s => s.setActiveTab)
  const setRootPath = useSidebarStore(s => s.setRootPath)
  const setTreeData = useSidebarStore(s => s.setTreeData)

  const handleTabClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const tab = event.currentTarget.dataset['tab'] as SidebarTab | undefined
      if (tab) setActiveTab(tab)
    },
    [setActiveTab]
  )

  const handleOpenFolder = useCallback(async () => {
    if (!isTauri()) return
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({ directory: true, title: 'Open Folder' })
    if (typeof selected === 'string') {
      setRootPath(selected)
      const entries = await loadDirectoryEntries(selected)
      setTreeData(entries)
    }
  }, [setRootPath, setTreeData])

  return (
    <aside
      aria-label="Sidebar"
      className={clsx(
        'flex flex-col overflow-hidden border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900',
        !isResizing && 'transition-[width] duration-200 ease-in-out'
      )}
      style={{ width: isOpen ? width : 0 }}
    >
      <div
        role="tablist"
        aria-label="Sidebar sections"
        className="flex h-8 flex-none items-center border-b border-gray-200 dark:border-gray-700"
      >
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            id={`sidebar-tab-${key}`}
            role="tab"
            type="button"
            aria-controls={`sidebar-panel-${key}`}
            aria-selected={activeTab === key}
            className={clsx(
              'flex-1 text-center text-[10px] font-semibold tracking-wider',
              activeTab === key
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
            )}
            data-tab={key}
            onClick={handleTabClick}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'files' ? (
        <div
          id="sidebar-panel-files"
          role="tabpanel"
          aria-labelledby="sidebar-tab-files"
          className="flex min-h-0 flex-1"
        >
          <FileTree onFileOpen={onFileOpen} />
        </div>
      ) : activeTab === 'recent' ? (
        <div
          id="sidebar-panel-recent"
          role="tabpanel"
          aria-labelledby="sidebar-tab-recent"
          className="flex min-h-0 flex-1"
        >
          <RecentFiles onFileOpen={onFileOpen} />
        </div>
      ) : (
        <div
          id="sidebar-panel-outline"
          role="tabpanel"
          aria-labelledby="sidebar-tab-outline"
          className="flex min-h-0 flex-1"
        >
          <OutlinePanel />
        </div>
      )}

      {isTauri() && (
        <button
          type="button"
          className="flex h-9 flex-none items-center justify-center gap-1.5 border-t border-gray-200 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          onClick={handleOpenFolder}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Open Folder
        </button>
      )}

      {!isTauri() && (
        <div className="flex h-9 flex-none items-center justify-center border-t border-gray-200 text-[10px] text-gray-400 dark:border-gray-700">
          Open in Tauri for file browsing
        </div>
      )}
    </aside>
  )
})
