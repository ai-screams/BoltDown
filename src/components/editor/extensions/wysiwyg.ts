import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { StateField, type EditorState, type Range } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view'
import katex from 'katex'
import Prism from 'prismjs'

import { useTabStore } from '@/stores/tabStore'
import type { MermaidSecurityLevel } from '@/types/settings'
import { resolveImageSrcForDisplay } from '@/utils/imagePath'
import { getMermaidThemeFromDom } from '@/utils/themeRuntime'

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

let mermaidModulePromise: Promise<(typeof import('mermaid'))['default']> | null = null
let mermaidConfigCache: { theme: 'dark' | 'default'; securityLevel: MermaidSecurityLevel } | null =
  null
let mermaidRenderCount = 0
let mermaidRenderToken = 0

function getCodeBlockPalette() {
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

function getPrismTokenColor(
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

function applyPrismTokens(
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

/** Shared logic for symmetric inline formatting (bold, italic, inline code, strikethrough) */
function applyInlineFormatting(
  decorations: Range<Decoration>[],
  from: number,
  to: number,
  markerLen: number,
  contentStyle: string,
  revealInline: boolean
) {
  decorations.push(
    Decoration.mark({ attributes: { style: contentStyle } }).range(from + markerLen, to - markerLen)
  )
  if (!revealInline) {
    decorations.push(Decoration.replace({}).range(from, from + markerLen))
    decorations.push(Decoration.replace({}).range(to - markerLen, to))
  } else {
    decorations.push(
      Decoration.mark({ attributes: { style: 'opacity: 0.35;' } }).range(from, from + markerLen)
    )
    decorations.push(
      Decoration.mark({ attributes: { style: 'opacity: 0.35;' } }).range(to - markerLen, to)
    )
  }
}

class LanguageBadgeWidget extends WidgetType {
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

function scheduleEditorMeasure(view: EditorView) {
  requestAnimationFrame(() => {
    if (!view.dom.isConnected) return
    view.requestMeasure()
  })
}

async function getMermaid(securityLevel: MermaidSecurityLevel) {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then(mod => mod.default)
  }

  const mermaid = await mermaidModulePromise
  const theme = getMermaidThemeFromDom()

  if (
    !mermaidConfigCache ||
    mermaidConfigCache.theme !== theme ||
    mermaidConfigCache.securityLevel !== securityLevel
  ) {
    mermaid.initialize({
      startOnLoad: false,
      theme,
      securityLevel,
    })
    mermaidConfigCache = { theme, securityLevel }
  }

  return mermaid
}

async function renderMermaidInto(
  container: HTMLDivElement,
  code: string,
  securityLevel: MermaidSecurityLevel,
  onRendered?: () => void
) {
  const token = `${++mermaidRenderToken}`
  container.dataset.mermaidToken = token

  try {
    const mermaid = await getMermaid(securityLevel)
    const id = `cm-mermaid-${mermaidRenderCount++}`
    const { svg } = await mermaid.render(id, code)

    if (!container.isConnected || container.dataset.mermaidToken !== token) return
    container.innerHTML = svg
    onRendered?.()
  } catch {
    if (!container.isConnected || container.dataset.mermaidToken !== token) return

    const palette = getCodeBlockPalette()
    const pre = document.createElement('pre')
    pre.style.cssText = `background: ${palette.background}; color: ${palette.text}; border-radius: 6px; padding: 16px; overflow-x: auto; font-size: 0.875em; line-height: 1.6; margin: 0;`
    const codeEl = document.createElement('code')
    codeEl.textContent = code
    codeEl.style.cssText = 'font-family: monospace; white-space: pre;'
    pre.appendChild(codeEl)
    container.replaceChildren(pre)
    onRendered?.()
  }
}

type DocRange = { from: number; to: number }

function createRangeChecker(ranges: DocRange[]) {
  let idx = 0

  return (pos: number) => {
    while (idx < ranges.length && ranges[idx]!.to <= pos) {
      idx += 1
    }

    if (idx >= ranges.length) return false
    const range = ranges[idx]!
    return pos >= range.from && pos < range.to
  }
}

function isSelectionInRange(selection: { from: number; to: number }, from: number, to: number) {
  if (selection.from === selection.to) {
    return selection.from >= from && selection.from < to
  }

  return selection.from < to && selection.to > from
}

function isCursorOnRangeLine(state: EditorState, cursorLine: number, from: number, to: number) {
  const startLine = state.doc.lineAt(from).number
  const endLine = state.doc.lineAt(Math.max(from, to - 1)).number
  return cursorLine >= startLine && cursorLine <= endLine
}

function appendMathDecorations(
  state: EditorState,
  decorations: Range<Decoration>[],
  cursor: { from: number; to: number },
  cursorLine: number,
  codeRanges: DocRange[]
) {
  const doc = state.doc
  const blockMathRanges: DocRange[] = []
  const isInCodeRange = createRangeChecker(codeRanges)

  let blockStart: number | null = null
  let blockLines: string[] = []

  // Block math pass: $$ line, content lines, $$ line
  for (let lineNo = 1; lineNo <= doc.lines; lineNo++) {
    const line = doc.line(lineNo)
    const trimmed = line.text.trim()
    const lineInCode = isInCodeRange(line.from)

    if (blockStart === null) {
      if (!lineInCode && trimmed === '$$') {
        blockStart = line.from
        blockLines = []
      }
      continue
    }

    if (!lineInCode && trimmed === '$$') {
      const matchFrom = blockStart
      const matchTo = line.to
      blockMathRanges.push({ from: matchFrom, to: matchTo })

      const isActive =
        isSelectionInRange(cursor, matchFrom, matchTo) ||
        isCursorOnRangeLine(state, cursorLine, matchFrom, matchTo)

      if (!isActive) {
        decorations.push(
          Decoration.replace({
            widget: new BlockMathWidget(blockLines.join('\n')),
            block: true,
          }).range(matchFrom, matchTo)
        )
      }

      blockStart = null
      continue
    }

    blockLines.push(line.text)
  }

  const excludedRanges = [...codeRanges, ...blockMathRanges].sort((a, b) => a.from - b.from)
  const isInExcludedRange = createRangeChecker(excludedRanges)

  // Inline math pass: $...$ (not $$)
  const inlineMathRegex = /(?<!\$)\$(?!\$)(.+?)\$(?!\$)/g

  for (let lineNo = 1; lineNo <= doc.lines; lineNo++) {
    const line = doc.line(lineNo)
    inlineMathRegex.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = inlineMathRegex.exec(line.text)) !== null) {
      const matchFrom = line.from + match.index
      const matchTo = matchFrom + match[0].length

      if (isInExcludedRange(matchFrom) || isInExcludedRange(matchTo - 1)) continue

      const isActive =
        isSelectionInRange(cursor, matchFrom, matchTo) ||
        isCursorOnRangeLine(state, cursorLine, matchFrom, matchTo)
      if (isActive) continue

      decorations.push(
        Decoration.replace({
          widget: new InlineMathWidget(match[1]!),
        }).range(matchFrom, matchTo)
      )
    }
  }
}

// Widget that renders a bullet character
class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span')
    span.textContent = '\u2022'
    span.style.cssText = 'opacity: 0.5; font-size: 1.2em; margin-right: 4px;'
    return span
  }
  eq() {
    return true
  }
}

