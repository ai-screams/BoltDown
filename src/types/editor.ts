export type EditorMode = 'split' | 'source' | 'live' | 'zen'

export interface Tab {
  id: string
  filePath: string | null
  fileName: string
  content: string
  savedContent: string
}
