import type { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export type DocRange = { from: number; to: number }

export const headingStyles: Record<string, string> = {
  '1': 'font-size: 2em; font-weight: 700; line-height: 1.2;',
  '2': 'font-size: 1.5em; font-weight: 700; line-height: 1.3;',
  '3': 'font-size: 1.25em; font-weight: 600; line-height: 1.4;',
  '4': 'font-size: 1.1em; font-weight: 600; line-height: 1.4;',
  '5': 'font-size: 1em; font-weight: 600; line-height: 1.5;',
  '6': 'font-size: 0.9em; font-weight: 600; line-height: 1.5; color: rgb(var(--c-wys-heading-6-text) / 1);',
}

export function scheduleEditorMeasure(view: EditorView) {
  requestAnimationFrame(() => {
    if (!view.dom.isConnected) return
    view.requestMeasure()
  })
}

export function createRangeChecker(ranges: DocRange[]) {
  let idx = 0

  return (pos: number) => {
    while (idx < ranges.length && ranges[idx]!.to <= pos) {
      idx += 1
    }

    if (idx >= ranges.length) return false
    const range = ranges[idx]!
    return pos >= range.from && pos < range.to
  }
}

export function isSelectionInRange(
  selection: { from: number; to: number },
  from: number,
  to: number
) {
  if (selection.from === selection.to) {
    return selection.from >= from && selection.from < to
  }

  return selection.from < to && selection.to > from
}

export function isCursorOnRangeLine(
  state: EditorState,
  cursorLine: number,
  from: number,
  to: number
) {
  const startLine = state.doc.lineAt(from).number
  const endLine = state.doc.lineAt(Math.max(from, to - 1)).number
  return cursorLine >= startLine && cursorLine <= endLine
}
