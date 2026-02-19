import { EditorState, type TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'

import { TaskCheckboxWidget } from './TaskCheckboxWidget'

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

describe('TaskCheckboxWidget', () => {
  it('toggles unchecked marker to checked on click', () => {
    const { view, getDoc } = createMockView('- [ ] pending')
    const widget = new TaskCheckboxWidget(false, 2, 5)
    const dom = widget.toDOM(view)

    dom.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(getDoc()).toBe('- [x] pending')
  })

  it('toggles checked marker to unchecked on click', () => {
    const { view, getDoc } = createMockView('- [x] done')
    const widget = new TaskCheckboxWidget(true, 2, 5)
    const dom = widget.toDOM(view)

    dom.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(getDoc()).toBe('- [ ] done')
  })

  it('ignores clicks when marker text is invalid', () => {
    const { view, getDoc } = createMockView('- [v] custom')
    const widget = new TaskCheckboxWidget(false, 2, 5)
    const dom = widget.toDOM(view)

    dom.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(getDoc()).toBe('- [v] custom')
  })
})
