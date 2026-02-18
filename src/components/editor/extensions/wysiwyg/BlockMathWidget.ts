import type { EditorState, Range } from '@codemirror/state'
import { Decoration, WidgetType } from '@codemirror/view'
import katex from 'katex'

import { sanitizeKatexHtml } from '@/utils/sanitize'

import { InlineMathWidget, wysiwygKatexCache } from './InlineMathWidget'
import { createRangeChecker, isCursorOnRangeLine, isSelectionInRange, type DocRange } from './utils'

export class BlockMathWidget extends WidgetType {
  constructor(private content: string) {
    super()
  }
  toDOM() {
    const div = document.createElement('div')
    div.className = 'cm-block-math-widget'
    div.style.cssText = 'text-align: center; padding: 12px 0;'
    const cacheKey = `b:${this.content}`
    let html = wysiwygKatexCache.get(cacheKey)
    if (html === undefined) {
      html = sanitizeKatexHtml(
        katex.renderToString(this.content, {
          throwOnError: false,
          strict: 'ignore',
          displayMode: true,
        })
      )
      wysiwygKatexCache.set(cacheKey, html)
    }
    div.innerHTML = html
    return div
  }
  eq(other: BlockMathWidget) {
    return this.content === other.content
  }
  ignoreEvent() {
    return false
  }
}

export function appendMathDecorations(
  state: EditorState,
  decorations: Range<Decoration>[],
  cursor: { from: number; to: number },
  cursorLine: number,
  codeRanges: DocRange[]
) {
  const doc = state.doc
  const blockMathRanges: DocRange[] = []
  const isInCodeRange = createRangeChecker(codeRanges)

  let blockStart: number | null = null
  let blockLines: string[] = []

  // Block math pass: $$ line, content lines, $$ line
  for (let lineNo = 1; lineNo <= doc.lines; lineNo++) {
    const line = doc.line(lineNo)
    const trimmed = line.text.trim()
    const lineInCode = isInCodeRange(line.from)

    if (blockStart === null) {
      if (!lineInCode && trimmed === '$$') {
        blockStart = line.from
        blockLines = []
      }
      continue
    }

    if (!lineInCode && trimmed === '$$') {
      const matchFrom = blockStart
      const matchTo = line.to
      blockMathRanges.push({ from: matchFrom, to: matchTo })

      const isActive =
        isSelectionInRange(cursor, matchFrom, matchTo) ||
        isCursorOnRangeLine(state, cursorLine, matchFrom, matchTo)

      if (!isActive) {
        decorations.push(
          Decoration.replace({
            widget: new BlockMathWidget(blockLines.join('\n')),
            block: true,
          }).range(matchFrom, matchTo)
        )
      }

      blockStart = null
      continue
    }

    blockLines.push(line.text)
  }

  const excludedRanges = [...codeRanges, ...blockMathRanges].sort((a, b) => a.from - b.from)
  const isInExcludedRange = createRangeChecker(excludedRanges)

  // Inline math pass: $...$ (not $$)
  const inlineMathRegex = /(?<!\$)\$(?!\$)(.+?)\$(?!\$)/g

  for (let lineNo = 1; lineNo <= doc.lines; lineNo++) {
    const line = doc.line(lineNo)
    inlineMathRegex.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = inlineMathRegex.exec(line.text)) !== null) {
      const matchFrom = line.from + match.index
      const matchTo = matchFrom + match[0].length

      if (isInExcludedRange(matchFrom) || isInExcludedRange(matchTo - 1)) continue

      const isActive =
        isSelectionInRange(cursor, matchFrom, matchTo) ||
        isCursorOnRangeLine(state, cursorLine, matchFrom, matchTo)
      if (isActive) continue

      decorations.push(
        Decoration.replace({
          widget: new InlineMathWidget(match[1]!),
        }).range(matchFrom, matchTo)
      )
    }
  }
}
