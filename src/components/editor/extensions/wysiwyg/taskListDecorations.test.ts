import { EditorState } from '@codemirror/state'
import type { Decoration, DecorationSet } from '@codemirror/view'
import { describe, expect, it } from 'vitest'

import { markdownExtension } from '../markdown'

import { buildDecorations } from './buildDecorations'

interface DecorationSnapshot {
  from: number
  to: number
  widgetName: string | null
}

interface DecorationSpecWithWidget {
  widget?: unknown
}

function snapshotDecorations(set: DecorationSet, docLength: number): DecorationSnapshot[] {
  const snapshots: DecorationSnapshot[] = []

  set.between(0, docLength, (from, to, decoration: Decoration) => {
    const spec = decoration.spec as DecorationSpecWithWidget
    const widgetName =
      spec.widget && typeof spec.widget === 'object' && 'constructor' in spec.widget
        ? String((spec.widget as { constructor: { name: string } }).constructor.name)
        : null

    snapshots.push({ from, to, widgetName })
  })

  return snapshots
}

describe('task list decorations in live mode', () => {
  it('renders task checkbox widget when cursor is outside task item line', () => {
    const doc = '- [ ] open task\n\ncursor line'
    const state = EditorState.create({
      doc,
      selection: { anchor: doc.length },
      extensions: [markdownExtension()],
    })

    const decorationSet = buildDecorations(state, 'strict')
    const snapshots = snapshotDecorations(decorationSet, state.doc.length)

    expect(snapshots).toContainEqual({ from: 0, to: 6, widgetName: 'TaskCheckboxWidget' })
    expect(snapshots.some(snapshot => snapshot.widgetName === 'BulletWidget')).toBe(false)
  })

  it('reveals raw task syntax while editing current task line', () => {
    const doc = '- [x] done task\n\nnext line'
    const state = EditorState.create({
      doc,
      selection: { anchor: 4 },
      extensions: [markdownExtension()],
    })

    const decorationSet = buildDecorations(state, 'strict')
    const snapshots = snapshotDecorations(decorationSet, state.doc.length)

    expect(snapshots.some(snapshot => snapshot.widgetName === 'TaskCheckboxWidget')).toBe(false)
  })
})
