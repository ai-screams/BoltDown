import type { FileTreeNode } from '@/types/sidebar'
import { isTauri } from '@/utils/tauri'

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
  const { invoke } = await import('@tauri-apps/api/core')
  const entries = await invoke<RawFileEntry[]>('list_directory', { path: dirPath })
  return toTreeNodes(entries)
}
