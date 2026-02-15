import type MarkdownIt from 'markdown-it'
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function tocBlockRule(
  state: StateBlock,
  startLine: number,
  _endLine: number,
  silent: boolean
): boolean {
  const pos = state.bMarks[startLine]! + state.tShift[startLine]!
  const max = state.eMarks[startLine]!
  const lineText = state.src.slice(pos, max).trim()

  if (lineText.toLowerCase() !== '[toc]') return false
  if (silent) return true

  state.line = startLine + 1

  const tokenOpen = state.push('toc_open', 'nav', 1)
  tokenOpen.map = [startLine, state.line]

  const tokenBody = state.push('toc_body', '', 0)
  tokenBody.content = '' // Will be populated by core rule
  tokenBody.map = [startLine, state.line]

  state.push('toc_close', 'nav', -1)

  return true
}

export function tocPlugin(md: MarkdownIt): void {
  // Track heading slugs for uniqueness per render
  const slugCounts = new Map<string, number>()

  // Part A: Add IDs to headings
  const originalHeadingOpen = md.renderer.rules.heading_open
  md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
    const currentToken = tokens[idx]
    const nextToken = tokens[idx + 1]
    if (currentToken && nextToken && nextToken.type === 'inline') {
      const rawText = nextToken.content
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')
        .replace(/~~(.+?)~~/g, '$1')
      let slug = slugify(rawText)
      const count = slugCounts.get(slug) ?? 0
      if (count > 0) slug = `${slug}-${count}`
      slugCounts.set(slug.replace(/-\d+$/, ''), count + 1)
      currentToken.attrSet('id', slug)
    }
    if (originalHeadingOpen) {
      return originalHeadingOpen(tokens, idx, options, env, self)
    }
    return self.renderToken(tokens, idx, options)
  }

  // Part B: [TOC] block rule
  md.block.ruler.before('paragraph', 'toc', tocBlockRule, {
    alt: ['paragraph', 'reference', 'blockquote'],
  })

  // Part C: TOC renderer
  md.renderer.rules['toc_open'] = () => '<nav class="markdown-toc">'
  md.renderer.rules['toc_close'] = () => '</nav>'
  md.renderer.rules['toc_body'] = (tokens, idx) => {
    const token = tokens[idx]
    return token ? token.content : ''
  }

  // Core rule to collect headings and generate TOC HTML
  md.core.ruler.push('collect_toc', state => {
    slugCounts.clear()

    // First pass: collect headings
    const headings: { level: number; text: string; slug: string }[] = []
    const tempSlugs = new Map<string, number>()

    for (let i = 0; i < state.tokens.length; i++) {
      const token = state.tokens[i]
      if (token && token.type === 'heading_open') {
        const level = parseInt(token.tag.slice(1))
        const inline = state.tokens[i + 1]
        if (inline && inline.type === 'inline') {
          const rawText = inline.content
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/`(.+?)`/g, '$1')
            .replace(/\[(.+?)\]\(.+?\)/g, '$1')
            .replace(/~~(.+?)~~/g, '$1')
          let slug = slugify(rawText)
          const count = tempSlugs.get(slug) ?? 0
          if (count > 0) slug = `${slug}-${count}`
          tempSlugs.set(slug.replace(/-\d+$/, ''), count + 1)
          headings.push({ level, text: rawText.trim(), slug })
        }
      }
    }

    // Second pass: inject TOC HTML into toc_body tokens
    if (headings.length > 0) {
      const minLevel = Math.min(...headings.map(h => h.level))
      const tocHtml = headings
        .map(h => {
          const indent = (h.level - minLevel) * 16
          return `<div style="padding-left:${indent}px" class="toc-item"><a href="#${h.slug}">${escapeHtml(h.text)}</a></div>`
        })
        .join('\n')

      for (const token of state.tokens) {
        if (token.type === 'toc_body') {
          token.content = tocHtml
        }
      }
    }
  })
}
