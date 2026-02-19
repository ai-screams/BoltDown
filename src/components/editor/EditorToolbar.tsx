import type { EditorView } from '@codemirror/view'
import { clsx } from 'clsx'
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
import { memo, useCallback, useEffect, useRef, useState } from 'react'

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
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [showLeftFade, setShowLeftFade] = useState<boolean>(false)
  const [showRightFade, setShowRightFade] = useState<boolean>(false)

  const updateFadeVisibility = useCallback((): void => {
    const container = scrollRef.current
    if (!container) {
      return
    }

    const { scrollLeft, scrollWidth, clientWidth } = container
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth)
    const threshold = 1

    setShowLeftFade(scrollLeft > threshold)
    setShowRightFade(maxScrollLeft - scrollLeft > threshold)
  }, [])

  useEffect(() => {
    updateFadeVisibility()
  }, [updateFadeVisibility])

  useEffect(() => {
    window.addEventListener('resize', updateFadeVisibility)
    return () => window.removeEventListener('resize', updateFadeVisibility)
  }, [updateFadeVisibility])

  useEffect(() => {
    const container = scrollRef.current
    if (!container || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      updateFadeVisibility()
    })

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [updateFadeVisibility])

  const exec = (fn: (view: EditorView) => void) => {
    if (editorViewRef.current) fn(editorViewRef.current)
  }

  return (
    <div className="relative flex h-9 flex-none border-b border-line bg-surface-canvas">
      <div
        aria-hidden="true"
        className={clsx(
          'pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-surface-canvas via-surface-canvas/90 to-transparent transition-opacity duration-150',
          showLeftFade ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div
        aria-hidden="true"
        className={clsx(
          'pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-surface-canvas via-surface-canvas/90 to-transparent transition-opacity duration-150',
          showRightFade ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div
        ref={scrollRef}
        role="toolbar"
        aria-label="Formatting toolbar"
        className="scrollbar-none flex h-9 min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-2"
        onScroll={updateFadeVisibility}
      >
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
        <IconButton
          icon={Braces}
          label="Code Block"
          onClick={() => exec(v => insertCodeBlock(v))}
        />
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
        <IconButton
          icon={ListTodo}
          label="Task List"
          onClick={() => exec(v => insertTaskList(v))}
        />

        <div className="mx-1 h-4 w-px flex-none bg-line" />

        {/* Insert */}
        <IconButton icon={Table} label="Table" onClick={() => exec(v => insertTable(v))} />
        <IconButton
          icon={Minus}
          label="Horizontal Rule"
          onClick={() => exec(v => insertBlock(v, '\n---\n'))}
        />
      </div>
    </div>
  )
})
