import type { FileTreeNode } from '@/types/sidebar'
import { invokeTauri, isTauri } from '@/utils/tauri'

interface RawFileEntry {
  name: string
  path: string
  is_dir: boolean
  size: number
  modified: number
}

function toTreeNodes(entries: RawFileEntry[]): FileTreeNode[] {
  return entries.map(e => ({
    id: e.path,
    name: e.name,
    path: e.path,
    isDir: e.is_dir,
    children: e.is_dir ? [] : undefined,
  }))
}

export async function loadDirectoryEntries(dirPath: string): Promise<FileTreeNode[]> {
  if (!isTauri()) return []
  const entries = await invokeTauri<RawFileEntry[]>('list_directory', { path: dirPath })
  return toTreeNodes(entries)
}
