import { FileText } from 'lucide-react'
import { memo, useCallback, type MouseEvent } from 'react'

import { useSidebarStore } from '@/stores/sidebarStore'

interface RecentFilesProps {
  onFileOpen: (path: string, name: string) => void
}

export default memo(function RecentFiles({ onFileOpen }: RecentFilesProps) {
  const recentFiles = useSidebarStore(s => s.recentFiles)

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      const path = e.currentTarget.dataset.path
      const name = e.currentTarget.dataset.name
      if (path && name) onFileOpen(path, name)
    },
    [onFileOpen]
  )

  if (recentFiles.length === 0) {
    return (
      <div className="text-fg-muted flex flex-1 items-center justify-center p-4 text-xs">
        No recent files
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {recentFiles.map(file => (
        <button
          key={file.path}
          className="hover:bg-surface-muted flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs"
          data-name={file.name}
          data-path={file.path}
          onClick={handleClick}
        >
          <FileText aria-hidden="true" className="text-info h-3.5 w-3.5 flex-none" />
          <div className="min-w-0 flex-1">
            <div className="text-fg-secondary truncate">{file.name}</div>
            <div className="text-fg-muted truncate" style={{ fontSize: 10 }}>
              {file.path}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
})
