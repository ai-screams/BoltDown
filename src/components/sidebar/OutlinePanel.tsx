import { EditorView } from '@codemirror/view'
import { Hash } from 'lucide-react'
import { memo, useCallback } from 'react'

import { useEditorView } from '@/contexts/EditorViewContext'
import { useOutline } from '@/hooks/useOutline'

function scrollToLine(view: EditorView, line: number) {
  const targetLine = Math.min(Math.max(1, line + 1), view.state.doc.lines)
  const lineInfo = view.state.doc.line(targetLine)
  view.dispatch({
    selection: { anchor: lineInfo.from },
    effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
  })
  view.focus()
}

export const OutlinePanel = memo(() => {
  const headings = useOutline()
  const editorViewRef = useEditorView()

  const handleHeadingClick = useCallback(
    (line: number) => {
      const view = editorViewRef.current
      if (view) {
        scrollToLine(view, line)
      }
    },
    [editorViewRef]
  )

  if (headings.length === 0) {
    return (
      <div className="text-fg-muted flex flex-1 flex-col items-center justify-center px-4 text-sm">
        <Hash aria-hidden="true" className="mb-2 h-8 w-8 opacity-50" />
        <p>No headings found</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto text-xs">
      {headings.map(heading => {
        const indent = (heading.level - 1) * 12
        return (
          <button
            key={`${heading.line}-${heading.text}`}
            type="button"
            className="text-fg-secondary hover:bg-surface-muted flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
            style={{ paddingLeft: `${12 + indent}px` }}
            onClick={() => handleHeadingClick(heading.line)}
          >
            <Hash aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
            <span className="truncate">{heading.text}</span>
          </button>
        )
      })}
    </div>
  )
})

OutlinePanel.displayName = 'OutlinePanel'
