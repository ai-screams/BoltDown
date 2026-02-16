import { EditorView } from '@codemirror/view'
import { createContext, type ReactNode, type RefObject, use, useMemo, useRef } from 'react'

interface EditorViewContextValue {
  editorViewRef: RefObject<EditorView | null>
}

const EditorViewContext = createContext<EditorViewContextValue | null>(null)

export function EditorViewProvider({ children }: { children: ReactNode }) {
  const editorViewRef = useRef<EditorView | null>(null)
  const value = useMemo(() => ({ editorViewRef }), [])
  return <EditorViewContext value={value}>{children}</EditorViewContext>
}

export function useEditorView(): RefObject<EditorView | null> {
  const ctx = use(EditorViewContext)
  if (!ctx) throw new Error('useEditorView must be used within EditorViewProvider')
  return ctx.editorViewRef
}
