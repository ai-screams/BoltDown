import { EditorState } from '@codemirror/state'
import type { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'

import { markdownExtension } from '../markdown'

import { buildDecorations } from './buildDecorations'

interface DecorationSpecWithWidget {
  widget?: unknown
}

interface MockEditorView {
  dispatch: (tr: { selection: { anchor: number }; scrollIntoView: boolean }) => void
  focus: () => void
}

function getWidgetName(widget: unknown): string | null {
  if (!widget || typeof widget !== 'object' || !('constructor' in widget)) {
    return null
  }

  return String((widget as { constructor: { name: string } }).constructor.name)
}

function findWidgetByName(
  decorations: DecorationSet,
  docLength: number,
  widgetName: string
): unknown | null {
  let found: unknown | null = null

  decorations.between(0, docLength, (_from, _to, decoration: Decoration) => {
    if (found) return
    const spec = decoration.spec as DecorationSpecWithWidget
    if (getWidgetName(spec.widget) === widgetName) {
      found = spec.widget ?? null
    }
  })

  return found
}

describe('TOC decorations in live mode', () => {
  it('renders TOC widget when cursor is outside [toc] paragraph', () => {
    const doc = '# First\n\n[toc]\n\n## Second'
    const state = EditorState.create({
      doc,
      selection: { anchor: doc.length },
      extensions: [markdownExtension()],
    })

    const decorationSet = buildDecorations(state, 'strict')
    const tocWidget = findWidgetByName(decorationSet, state.doc.length, 'TocWidget')

    expect(tocWidget).not.toBeNull()
  })

  it('reveals raw [toc] syntax while editing [toc] line', () => {
    const doc = '# First\n\n[toc]\n\n## Second'
    const state = EditorState.create({
      doc,
      selection: { anchor: doc.indexOf('[toc]') + 1 },
      extensions: [markdownExtension()],
    })

    const decorationSet = buildDecorations(state, 'strict')
    const tocWidget = findWidgetByName(decorationSet, state.doc.length, 'TocWidget')

    expect(tocWidget).toBeNull()
  })

  it('includes ATX and Setext headings in rendered TOC widget', () => {
    const doc = 'Setext Title\n=====\n\n## ATX Heading\n\n[toc]'
    const state = EditorState.create({
      doc,
      selection: { anchor: 0 },
      extensions: [markdownExtension()],
    })

    const decorationSet = buildDecorations(state, 'strict')
    const tocWidget = findWidgetByName(decorationSet, state.doc.length, 'TocWidget') as {
      toDOM: (view: EditorView) => HTMLElement
    } | null

    expect(tocWidget).not.toBeNull()

    const mockView: MockEditorView = {
      dispatch: () => {},
      focus: () => {},
    }

    if (!tocWidget) {
      throw new Error('TocWidget should exist for [toc] paragraph')
    }

    const dom = tocWidget.toDOM(mockView as unknown as EditorView)
    const links = Array.from(dom.querySelectorAll('.toc-item a')).map(link => link.textContent)

    expect(links).toEqual(['Setext Title', 'ATX Heading'])
  })
})
