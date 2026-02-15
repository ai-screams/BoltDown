import { ChevronDown, ChevronRight, Copy, File, Folder, FolderOpen, Trash2 } from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import type { NodeRendererProps } from 'react-arborist'

import type { FileTreeNode } from '@/types/sidebar'

interface FileTreeNodeProps extends NodeRendererProps<FileTreeNode> {
  onDelete?: (path: string) => void
  onDuplicate?: (path: string) => void
}

const extColors: Record<string, string> = {
  md: 'text-blue-500',
  markdown: 'text-blue-500',
  ts: 'text-blue-600',
  tsx: 'text-blue-600',
  js: 'text-yellow-500',
  jsx: 'text-yellow-500',
  json: 'text-yellow-500',
  rs: 'text-orange-500',
  toml: 'text-orange-400',
  css: 'text-purple-500',
  html: 'text-red-500',
}

function getExtColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  return ext ? (extColors[ext] ?? 'text-gray-400') : 'text-gray-400'
}

function FileTreeNodeComponent({ node, style, onDelete, onDuplicate }: FileTreeNodeProps) {
  const { isDir, name, path } = node.data
  const [isHovered, setIsHovered] = useState(false)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isDir) return
    e.preventDefault()
    e.stopPropagation()
    setMenuPos({ x: e.clientX, y: e.clientY })
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete?.(path)
  }

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDuplicate?.(path)
  }

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!menuPos) return
    const close = () => setMenuPos(null)
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('click', close)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [menuPos])

  return (
    <>
      <div
        style={style}
        className="group relative flex cursor-pointer items-center gap-1 px-1 py-0.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={handleContextMenu}
        onClick={() => {
          if (isDir) {
            node.toggle()
          } else {
            node.activate()
          }
        }}
      >
        {isDir ? (
          <>
            {node.isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 flex-none text-gray-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 flex-none text-gray-400" />
            )}
            {node.isOpen ? (
              <FolderOpen className="h-3.5 w-3.5 flex-none text-yellow-500" />
            ) : (
              <Folder className="h-3.5 w-3.5 flex-none text-yellow-500" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 flex-none" />
            <File className={`h-3.5 w-3.5 flex-none ${getExtColor(name)}`} />
          </>
        )}
        <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{name}</span>

        {/* Hover action icons (files only) */}
        {!isDir && isHovered && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleDuplicate}
              className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Duplicate file"
            >
              <Copy className="h-3 w-3 text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={handleDelete}
              className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Delete file"
            >
              <Trash2 className="h-3 w-3 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        )}
      </div>

      {/* Context menu */}
      {menuPos && (
        <div
          className="fixed z-50 min-w-[140px] rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
          style={{ left: menuPos.x, top: menuPos.y }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={e => {
              handleDuplicate(e)
              setMenuPos(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </button>
          <button
            onClick={e => {
              handleDelete(e)
              setMenuPos(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </>
  )
}

export default memo(FileTreeNodeComponent)
