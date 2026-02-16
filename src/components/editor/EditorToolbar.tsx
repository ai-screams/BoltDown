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
import { memo } from 'react'

import { useEditorView } from '@/contexts/EditorViewContext'
import IconButton from '@components/common/IconButton'

function toggleWrap(view: EditorView, before: string, after: string) {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const doc = view.state.doc

  // Case 1: Selected text is already wrapped with markers (e.g. selecting "**bold**")
  if (
    selected.startsWith(before) &&
    selected.endsWith(after) &&
    selected.length >= before.length + after.length
  ) {
    const inner = selected.slice(before.length, selected.length - after.length)
    view.dispatch({
      changes: { from, to, insert: inner },
      selection: { anchor: from, head: from + inner.length },
    })
    view.focus()
    return
  }

  // Case 2: Markers exist just outside the selection (e.g. cursor inside **|bold|**)
  const outerFrom = from - before.length
  const outerTo = to + after.length
  if (
    outerFrom >= 0 &&
    outerTo <= doc.length &&
    doc.sliceString(outerFrom, from) === before &&
    doc.sliceString(to, outerTo) === after
  ) {
    // Guard: for single-char markers (e.g. * for italic), count the full consecutive
    // run to avoid stripping a char that belongs to a longer marker (e.g. ** for bold).
    // Even count ⇒ marker not present (all chars paired as bold) ⇒ skip removal.
    let shouldRemove = true
    if (before === after && before.length === 1) {
      const ch = before
      let left = 0
      for (let i = from - 1; i >= 0 && doc.sliceString(i, i + 1) === ch; i--) left++
      let right = 0
      for (let i = to; i < doc.length && doc.sliceString(i, i + 1) === ch; i++) right++
      if (left % 2 === 0 || right % 2 === 0) shouldRemove = false
    }

    if (shouldRemove) {
      view.dispatch({
        changes: [
          { from: outerFrom, to: from, insert: '' },
          { from: to, to: outerTo, insert: '' },
        ],
        selection: { anchor: outerFrom, head: outerFrom + (to - from) },
      })
      view.focus()
      return
    }
  }

  // Case 3: No existing markers — wrap with markers
  const text = selected || 'text'
  view.dispatch({
    changes: { from, to, insert: `${before}${text}${after}` },
    selection: { anchor: from + before.length, head: from + before.length + text.length },
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

export default memo(function EditorToolbar() {
  const editorViewRef = useEditorView()

  const exec = (fn: (view: EditorView) => void) => {
    if (editorViewRef.current) fn(editorViewRef.current)
  }

  return (
    <div className="flex h-9 flex-none items-center gap-0.5 border-b border-line bg-surface-canvas px-2">
      <IconButton
        icon={Bold}
        label="Bold"
        shortcut="Cmd+B"
        onClick={() => exec(v => toggleWrap(v, '**', '**'))}
      />
      <IconButton
        icon={Italic}
        label="Italic"
        shortcut="Cmd+I"
        onClick={() => exec(v => toggleWrap(v, '*', '*'))}
      />
      <IconButton
        icon={Strikethrough}
        label="Strikethrough"
        onClick={() => exec(v => toggleWrap(v, '~~', '~~'))}
      />

      <div className="mx-1 h-4 w-px bg-line" />

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

      <div className="mx-1 h-4 w-px bg-line" />

      <IconButton
        icon={Link}
        label="Link"
        onClick={() => exec(v => toggleWrap(v, '[', '](url)'))}
      />
      <IconButton
        icon={Image}
        label="Image"
        onClick={() => exec(v => insertBlock(v, '![alt](url)'))}
      />

      <div className="mx-1 h-4 w-px bg-line" />

      <IconButton
        icon={Code}
        label="Code"
        onClick={() => {
          exec(v => {
            const { from, to } = v.state.selection.main
            const selected = v.state.sliceDoc(from, to)
            if (selected.includes('\n')) {
              toggleWrap(v, '```\n', '\n```')
            } else {
              toggleWrap(v, '`', '`')
            }
          })
        }}
      />
      <IconButton
        icon={Quote}
        label="Blockquote"
        onClick={() => exec(v => insertAtLineStart(v, '> '))}
      />

      <div className="mx-1 h-4 w-px bg-line" />

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
})
