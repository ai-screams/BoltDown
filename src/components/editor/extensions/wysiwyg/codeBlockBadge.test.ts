import { EditorState } from '@codemirror/state'
import type { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { describe, expect, it, vi } from 'vitest'

import { markdownExtension } from '../markdown'

import { buildDecorations } from './buildDecorations'
import { getFencedCodeBlockIdFromRange } from './codeBlockArrowNavigationModel'
import { openLanguagePopoverForCodeBlock } from './CodeBlockWidget'

interface DecorationSpecWithWidget {
  widget?: unknown
  class?: string
  attributes?: Record<string, string>
}

function hasWidgetByName(
  decorations: DecorationSet,
  docLength: number,
  widgetName: string
): boolean {
  let found = false

  decorations.between(0, docLength, (_from, _to, decoration: Decoration) => {
    if (found) return
    const spec = decoration.spec as DecorationSpecWithWidget
    const widget = spec.widget
    if (!widget || typeof widget !== 'object' || !('constructor' in widget)) return

    const name = String((widget as { constructor: { name: string } }).constructor.name)
    if (name === widgetName) {
      found = true
    }
  })

  return found
}

function getWidgetByName(
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

function hasCodeBlockLineAt(
  decorations: DecorationSet,
  docLength: number,
  lineFrom: number,
  expectedLineNumber: string
): boolean {
  let found = false

  decorations.between(0, docLength, (from, _to, decoration: Decoration) => {
    if (found || from !== lineFrom) return

    const spec = decoration.spec as DecorationSpecWithWidget
    if (spec.class !== 'codeblock-line') return
    if (spec.attributes?.['data-line-number'] !== expectedLineNumber) return
    found = true
  })

  return found
}

describe('code block language badge decorations', () => {
  it('renders a language badge widget for unlabeled fenced blocks', () => {
    const doc = ['before', '```', 'alpha', '```', 'after'].join('\n')
    const state = EditorState.create({
      doc,
      selection: { anchor: doc.indexOf('alpha') },
      extensions: [markdownExtension()],
    })

    const decorations = buildDecorations(state, 'strict')
    expect(hasWidgetByName(decorations, state.doc.length, 'LanguageBadgeWidget')).toBe(true)
  })

  it('keeps mermaid reveal mode language badge when cursor is inside the block', () => {
    const doc = ['before', '```mermaid', 'flowchart LR', '```', 'after'].join('\n')
    const state = EditorState.create({
      doc,
      selection: { anchor: doc.indexOf('flowchart') },
      extensions: [markdownExtension()],
    })

    const decorations = buildDecorations(state, 'strict')
    expect(hasWidgetByName(decorations, state.doc.length, 'LanguageBadgeWidget')).toBe(true)
  })

  it('keeps mermaid outside mode language badge with metadata and open path', () => {
    const doc = ['before', '```mermaid', 'flowchart LR', '```', 'after'].join('\n')
    const state = EditorState.create({
      doc,
      selection: { anchor: doc.indexOf('before') },
      extensions: [markdownExtension()],
    })

    const decorations = buildDecorations(state, 'strict')
    const widget = getWidgetByName(decorations, state.doc.length, 'LanguageBadgeWidget')
    expect(widget).not.toBeNull()

    const host = document.createElement('div')
    const dispatch = vi.fn()
    const view = {
      dom: host,
      dispatch,
      focus() {},
    } as unknown as EditorView

    const badge = (widget as { toDOM: (view: EditorView) => HTMLElement }).toDOM(view)
    host.appendChild(badge)

    expect(badge.dataset['codeblockId']).toBeTruthy()
    expect(badge.dataset['firstCodeLineEntryPos']).toBeTruthy()

    const opened = openLanguagePopoverForCodeBlock(view, badge.dataset['codeblockId'] as string)
    expect(opened).toBe(true)

    const input = host.querySelector<HTMLInputElement>('.codeblock-lang-input')
    expect(input).not.toBeNull()
    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: { anchor: Number.parseInt(badge.dataset['firstCodeLineEntryPos'] ?? '0', 10) },
        scrollIntoView: true,
      })
    )
  })

  it('applies first code-line styling to the first actual code line', () => {
    const doc = ['```typescript', 'const a = 1', 'const b = 2', '```'].join('\n')
    const state = EditorState.create({
      doc,
      selection: { anchor: doc.indexOf('const a') },
      extensions: [markdownExtension()],
    })

    const decorations = buildDecorations(state, 'strict')
    const firstCodeLineFrom = state.doc.line(2).from

    expect(hasCodeBlockLineAt(decorations, state.doc.length, firstCodeLineFrom, '1')).toBe(true)
  })
})

