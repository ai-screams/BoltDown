import { EditorState } from '@codemirror/state'
import type { Decoration, DecorationSet } from '@codemirror/view'
import { describe, expect, it } from 'vitest'

import { markdownExtension } from '../markdown'

import { buildDecorations } from './buildDecorations'

interface DecorationSpecWithWidget {
  widget?: unknown
}

interface DecorationRangeSnapshot {
  from: number
  to: number
}

function getWidgetName(widget: unknown): string | null {
  if (!widget || typeof widget !== 'object' || !('constructor' in widget)) {
    return null
  }

  return String((widget as { constructor: { name: string } }).constructor.name)
}

function collectWidgetRanges(
  decorations: DecorationSet,
  docLength: number,
  widgetName: string
): DecorationRangeSnapshot[] {
  const ranges: DecorationRangeSnapshot[] = []

  decorations.between(0, docLength, (from, to, decoration: Decoration) => {
    const spec = decoration.spec as DecorationSpecWithWidget
    if (getWidgetName(spec.widget) !== widgetName) return
    ranges.push({ from, to })
  })

  return ranges
}

describe('inline math reveal behavior in live mode', () => {
  it('keeps inline math rendered when cursor is on same line but outside formulas', () => {
    const doc = 'alpha $x$ beta $y$ gamma'
    const state = EditorState.create({
      doc,
      selection: { anchor: 0 },
      extensions: [markdownExtension()],
    })

    const decorationSet = buildDecorations(state, 'strict')
    const inlineMathRanges = collectWidgetRanges(
      decorationSet,
      state.doc.length,
      'InlineMathWidget'
    )

    expect(inlineMathRanges).toEqual([
      { from: doc.indexOf('$x$'), to: doc.indexOf('$x$') + 3 },
      { from: doc.indexOf('$y$'), to: doc.indexOf('$y$') + 3 },
    ])
  })

  it('reveals only the focused inline math expression', () => {
    const doc = 'alpha $x$ beta $y$ gamma'
    const firstMathFrom = doc.indexOf('$x$')
    const secondMathFrom = doc.indexOf('$y$')

    const state = EditorState.create({
      doc,
      selection: { anchor: firstMathFrom + 1 },
      extensions: [markdownExtension()],
    })

    const decorationSet = buildDecorations(state, 'strict')
    const inlineMathRanges = collectWidgetRanges(
      decorationSet,
      state.doc.length,
      'InlineMathWidget'
    )

    expect(inlineMathRanges).toEqual([{ from: secondMathFrom, to: secondMathFrom + 3 }])
  })
})
