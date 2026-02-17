import { FileIcon, FolderIcon } from '@react-symbols/icons/utils'
import { ChevronDown, ChevronRight, Copy, Trash2 } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'
import type { NodeRendererProps } from 'react-arborist'

import type { FileTreeNode } from '@/types/sidebar'

interface FileTreeNodeProps extends NodeRendererProps<FileTreeNode> {
  onDelete?: (path: string) => void
  onDuplicate?: (path: string) => void
}

const MENU_WIDTH = 160
const MENU_HEIGHT = 90

function FileTreeNodeComponent({ node, style, onDelete, onDuplicate }: FileTreeNodeProps) {
  const { isDir, name, path } = node.data
  const [isHovered, setIsHovered] = useState(false)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (isDir) return
      e.preventDefault()
      e.stopPropagation()
      const maxX = Math.max(8, window.innerWidth - MENU_WIDTH - 8)
      const maxY = Math.max(8, window.innerHeight - MENU_HEIGHT - 8)
      setMenuPos({ x: Math.min(e.clientX, maxX), y: Math.min(e.clientY, maxY) })
    },
    [isDir]
  )

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDelete?.(path)
    },
    [onDelete, path]
  )

  const handleDuplicate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDuplicate?.(path)
    },
    [onDuplicate, path]
  )

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => setIsHovered(false), [])
  const handleNodeClick = useCallback(() => {
    if (isDir) {
      node.toggle()
      return
    }
    node.activate()
  }, [isDir, node])

  const handleNodeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleNodeClick()
      }
    },
    [handleNodeClick]
  )

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
        role="treeitem"
        aria-expanded={isDir ? node.isOpen : undefined}
        aria-selected={!isDir ? node.isSelected : undefined}
        className="group relative flex cursor-pointer items-center gap-1 px-1 py-0.5 text-xs hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric-yellow/50"
        style={style}
        tabIndex={0}
        onClick={handleNodeClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleNodeKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {isDir ? (
          <>
            {node.isOpen ? (
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 flex-none text-fg-muted" />
            ) : (
              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 flex-none text-fg-muted" />
            )}
            <span className="flex-none" style={{ width: 16, height: 16 }}>
              <FolderIcon folderName={name} />
            </span>
          </>
        ) : (
          <>
            <span className="w-3.5 flex-none" />
            <span className="flex-none" style={{ width: 16, height: 16 }}>
              <FileIcon fileName={name} autoAssign />
            </span>
          </>
        )}
        <span className="flex-1 truncate text-fg-secondary">{name}</span>

        {/* Hover action icons (files only) */}
        {!isDir && (
          <div
            className={
              isHovered
                ? 'flex items-center gap-0.5'
                : 'pointer-events-none flex items-center gap-0.5 opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100'
            }
          >
            <button
              type="button"
              aria-label="Duplicate"
              className="rounded p-0.5 hover:bg-surface-elevated"
              title="Duplicate file"
              onClick={handleDuplicate}
            >
              <Copy aria-hidden="true" className="h-3 w-3 text-fg-muted" />
            </button>
            <button
              type="button"
              aria-label="Delete"
              className="rounded p-0.5 hover:bg-surface-elevated"
              title="Delete file"
              onClick={handleDelete}
            >
              <Trash2 aria-hidden="true" className="h-3 w-3 text-fg-muted" />
            </button>
          </div>
        )}
      </div>

      {/* Context menu */}
      {menuPos && (
        <div
          role="menu"
          className="fixed z-50 min-w-[140px] rounded-md border border-line bg-surface py-1 shadow-lg"
          style={{ left: menuPos.x, top: menuPos.y }}
          onClick={e => e.stopPropagation()}
        >
          <button
            role="menuitem"
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-fg-secondary hover:bg-surface-muted"
            onClick={e => {
              handleDuplicate(e)
              setMenuPos(null)
            }}
          >
            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
            Duplicate
          </button>
          <button
            role="menuitem"
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-danger hover:bg-surface-muted"
            onClick={e => {
              handleDelete(e)
              setMenuPos(null)
            }}
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </>
  )
}

export default memo(FileTreeNodeComponent)
