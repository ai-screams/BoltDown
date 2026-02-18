import katex from 'katex'
import MarkdownIt from 'markdown-it'
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs'
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs'
import type Token from 'markdown-it/lib/token.mjs'
import Prism from 'prismjs'

import { LruCache } from '@/utils/cache'
import { escapeHtml } from '@/utils/markdownText'
import { tocPlugin } from '@/utils/tocPlugin'

import 'katex/dist/katex.min.css'
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

const katexCache = new LruCache<string>(200)

// KaTeX inline math: $...$
function mathInline(state: StateInline, silent: boolean): boolean {
  if (state.src[state.pos] !== '$') return false
  // Don't match $$ (block delimiters)
  if (state.src[state.pos + 1] === '$') return false

  const start = state.pos + 1
  let end = start
  while (end < state.posMax && state.src[end] !== '$') {
    if (state.src[end] === '\\') end++ // skip escaped chars
    end++
  }
  if (end >= state.posMax) return false

  if (!silent) {
    const content = state.src.slice(start, end)
    const token = state.push('math_inline', 'math', 0)
    token.markup = '$'
    token.content = content
  }

  state.pos = end + 1
  return true
}

// KaTeX block math: $$...$$
function mathBlock(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean
): boolean {
  const startPos = state.bMarks[startLine]! + state.tShift[startLine]!
  const maxPos = state.eMarks[startLine]!

  if (startPos + 2 > maxPos) return false
  if (state.src.slice(startPos, startPos + 2) !== '$$') return false
  if (silent) return true

  let nextLine = startLine + 1
  let found = false
  while (nextLine < endLine) {
    const lineStart = state.bMarks[nextLine]! + state.tShift[nextLine]!
    const lineEnd = state.eMarks[nextLine]!
    if (state.src.slice(lineStart, lineEnd).trim() === '$$') {
      found = true
      break
    }
    nextLine++
  }
  if (!found) return false

  const content = state.getLines(startLine + 1, nextLine, state.tShift[startLine]!, false).trim()

  const token = state.push('math_block', 'math', 0)
  token.block = true
  token.content = content
  token.markup = '$$'
  token.map = [startLine, nextLine + 1]

  state.line = nextLine + 1
  return true
}

function sourceLineFromToken(
  token: { map?: [number, number] | null } | null | undefined
): number | null {
  const startLine = token?.map?.[0]
  if (startLine === undefined || startLine < 0) return null
  return startLine + 1
}

function withSourceLineAttr(html: string, line: number | null): string {
  if (!line || !html.startsWith('<')) return html
  if (/^<pre\b[^>]*\bdata-source-line=/.test(html)) return html
  return html.replace(/^<([a-zA-Z][\w:-]*)/, `<$1 data-source-line="${line}"`)
}

function addBlockSourceLineAttributes(parser: MarkdownIt): void {
  parser.core.ruler.after('block', 'source_line_attrs', state => {
    for (const token of state.tokens) {
      const line = sourceLineFromToken(token)
      if (!line) continue

      const isOpeningBlock = token.block && token.nesting === 1
      const isStandaloneBlock = token.block && token.nesting === 0
      if (!isOpeningBlock && !isStandaloneBlock) continue

      token.attrSet('data-source-line', String(line))
    }
  })
}

function findParentListOpenToken(
  tokens: readonly Token[],
  fromIndex: number,
  listItemLevel: number
): Token | null {
  for (let index = fromIndex; index >= 0; index -= 1) {
    const token = tokens[index]!
    const isListOpen = token.type === 'bullet_list_open' || token.type === 'ordered_list_open'
    if (isListOpen && token.level === listItemLevel - 1) {
      return token
    }
  }

  return null
}

function addClassIfMissing(token: Token, className: string): void {
  const classAttr = token.attrGet('class')
  if (!classAttr) {
    token.attrSet('class', className)
    return
  }

  const existing = classAttr.split(/\s+/)
  if (!existing.includes(className)) {
    token.attrSet('class', `${classAttr} ${className}`)
  }
}

