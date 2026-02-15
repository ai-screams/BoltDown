import { create } from 'zustand'

import type { FileTreeNode, RecentFile, SidebarTab } from '@/types/sidebar'
import { loadDirectoryEntries } from '@/utils/directoryLoader'

const STORAGE_KEY_WIDTH = 'boltdown-sidebar-width'
const STORAGE_KEY_RECENT = 'boltdown-recent-files'
const MAX_RECENT = 20
const DEFAULT_WIDTH = 240

const loadRecentFiles = (): RecentFile[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECENT)
    return raw ? (JSON.parse(raw) as RecentFile[]) : []
  } catch {
    return []
  }
}

const loadWidth = (): number => {
  const raw = localStorage.getItem(STORAGE_KEY_WIDTH)
  if (!raw) return DEFAULT_WIDTH
  const parsed = parseInt(raw, 10)
  return Number.isNaN(parsed) ? DEFAULT_WIDTH : parsed
}

const updateChildren = (
  nodes: FileTreeNode[],
  parentId: string,
  children: FileTreeNode[]
): FileTreeNode[] =>
  nodes.map(node => {
    if (node.id === parentId) return { ...node, children }
    if (node.children)
      return { ...node, children: updateChildren(node.children, parentId, children) }
    return node
  })

// Debounce localStorage writes for width (called 60x/sec during drag)
let widthWriteTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSaveWidth(width: number) {
  if (widthWriteTimer) clearTimeout(widthWriteTimer)
  widthWriteTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY_WIDTH, String(width))
  }, 300)
}

interface SidebarState {
  isOpen: boolean
  width: number
  isResizing: boolean
  activeTab: SidebarTab
  rootPath: string | null
  treeData: FileTreeNode[]
  recentFiles: RecentFile[]

  toggle: () => void
  setOpen: (open: boolean) => void
  setWidth: (width: number) => void
  setResizing: (resizing: boolean) => void
  setActiveTab: (tab: SidebarTab) => void
  setRootPath: (path: string) => void
  setTreeData: (data: FileTreeNode[]) => void
  updateNodeChildren: (parentId: string, children: FileTreeNode[]) => void
  addRecentFile: (path: string, name: string) => void
  loadParentDirectory: (filePath: string, openSidebar?: boolean) => Promise<void>
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  isOpen: false,
  width: loadWidth(),
  isResizing: false,
  activeTab: 'files',
  rootPath: null,
  treeData: [],
  recentFiles: loadRecentFiles(),

  toggle: () => set(s => ({ isOpen: !s.isOpen })),
  setOpen: open => set({ isOpen: open }),
  setWidth: width => {
    debouncedSaveWidth(width)
    set({ width })
  },
  setResizing: resizing => set({ isResizing: resizing }),
  setActiveTab: tab => set({ activeTab: tab }),
  setRootPath: path => set({ rootPath: path }),
  setTreeData: data => set({ treeData: data }),
  updateNodeChildren: (parentId, children) =>
    set(s => ({ treeData: updateChildren(s.treeData, parentId, children) })),
  addRecentFile: (path, name) => {
    const filtered = get().recentFiles.filter(f => f.path !== path)
    const updated = [{ path, name, openedAt: Date.now() }, ...filtered].slice(0, MAX_RECENT)
    localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(updated))
    set({ recentFiles: updated })
  },
  loadParentDirectory: async (filePath, openSidebar = false) => {
    const dir = filePath.slice(0, filePath.lastIndexOf('/'))
    if (!dir) return
    const { rootPath } = get()
    if (rootPath !== dir) {
      set({ rootPath: dir })
      try {
        const entries = await loadDirectoryEntries(dir)
        set({ treeData: entries })
      } catch {
        // Directory listing failed — file is already open, silently ignore
      }
    }
    if (openSidebar) set({ isOpen: true })
  },
}))
