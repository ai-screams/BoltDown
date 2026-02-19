export type TableAlignment = 'left' | 'center' | 'right'

export interface TableModel {
  headers: string[]
  alignments: TableAlignment[]
  rows: string[][]
}

export interface TableCellCoords {
  rowIndex: number
  columnIndex: number
}

function parseCells(line: string): string[] {
  const trimmedLine = line.trim()
  const segments = splitByUnescapedPipe(trimmedLine)

  if (trimmedLine.startsWith('|') && segments.length > 0 && segments[0] === '') {
    segments.shift()
  }

  if (
    hasUnescapedTrailingPipe(trimmedLine) &&
    segments.length > 0 &&
    segments[segments.length - 1] === ''
  ) {
    segments.pop()
  }

  return segments.map(cell => decodeEscapedCell(cell.trim()))
}

function splitByUnescapedPipe(text: string): string[] {
  const cells: string[] = []
  let currentCell = ''

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '|' && !isEscaped(text, index)) {
      cells.push(currentCell)
      currentCell = ''
      continue
    }

    currentCell += char
  }

  cells.push(currentCell)
  return cells
}

function isEscaped(text: string, index: number): boolean {
  let slashCount = 0
  for (let scan = index - 1; scan >= 0; scan -= 1) {
    if (text[scan] !== '\\') break
    slashCount += 1
  }

  return slashCount % 2 === 1
}

function hasUnescapedTrailingPipe(text: string): boolean {
  if (!text.endsWith('|')) return false
  return !isEscaped(text, text.length - 1)
}

function decodeEscapedCell(cell: string): string {
  let decoded = ''

  for (let index = 0; index < cell.length; index += 1) {
    const char = cell[index]
    const nextChar = cell[index + 1]

    if (char === '\\' && (nextChar === '\\' || nextChar === '|')) {
      decoded += nextChar
      index += 1
      continue
    }

    decoded += char
  }

  return decoded
}

function escapeCell(cell: string): string {
  let escaped = ''

  for (let index = 0; index < cell.length; index += 1) {
    const char = cell[index]
    if (char === '\\') {
      escaped += '\\\\'
      continue
    }
    if (char === '|') {
      escaped += '\\|'
      continue
    }
    escaped += char
  }

  return escaped
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

export function normalizeCellValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function cloneModel(model: TableModel): TableModel {
  return {
    headers: [...model.headers],
    alignments: [...model.alignments],
    rows: model.rows.map(row => [...row]),
  }
}

function clampColumnIndex(model: TableModel, index: number): number {
  return Math.max(0, Math.min(index, model.headers.length - 1))
}

function clampTargetSize(value: number, min: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.floor(value))
}

