import { search } from '@codemirror/search'
import { EditorView } from '@codemirror/view'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { memo, useMemo, useRef } from 'react'

import { useEditorView } from '@/contexts/EditorViewContext'
import { useTheme } from '@/hooks/useTheme'
import { useEditorStore } from '@/stores/editorStore'

import { markdownExtension } from './extensions/markdown'
import { boltdownDarkTheme, boltdownTheme } from './extensions/theme'
import { wysiwygPlugin } from './extensions/wysiwyg'

export default memo(function MarkdownEditor() {
  const content = useEditorStore(s => s.content)
  const setContent = useEditorStore(s => s.setContent)
  const mode = useEditorStore(s => s.mode)
  const { isDark } = useTheme()
  const editorViewRef = useEditorView()
  const editorRef = useRef<ReactCodeMirrorRef>(null)

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
    <CodeMirror
      ref={editorRef}
      value={content}
      onChange={setContent}
      onCreateEditor={view => {
        editorViewRef.current = view
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
  )
})