describe('openLanguagePopoverForCodeBlock', () => {
  it('uses dataset language value instead of badge fallback text', () => {
    const host = document.createElement('div')
    const badge = document.createElement('button')
    const blockId = '10:20'
    badge.className = 'codeblock-badge'
    badge.dataset['codeblockId'] = blockId
    badge.dataset['codeLanguage'] = ''
    badge.dataset['codeInfoFrom'] = '16'
    badge.dataset['codeInfoTo'] = '16'
    badge.dataset['lineAboveFrom'] = '1'
    badge.dataset['firstCodeLineEntryPos'] = '17'
    badge.textContent = 'plain text'
    host.appendChild(badge)

    const view = {
      dom: host,
      dispatch() {},
      focus() {},
    } as unknown as EditorView

    const opened = openLanguagePopoverForCodeBlock(view, getFencedCodeBlockIdFromRange(10, 20))
    expect(opened).toBe(true)

    const input = host.querySelector<HTMLInputElement>('.codeblock-lang-input')
    expect(input).not.toBeNull()
    expect(input?.value).toBe('')
  })

  it('ArrowDown in popover moves cursor into first code line entry position', () => {
    const host = document.createElement('div')
    const badge = document.createElement('button')
    const blockId = '10:20'
    badge.className = 'codeblock-badge'
    badge.dataset['codeblockId'] = blockId
    badge.dataset['codeLanguage'] = 'typescript'
    badge.dataset['codeInfoFrom'] = '13'
    badge.dataset['codeInfoTo'] = '23'
    badge.dataset['lineAboveFrom'] = '1'
    badge.dataset['firstCodeLineEntryPos'] = '24'
    host.appendChild(badge)

    const dispatch = vi.fn()
    const view = {
      dom: host,
      dispatch,
      focus() {},
    } as unknown as EditorView

    const opened = openLanguagePopoverForCodeBlock(view, getFencedCodeBlockIdFromRange(10, 20))
    expect(opened).toBe(true)

    const input = host.querySelector<HTMLInputElement>('.codeblock-lang-input')
    expect(input).not.toBeNull()
    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: { anchor: 24 },
        scrollIntoView: true,
      })
    )
  })

  it('ArrowDown and ArrowUp navigate suggestion list for non-empty query', () => {
    const host = document.createElement('div')
    const badge = document.createElement('button')
    const blockId = '10:20'
    badge.className = 'codeblock-badge'
    badge.dataset['codeblockId'] = blockId
    badge.dataset['codeLanguage'] = 'jav'
    badge.dataset['codeInfoFrom'] = '13'
    badge.dataset['codeInfoTo'] = '23'
    badge.dataset['lineAboveFrom'] = '1'
    badge.dataset['firstCodeLineEntryPos'] = '24'
    host.appendChild(badge)

    const dispatch = vi.fn()
    const view = {
      dom: host,
      dispatch,
      focus() {},
    } as unknown as EditorView

    const opened = openLanguagePopoverForCodeBlock(view, getFencedCodeBlockIdFromRange(10, 20))
    expect(opened).toBe(true)

    const input = host.querySelector<HTMLInputElement>('.codeblock-lang-input')
    const list = host.querySelector<HTMLUListElement>('.codeblock-lang-list')
    expect(input).not.toBeNull()
    expect(list).not.toBeNull()

    input?.dispatchEvent(new Event('input', { bubbles: true }))

    const initialActive = host.querySelector('.codeblock-lang-option.active') as HTMLElement | null
    expect(initialActive).toBeNull()

    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    const firstActive = host.querySelector('.codeblock-lang-option.active') as HTMLElement | null
    expect(firstActive).not.toBeNull()

    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    const secondActive = host.querySelector('.codeblock-lang-option.active') as HTMLElement | null
    expect(secondActive).not.toBeNull()
    expect(secondActive?.dataset['value']).not.toBe(firstActive?.dataset['value'])

    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    const activeAfterUp = host.querySelector('.codeblock-lang-option.active') as HTMLElement | null
    expect(activeAfterUp).not.toBeNull()
    expect(activeAfterUp?.dataset['value']).toBe(firstActive?.dataset['value'])

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('ArrowDown keeps moving into code line for empty query popover', () => {
    const host = document.createElement('div')
    const badge = document.createElement('button')
    const blockId = '10:20'
    badge.className = 'codeblock-badge'
    badge.dataset['codeblockId'] = blockId
    badge.dataset['codeLanguage'] = ''
    badge.dataset['codeInfoFrom'] = '13'
    badge.dataset['codeInfoTo'] = '23'
    badge.dataset['lineAboveFrom'] = '1'
    badge.dataset['firstCodeLineEntryPos'] = '24'
    host.appendChild(badge)

    const dispatch = vi.fn()
    const view = {
      dom: host,
      dispatch,
      focus() {},
    } as unknown as EditorView

    const opened = openLanguagePopoverForCodeBlock(view, getFencedCodeBlockIdFromRange(10, 20))
    expect(opened).toBe(true)

    const input = host.querySelector<HTMLInputElement>('.codeblock-lang-input')
    expect(input).not.toBeNull()

    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: { anchor: 24 },
        scrollIntoView: true,
      })
    )
  })
})