export function parseTableModel(tableText: string): TableModel | null {
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

export function serializeTableModel(model: TableModel): string {
  const alignmentTokens = model.alignments.map(buildAlignmentToken)
  const escapedHeaders = model.headers.map(escapeCell)
  const escapedRows = model.rows.map(row => row.map(cell => escapeCell(cell ?? '')))

  const columnWidths = escapedHeaders.map((header, index) => {
    const values = [header, alignmentTokens[index]!, ...escapedRows.map(row => row[index] ?? '')]
    return Math.max(...values.map(value => value.length), 1)
  })

  const formatRow = (cells: readonly string[]): string => {
    const segments = cells.map((cell, index) => ` ${cell.padEnd(columnWidths[index]!)} `)
    return `|${segments.join('|')}|`
  }

  const lines = [formatRow(escapedHeaders), formatRow(alignmentTokens)]
  for (const row of escapedRows) {
    lines.push(formatRow(row))
  }

  return lines.join('\n')
}

export function setCellText(model: TableModel, coords: TableCellCoords, value: string): TableModel {
  const nextModel = cloneModel(model)
  const nextValue = normalizeCellValue(value)

  if (coords.rowIndex === 0) {
    if (coords.columnIndex < 0 || coords.columnIndex >= nextModel.headers.length) return nextModel
    nextModel.headers[coords.columnIndex] = nextValue
    return nextModel
  }

  const bodyRowIndex = coords.rowIndex - 1
  if (bodyRowIndex < 0 || bodyRowIndex >= nextModel.rows.length) return nextModel
  if (coords.columnIndex < 0 || coords.columnIndex >= nextModel.headers.length) return nextModel

  nextModel.rows[bodyRowIndex]![coords.columnIndex] = nextValue
  return nextModel
}

export function addRowAbove(model: TableModel, bodyRowIndex: number): TableModel {
  const nextModel = cloneModel(model)
  const insertIndex = Math.max(0, Math.min(bodyRowIndex, nextModel.rows.length))
  const newRow = nextModel.headers.map(() => '')
  nextModel.rows.splice(insertIndex, 0, newRow)
  return nextModel
}

export function addRowBelow(model: TableModel, bodyRowIndex: number): TableModel {
  const nextModel = cloneModel(model)
  const insertIndex = Math.max(0, Math.min(bodyRowIndex + 1, nextModel.rows.length))
  const newRow = nextModel.headers.map(() => '')
  nextModel.rows.splice(insertIndex, 0, newRow)
  return nextModel
}

export function deleteRow(model: TableModel, bodyRowIndex: number): TableModel {
  if (model.rows.length === 0) return cloneModel(model)

  const nextModel = cloneModel(model)
  const deleteIndex = Math.max(0, Math.min(bodyRowIndex, nextModel.rows.length - 1))
  nextModel.rows.splice(deleteIndex, 1)
  return nextModel
}

export function addColumnLeft(model: TableModel, columnIndex: number): TableModel {
  const nextModel = cloneModel(model)
  const insertIndex = Math.max(0, Math.min(columnIndex, nextModel.headers.length))

  nextModel.headers.splice(insertIndex, 0, '')
  nextModel.alignments.splice(insertIndex, 0, 'left')
  nextModel.rows = nextModel.rows.map(row => {
    const nextRow = [...row]
    nextRow.splice(insertIndex, 0, '')
    return nextRow
  })

  return nextModel
}

export function addColumnRight(model: TableModel, columnIndex: number): TableModel {
  const nextModel = cloneModel(model)
  const insertIndex = Math.max(0, Math.min(columnIndex + 1, nextModel.headers.length))

  nextModel.headers.splice(insertIndex, 0, '')
  nextModel.alignments.splice(insertIndex, 0, 'left')
  nextModel.rows = nextModel.rows.map(row => {
    const nextRow = [...row]
    nextRow.splice(insertIndex, 0, '')
    return nextRow
  })

  return nextModel
}

export function deleteColumn(model: TableModel, columnIndex: number): TableModel {
  if (model.headers.length <= 1) return cloneModel(model)

  const nextModel = cloneModel(model)
  const deleteIndex = clampColumnIndex(nextModel, columnIndex)

  nextModel.headers.splice(deleteIndex, 1)
  nextModel.alignments.splice(deleteIndex, 1)
  nextModel.rows = nextModel.rows.map(row => {
    const nextRow = [...row]
    nextRow.splice(deleteIndex, 1)
    return nextRow
  })

  return nextModel
}

export function setColumnAlignment(
  model: TableModel,
  columnIndex: number,
  alignment: TableAlignment
): TableModel {
  const nextModel = cloneModel(model)
  if (nextModel.alignments.length === 0) return nextModel

  const targetIndex = clampColumnIndex(nextModel, columnIndex)
  nextModel.alignments[targetIndex] = alignment
  return nextModel
}

export function resizeTable(
  model: TableModel,
  targetBodyRows: number,
  targetColumns: number
): TableModel {
  const nextModel = cloneModel(model)
  const nextColumnCount = clampTargetSize(targetColumns, 1)
  const nextBodyRowCount = clampTargetSize(targetBodyRows, 1)

  if (nextModel.headers.length > nextColumnCount) {
    nextModel.headers = nextModel.headers.slice(0, nextColumnCount)
    nextModel.alignments = nextModel.alignments.slice(0, nextColumnCount)
    nextModel.rows = nextModel.rows.map(row => row.slice(0, nextColumnCount))
  } else if (nextModel.headers.length < nextColumnCount) {
    const addCount = nextColumnCount - nextModel.headers.length
    nextModel.headers.push(...new Array(addCount).fill(''))
    nextModel.alignments.push(...new Array(addCount).fill('left'))
    nextModel.rows = nextModel.rows.map(row => [...row, ...new Array(addCount).fill('')])
  }

  if (nextModel.rows.length > nextBodyRowCount) {
    nextModel.rows = nextModel.rows.slice(0, nextBodyRowCount)
  } else if (nextModel.rows.length < nextBodyRowCount) {
    const addCount = nextBodyRowCount - nextModel.rows.length
    const emptyRow = new Array(nextColumnCount).fill('')
    nextModel.rows.push(...Array.from({ length: addCount }, () => [...emptyRow]))
  }

  return nextModel
}
