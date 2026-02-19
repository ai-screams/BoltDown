import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'

import { markdownExtension } from '../markdown'

import {
  resolveCodeBlockArrowNavigation,
  resolveCodeBlockSelectAllRange,
} from './codeBlockArrowNavigationModel'

function createState(language: string, lineNumber: number): EditorState {
  const doc = ['before', `\`\`\`${language}`, 'alpha', 'beta', '```', 'after'].join('\n')
  const anchor =
    doc
      .split('\n')
      .slice(0, lineNumber - 1)
      .join('\n').length + (lineNumber > 1 ? 1 : 0)

  return EditorState.create({
    doc,
    selection: { anchor },
    extensions: [markdownExtension()],
  })
}

describe.each([
  { label: 'typescript', language: 'typescript' },
  { label: 'mermaid', language: 'mermaid' },
  { label: 'unlabeled', language: '' },
])('code block arrow navigation model ($label)', ({ language }) => {
  it('ArrowUp from first code line opens language editor with above-line target', () => {
    const state = createState(language, 3)

    const action = resolveCodeBlockArrowNavigation(state, state.selection.main, 'up')

    expect(action?.type).toBe('open-language-editor')
    if (!action || action.type !== 'open-language-editor') {
      throw new Error('Expected open-language-editor action')
    }
    expect(action.lineAboveFrom).toBe(state.doc.line(1).from)
  })

  it('ArrowDown from last code line moves cursor below the fenced block', () => {
    const state = createState(language, 4)

    const action = resolveCodeBlockArrowNavigation(state, state.selection.main, 'down')

    expect(action).toEqual({
      type: 'move-cursor',
      targetPos: state.doc.line(6).from,
    })
  })

  it('ArrowDown from line above enters the block at first code line', () => {
    const state = createState(language, 1)

    const action = resolveCodeBlockArrowNavigation(state, state.selection.main, 'down')

    expect(action).toEqual({
      type: 'move-cursor',
      targetPos: state.doc.line(3).from + 1,
    })
  })

  it('ArrowUp from line below enters the block at last code line', () => {
    const state = createState(language, 6)

    const action = resolveCodeBlockArrowNavigation(state, state.selection.main, 'up')

    expect(action).toEqual({
      type: 'move-cursor',
      targetPos: state.doc.line(4).from,
    })
  })

  it('returns null for non-boundary ArrowDown movement', () => {
    const state = createState(language, 3)

    const action = resolveCodeBlockArrowNavigation(state, state.selection.main, 'down')

    expect(action).toBeNull()
  })

  it('Mod+a inside code block selects only code text range', () => {
    const state = createState(language, 3)

    const range = resolveCodeBlockSelectAllRange(state, state.selection.main)

    expect(range).toEqual({
      from: state.doc.line(3).from,
      to: state.doc.line(4).to,
    })
  })

  it('returns null for Mod+a outside code block', () => {
    const state = createState(language, 1)

    const range = resolveCodeBlockSelectAllRange(state, state.selection.main)

    expect(range).toBeNull()
  })

  it('Mod+a on hidden closing fence line still selects only code text range', () => {
    const state = createState(language, 5)

    const range = resolveCodeBlockSelectAllRange(state, state.selection.main)

    expect(range).toEqual({
      from: state.doc.line(3).from,
      to: state.doc.line(4).to,
    })
  })
})

describe('code block select-all model edge cases', () => {
  it('returns null for empty fenced blocks without code text', () => {
    const doc = ['before', '```ts', '```', 'after'].join('\n')
    const state = EditorState.create({
      doc,
      selection: { anchor: doc.indexOf('```ts') },
      extensions: [markdownExtension()],
    })

    const range = resolveCodeBlockSelectAllRange(state, state.selection.main)

    expect(range).toBeNull()
  })
})
