import type { EditorView } from '@codemirror/view'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
} from 'lucide-react'
import type { RefObject } from 'react'

import IconButton from '@components/common/IconButton'

interface EditorToolbarProps {
  editorView: RefObject<EditorView | null>
}

function wrapSelection(view: EditorView, before: string, after: string) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  view.dispatch({
    changes: { from, to, insert: `${before}${selected || 'text'}${after}` },
    selection: {
      anchor: from + before.length,
      head: from + before.length + (selected || 'text').length,
    },
  })
  view.focus()
}

function insertAtLineStart(view: EditorView, prefix: string) {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const currentText = line.text

  // Toggle: if line already starts with prefix, remove it
  if (currentText.startsWith(prefix)) {
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: '' },
    })
  } else {
    // Remove existing heading prefixes before adding new one
    const headingMatch = /^#{1,6}\s/.exec(currentText)
    const removeLen = headingMatch ? headingMatch[0].length : 0
    view.dispatch({
      changes: { from: line.from, to: line.from + removeLen, insert: prefix },
    })
  }
  view.focus()
}

function insertBlock(view: EditorView, text: string) {
  const { from } = view.state.selection.main
  view.dispatch({
    changes: { from, insert: text },
    selection: { anchor: from + text.length },
  })
  view.focus()
}

export default function EditorToolbar({ editorView }: EditorToolbarProps) {
  const exec = (fn: (view: EditorView) => void) => {
    if (editorView.current) fn(editorView.current)
  }

  return (
    <div className="flex h-9 items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 dark:border-gray-700 dark:bg-gray-800/50">
      <IconButton
        icon={Bold}
        label="Bold"
        shortcut="Cmd+B"
        onClick={() => exec(v => wrapSelection(v, '**', '**'))}
      />
      <IconButton
        icon={Italic}
        label="Italic"
        shortcut="Cmd+I"
        onClick={() => exec(v => wrapSelection(v, '*', '*'))}
      />
      <IconButton
        icon={Strikethrough}
        label="Strikethrough"
        onClick={() => exec(v => wrapSelection(v, '~~', '~~'))}
      />

      <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />

      <IconButton
        icon={Heading1}
        label="Heading 1"
        onClick={() => exec(v => insertAtLineStart(v, '# '))}
      />
      <IconButton
        icon={Heading2}
        label="Heading 2"
        onClick={() => exec(v => insertAtLineStart(v, '## '))}
      />
      <IconButton
        icon={Heading3}
        label="Heading 3"
        onClick={() => exec(v => insertAtLineStart(v, '### '))}
      />

      <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />

      <IconButton
        icon={Link}
        label="Link"
        onClick={() => exec(v => wrapSelection(v, '[', '](url)'))}
      />
      <IconButton
        icon={Image}
        label="Image"
        onClick={() => exec(v => insertBlock(v, '![alt](url)'))}
      />

      <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />

      <IconButton
        icon={Code}
        label="Code"
        onClick={() => {
          exec(v => {
            const { from, to } = v.state.selection.main
            const selected = v.state.sliceDoc(from, to)
            if (selected.includes('\n')) {
              wrapSelection(v, '```\n', '\n```')
            } else {
              wrapSelection(v, '`', '`')
            }
          })
        }}
      />
      <IconButton
        icon={Quote}
        label="Blockquote"
        onClick={() => exec(v => insertAtLineStart(v, '> '))}
      />

      <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />

      <IconButton
        icon={List}
        label="Bullet List"
        onClick={() => exec(v => insertAtLineStart(v, '- '))}
      />
      <IconButton
        icon={ListOrdered}
        label="Numbered List"
        onClick={() => exec(v => insertAtLineStart(v, '1. '))}
      />
      <IconButton
        icon={Minus}
        label="Horizontal Rule"
        onClick={() => exec(v => insertBlock(v, '\n---\n'))}
      />
    </div>
  )
}
