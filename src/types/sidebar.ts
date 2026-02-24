export interface FileTreeNode {
  id: string
  name: string
  path: string
  isDir: boolean
  children?: FileTreeNode[]
}

export interface RecentFile {
  path: string
  name: string
  openedAt: number
}

export type SidebarTab = 'files' | 'recent' | 'outline-solid'

export interface HeadingNode {
  level: number
  text: string
  line: number
}
