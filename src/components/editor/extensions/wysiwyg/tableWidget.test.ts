import { EditorState, type TransactionSpec } from '@codemirror/state'
import type { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'

import { markdownExtension } from '../markdown'

import { buildDecorations } from './buildDecorations'
import { parseTableModel } from './tableModel'
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

  it('keeps escaped pipe/backslash values when another cell is edited', () => {
    const tableText =
      '| Name\\|Title | Path\\\\Root |\n| :--- | :--- |\n| Keep\\|Pipe | Slash\\\\Value |'
    const { view, getDoc } = createMockView(tableText)
    const widget = new TableWidget(tableText, 0, tableText.length)
    const dom = widget.toDOM(view)

    const editableCell = dom.querySelector('tbody td[data-row-index="1"][data-col-index="1"]')
    if (!editableCell) {
      throw new Error('Expected editable body cell to exist')
    }

    editableCell.textContent = 'New|Value\\Path'
    editableCell.dispatchEvent(new Event('blur'))

    const updatedDoc = getDoc()
    expect(updatedDoc).toContain('Keep\\|Pipe')
    expect(updatedDoc).toContain('Name\\|Title')
    expect(updatedDoc).toContain('Path\\\\Root')
    expect(updatedDoc).toContain('New\\|Value\\\\Path')

    const reparsed = parseTableModel(updatedDoc)
    expect(reparsed?.rows[0]?.[1]).toBe('New|Value\\Path')
    expect(reparsed?.rows[0]?.[0]).toBe('Keep|Pipe')
  })

  it('ignores editor mouse selection handling for widget interactions', () => {
    const widget = new TableWidget('| A |\n| :--- |\n| B |', 0, 21)

    expect(widget.ignoreEvent(new MouseEvent('click'))).toBe(true)
    expect(widget.ignoreEvent(new KeyboardEvent('keydown'))).toBe(true)
  })

  it('adds and deletes rows through table controls', () => {
    const tableText = '| A | B |\n| :--- | :--- |\n| C | D |'
    const { view, getDoc } = createMockView(tableText)
    const widget = new TableWidget(tableText, 0, tableText.length)
    const dom = widget.toDOM(view)

    const firstBodyCell = dom.querySelector('tbody td[data-row-index="1"][data-col-index="0"]')
    const toggleRowMenuButton = dom.querySelector('button[data-action="toggle-row-menu"]')
    const addRowBelowButton = dom.querySelector('button[data-action="add-row-below"]')
    const deleteRowButton = dom.querySelector('button[data-action="delete-row"]')
    if (!firstBodyCell || !toggleRowMenuButton || !addRowBelowButton || !deleteRowButton) {
      throw new Error('Expected row controls and first body cell to exist')
    }

    firstBodyCell.dispatchEvent(new Event('focus'))
    toggleRowMenuButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    addRowBelowButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    const withExtraRow = parseTableModel(getDoc())
    expect(withExtraRow?.rows).toHaveLength(2)

    const secondWidget = new TableWidget(getDoc(), 0, getDoc().length)
    const secondDom = secondWidget.toDOM(view)
    const secondToggleRowMenuButton = secondDom.querySelector(
      'button[data-action="toggle-row-menu"]'
    )
    const secondDeleteRowButton = secondDom.querySelector('button[data-action="delete-row"]')
    if (!secondToggleRowMenuButton || !secondDeleteRowButton) {
      throw new Error('Expected delete row button to exist after update')
    }

    secondToggleRowMenuButton.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    )
    secondDeleteRowButton.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    )

    const afterDelete = parseTableModel(getDoc())
    expect(afterDelete?.rows).toHaveLength(1)
  })

  it('adds and deletes columns through table controls', () => {
    const tableText = '| A | B |\n| :--- | :--- |\n| C | D |'
    const { view, getDoc } = createMockView(tableText)
    const widget = new TableWidget(tableText, 0, tableText.length)
    const dom = widget.toDOM(view)

    const firstHeaderCell = dom.querySelector('thead th[data-row-index="0"][data-col-index="0"]')
    const toggleColMenuButton = dom.querySelector('button[data-action="toggle-col-menu"]')
    const addColumnRightButton = dom.querySelector('button[data-action="add-col-right"]')
    if (!firstHeaderCell || !toggleColMenuButton || !addColumnRightButton) {
      throw new Error('Expected column controls and header cell to exist')
    }

    firstHeaderCell.dispatchEvent(new Event('focus'))
    toggleColMenuButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    addColumnRightButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    const withExtraColumn = parseTableModel(getDoc())
    expect(withExtraColumn?.headers).toHaveLength(3)

    const secondWidget = new TableWidget(getDoc(), 0, getDoc().length)
    const secondDom = secondWidget.toDOM(view)
    const secondToggleColMenuButton = secondDom.querySelector(
      'button[data-action="toggle-col-menu"]'
    )
    const secondDeleteColumnButton = secondDom.querySelector('button[data-action="delete-col"]')
    if (!secondToggleColMenuButton || !secondDeleteColumnButton) {
      throw new Error('Expected delete column button to exist after update')
    }

    secondToggleColMenuButton.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    )
    secondDeleteColumnButton.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    )

    const afterDelete = parseTableModel(getDoc())
    expect(afterDelete?.headers).toHaveLength(2)
  })

  it('updates column alignment through table controls', () => {
    const tableText = '| A | B |\n| :--- | :--- |\n| C | D |'
    const { view, getDoc } = createMockView(tableText)
    const widget = new TableWidget(tableText, 0, tableText.length)
    const dom = widget.toDOM(view)

    const secondHeaderCell = dom.querySelector('thead th[data-row-index="0"][data-col-index="1"]')
    const alignRightButton = dom.querySelector('button[data-action="align-right"]')
    if (!secondHeaderCell || !alignRightButton) {
      throw new Error('Expected alignment controls and second header cell to exist')
    }

    secondHeaderCell.dispatchEvent(new Event('focus'))
    alignRightButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    const alignedModel = parseTableModel(getDoc())
    expect(alignedModel?.alignments[1]).toBe('right')
  })

  it('updates active L/C/R state when focused column changes', () => {
    const tableText = '| A | B |\n| :---: | ---: |\n| C | D |'
    const { view } = createMockView(tableText)
    const widget = new TableWidget(tableText, 0, tableText.length)
    const dom = widget.toDOM(view)

    const firstHeaderCell = dom.querySelector('thead th[data-row-index="0"][data-col-index="0"]')
    const secondHeaderCell = dom.querySelector('thead th[data-row-index="0"][data-col-index="1"]')
    const alignCenterButton = dom.querySelector('button[data-action="align-center"]')
    const alignRightButton = dom.querySelector('button[data-action="align-right"]')

    if (!firstHeaderCell || !secondHeaderCell || !alignCenterButton || !alignRightButton) {
      throw new Error('Expected header cells and alignment buttons to exist')
    }

    firstHeaderCell.dispatchEvent(new Event('focus'))
    expect(alignCenterButton.getAttribute('data-active')).toBe('true')
    expect(alignRightButton.getAttribute('data-active')).toBe('false')

    secondHeaderCell.dispatchEvent(new Event('focus'))
    expect(alignCenterButton.getAttribute('data-active')).toBe('false')
    expect(alignRightButton.getAttribute('data-active')).toBe('true')
  })

  it('resizes table using cols/rows inputs and keeps existing data', () => {
    const tableText = '| A | B |\n| :--- | :--- |\n| v1 | v2 |\n| v3 | v4 |'
    const { view, getDoc } = createMockView(tableText)
    const widget = new TableWidget(tableText, 0, tableText.length)
    const dom = widget.toDOM(view)

    const toggleResizeButton = dom.querySelector('button[data-action="toggle-resize-panel"]')
    if (!toggleResizeButton) {
      throw new Error('Expected resize toggle button to exist')
    }

    toggleResizeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    const colsInput = dom.querySelector(
      'input[data-field="resize-cols"]'
    ) as HTMLInputElement | null
    const rowsInput = dom.querySelector(
      'input[data-field="resize-rows"]'
    ) as HTMLInputElement | null
    const applyResizeButton = dom.querySelector('button[data-action="apply-resize"]')

    if (!colsInput || !rowsInput || !applyResizeButton) {
      throw new Error('Expected resize panel inputs and apply button to exist')
    }

    colsInput.value = '3'
    rowsInput.value = '3'
    applyResizeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    const expanded = parseTableModel(getDoc())
    expect(expanded?.headers).toEqual(['A', 'B', ''])
    expect(expanded?.rows).toEqual([
      ['v1', 'v2', ''],
      ['v3', 'v4', ''],
      ['', '', ''],
    ])
  })

  it('allows shrinking resize and accepts data truncation', () => {
    const tableText = '| A | B | C |\n| :--- | :--- | :--- |\n| v1 | v2 | v3 |\n| v4 | v5 | v6 |'
    const { view, getDoc } = createMockView(tableText)
    const widget = new TableWidget(tableText, 0, tableText.length)
    const dom = widget.toDOM(view)

    const toggleResizeButton = dom.querySelector('button[data-action="toggle-resize-panel"]')
    if (!toggleResizeButton) {
      throw new Error('Expected resize toggle button to exist')
    }

    toggleResizeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    const colsInput = dom.querySelector(
      'input[data-field="resize-cols"]'
    ) as HTMLInputElement | null
    const rowsInput = dom.querySelector(
      'input[data-field="resize-rows"]'
    ) as HTMLInputElement | null
    const applyResizeButton = dom.querySelector('button[data-action="apply-resize"]')

    if (!colsInput || !rowsInput || !applyResizeButton) {
      throw new Error('Expected resize panel inputs and apply button to exist')
    }

    colsInput.value = '1'
    rowsInput.value = '1'
    applyResizeButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    const shrunken = parseTableModel(getDoc())
    expect(shrunken?.headers).toEqual(['A'])
    expect(shrunken?.rows).toEqual([['v1']])
  })

  it('keeps committed value unchanged when update cannot be dispatched', () => {
    const tableText = '| A |\n| :--- |\n| B |'
    const { view } = createMockView(tableText)
    const widget = new TableWidget(tableText, 0, tableText.length)
    const dom = widget.toDOM(view)

    const bodyCell = dom.querySelector('tbody td[data-row-index="1"][data-col-index="0"]')
    if (!bodyCell) {
      throw new Error('Expected body cell to exist')
    }

    view.dispatch({
      changes: {
        from: 0,
        to: tableText.length,
        insert: 'x',
      },
    })

    bodyCell.textContent = 'Changed'
    bodyCell.dispatchEvent(new Event('blur'))

    bodyCell.textContent = 'Different draft'
    bodyCell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(bodyCell.textContent).toBe('B')
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
