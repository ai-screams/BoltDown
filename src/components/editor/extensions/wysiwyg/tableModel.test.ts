import { describe, expect, it } from 'vitest'

import {
  addColumnLeft,
  addColumnRight,
  addRowAbove,
  addRowBelow,
  deleteColumn,
  deleteRow,
  parseTableModel,
  resizeTable,
  serializeTableModel,
  setColumnAlignment,
  type TableModel,
} from './tableModel'

describe('tableModel row operations', () => {
  it('adds rows above and below selected row', () => {
    const model: TableModel = {
      headers: ['Feature', 'Shortcut'],
      alignments: ['left', 'left'],
      rows: [['Open', 'Cmd+O']],
    }

    const withAbove = addRowAbove(model, 0)
    expect(withAbove.rows).toEqual([
      ['', ''],
      ['Open', 'Cmd+O'],
    ])

    const withBelow = addRowBelow(model, 0)
    expect(withBelow.rows).toEqual([
      ['Open', 'Cmd+O'],
      ['', ''],
    ])
  })

  it('deletes selected row and keeps table shape valid', () => {
    const model: TableModel = {
      headers: ['A', 'B'],
      alignments: ['left', 'left'],
      rows: [
        ['1', '2'],
        ['3', '4'],
      ],
    }

    const nextModel = deleteRow(model, 0)
    expect(nextModel.rows).toEqual([['3', '4']])
  })
})

describe('tableModel column operations', () => {
  it('adds columns on left/right and deletes a selected column', () => {
    const model: TableModel = {
      headers: ['A', 'B'],
      alignments: ['left', 'right'],
      rows: [['x', 'y']],
    }

    const withLeft = addColumnLeft(model, 1)
    expect(withLeft.headers).toEqual(['A', '', 'B'])
    expect(withLeft.alignments).toEqual(['left', 'left', 'right'])
    expect(withLeft.rows).toEqual([['x', '', 'y']])

    const withRight = addColumnRight(model, 0)
    expect(withRight.headers).toEqual(['A', '', 'B'])
    expect(withRight.rows).toEqual([['x', '', 'y']])

    const afterDelete = deleteColumn(withRight, 1)
    expect(afterDelete.headers).toEqual(['A', 'B'])
    expect(afterDelete.rows).toEqual([['x', 'y']])
  })

  it('keeps at least one column when deleting columns', () => {
    const model: TableModel = {
      headers: ['Only'],
      alignments: ['left'],
      rows: [['v']],
    }

    const afterDelete = deleteColumn(model, 0)
    expect(afterDelete.headers).toEqual(['Only'])
    expect(afterDelete.rows).toEqual([['v']])
  })
})

describe('tableModel alignment and serialization', () => {
  it('updates alignment and serializes back to parseable markdown', () => {
    const model: TableModel = {
      headers: ['Feature', 'Shortcut'],
      alignments: ['left', 'left'],
      rows: [['Open', 'Cmd+O']],
    }

    const aligned = setColumnAlignment(model, 1, 'center')
    expect(aligned.alignments).toEqual(['left', 'center'])

    const serialized = serializeTableModel(aligned)
    const reparsed = parseTableModel(serialized)

    expect(reparsed).toEqual(aligned)
  })

  it('roundtrips escaped pipes and backslashes safely', () => {
    const markdown =
      '| Name\\|Title | Path\\\\Root |\n| :--- | :--- |\n| Keep\\|Pipe | Slash\\\\Value |'

    const parsed = parseTableModel(markdown)
    if (!parsed) {
      throw new Error('Expected escaped markdown table to parse')
    }

    expect(parsed.headers).toEqual(['Name|Title', 'Path\\Root'])
    expect(parsed.rows[0]).toEqual(['Keep|Pipe', 'Slash\\Value'])

    const serialized = serializeTableModel(parsed)
    expect(serialized).toContain('Name\\|Title')
    expect(serialized).toContain('Path\\\\Root')
    expect(serialized).toContain('Keep\\|Pipe')
    expect(serialized).toContain('Slash\\\\Value')

    const reparsed = parseTableModel(serialized)
    expect(reparsed).toEqual(parsed)
  })

  it('resizes rows and columns while preserving top-left cells', () => {
    const model: TableModel = {
      headers: ['A', 'B'],
      alignments: ['left', 'right'],
      rows: [
        ['r1c1', 'r1c2'],
        ['r2c1', 'r2c2'],
      ],
    }

    const expanded = resizeTable(model, 3, 4)
    expect(expanded.headers).toEqual(['A', 'B', '', ''])
    expect(expanded.rows).toEqual([
      ['r1c1', 'r1c2', '', ''],
      ['r2c1', 'r2c2', '', ''],
      ['', '', '', ''],
    ])

    const shrunken = resizeTable(expanded, 1, 1)
    expect(shrunken.headers).toEqual(['A'])
    expect(shrunken.rows).toEqual([['r1c1']])
  })
})