function enableTaskListSyntax(parser: MarkdownIt): void {
  parser.core.ruler.after('inline', 'task_list_checkbox', state => {
    const tokens = state.tokens

    for (let index = 2; index < tokens.length; index += 1) {
      const inlineToken = tokens[index]!
      const paragraphOpen = tokens[index - 1]
      const listItemOpen = tokens[index - 2]

      if (inlineToken.type !== 'inline') continue
      if (paragraphOpen?.type !== 'paragraph_open' || listItemOpen?.type !== 'list_item_open')
        continue

      const children = inlineToken.children
      if (!children || children.length === 0) continue

      const firstTextToken = children[0]
      if (!firstTextToken || firstTextToken.type !== 'text') continue

      const markerMatch = /^\[([ xX])\]\s+/.exec(firstTextToken.content)
      if (!markerMatch) continue

      const isChecked = markerMatch[1]!.toLowerCase() === 'x'
      const markerLength = markerMatch[0]!.length

      firstTextToken.content = firstTextToken.content.slice(markerLength)
      inlineToken.content = inlineToken.content.slice(markerLength)

      if (firstTextToken.content.length === 0) {
        children.shift()
      }

      const checkboxToken = new state.Token('html_inline', '', 0)
      checkboxToken.content = `<input class="task-list-item-checkbox" type="checkbox"${isChecked ? ' checked' : ''} disabled>`
      children.unshift(checkboxToken)

      addClassIfMissing(listItemOpen, 'task-list-item')
      const listOpen = findParentListOpenToken(tokens, index - 2, listItemOpen.level)
      if (listOpen) {
        addClassIfMissing(listOpen, 'contains-task-list')
      }
    }
  })
}

export const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str: string, lang: string): string => {
    // Mermaid: pass through as-is (rendered client-side)
    if (lang === 'mermaid') {
      return `<pre class="mermaid-block"><code class="language-mermaid">${escapeHtml(str)}</code></pre>`
    }

    if (lang && Prism.languages[lang]) {
      const badge = `<span class="preview-lang-badge">${escapeHtml(lang)}</span>`
      return `<pre class="language-${lang}">${badge}<code class="language-${lang}">${Prism.highlight(str, Prism.languages[lang], lang)}</code></pre>`
    }
    return `<pre><code>${escapeHtml(str)}</code></pre>`
  },
})

// Register KaTeX plugin
md.inline.ruler.after('escape', 'math_inline', mathInline)
md.block.ruler.before('fence', 'math_block', mathBlock, {
  alt: ['paragraph', 'reference', 'blockquote', 'list'],
})
addBlockSourceLineAttributes(md)
enableTaskListSyntax(md)

const defaultFenceRenderer = md.renderer.rules.fence
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const rendered = defaultFenceRenderer
    ? defaultFenceRenderer(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options)
  const line = sourceLineFromToken(tokens[idx])
  return withSourceLineAttr(rendered, line)
}

const defaultCodeBlockRenderer = md.renderer.rules.code_block
md.renderer.rules.code_block = (tokens, idx, options, env, self) => {
  const rendered = defaultCodeBlockRenderer
    ? defaultCodeBlockRenderer(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options)
  const line = sourceLineFromToken(tokens[idx])
  return withSourceLineAttr(rendered, line)
}

md.renderer.rules['math_inline'] = (tokens, idx) => {
  const content = tokens[idx]!.content
  const cacheKey = `i:${content}`
  const cached = katexCache.get(cacheKey)
  if (cached !== undefined) return cached

  try {
    const html = katex.renderToString(content, {
      throwOnError: false,
      strict: 'ignore',
    })
    katexCache.set(cacheKey, html)
    return html
  } catch {
    const fallback = `<code>${escapeHtml(content)}</code>`
    katexCache.set(cacheKey, fallback)
    return fallback
  }
}

md.renderer.rules['math_block'] = (tokens, idx) => {
  const content = tokens[idx]!.content
  const line = sourceLineFromToken(tokens[idx])
  const lineAttr = line ? ` data-source-line="${line}"` : ''
  const cacheKey = `b:${content}`
  const cached = katexCache.get(cacheKey)
  if (cached !== undefined) return `<div${lineAttr} class="katex-block">${cached}</div>`

  try {
    const html = katex.renderToString(content, {
      throwOnError: false,
      strict: 'ignore',
      displayMode: true,
    })
    katexCache.set(cacheKey, html)
    return `<div${lineAttr} class="katex-block">${html}</div>`
  } catch {
    const fallback = escapeHtml(content)
    katexCache.set(cacheKey, fallback)
    return `<pre${lineAttr}><code>${fallback}</code></pre>`
  }
}

// Register TOC plugin
md.use(tocPlugin)
