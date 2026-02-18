import { EditorState, type TransactionSpec } from '@codemirror/state'
import type { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'

import { markdownExtension } from '../markdown'

import { buildDecorations } from './buildDecorations'
import { TableWidget } from './TableWidget'

interface MockEditorView {
  readonly state: EditorState
  dispatch: (spec: TransactionSpec | { state: EditorState }) => void
}

interface DecorationSpecWithWidget {
  widget?: unknown
}

function isTransaction(value: unknown): value is { state: EditorState } {
  if (!value || typeof value !== 'object') return false
  if (!('state' in value)) return false
  const maybeTransaction = value as { state?: unknown }
  return maybeTransaction.state instanceof EditorState
}

function createMockView(doc: string): { view: EditorView; getDoc: () => string } {
  let state = EditorState.create({ doc })

  const mockView: MockEditorView = {
    get state() {
      return state
    },
    dispatch(spec: TransactionSpec | { state: EditorState }) {
      if (isTransaction(spec)) {
        state = spec.state
        return
      }

      state = state.update(spec).state
    },
  }

  return {
    view: mockView as unknown as EditorView,
    getDoc: () => state.doc.toString(),
  }
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
    const widget = spec.widget
    if (!widget || typeof widget !== 'object' || !('constructor' in widget)) return

    const name = String((widget as { constructor: { name: string } }).constructor.name)
    if (name === widgetName) {
      found = widget
    }
  })

  return found
}

describe('TableWidget editing', () => {
  it('updates markdown table text when a rendered cell is edited', () => {
    const tableText =
      '| Feature | Shortcut | Description |\n| :--- | :--- | :--- |\n| Open | Cmd+O | Open file |'
    const { view, getDoc } = createMockView(tableText)
    const widget = new TableWidget(tableText, 0, tableText.length)
    const dom = widget.toDOM(view)

    const firstBodyCell = dom.querySelector('tbody td')
    if (!firstBodyCell) {
      throw new Error('Expected first table body cell to exist')
    }

    firstBodyCell.textContent = 'Open document'
    firstBodyCell.dispatchEvent(new Event('blur'))

    const updatedDoc = getDoc()
    expect(updatedDoc).toContain('Open document')
    expect(updatedDoc).toContain('| Feature')
    expect(updatedDoc).toContain('| :---')
  })

  it('ignores editor mouse selection handling for widget interactions', () => {
    const widget = new TableWidget('| A |\n| :--- |\n| B |', 0, 21)

    expect(widget.ignoreEvent(new MouseEvent('click'))).toBe(true)
    expect(widget.ignoreEvent(new KeyboardEvent('keydown'))).toBe(true)
  })
})

describe('table decorations in live mode', () => {
  it('keeps table rendered even when cursor is inside table lines', () => {
    const doc = '| Feature | Shortcut |\n| :--- | :--- |\n| Open | Cmd+O |\n\nAfter table paragraph'
    const state = EditorState.create({
      doc,
      selection: { anchor: doc.indexOf('Feature') + 2 },
      extensions: [markdownExtension()],
    })

    const decorationSet = buildDecorations(state, 'strict')
    const tableWidget = findWidgetByName(decorationSet, state.doc.length, 'TableWidget')

    expect(tableWidget).not.toBeNull()
  })
})
