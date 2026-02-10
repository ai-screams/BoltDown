import { ChevronDown, ChevronRight, File, Folder, FolderOpen } from 'lucide-react'
import { memo } from 'react'
import type { NodeRendererProps } from 'react-arborist'

import type { FileTreeNode } from '@/types/sidebar'

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

function FileTreeNodeComponent({ node, style }: NodeRendererProps<FileTreeNode>) {
  const { isDir, name } = node.data

  return (
    <div
      style={style}
      className="flex cursor-pointer items-center gap-1 px-1 py-0.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
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
      <span className="truncate text-gray-700 dark:text-gray-300">{name}</span>
    </div>
  )
}

export default memo(FileTreeNodeComponent)
