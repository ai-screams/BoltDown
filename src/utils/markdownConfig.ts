import katex from 'katex'
import MarkdownIt from 'markdown-it'
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs'
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs'
import Prism from 'prismjs'

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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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
  try {
    return `<div class="katex-block">${katex.renderToString(tokens[idx]!.content, {
      throwOnError: false,
      strict: 'ignore',
      displayMode: true,
    })}</div>`
  } catch {
    return `<pre><code>${escapeHtml(tokens[idx]!.content)}</code></pre>`
  }
}

// Register TOC plugin
import { tocPlugin } from './tocPlugin'
md.use(tocPlugin)
