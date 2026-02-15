import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Tree, type TreeApi } from 'react-arborist'

import { useEditorStore } from '@/stores/editorStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useTabStore } from '@/stores/tabStore'
import type { FileTreeNode } from '@/types/sidebar'
import { loadDirectoryEntries } from '@/utils/directoryLoader'
import { isTauri } from '@/utils/tauri'

import FileTreeNodeComponent from './FileTreeNode'

interface FileTreeProps {
  onFileOpen: (path: string, name: string) => void
}

export default memo(function FileTree({ onFileOpen }: FileTreeProps) {
  const treeData = useSidebarStore(s => s.treeData)
  const setTreeData = useSidebarStore(s => s.setTreeData)
  const rootPath = useSidebarStore(s => s.rootPath)
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

  const refreshTree = useCallback(async () => {
    if (!rootPath) return
    try {
      const entries = await loadDirectoryEntries(rootPath)
      setTreeData(entries)
    } catch (e) {
      console.error('Failed to refresh tree:', e)
    }
  }, [rootPath, setTreeData])

  const deleteFile = useCallback(
    async (path: string) => {
      if (!isTauri()) return
      try {
        const { ask } = await import('@tauri-apps/plugin-dialog')
        const fileName = path.split('/').pop() ?? path
        const confirmed = await ask(`Delete "${fileName}"? This cannot be undone.`, {
          title: 'Delete File',
          kind: 'warning',
        })
        if (!confirmed) return

        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('delete_file', { path })

        // Close tab if open
        const { tabs, closeTab } = useTabStore.getState()
        const tab = tabs.find(t => t.filePath === path)
        if (tab) closeTab(tab.id)

        // Refresh tree
        await refreshTree()

        useEditorStore.getState().flashStatus('File deleted')
      } catch (e) {
        useEditorStore.getState().flashStatus(`Delete failed: ${e}`)
      }
    },
    [refreshTree]
  )

  const duplicateFile = useCallback(
    async (path: string) => {
      if (!isTauri()) return
      try {
        const { invoke } = await import('@tauri-apps/api/core')

        // Generate copy name: "file.md" → "file (copy).md"
        const lastSlash = path.lastIndexOf('/')
        const dir = path.slice(0, lastSlash + 1)
        const fullName = path.slice(lastSlash + 1)
        const dotIdx = fullName.lastIndexOf('.')
        const name = dotIdx > 0 ? fullName.slice(0, dotIdx) : fullName
        const ext = dotIdx > 0 ? fullName.slice(dotIdx) : ''

        // Find available name
        let copyName = `${name} (copy)${ext}`
        let copyPath = `${dir}${copyName}`
        let counter = 2
        while (true) {
          try {
            await invoke<string>('read_file', { path: copyPath })
            // File exists, try next
            copyName = `${name} (copy ${counter})${ext}`
            copyPath = `${dir}${copyName}`
            counter++
          } catch {
            break // File doesn't exist, use this name
          }
        }

        await invoke('copy_file', { srcPath: path, destPath: copyPath })

        // Read and open the copy in a new tab
        const content = await invoke<string>('read_file', { path: copyPath })
        useTabStore.getState().openTab(copyPath, copyName, content)

        // Refresh tree
        await refreshTree()

        useEditorStore.getState().flashStatus('File duplicated')
      } catch (e) {
        useEditorStore.getState().flashStatus(`Duplicate failed: ${e}`)
      }
    },
    [refreshTree]
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
        {props => (
          <FileTreeNodeComponent {...props} onDelete={deleteFile} onDuplicate={duplicateFile} />
        )}
      </Tree>
    </div>
  )
})
