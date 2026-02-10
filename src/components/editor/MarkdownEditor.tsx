import { search } from '@codemirror/search'
import { EditorView } from '@codemirror/view'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { useMemo, useRef } from 'react'

import type { EditorMode } from '@/types/editor'

import EditorToolbar from './EditorToolbar'
import { markdownExtension } from './extensions/markdown'
import { boltdownDarkTheme, boltdownTheme } from './extensions/theme'
import { wysiwygPlugin } from './extensions/wysiwyg'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  isDark: boolean
  mode: EditorMode
}

export default function MarkdownEditor({ value, onChange, isDark, mode }: MarkdownEditorProps) {
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const viewRef = useRef<EditorView | null>(null)

  const extensions = useMemo(() => {
    const exts = [
      markdownExtension(),
      isDark ? boltdownDarkTheme : boltdownTheme,
      search(),
      EditorView.lineWrapping,
    ]

    if (mode === 'wysiwyg') {
      exts.push(wysiwygPlugin)
    }

    return exts
  }, [isDark, mode])

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar editorView={viewRef} />
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          ref={editorRef}
          value={value}
          onChange={onChange}
          onCreateEditor={view => {
            viewRef.current = view
          }}
          extensions={extensions}
          theme={isDark ? 'dark' : 'light'}
          basicSetup={{
            lineNumbers: mode !== 'wysiwyg',
            foldGutter: mode !== 'wysiwyg',
            highlightActiveLine: true,
            highlightActiveLineGutter: mode !== 'wysiwyg',
            bracketMatching: true,
            indentOnInput: true,
            autocompletion: false,
          }}
          className="h-full"
        />
      </div>
    </div>
  )
}
