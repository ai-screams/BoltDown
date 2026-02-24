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
  { key: 'outline-solid', label: 'OUTLINE' },
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
        'border-line bg-surface-canvas flex flex-col overflow-hidden border-r',
        !isResizing && 'transition-[width] duration-200 ease-in-out'
      )}
      style={{ width: isOpen ? width : 0 }}
    >
      <div
        role="tablist"
        aria-label="Sidebar sections"
        className="border-line flex h-8 flex-none items-center border-b"
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
              activeTab === key ? 'text-fg' : 'text-fg-muted hover:text-fg-secondary'
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
          className="border-line text-fg-muted hover:bg-surface-muted hover:text-fg-secondary flex h-9 flex-none items-center justify-center gap-1.5 border-t text-xs transition-colors"
          onClick={handleOpenFolder}
        >
          <FolderOpen aria-hidden="true" className="h-3.5 w-3.5" />
          Open Folder
        </button>
      )}

      {!isTauri() && (
        <div className="border-line text-fg-muted flex h-9 flex-none items-center justify-center border-t text-[10px]">
          Open in Tauri for file browsing
        </div>
      )}
    </aside>
  )
})
