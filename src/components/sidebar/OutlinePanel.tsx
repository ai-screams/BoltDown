import { EditorView } from '@codemirror/view'
import { Hash } from 'lucide-react'
import { memo } from 'react'

import { useEditorView } from '@/contexts/EditorViewContext'
import { useOutline } from '@/hooks/useOutline'

function scrollToLine(view: EditorView, line: number) {
  const lineInfo = view.state.doc.line(line + 1)
  view.dispatch({
    selection: { anchor: lineInfo.from },
    effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
  })
  view.focus()
}

export const OutlinePanel = memo(() => {
  const headings = useOutline()
  const editorViewRef = useEditorView()

  const handleHeadingClick = (line: number) => {
    const view = editorViewRef.current
    if (view) {
      scrollToLine(view, line)
    }
  }

  if (headings.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 text-sm text-gray-500">
        <Hash className="mb-2 h-8 w-8 opacity-50" />
        <p>No headings found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col text-xs">
      {headings.map((heading, index) => {
        const indent = (heading.level - 1) * 12
        return (
          <button
            key={index}
            onClick={() => handleHeadingClick(heading.line)}
            className="flex items-center gap-2 px-3 py-1.5 text-left text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            style={{ paddingLeft: `${12 + indent}px` }}
          >
            <Hash className="h-3 w-3 flex-shrink-0 opacity-60" />
            <span className="truncate">{heading.text}</span>
          </button>
        )
      })}
    </div>
  )
})

OutlinePanel.displayName = 'OutlinePanel'
