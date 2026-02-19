import { EditorState } from '@codemirror/state'
import type { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'

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
})
