import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Tree, type TreeApi } from 'react-arborist'

import { useSidebarStore } from '@/stores/sidebarStore'
import type { FileTreeNode } from '@/types/sidebar'
import { loadDirectoryEntries } from '@/utils/directoryLoader'

import FileTreeNodeComponent from './FileTreeNode'

interface FileTreeProps {
  onFileOpen: (path: string, name: string) => void
}

export default memo(function FileTree({ onFileOpen }: FileTreeProps) {
  const treeData = useSidebarStore(s => s.treeData)
  const width = useSidebarStore(s => s.width)
  const updateNodeChildren = useSidebarStore(s => s.updateNodeChildren)

  const treeRef = useRef<TreeApi<FileTreeNode>>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(400)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) setContainerHeight(entry.contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleToggle = useCallback(
    (id: string) => {
      const node = treeRef.current?.get(id)
      if (node?.isOpen && node.data.isDir) {
        loadDirectoryEntries(node.data.path)
          .then(children => {
            updateNodeChildren(id, children)
          })
          .catch(() => {
            // Directory read failed — leave children empty
          })
      }
    },
    [updateNodeChildren]
  )

  const handleActivate = useCallback(
    (node: { data: FileTreeNode }) => {
      if (!node.data.isDir) {
        onFileOpen(node.data.path, node.data.name)
      }
    },
    [onFileOpen]
  )

  if (treeData.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-xs text-gray-400">
        No folder open
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden">
      <Tree<FileTreeNode>
        ref={treeRef}
        data={treeData}
        openByDefault={false}
        width={width - 16}
        height={containerHeight}
        rowHeight={28}
        indent={16}
        overscanCount={5}
        disableDrag
        disableDrop
        disableEdit
        onToggle={handleToggle}
        onActivate={handleActivate}
      >
        {FileTreeNodeComponent}
      </Tree>
    </div>
  )
})
