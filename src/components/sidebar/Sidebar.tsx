import { clsx } from 'clsx'
import { FolderOpen } from 'lucide-react'
import { memo, useCallback } from 'react'

import { useSidebarStore } from '@/stores/sidebarStore'
import type { SidebarTab } from '@/types/sidebar'
import { loadDirectoryEntries } from '@/utils/directoryLoader'
import { isTauri } from '@/utils/tauri'

import FileTree from './FileTree'
import RecentFiles from './RecentFiles'

const tabs: { key: SidebarTab; label: string }[] = [
  { key: 'files', label: 'FILES' },
  { key: 'recent', label: 'RECENT' },
]

interface SidebarProps {
  onFileOpen: (path: string, name: string) => void
}

export default memo(function Sidebar({ onFileOpen }: SidebarProps) {
  const isOpen = useSidebarStore(s => s.isOpen)
  const width = useSidebarStore(s => s.width)
  const activeTab = useSidebarStore(s => s.activeTab)
  const setActiveTab = useSidebarStore(s => s.setActiveTab)
  const setRootPath = useSidebarStore(s => s.setRootPath)
  const setTreeData = useSidebarStore(s => s.setTreeData)

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
      style={{ width: isOpen ? width : 0 }}
      className="flex flex-col overflow-hidden border-r border-gray-200 bg-gray-50 transition-[width] duration-200 ease-in-out dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex h-8 flex-none items-center border-b border-gray-200 dark:border-gray-700">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={clsx(
              'flex-1 text-center text-[10px] font-semibold tracking-wider',
              activeTab === key
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'files' ? (
        <FileTree onFileOpen={onFileOpen} />
      ) : (
        <RecentFiles onFileOpen={onFileOpen} />
      )}

      {isTauri() && (
        <button
          onClick={handleOpenFolder}
          className="flex h-9 flex-none items-center justify-center gap-1.5 border-t border-gray-200 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
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
