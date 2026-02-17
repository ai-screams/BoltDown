import katex from 'katex'
import MarkdownIt from 'markdown-it'
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs'
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs'
import Prism from 'prismjs'

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
      return `<pre class="language-${lang}"><code class="language-${lang}">${Prism.highlight(str, Prism.languages[lang], lang)}</code></pre>`
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
  try {
    return katex.renderToString(tokens[idx]!.content, {
      throwOnError: false,
      strict: 'ignore',
    })
  } catch {
    return `<code>${escapeHtml(tokens[idx]!.content)}</code>`
  }
}

md.renderer.rules['math_block'] = (tokens, idx) => {
  const line = sourceLineFromToken(tokens[idx])
  const lineAttr = line ? ` data-source-line="${line}"` : ''

  try {
    return `<div${lineAttr} class="katex-block">${katex.renderToString(tokens[idx]!.content, {
      throwOnError: false,
      strict: 'ignore',
      displayMode: true,
    })}</div>`
  } catch {
    return `<pre${lineAttr}><code>${escapeHtml(tokens[idx]!.content)}</code></pre>`
  }
}

// Register TOC plugin
md.use(tocPlugin)
