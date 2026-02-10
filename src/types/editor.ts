export type EditorMode = 'split' | 'source' | 'wysiwyg'

export interface Tab {
  id: string
  filePath: string | null
  fileName: string
  content: string
  savedContent: string
}
