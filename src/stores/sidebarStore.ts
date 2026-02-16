import { create } from 'zustand'

import { SIDEBAR_POLICY, SIDEBAR_WIDTH_LIMITS } from '@/constants/sidebar'
import { STORAGE_KEYS } from '@/constants/storage'
import type { FileTreeNode, RecentFile, SidebarTab } from '@/types/sidebar'
import { loadDirectoryEntries } from '@/utils/directoryLoader'
import { getDirectoryPath } from '@/utils/imagePath'

const loadRecentFiles = (): RecentFile[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.recentFiles)
    return raw ? (JSON.parse(raw) as RecentFile[]) : []
  } catch {
    return []
  }
}

const loadWidth = (): number => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.sidebarWidth)
    if (!raw) return SIDEBAR_WIDTH_LIMITS.default
    const parsed = parseInt(raw, 10)
    if (Number.isNaN(parsed)) return SIDEBAR_WIDTH_LIMITS.default

    return Math.max(SIDEBAR_WIDTH_LIMITS.min, Math.min(parsed, SIDEBAR_WIDTH_LIMITS.max))
  } catch {
    return SIDEBAR_WIDTH_LIMITS.default
  }
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
    try {
      localStorage.setItem(STORAGE_KEYS.sidebarWidth, String(width))
    } catch {
      // Ignore storage errors (private mode/quota exceeded)
    }
  }, SIDEBAR_POLICY.saveDebounceMs)
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
    const clamped = Math.max(SIDEBAR_WIDTH_LIMITS.min, Math.min(width, SIDEBAR_WIDTH_LIMITS.max))
    debouncedSaveWidth(clamped)
    set({ width: clamped })
  },
  setResizing: resizing => set({ isResizing: resizing }),
  setActiveTab: tab => set({ activeTab: tab }),
  setRootPath: path => set({ rootPath: path }),
  setTreeData: data => set({ treeData: data }),
  updateNodeChildren: (parentId, children) =>
    set(s => ({ treeData: updateChildren(s.treeData, parentId, children) })),
  addRecentFile: (path, name) => {
    const filtered = get().recentFiles.filter(f => f.path !== path)
    const updated = [{ path, name, openedAt: Date.now() }, ...filtered].slice(
      0,
      SIDEBAR_POLICY.maxRecentFiles
    )
    try {
      localStorage.setItem(STORAGE_KEYS.recentFiles, JSON.stringify(updated))
    } catch {
      // Ignore storage errors (private mode/quota exceeded)
    }
    set({ recentFiles: updated })
  },
  loadParentDirectory: async (filePath, openSidebar = false) => {
    const dir = getDirectoryPath(filePath)
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
