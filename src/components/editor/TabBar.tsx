import { clsx } from 'clsx'
import { FileText, Plus, X } from 'lucide-react'
import { memo, useCallback } from 'react'

import { useTabStore } from '@/stores/tabStore'

export default memo(function TabBar() {
  const tabs = useTabStore(s => s.tabs)
  const activeTabId = useTabStore(s => s.activeTabId)
  const setActiveTab = useTabStore(s => s.setActiveTab)
  const closeTab = useTabStore(s => s.closeTab)
  const openTab = useTabStore(s => s.openTab)

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

  return (
    <div className="flex h-8 flex-none items-center border-b border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-1 items-center overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'group flex h-8 min-w-0 max-w-[180px] items-center gap-1.5 border-r border-gray-200 px-3 text-xs dark:border-gray-700',
              tab.id === activeTabId
                ? 'bg-white text-gray-900 dark:bg-gray-800 dark:text-white'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
            )}
          >
            <FileText className="h-3 w-3 flex-none" />
            <span className="truncate">{tab.fileName}</span>
            {tab.content !== tab.savedContent && (
              <span className="flex-none text-electric-yellow">●</span>
            )}
            <span
              onClick={e => handleClose(e, tab.id)}
              className="ml-auto flex-none rounded p-0.5 opacity-0 hover:bg-gray-200 group-hover:opacity-100 dark:hover:bg-gray-600"
            >
              <X className="h-3 w-3" />
            </span>
          </button>
        ))}
      </div>
      <button
        onClick={handleNewTab}
        title="New Tab (Cmd+N)"
        className="flex h-8 w-8 flex-none items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
})
