import type { EditorView } from '@codemirror/view'
import { WidgetType } from '@codemirror/view'

type TableAlignment = 'left' | 'center' | 'right'

interface TableModel {
  headers: string[]
  alignments: TableAlignment[]
  rows: string[][]
}

interface TableCellCoords {
  rowIndex: number
  columnIndex: number
}

function parseCells(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell => cell.trim())
}

function parseAlignmentToken(token: string): TableAlignment {
  const trimmed = token.trim()
  const hasLeadingColon = trimmed.startsWith(':')
  const hasTrailingColon = trimmed.endsWith(':')

  if (hasLeadingColon && hasTrailingColon) return 'center'
  if (hasTrailingColon) return 'right'
  return 'left'
}

function buildAlignmentToken(alignment: TableAlignment): string {
  if (alignment === 'center') return ':---:'
  if (alignment === 'right') return '---:'
  return ':---'
}

function normalizeCellValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function parseTableModel(tableText: string): TableModel | null {
  const lines = tableText.split('\n').filter(line => line.trim())
  if (lines.length < 2) return null

  const headers = parseCells(lines[0]!)
  const alignmentCells = parseCells(lines[1]!)
  const bodyRows = lines.slice(2).map(parseCells)

  const columnCount = Math.max(
    headers.length,
    alignmentCells.length,
    ...bodyRows.map(row => row.length),
    1
  )

  const normalizedHeaders = Array.from({ length: columnCount }, (_, index) => headers[index] ?? '')
  const normalizedAlignments = Array.from({ length: columnCount }, (_, index) =>
    parseAlignmentToken(alignmentCells[index] ?? '')
  )
  const normalizedRows = bodyRows.map(row =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? '')
  )

  return {
    headers: normalizedHeaders,
    alignments: normalizedAlignments,
    rows: normalizedRows,
  }
}

function serializeTableModel(model: TableModel): string {
  const alignmentTokens = model.alignments.map(buildAlignmentToken)
  const columnWidths = model.headers.map((header, index) => {
    const values = [header, alignmentTokens[index]!, ...model.rows.map(row => row[index] ?? '')]
    return Math.max(...values.map(value => value.length), 1)
  })

  const formatRow = (cells: readonly string[]): string => {
    const segments = cells.map((cell, index) => ` ${cell.padEnd(columnWidths[index]!)} `)
    return `|${segments.join('|')}|`
  }

  const lines = [formatRow(model.headers), formatRow(alignmentTokens)]
  for (const row of model.rows) {
    lines.push(formatRow(row))
  }

  return lines.join('\n')
}

export class TableWidget extends WidgetType {
  constructor(
    private readonly tableText: string,
    private readonly tableFrom: number,
    private readonly tableTo: number
  ) {
    super()
  }

  private updateCell(view: EditorView, coords: TableCellCoords, nextValue: string): void {
    const model = parseTableModel(this.tableText)
    if (!model) return

    const normalizedValue = normalizeCellValue(nextValue)

    if (coords.rowIndex === 0) {
      if (!model.headers[coords.columnIndex]) {
        model.headers[coords.columnIndex] = ''
      }
      if (model.headers[coords.columnIndex] === normalizedValue) return
      model.headers[coords.columnIndex] = normalizedValue
    } else {
      const bodyRowIndex = coords.rowIndex - 1
      if (!model.rows[bodyRowIndex]) return
      if (!model.rows[bodyRowIndex]![coords.columnIndex]) {
        model.rows[bodyRowIndex]![coords.columnIndex] = ''
      }
      if (model.rows[bodyRowIndex]![coords.columnIndex] === normalizedValue) return
      model.rows[bodyRowIndex]![coords.columnIndex] = normalizedValue
    }

    if (
      this.tableFrom < 0 ||
      this.tableTo > view.state.doc.length ||
      this.tableFrom >= this.tableTo
    ) {
      return
    }

    const nextTableText = serializeTableModel(model)
    const currentTableText = view.state.sliceDoc(this.tableFrom, this.tableTo)
    if (nextTableText === currentTableText) return

    view.dispatch({
      changes: {
        from: this.tableFrom,
        to: this.tableTo,
        insert: nextTableText,
      },
    })
  }

  private createEditableCell(
    view: EditorView,
    cellTag: 'th' | 'td',
    text: string,
    coords: TableCellCoords,
    alignment: TableAlignment
  ): HTMLElement {
    const cell = document.createElement(cellTag)
    cell.textContent = text
    cell.contentEditable = 'true'
    cell.spellcheck = false
    cell.style.cssText = `border: 1px solid rgb(var(--c-wys-table-border) / 1); padding: 6px 12px; text-align: ${alignment}; ${cellTag === 'th' ? 'font-weight: 600; background: var(--c-wys-table-head-bg);' : ''}`

    const commit = () => {
      const nextValue = cell.textContent ?? ''
      this.updateCell(view, coords, nextValue)
    }

    cell.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commit()
        cell.blur()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        cell.textContent = text
        cell.blur()
      }
    })

    cell.addEventListener('blur', commit)

    return cell
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-table-widget'
    wrapper.style.cssText = 'padding: 8px 0; overflow-x: auto;'

    const model = parseTableModel(this.tableText)
    if (!model) {
      wrapper.textContent = this.tableText
      return wrapper
    }

    const table = document.createElement('table')
    table.style.cssText = 'border-collapse: collapse; width: 100%; font-size: 0.9em;'

    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    model.headers.forEach((header, columnIndex) => {
      const alignment = model.alignments[columnIndex] ?? 'left'
      const headerCell = this.createEditableCell(
        view,
        'th',
        header,
        { rowIndex: 0, columnIndex },
        alignment
      )
      headerRow.appendChild(headerCell)
    })
    thead.appendChild(headerRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    model.rows.forEach((row, bodyIndex) => {
      const rowElement = document.createElement('tr')
      if (bodyIndex % 2 === 0) {
        rowElement.style.background = 'var(--c-wys-table-row-alt-bg)'
      }

      row.forEach((cellText, columnIndex) => {
        const alignment = model.alignments[columnIndex] ?? 'left'
        const bodyCell = this.createEditableCell(
          view,
          'td',
          cellText,
          { rowIndex: bodyIndex + 1, columnIndex },
          alignment
        )
        rowElement.appendChild(bodyCell)
      })

      tbody.appendChild(rowElement)
    })

    table.appendChild(tbody)
    wrapper.appendChild(table)
    return wrapper
  }

  eq(other: TableWidget): boolean {
    return (
      this.tableText === other.tableText &&
      this.tableFrom === other.tableFrom &&
      this.tableTo === other.tableTo
    )
  }

  ignoreEvent(_event: Event): boolean {
    return true
  }
}
