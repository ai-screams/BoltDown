import { EditorState, type Range } from '@codemirror/state'
import type { Decoration, DecorationSet } from '@codemirror/view'
import { describe, expect, it } from 'vitest'

import { markdownExtension } from '../markdown'

import { buildDecorations } from './buildDecorations'
import {
  appendInlineHtmlTagDecorations,
  parseInlineHtmlMarker,
  type InlineHtmlMarker,
} from './inlineHtmlDecorations'

interface DecorationSummary {
  from: number
  to: number
  style: string | null
}

interface DecorationSpecWithAttributes {
  attributes?: {
    style?: string
  }
}

function getStyleFromDecoration(decoration: Decoration): string | null {
  const spec = decoration.spec as DecorationSpecWithAttributes
  return spec.attributes?.style ?? null
}

function summarizeRanges(decorations: readonly Range<Decoration>[]): DecorationSummary[] {
  return decorations.map(decoration => ({
    from: decoration.from,
    to: decoration.to,
    style: getStyleFromDecoration(decoration.value),
  }))
}

function summarizeDecorationSet(set: DecorationSet, docLength: number): DecorationSummary[] {
  const summaries: DecorationSummary[] = []
  set.between(0, docLength, (from, to, decoration) => {
    summaries.push({
      from,
      to,
      style: getStyleFromDecoration(decoration),
    })
  })
  return summaries
}

describe('parseInlineHtmlMarker', () => {
  it('parses supported opening and closing tags', () => {
    expect(parseInlineHtmlMarker('<u>', 0, 3)).toEqual({
      type: 'open',
      tag: 'u',
      from: 0,
      to: 3,
    })

    expect(parseInlineHtmlMarker('</sup>', 10, 16)).toEqual({
      type: 'close',
      tag: 'sup',
      from: 10,
      to: 16,
    })
  })

  it('ignores unsupported and self-closing tags', () => {
    expect(parseInlineHtmlMarker('<strong>', 0, 8)).toBeNull()
    expect(parseInlineHtmlMarker('<u/>', 0, 4)).toBeNull()
    expect(parseInlineHtmlMarker('<sub />', 0, 7)).toBeNull()
  })
})

describe('appendInlineHtmlTagDecorations', () => {
  it('hides markers when selection is outside pair range', () => {
    const markers: InlineHtmlMarker[] = [
      { type: 'open', tag: 'u', from: 0, to: 3 },
      { type: 'close', tag: 'u', from: 8, to: 12 },
    ]
    const decorations: Range<Decoration>[] = []

    appendInlineHtmlTagDecorations(decorations, { from: 20, to: 20 }, markers, [])
    const summaries = summarizeRanges(decorations)

    expect(summaries).toContainEqual({ from: 3, to: 8, style: 'text-decoration: underline;' })
    expect(summaries).toContainEqual({ from: 0, to: 3, style: null })
    expect(summaries).toContainEqual({ from: 8, to: 12, style: null })
  })

  it('dims markers when selection is inside pair range', () => {
    const markers: InlineHtmlMarker[] = [
      { type: 'open', tag: 'sup', from: 0, to: 5 },
      { type: 'close', tag: 'sup', from: 9, to: 15 },
    ]
    const decorations: Range<Decoration>[] = []

    appendInlineHtmlTagDecorations(decorations, { from: 10, to: 10 }, markers, [])
    const summaries = summarizeRanges(decorations)

    expect(summaries).toContainEqual({
      from: 0,
      to: 5,
      style: 'opacity: 0.35;',
    })
    expect(summaries).toContainEqual({
      from: 9,
      to: 15,
      style: 'opacity: 0.35;',
    })
    expect(summaries).not.toContainEqual({ from: 0, to: 5, style: null })
  })

  it('splits content styling around excluded ranges', () => {
    const markers: InlineHtmlMarker[] = [
      { type: 'open', tag: 'u', from: 0, to: 3 },
      { type: 'close', tag: 'u', from: 10, to: 14 },
    ]
    const decorations: Range<Decoration>[] = []

    appendInlineHtmlTagDecorations(decorations, { from: 20, to: 20 }, markers, [{ from: 5, to: 7 }])

    const styledSegments = summarizeRanges(decorations)
      .filter(decoration => decoration.style === 'text-decoration: underline;')
      .map(decoration => ({ from: decoration.from, to: decoration.to }))

    expect(styledSegments).toEqual([
      { from: 3, to: 5 },
      { from: 7, to: 10 },
    ])
  })

  it('recovers malformed nesting by reverse-search matching closes', () => {
    const markers: InlineHtmlMarker[] = [
      { type: 'open', tag: 'u', from: 0, to: 3 },
      { type: 'open', tag: 'sup', from: 3, to: 8 },
      { type: 'close', tag: 'u', from: 9, to: 13 },
      { type: 'close', tag: 'sup', from: 13, to: 19 },
    ]
    const decorations: Range<Decoration>[] = []

    appendInlineHtmlTagDecorations(decorations, { from: 25, to: 25 }, markers, [])
    const summaries = summarizeRanges(decorations)

    expect(summaries).toContainEqual({ from: 3, to: 9, style: 'text-decoration: underline;' })
    expect(summaries).toContainEqual({ from: 0, to: 3, style: null })
    expect(summaries).toContainEqual({ from: 9, to: 13, style: null })

    expect(summaries.some(decoration => decoration.from === 3 && decoration.to === 8)).toBe(false)
    expect(summaries.some(decoration => decoration.from === 13 && decoration.to === 19)).toBe(false)
  })

  it('ignores markers that overlap excluded ranges', () => {
    const markers: InlineHtmlMarker[] = [
      { type: 'open', tag: 'sub', from: 4, to: 9 },
      { type: 'close', tag: 'sub', from: 11, to: 17 },
    ]
    const decorations: Range<Decoration>[] = []

    appendInlineHtmlTagDecorations(decorations, { from: 0, to: 0 }, markers, [{ from: 0, to: 6 }])

    expect(decorations).toHaveLength(0)
  })
})

describe('buildDecorations integration', () => {
  it('does not render inline html styles inside indented code blocks', () => {
    const documentText = '<u>live</u>\n\n    <u>code</u>'
    const state = EditorState.create({
      doc: documentText,
      extensions: [markdownExtension()],
    })

    const decorationSet = buildDecorations(state, 'strict')
    const summaries = summarizeDecorationSet(decorationSet, state.doc.length)

    const underlineRanges = summaries.filter(
      decoration => decoration.style === 'text-decoration: underline;'
    )

    expect(underlineRanges).toEqual([{ from: 3, to: 7, style: 'text-decoration: underline;' }])
  })

  it('applies malformed recovery through syntax-tree HTMLTag extraction', () => {
    const documentText = '<u><sup>x</u></sup>'
    const state = EditorState.create({
      doc: documentText,
      selection: { anchor: documentText.length },
      extensions: [markdownExtension()],
    })

    const decorationSet = buildDecorations(state, 'strict')
    const summaries = summarizeDecorationSet(decorationSet, state.doc.length)

    expect(summaries).toContainEqual({ from: 3, to: 9, style: 'text-decoration: underline;' })

    const superscriptStyles = summaries.filter(
      decoration => decoration.style === 'vertical-align: super; font-size: 0.75em; line-height: 1;'
    )
    expect(superscriptStyles).toHaveLength(0)
  })
})
