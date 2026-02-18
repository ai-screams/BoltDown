import { markdown } from '@codemirror/lang-markdown'
import { EditorState, type TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'

import { indentOrderedListItem, outdentOrderedListItem } from './editorUtils'

interface MockEditorView {
  readonly state: EditorState
  dispatch: (spec: TransactionSpec | { state: EditorState }) => void
}

function isTransaction(value: unknown): value is { state: EditorState } {
  if (!value || typeof value !== 'object') return false
  if (!('state' in value)) return false
  const maybeTransaction = value as { state?: unknown }
  return maybeTransaction.state instanceof EditorState
}

function createMockEditorView(
  doc: string,
  anchor: number
): {
  view: EditorView
  getDoc: () => string
} {
  let state = EditorState.create({
    doc,
    extensions: [markdown()],
  })
  state = state.update({ selection: { anchor } }).state

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

describe('ordered list tab indentation behavior', () => {
  it('indents the current item subtree and renumbers ordered lists', () => {
    const input = '1. one\n2. two\n   1. two-a\n3. three'
    const anchor = input.indexOf('2. two') + 1
    const { view, getDoc } = createMockEditorView(input, anchor)

    const handled = indentOrderedListItem(view)

    expect(handled).toBe(true)
    expect(getDoc()).toBe('1. one\n   1. two\n      1. two-a\n2. three')
  })

  it('matches sibling indentation when previous item already has a nested ordered list', () => {
    const input = '1. df\n   1. 23\n   2. 123\n2. ddf'
    const anchor = input.indexOf('2. ddf') + 1
    const { view, getDoc } = createMockEditorView(input, anchor)

    const handled = indentOrderedListItem(view)

    expect(handled).toBe(true)
    expect(getDoc()).toBe('1. df\n   1. 23\n   2. 123\n   3. ddf')
  })

  it('outdents the current item subtree and restores ordered numbering', () => {
    const input = '1. one\n   1. two\n      1. two-a\n2. three'
    const anchor = input.indexOf('1. two') + 1
    const { view, getDoc } = createMockEditorView(input, anchor)

    const handled = outdentOrderedListItem(view)

    expect(handled).toBe(true)
    expect(getDoc()).toBe('1. one\n2. two\n   1. two-a\n3. three')
  })

  it('returns false for outdent on top-level ordered item', () => {
    const input = '1. one\n2. two\n3. three'
    const anchor = input.indexOf('2. two') + 1
    const { view, getDoc } = createMockEditorView(input, anchor)

    const handled = outdentOrderedListItem(view)

    expect(handled).toBe(false)
    expect(getDoc()).toBe(input)
  })

  it('renumbers siblings after outdenting back to parent list', () => {
    const input = '1. one\n   1. two\n3. three'
    const anchor = input.indexOf('1. two') + 1
    const { view, getDoc } = createMockEditorView(input, anchor)

    const handled = outdentOrderedListItem(view)

    expect(handled).toBe(true)
    expect(getDoc()).toBe('1. one\n2. two\n3. three')
  })
})
