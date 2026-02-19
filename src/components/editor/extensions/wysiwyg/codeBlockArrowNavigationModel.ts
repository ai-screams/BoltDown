import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import type { EditorState, SelectionRange } from '@codemirror/state'

export type ArrowNavigationDirection = 'up' | 'down'

export interface CodeBlockArrowNavigationOpenLanguageAction {
  type: 'open-language-editor'
  blockId: string
  lineAboveFrom: number | null
  firstCodeLineEntryPos: number | null
}

export interface CodeBlockArrowNavigationMoveCursorAction {
  type: 'move-cursor'
  targetPos: number
}

export interface CodeBlockSelectAllRange {
  from: number
  to: number
}

export type CodeBlockArrowNavigationAction =
  | CodeBlockArrowNavigationOpenLanguageAction
  | CodeBlockArrowNavigationMoveCursorAction

interface FencedCodeNavigationBlock {
  blockId: string
  codeTextFrom: number | null
  codeTextTo: number | null
  openingFenceLineNumber: number
  closingFenceLineNumber: number
  lineAboveNumber: number | null
  lineAboveFrom: number | null
  lineBelowNumber: number | null
  lineBelowFrom: number | null
  firstCodeLineNumber: number | null
  firstCodeLineFrom: number | null
  firstCodeLineEntryPos: number | null
  lastCodeLineNumber: number | null
  lastCodeLineFrom: number | null
}

function getFencedCodeBlockId(from: number, to: number): string {
  return `${from}:${to}`
}

export function getFencedCodeBlockIdFromRange(from: number, to: number): string {
  return getFencedCodeBlockId(from, to)
}

function getFencedCodeNavigationBlocks(state: EditorState): FencedCodeNavigationBlock[] {
  const blocks: FencedCodeNavigationBlock[] = []
  const tree = ensureSyntaxTree(state, state.doc.length, 50) ?? syntaxTree(state)

  tree.iterate({
    enter(node) {
      if (node.name !== 'FencedCode') return

      const openingFenceLine = state.doc.lineAt(node.from)
      const closingFenceLine = state.doc.lineAt(Math.max(node.from, node.to - 1))
      const codeTextNode = node.node.getChildren('CodeText')[0]

      const firstCodeLine = codeTextNode ? state.doc.lineAt(codeTextNode.from) : null
      const lastCodeLine = codeTextNode
        ? state.doc.lineAt(Math.max(codeTextNode.from, codeTextNode.to - 1))
        : null
      const firstCodeLineEntryPos = firstCodeLine
        ? Math.min(firstCodeLine.from + 1, firstCodeLine.to)
        : null

      const lineAboveNumber = openingFenceLine.number > 1 ? openingFenceLine.number - 1 : null
      const lineBelowNumber =
        closingFenceLine.number < state.doc.lines ? closingFenceLine.number + 1 : null

      blocks.push({
        blockId: getFencedCodeBlockId(node.from, node.to),
        codeTextFrom: codeTextNode?.from ?? null,
        codeTextTo: codeTextNode?.to ?? null,
        openingFenceLineNumber: openingFenceLine.number,
        closingFenceLineNumber: closingFenceLine.number,
        lineAboveNumber,
        lineAboveFrom: lineAboveNumber ? state.doc.line(lineAboveNumber).from : null,
        lineBelowNumber,
        lineBelowFrom: lineBelowNumber ? state.doc.line(lineBelowNumber).from : null,
        firstCodeLineNumber: firstCodeLine?.number ?? null,
        firstCodeLineFrom: firstCodeLine?.from ?? null,
        firstCodeLineEntryPos,
        lastCodeLineNumber: lastCodeLine?.number ?? null,
        lastCodeLineFrom: lastCodeLine?.from ?? null,
      })
    },
  })

  return blocks
}

export function resolveCodeBlockArrowNavigation(
  state: EditorState,
  selection: SelectionRange,
  direction: ArrowNavigationDirection
): CodeBlockArrowNavigationAction | null {
  if (!selection.empty) return null

  const cursorLineNumber = state.doc.lineAt(selection.head).number
  const blocks = getFencedCodeNavigationBlocks(state)

  for (const block of blocks) {
    if (direction === 'up') {
      if (block.firstCodeLineNumber !== null && cursorLineNumber === block.firstCodeLineNumber) {
        return {
          type: 'open-language-editor',
          blockId: block.blockId,
          lineAboveFrom: block.lineAboveFrom,
          firstCodeLineEntryPos: block.firstCodeLineEntryPos,
        }
      }

      if (
        block.lineBelowNumber !== null &&
        block.lastCodeLineFrom !== null &&
        cursorLineNumber === block.lineBelowNumber
      ) {
        return { type: 'move-cursor', targetPos: block.lastCodeLineFrom }
      }
    }

    if (direction === 'down') {
      if (
        block.lineAboveNumber !== null &&
        block.firstCodeLineEntryPos !== null &&
        cursorLineNumber === block.lineAboveNumber
      ) {
        return {
          type: 'open-language-editor',
          blockId: block.blockId,
          lineAboveFrom: block.lineAboveFrom,
          firstCodeLineEntryPos: block.firstCodeLineEntryPos,
        }
      }

      if (
        block.lastCodeLineNumber !== null &&
        block.lineBelowFrom !== null &&
        cursorLineNumber === block.lastCodeLineNumber
      ) {
        return { type: 'move-cursor', targetPos: block.lineBelowFrom }
      }
    }
  }

  return null
}

function isPositionWithinCodeText(pos: number, block: FencedCodeNavigationBlock): boolean {
  if (block.codeTextFrom === null || block.codeTextTo === null) {
    return false
  }

  return pos >= block.codeTextFrom && pos <= block.codeTextTo
}

function isCursorOnFencedCodeLine(
  state: EditorState,
  selection: SelectionRange,
  block: FencedCodeNavigationBlock
): boolean {
  const cursorLineNumber = state.doc.lineAt(selection.head).number
  return (
    cursorLineNumber >= block.openingFenceLineNumber &&
    cursorLineNumber <= block.closingFenceLineNumber
  )
}

export function resolveCodeBlockSelectAllRange(
  state: EditorState,
  selection: SelectionRange
): CodeBlockSelectAllRange | null {
  if (state.selection.ranges.length > 1) {
    return null
  }

  const blocks = getFencedCodeNavigationBlocks(state)
  for (const block of blocks) {
    const insideCodeText = isPositionWithinCodeText(selection.head, block)
    const onFencedCodeLine = isCursorOnFencedCodeLine(state, selection, block)
    if (!insideCodeText && !onFencedCodeLine) {
      continue
    }

    if (block.codeTextFrom === null || block.codeTextTo === null) {
      continue
    }

    return {
      from: block.codeTextFrom,
      to: block.codeTextTo,
    }
  }

  return null
}