// Widget that renders an image inline
class ImageWidget extends WidgetType {
  constructor(
    private url: string,
    private alt: string
  ) {
    super()
  }
  toDOM(view: EditorView) {
    const wrapper = document.createElement('span')
    wrapper.className = 'cm-image-widget'
    wrapper.style.cssText = 'display: inline-block; max-width: 100%; padding: 4px 0;'

    const img = document.createElement('img')

    const syncLayout = () => scheduleEditorMeasure(view)
    img.addEventListener('load', syncLayout, { once: true })
    img.addEventListener('error', syncLayout, { once: true })

    img.alt = this.alt
    img.style.display = 'block'
    img.style.maxWidth = '100%'
    img.style.borderRadius = '4px'
    const { tabs, activeTabId } = useTabStore.getState()
    const activeTab = tabs.find(t => t.id === activeTabId)
    img.src = resolveImageSrcForDisplay(this.url, activeTab?.filePath ?? null)

    if (img.complete) {
      syncLayout()
    }

    wrapper.appendChild(img)
    return wrapper
  }
  eq(other: ImageWidget) {
    return this.url === other.url && this.alt === other.alt
  }
  ignoreEvent() {
    return false
  }
}

// Widget that renders inline math using KaTeX
class InlineMathWidget extends WidgetType {
  constructor(private content: string) {
    super()
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-inline-math-widget'
    span.innerHTML = katex.renderToString(this.content, {
      throwOnError: false,
      strict: 'ignore',
    })
    return span
  }
  eq(other: InlineMathWidget) {
    return this.content === other.content
  }
  ignoreEvent() {
    return false
  }
}

