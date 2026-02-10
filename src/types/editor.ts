export type EditorMode = 'split' | 'source' | 'wysiwyg'

export interface FileInfo {
  path: string | null
  name: string
  isDirty: boolean
}
