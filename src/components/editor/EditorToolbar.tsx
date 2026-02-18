import type { EditorView } from '@codemirror/view'
import {
  Bold,
  Braces,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Highlighter,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Sigma,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Underline,
} from 'lucide-react'
import { memo } from 'react'

import { useEditorView } from '@/contexts/EditorViewContext'
import IconButton from '@components/common/IconButton'

import {
  insertAtLineStart,
  insertBlock,
  insertCodeBlock,
  insertMathBlock,
  insertTable,
  insertTaskList,
  toggleCode,
  toggleWrap,
} from './formatCommands'

export default memo(function EditorToolbar() {
  const editorViewRef = useEditorView()

  const exec = (fn: (view: EditorView) => void) => {
    if (editorViewRef.current) fn(editorViewRef.current)
  }

  return (
    <div className="scrollbar-none flex h-9 flex-none items-center gap-0.5 overflow-x-auto border-b border-line bg-surface-canvas px-2">
      {/* Text formatting */}
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
        icon={Underline}
        label="Underline"
        onClick={() => exec(v => toggleWrap(v, '<u>', '</u>'))}
      />
      <IconButton
        icon={Strikethrough}
        label="Strikethrough"
        shortcut="Cmd+Shift+X"
        onClick={() => exec(v => toggleWrap(v, '~~', '~~'))}
      />
      <IconButton
        icon={Highlighter}
        label="Highlight"
        onClick={() => exec(v => toggleWrap(v, '==', '=='))}
      />
      <IconButton
        icon={Superscript}
        label="Superscript"
        onClick={() => exec(v => toggleWrap(v, '<sup>', '</sup>'))}
      />
      <IconButton
        icon={Subscript}
        label="Subscript"
        onClick={() => exec(v => toggleWrap(v, '<sub>', '</sub>'))}
      />

      <div className="mx-1 h-4 w-px flex-none bg-line" />

      {/* Headings */}
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
      <IconButton
        icon={Heading4}
        label="Heading 4"
        onClick={() => exec(v => insertAtLineStart(v, '#### '))}
      />

      <div className="mx-1 h-4 w-px flex-none bg-line" />

      {/* Links & media */}
      <IconButton
        icon={Link}
        label="Link"
        shortcut="Cmd+K"
        onClick={() => exec(v => toggleWrap(v, '[', '](url)'))}
      />
      <IconButton
        icon={Image}
        label="Image"
        onClick={() => exec(v => insertBlock(v, '![alt](url)'))}
      />

      <div className="mx-1 h-4 w-px flex-none bg-line" />

      {/* Code & math */}
      <IconButton
        icon={Code}
        label="Inline Code"
        shortcut="Cmd+E"
        onClick={() => exec(v => toggleCode(v))}
      />
      <IconButton icon={Braces} label="Code Block" onClick={() => exec(v => insertCodeBlock(v))} />
      <IconButton icon={Sigma} label="Math" onClick={() => exec(v => insertMathBlock(v))} />

      <div className="mx-1 h-4 w-px flex-none bg-line" />

      {/* Block elements */}
      <IconButton
        icon={Quote}
        label="Blockquote"
        onClick={() => exec(v => insertAtLineStart(v, '> '))}
      />
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
      <IconButton icon={ListTodo} label="Task List" onClick={() => exec(v => insertTaskList(v))} />

      <div className="mx-1 h-4 w-px flex-none bg-line" />

      {/* Insert */}
      <IconButton icon={Table} label="Table" onClick={() => exec(v => insertTable(v))} />
      <IconButton
        icon={Minus}
        label="Horizontal Rule"
        onClick={() => exec(v => insertBlock(v, '\n---\n'))}
      />
    </div>
  )
})