// Widget that renders block math using KaTeX in display mode
class BlockMathWidget extends WidgetType {
  constructor(private content: string) {
    super()
  }
  toDOM() {
    const div = document.createElement('div')
    div.className = 'cm-block-math-widget'
    div.style.cssText = 'text-align: center; padding: 12px 0;'
    div.innerHTML = katex.renderToString(this.content, {
      throwOnError: false,
      strict: 'ignore',
      displayMode: true,
    })
    return div
  }
  eq(other: BlockMathWidget) {
    return this.content === other.content
  }
  ignoreEvent() {
    return false
  }
}

// Widget that renders a markdown table as an HTML table
class TableWidget extends WidgetType {
  constructor(private tableText: string) {
    super()
  }
  toDOM() {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-table-widget'
    wrapper.style.cssText = 'padding: 8px 0; overflow-x: auto;'

    const lines = this.tableText.split('\n').filter(l => l.trim())
    if (lines.length < 2) {
      wrapper.textContent = this.tableText
      return wrapper
    }

    const parseCells = (line: string): string[] =>
      line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(c => c.trim())

    const headers = parseCells(lines[0]!)
    const alignLine = parseCells(lines[1]!)
    const alignments = alignLine.map(cell => {
      const trimmed = cell.trim()
      if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center'
      if (trimmed.endsWith(':')) return 'right'
      return 'left'
    })

    const table = document.createElement('table')
    table.style.cssText = 'border-collapse: collapse; width: 100%; font-size: 0.9em;'

    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    headers.forEach((h, i) => {
      const th = document.createElement('th')
      th.textContent = h
      th.style.cssText = `border: 1px solid rgb(var(--c-wys-table-border) / 1); padding: 6px 12px; font-weight: 600; text-align: ${alignments[i] ?? 'left'}; background: var(--c-wys-table-head-bg);`
      headerRow.appendChild(th)
    })
    thead.appendChild(headerRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    for (let r = 2; r < lines.length; r++) {
      const cells = parseCells(lines[r]!)
      const tr = document.createElement('tr')
      if (r % 2 === 1) {
        tr.style.background = 'var(--c-wys-table-row-alt-bg)'
      }
      cells.forEach((c, i) => {
        const td = document.createElement('td')
        td.textContent = c
        td.style.cssText = `border: 1px solid rgb(var(--c-wys-table-border) / 1); padding: 6px 12px; text-align: ${alignments[i] ?? 'left'};`
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)
    wrapper.appendChild(table)
    return wrapper
  }
  eq(other: TableWidget) {
    return this.tableText === other.tableText
  }
  ignoreEvent() {
    return false
  }
}

// Widget that renders a fenced code block with Prism syntax highlighting
class CodeBlockWidget extends WidgetType {
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
      codeEl.innerHTML = Prism.highlight(this.code, grammar, this.language)
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

class MermaidWidget extends WidgetType {
  constructor(
    private code: string,
    private securityLevel: MermaidSecurityLevel
  ) {
    super()
  }

  toDOM(view: EditorView) {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-mermaid-widget'
    wrapper.style.cssText = 'padding: 8px 0;'

    const panel = document.createElement('div')
    panel.style.cssText =
      'border-radius: 6px; padding: 8px; background: var(--c-wys-mermaid-panel-bg); overflow-x: auto;'
    wrapper.appendChild(panel)

    const loading = document.createElement('div')
    loading.textContent = 'Rendering Mermaid diagram...'
    loading.style.cssText =
      'color: rgb(var(--c-wys-mermaid-loading-text) / 1); font-size: 0.8em; text-align: center; padding: 8px 0;'
    panel.appendChild(loading)

    void renderMermaidInto(panel, this.code, this.securityLevel, () => {
      scheduleEditorMeasure(view)
    })

    return wrapper
  }

  eq(other: MermaidWidget) {
    return this.code === other.code && this.securityLevel === other.securityLevel
  }
  ignoreEvent() {
    return false
  }
}

// Heading styles based on level
const headingStyles: Record<string, string> = {
  '1': 'font-size: 2em; font-weight: 700; line-height: 1.2;',
  '2': 'font-size: 1.5em; font-weight: 700; line-height: 1.3;',
  '3': 'font-size: 1.25em; font-weight: 600; line-height: 1.4;',
  '4': 'font-size: 1.1em; font-weight: 600; line-height: 1.4;',
  '5': 'font-size: 1em; font-weight: 600; line-height: 1.5;',
  '6': 'font-size: 0.9em; font-weight: 600; line-height: 1.5; color: rgb(var(--c-wys-heading-6-text) / 1);',
}

function buildDecorations(
  state: EditorState,
  mermaidSecurityLevel: MermaidSecurityLevel
): DecorationSet {
  const decorations: Range<Decoration>[] = []
  const cursor = state.selection.main
  const cursorLine = state.doc.lineAt(cursor.head).number
  const codeRanges: DocRange[] = []
  const tree = ensureSyntaxTree(state, state.doc.length, 50) ?? syntaxTree(state)
  const codeBlockPalette = getCodeBlockPalette()

  tree.iterate({
    enter(node) {
      const { from, to } = node
      const cursorInRange = isSelectionInRange(cursor, from, to)
      const cursorOnNodeLine = isCursorOnRangeLine(state, cursorLine, from, to)
      const revealBlock = cursorInRange || cursorOnNodeLine
      const revealInline = cursorInRange

      // Collect code ranges for math exclusion
      if (node.name === 'FencedCode' || node.name === 'InlineCode') {
        codeRanges.push({ from, to })
      }

      // Headings: style the line when cursor is outside
      if (node.name.startsWith('ATXHeading') && !revealBlock) {
        const levelMatch = /ATXHeading(\d)/.exec(node.name)
        const level = levelMatch?.[1] ?? '1'
        const lineText = state.sliceDoc(from, to)
        const hashMatch = /^(#{1,6})\s/.exec(lineText)

        if (hashMatch) {
          const hashLen = hashMatch[1]!.length
          // Hide the # marks
          decorations.push(Decoration.replace({}).range(from, from + hashLen + 1))
          // Style the heading
          decorations.push(
            Decoration.line({
              attributes: { style: headingStyles[level] ?? '' },
            }).range(state.doc.lineAt(from).from)
          )
        }
      }

      // Bold (**text** or __text__)
      if (node.name === 'StrongEmphasis') {
        applyInlineFormatting(decorations, from, to, 2, 'font-weight: 700;', revealInline)
      }

      // Italic (*text* or _text_)
      if (node.name === 'Emphasis') {
        applyInlineFormatting(decorations, from, to, 1, 'font-style: italic;', revealInline)
      }

      // Inline code
      if (node.name === 'InlineCode') {
        const text = state.sliceDoc(from, to)
        if (text.startsWith('`') && text.endsWith('`')) {
          applyInlineFormatting(
            decorations,
            from,
            to,
            1,
            'background: var(--c-wys-inline-code-bg); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 0.9em;',
            revealInline
          )
        }
      }

      // Images: ![alt](url)
      if (node.name === 'Image' && !revealBlock) {
        const text = state.sliceDoc(from, to)
        const imgMatch = /!\[([^\]]*)\]\(([^)]+)\)/.exec(text)
        if (imgMatch) {
          const alt = imgMatch[1] ?? ''
          const url = imgMatch[2] ?? ''
          decorations.push(
            Decoration.replace({
              widget: new ImageWidget(url, alt),
            }).range(from, to)
          )
        }
      }

      // Strikethrough: ~~text~~
      if (node.name === 'Strikethrough') {
        const text = state.sliceDoc(from, to)
        if (text.startsWith('~~') && text.endsWith('~~')) {
          applyInlineFormatting(
            decorations,
            from,
            to,
            2,
            'text-decoration: line-through; color: rgb(var(--c-wys-strikethrough-text) / 1);',
            revealInline
          )
        }
      }

      // Horizontal rule
      if (node.name === 'HorizontalRule' && !revealBlock) {
        decorations.push(
          Decoration.line({
            attributes: {
              style:
                'border-bottom: 1px solid rgb(var(--c-wys-hr-border) / 1); padding: 12px 0; line-height: 1; color: transparent;',
            },
          }).range(state.doc.lineAt(from).from)
        )
      }

      // Links: [text](url)
      if (node.name === 'Link') {
        const linkMarks = node.node.getChildren('LinkMark')
        const urlNode = node.node.getChildren('URL')
        // LinkMarks: [0]='[', [1]=']', [2]='(', [3]=')'
        if (linkMarks.length >= 4 && urlNode.length > 0) {
          const openBracket = linkMarks[0]!
          const closeBracket = linkMarks[1]!
          const closeParen = linkMarks[3]!

          // Always style link text with blue + underline
          decorations.push(
            Decoration.mark({
              attributes: {
                style:
                  'color: rgb(var(--c-wys-link-text) / 1); text-decoration: underline; cursor: pointer;',
              },
            }).range(openBracket.to, closeBracket.from)
          )

          if (!revealInline) {
            // Cursor outside: hide markers
            decorations.push(Decoration.replace({}).range(openBracket.from, openBracket.to))
            decorations.push(Decoration.replace({}).range(closeBracket.from, closeParen.to))
          } else {
            // Cursor inside: show markers dimmed
            decorations.push(
              Decoration.mark({ attributes: { style: 'opacity: 0.35;' } }).range(
                openBracket.from,
                openBracket.to
              )
            )
            decorations.push(
              Decoration.mark({ attributes: { style: 'opacity: 0.35;' } }).range(
                closeBracket.from,
                closeParen.to
              )
            )
          }
        }
      }

      // Bullet lists: replace - with bullet widget
      if (node.name === 'ListItem' && node.node.parent?.type.name === 'BulletList') {
        const itemCursorInRange = isSelectionInRange(cursor, from, to)
        if (!itemCursorInRange && !cursorOnNodeLine) {
          const listMark = node.node.getChildren('ListMark')
          if (listMark.length > 0) {
            const mark = listMark[0]!
            // Replace '- ' with bullet widget
            decorations.push(
              Decoration.replace({
                widget: new BulletWidget(),
              }).range(mark.from, mark.to)
            )
          }
          // Subtle left indent for the whole line
          decorations.push(
            Decoration.line({
              attributes: {
                style: 'padding-left: 8px;',
              },
            }).range(state.doc.lineAt(from).from)
          )
        }
      }

      // Ordered lists: style the number marker
      if (node.name === 'ListItem' && node.node.parent?.type.name === 'OrderedList') {
        const itemCursorInRange = isSelectionInRange(cursor, from, to)
        if (!itemCursorInRange && !cursorOnNodeLine) {
          const listMark = node.node.getChildren('ListMark')
          if (listMark.length > 0) {
            const mark = listMark[0]!
            decorations.push(
              Decoration.mark({
                attributes: {
                  style: 'opacity: 0.6; font-weight: 600;',
                },
              }).range(mark.from, mark.to)
            )
          }
          // Subtle left indent
          decorations.push(
            Decoration.line({
              attributes: {
                style: 'padding-left: 8px;',
              },
            }).range(state.doc.lineAt(from).from)
          )
        }
      }

      // Blockquotes: hide > marks, add left border
      if (node.name === 'Blockquote') {
        // Walk all descendants to find every QuoteMark at any nesting depth
        const walker = node.node.cursor()
        do {
          if (walker.type.name === 'QuoteMark') {
            const qmTo = walker.to
            const nextCh = state.sliceDoc(qmTo, qmTo + 1)
            const hideEnd = nextCh === ' ' ? qmTo + 1 : qmTo
            decorations.push(Decoration.replace({}).range(walker.from, hideEnd))
          }
        } while (walker.next())
        // Add line decorations with left border for each line in the blockquote
        const startLine = state.doc.lineAt(from).number
        const endLine = state.doc.lineAt(to).number
        for (let i = startLine; i <= endLine; i++) {
          const line = state.doc.line(i)
          decorations.push(
            Decoration.line({
              attributes: {
                style:
                  'border-left: 3px solid rgb(var(--c-wys-blockquote-border) / 1); padding-left: 12px; color: rgb(var(--c-wys-blockquote-text) / 1); font-style: italic;',
              },
            }).range(line.from)
          )
        }
      }

      // Tables: replace with rendered HTML table
      if (node.name === 'Table' && !revealBlock) {
        const tableText = state.sliceDoc(from, to)
        decorations.push(
          Decoration.replace({
            widget: new TableWidget(tableText),
            block: true,
          }).range(from, to)
        )
      }

      // Fenced code blocks: replace with syntax-highlighted block
      if (node.name === 'FencedCode') {
        const codeInfoNode = node.node.getChildren('CodeInfo')
        const codeTextNode = node.node.getChildren('CodeText')
        const language =
          codeInfoNode.length > 0
            ? state.sliceDoc(codeInfoNode[0]!.from, codeInfoNode[0]!.to).trim()
            : ''
        const code =
          codeTextNode.length > 0 ? state.sliceDoc(codeTextNode[0]!.from, codeTextNode[0]!.to) : ''
        const normalizedLanguage = language.toLowerCase()

        if (!revealBlock) {
          // Cursor outside: show full widget (current behavior)
          const widget =
            normalizedLanguage === 'mermaid'
              ? new MermaidWidget(code, mermaidSecurityLevel)
              : new CodeBlockWidget(code, language)

          decorations.push(
            Decoration.replace({
              widget,
              block: true,
            }).range(from, to)
          )
        } else {
          // Cursor inside: hide fences, keep code editable with syntax highlighting
          const firstLine = state.doc.lineAt(from)
          const lastLine = state.doc.lineAt(to)

          // Hide the opening fence line (clamp to doc length for unclosed fences)
          decorations.push(
            Decoration.replace({}).range(
              firstLine.from,
              Math.min(firstLine.to + 1, state.doc.length)
            )
          )
          // Hide the closing fence line
          if (lastLine.from > firstLine.to) {
            decorations.push(Decoration.replace({}).range(lastLine.from - 1, lastLine.to))
          }

          // Style the code area with a background (palette hoisted above tree.iterate)
          const palette = codeBlockPalette
          if (codeTextNode.length > 0) {
            const codeFrom = codeTextNode[0]!.from
            const codeTo = codeTextNode[0]!.to

            // Apply background to each line of the code block
            const startLine = state.doc.lineAt(codeFrom)
            const endLine = state.doc.lineAt(codeTo)
            for (let i = startLine.number; i <= endLine.number; i++) {
              const line = state.doc.line(i)
              decorations.push(
                Decoration.line({
                  attributes: {
                    style: `background: ${palette.background}; font-family: monospace; font-size: 0.875em;`,
                  },
                }).range(line.from)
              )
            }

            // Apply Prism syntax highlighting as mark decorations
            const grammar = Prism.languages[normalizedLanguage]
            if (grammar) {
              const tokens = Prism.tokenize(code, grammar)
              applyPrismTokens(decorations, tokens, codeFrom, palette)
            }
          }

          // Show language badge if present
          if (language && codeInfoNode.length > 0) {
            decorations.push(
              Decoration.widget({
                widget: new LanguageBadgeWidget(language),
                side: -1,
              }).range(codeTextNode.length > 0 ? codeTextNode[0]!.from : from)
            )
          }
        }
      }
    },
  })

  // Math detection (separate pass after tree walk to avoid code ranges)
  codeRanges.sort((a, b) => a.from - b.from)
  appendMathDecorations(state, decorations, cursor, cursorLine, codeRanges)

  return Decoration.set(decorations, true)
}

export function wysiwygExtension(mermaidSecurityLevel: MermaidSecurityLevel = 'strict') {
  const wysiwygDecorations = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, mermaidSecurityLevel)
    },
    update(decorations, tr) {
      if (tr.docChanged || tr.selection) {
        return buildDecorations(tr.state, mermaidSecurityLevel)
      }
      return decorations
    },
    provide: field => EditorView.decorations.from(field),
  })

  return wysiwygDecorations
}
