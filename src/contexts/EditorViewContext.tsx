import { EditorView } from '@codemirror/view'
import { createContext, type ReactNode, type RefObject, useContext, useRef } from 'react'

interface EditorViewContextValue {
  editorViewRef: RefObject<EditorView | null>
}

const EditorViewContext = createContext<EditorViewContextValue | null>(null)

export function EditorViewProvider({ children }: { children: ReactNode }) {
  const editorViewRef = useRef<EditorView | null>(null)
  return <EditorViewContext value={{ editorViewRef }}>{children}</EditorViewContext>
}

export function useEditorView(): RefObject<EditorView | null> {
  const ctx = useContext(EditorViewContext)
  if (!ctx) throw new Error('useEditorView must be used within EditorViewProvider')
  return ctx.editorViewRef
}
