import type { Range } from '@codemirror/state'
import { Decoration, WidgetType } from '@codemirror/view'
import Prism from 'prismjs'

import { sanitizeCodeHtml } from '@/utils/sanitize'

import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-typescript'

export function getCodeBlockPalette() {
  const isDark = document.documentElement.classList.contains('dark')
  return {
    background: 'rgb(var(--c-code-block-bg) / 1)',
    text: 'rgb(var(--c-code-block-text) / 1)',
    badge: 'rgb(var(--c-code-block-badge) / 1)',
    keyword: isDark ? '#c678dd' : '#a626a4',
    string: isDark ? '#98c379' : '#50a14f',
    comment: isDark ? '#5c6370' : '#a0a1a7',
    function: isDark ? '#61afef' : '#4078f2',
    number: isDark ? '#d19a66' : '#986801',
    punctuation: isDark ? '#abb2bf' : '#383a42',
  }
}

export function getPrismTokenColor(
  type: string,
  palette: ReturnType<typeof getCodeBlockPalette>
): string | null {
  if (type === 'keyword' || type === 'tag' || type === 'builtin') return palette.keyword
  if (type === 'string' || type === 'char' || type === 'template-string') return palette.string
  if (type === 'comment' || type === 'prolog' || type === 'doctype') return palette.comment
  if (type === 'function' || type === 'class-name') return palette.function
  if (type === 'number' || type === 'boolean') return palette.number
  if (type === 'operator' || type === 'punctuation') return palette.punctuation
  if (type === 'attr-name' || type === 'property') return palette.keyword
  if (type === 'attr-value') return palette.string
  return null
}

export function applyPrismTokens(
  decorations: Range<Decoration>[],
  tokens: (string | Prism.Token)[],
  startPos: number,
  palette: ReturnType<typeof getCodeBlockPalette>
): number {
  let pos = startPos
  for (const token of tokens) {
    if (typeof token === 'string') {
      pos += token.length
    } else {
      const tokenStart = pos
      if (Array.isArray(token.content)) {
        pos = applyPrismTokens(decorations, token.content, pos, palette)
      } else if (typeof token.content === 'string') {
        pos += token.content.length
      } else {
        // token.content is a single Token — recurse
        pos = applyPrismTokens(decorations, [token.content], pos, palette)
      }
      const color = getPrismTokenColor(token.type, palette)
      if (color) {
        decorations.push(
          Decoration.mark({ attributes: { style: `color: ${color};` } }).range(tokenStart, pos)
        )
      }
    }
  }
  return pos
}

export class LanguageBadgeWidget extends WidgetType {
  constructor(private language: string) {
    super()
  }
  toDOM() {
    const badge = document.createElement('span')
    badge.className = 'cm-codeblock-badge'
    badge.textContent = this.language.toUpperCase()
    const palette = getCodeBlockPalette()
    badge.style.cssText = `display: block; text-align: right; font-size: 0.7em; color: ${palette.badge}; font-family: monospace; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 8px; background: ${palette.background}; border-radius: 6px 6px 0 0;`
    return badge
  }
  eq(other: LanguageBadgeWidget) {
    return this.language === other.language
  }
  ignoreEvent() {
    return false
  }
}

export class CodeBlockWidget extends WidgetType {
  constructor(
    private code: string,
    private language: string
  ) {
    super()
  }
  toDOM() {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-codeblock-widget'
    wrapper.style.cssText = 'position: relative; padding: 8px 0;'
    const palette = getCodeBlockPalette()

    // Language badge
    if (this.language) {
      const badge = document.createElement('span')
      badge.textContent = this.language
      badge.style.cssText = `position: absolute; top: 6px; right: 10px; font-size: 0.7em; color: ${palette.badge}; font-family: monospace; text-transform: uppercase; letter-spacing: 0.05em;`
      wrapper.appendChild(badge)
    }

    const pre = document.createElement('pre')
    pre.style.cssText = `background: ${palette.background}; color: ${palette.text}; border-radius: 6px; padding: 16px; overflow-x: auto; font-size: 0.875em; line-height: 1.6; margin: 0;`
    const codeEl = document.createElement('code')

    const grammar = Prism.languages[this.language]
    if (grammar) {
      codeEl.innerHTML = sanitizeCodeHtml(Prism.highlight(this.code, grammar, this.language))
    } else {
      codeEl.textContent = this.code
    }

    codeEl.style.cssText = 'font-family: monospace; white-space: pre;'
    pre.appendChild(codeEl)
    wrapper.appendChild(pre)
    return wrapper
  }
  eq(other: CodeBlockWidget) {
    return this.code === other.code && this.language === other.language
  }
  ignoreEvent() {
    return false
  }
}
