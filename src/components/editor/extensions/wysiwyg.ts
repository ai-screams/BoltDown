import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { StateField, type EditorState, type Range } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view'
import katex from 'katex'
import Prism from 'prismjs'

import type { MermaidSecurityLevel } from '@/types/settings'

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

function getMermaidTheme(): 'dark' | 'default' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'default'
}

async function getMermaid(securityLevel: MermaidSecurityLevel) {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then(mod => mod.default)
  }

  const mermaid = await mermaidModulePromise
  const theme = getMermaidTheme()

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
  securityLevel: MermaidSecurityLevel
) {
  const token = `${++mermaidRenderToken}`
  container.dataset.mermaidToken = token

  try {
    const mermaid = await getMermaid(securityLevel)
    const id = `cm-mermaid-${mermaidRenderCount++}`
    const { svg } = await mermaid.render(id, code)

    if (!container.isConnected || container.dataset.mermaidToken !== token) return
    container.innerHTML = svg
  } catch {
    if (!container.isConnected || container.dataset.mermaidToken !== token) return

    const pre = document.createElement('pre')
    pre.style.cssText =
      'background: #1e293b; color: #e2e8f0; border-radius: 6px; padding: 16px; overflow-x: auto; font-size: 0.875em; line-height: 1.6; margin: 0;'
    const codeEl = document.createElement('code')
    codeEl.textContent = code
    codeEl.style.cssText = 'font-family: monospace; white-space: pre;'
    pre.appendChild(codeEl)
    container.replaceChildren(pre)
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

function appendMathDecorations(
  state: EditorState,
  decorations: Range<Decoration>[],
  cursor: { from: number; to: number },
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

      if (!(cursor.from >= matchFrom && cursor.to <= matchTo)) {
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
      if (cursor.from >= matchFrom && cursor.to <= matchTo) continue

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
  toDOM() {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-image-widget'
    const img = document.createElement('img')
    img.src = this.url
    img.alt = this.alt
    img.style.maxWidth = '100%'
    img.style.borderRadius = '4px'
    img.style.margin = '4px 0'
    wrapper.appendChild(img)
    return wrapper
  }
  eq(other: ImageWidget) {
    return this.url === other.url && this.alt === other.alt
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
    div.style.cssText = 'text-align: center; margin: 12px 0; padding: 8px 0;'
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
    wrapper.style.cssText = 'margin: 8px 0; overflow-x: auto;'

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
      th.style.cssText = `border: 1px solid #d1d5db; padding: 6px 12px; font-weight: 600; text-align: ${alignments[i] ?? 'left'}; background: rgba(100, 116, 139, 0.08);`
      headerRow.appendChild(th)
    })
    thead.appendChild(headerRow)
    table.appendChild(thead)

    const tbody = document.createElement('tbody')
    for (let r = 2; r < lines.length; r++) {
      const cells = parseCells(lines[r]!)
      const tr = document.createElement('tr')
      if (r % 2 === 1) {
        tr.style.background = 'rgba(100, 116, 139, 0.04)'
      }
      cells.forEach((c, i) => {
        const td = document.createElement('td')
        td.textContent = c
        td.style.cssText = `border: 1px solid #d1d5db; padding: 6px 12px; text-align: ${alignments[i] ?? 'left'};`
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
    wrapper.style.cssText = 'position: relative; margin: 8px 0;'

    // Language badge
    if (this.language) {
      const badge = document.createElement('span')
      badge.textContent = this.language
      badge.style.cssText =
        'position: absolute; top: 6px; right: 10px; font-size: 0.7em; color: #94a3b8; font-family: monospace; text-transform: uppercase; letter-spacing: 0.05em;'
      wrapper.appendChild(badge)
    }

    const pre = document.createElement('pre')
    pre.style.cssText =
      'background: #1e293b; color: #e2e8f0; border-radius: 6px; padding: 16px; overflow-x: auto; font-size: 0.875em; line-height: 1.6; margin: 0;'
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

  toDOM() {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-mermaid-widget'
    wrapper.style.cssText =
      'margin: 8px 0; border-radius: 6px; padding: 8px; background: rgba(148, 163, 184, 0.08); overflow-x: auto;'

    const loading = document.createElement('div')
    loading.textContent = 'Rendering Mermaid diagram...'
    loading.style.cssText = 'color: #64748b; font-size: 0.8em; text-align: center; padding: 8px 0;'
    wrapper.appendChild(loading)

    void renderMermaidInto(wrapper, this.code, this.securityLevel)

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
  '6': 'font-size: 0.9em; font-weight: 600; line-height: 1.5; color: #6b7280;',
}

function buildDecorations(
  state: EditorState,
  mermaidSecurityLevel: MermaidSecurityLevel
): DecorationSet {
  const decorations: Range<Decoration>[] = []
  const cursor = state.selection.main
  const codeRanges: DocRange[] = []
  const tree = ensureSyntaxTree(state, state.doc.length, 50) ?? syntaxTree(state)

  tree.iterate({
    enter(node) {
      const { from, to } = node
      const cursorInRange = cursor.from >= from && cursor.to <= to

      // Collect code ranges for math exclusion
      if (node.name === 'FencedCode' || node.name === 'InlineCode') {
        codeRanges.push({ from, to })
      }

      // Headings: style the line when cursor is outside
      if (node.name.startsWith('ATXHeading') && !cursorInRange) {
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
      if (node.name === 'StrongEmphasis' && !cursorInRange) {
        const text = state.sliceDoc(from, to)
        const marker = text.startsWith('**') ? '**' : '__'
        const mLen = marker.length

        // Hide opening marker
        decorations.push(Decoration.replace({}).range(from, from + mLen))
        // Hide closing marker
        decorations.push(Decoration.replace({}).range(to - mLen, to))
        // Style the content
        decorations.push(
          Decoration.mark({ attributes: { style: 'font-weight: 700;' } }).range(
            from + mLen,
            to - mLen
          )
        )
      }

      // Italic (*text* or _text_)
      if (node.name === 'Emphasis' && !cursorInRange) {
        const text = state.sliceDoc(from, to)
        const marker = text.startsWith('*') ? '*' : '_'
        const mLen = marker.length

        decorations.push(Decoration.replace({}).range(from, from + mLen))
        decorations.push(Decoration.replace({}).range(to - mLen, to))
        decorations.push(
          Decoration.mark({ attributes: { style: 'font-style: italic;' } }).range(
            from + mLen,
            to - mLen
          )
        )
      }

      // Inline code
      if (node.name === 'InlineCode' && !cursorInRange) {
        const text = state.sliceDoc(from, to)
        if (text.startsWith('`') && text.endsWith('`')) {
          decorations.push(Decoration.replace({}).range(from, from + 1))
          decorations.push(Decoration.replace({}).range(to - 1, to))
          decorations.push(
            Decoration.mark({
              attributes: {
                style:
                  'background: rgba(100, 116, 139, 0.15); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 0.9em;',
              },
            }).range(from + 1, to - 1)
          )
        }
      }

      // Images: ![alt](url)
      if (node.name === 'Image' && !cursorInRange) {
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
      if (node.name === 'Strikethrough' && !cursorInRange) {
        const text = state.sliceDoc(from, to)
        if (text.startsWith('~~') && text.endsWith('~~')) {
          decorations.push(Decoration.replace({}).range(from, from + 2))
          decorations.push(Decoration.replace({}).range(to - 2, to))
          decorations.push(
            Decoration.mark({
              attributes: { style: 'text-decoration: line-through; color: #9ca3af;' },
            }).range(from + 2, to - 2)
          )
        }
      }

      // Horizontal rule
      if (node.name === 'HorizontalRule' && !cursorInRange) {
        decorations.push(
          Decoration.line({
            attributes: {
              style:
                'border-bottom: 1px solid #d1d5db; margin: 8px 0; line-height: 0.5; color: transparent;',
            },
          }).range(state.doc.lineAt(from).from)
        )
      }

      // Links: [text](url)
      if (node.name === 'Link' && !cursorInRange) {
        const linkMarks = node.node.getChildren('LinkMark')
        const urlNode = node.node.getChildren('URL')
        // LinkMarks: [0]='[', [1]=']', [2]='(', [3]=')'
        if (linkMarks.length >= 4 && urlNode.length > 0) {
          const openBracket = linkMarks[0]!
          const closeBracket = linkMarks[1]!
          const closeParen = linkMarks[3]!
          // Hide '['
          decorations.push(Decoration.replace({}).range(openBracket.from, openBracket.to))
          // Hide '](url)'
          decorations.push(Decoration.replace({}).range(closeBracket.from, closeParen.to))
          // Style link text with blue + underline
          decorations.push(
            Decoration.mark({
              attributes: {
                style: 'color: #3b82f6; text-decoration: underline; cursor: pointer;',
              },
            }).range(openBracket.to, closeBracket.from)
          )
        }
      }

      // Bullet lists: replace - with bullet widget
      if (node.name === 'ListItem' && node.node.parent?.type.name === 'BulletList') {
        const itemCursorInRange = cursor.from >= from && cursor.to <= to
        if (!itemCursorInRange) {
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
        const itemCursorInRange = cursor.from >= from && cursor.to <= to
        if (!itemCursorInRange) {
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
      if (node.name === 'Blockquote' && !cursorInRange) {
        // Hide all QuoteMark children
        const quoteMarks = node.node.getChildren('QuoteMark')
        for (const qm of quoteMarks) {
          // Hide the '> ' (mark + trailing space)
          const afterMark = qm.to
          const nextChar = state.sliceDoc(afterMark, afterMark + 1)
          const hideEnd = nextChar === ' ' ? afterMark + 1 : afterMark
          decorations.push(Decoration.replace({}).range(qm.from, hideEnd))
        }
        // Also find nested QuoteMarks (inside paragraphs within blockquotes)
        const innerCursor = node.node.cursor()
        if (innerCursor.firstChild()) {
          do {
            if (innerCursor.type.name === 'Paragraph') {
              const paraCursor = innerCursor.node.cursor()
              if (paraCursor.firstChild()) {
                do {
                  if (paraCursor.type.name === 'QuoteMark') {
                    const qmFrom = paraCursor.from
                    const qmTo = paraCursor.to
                    const nextCh = state.sliceDoc(qmTo, qmTo + 1)
                    const hideE = nextCh === ' ' ? qmTo + 1 : qmTo
                    decorations.push(Decoration.replace({}).range(qmFrom, hideE))
                  }
                } while (paraCursor.nextSibling())
              }
            }
          } while (innerCursor.nextSibling())
        }
        // Add line decorations with left border for each line in the blockquote
        const startLine = state.doc.lineAt(from).number
        const endLine = state.doc.lineAt(to).number
        for (let i = startLine; i <= endLine; i++) {
          const line = state.doc.line(i)
          decorations.push(
            Decoration.line({
              attributes: {
                style:
                  'border-left: 3px solid #d1d5db; padding-left: 12px; color: #6b7280; font-style: italic;',
              },
            }).range(line.from)
          )
        }
      }

      // Tables: replace with rendered HTML table
      if (node.name === 'Table' && !cursorInRange) {
        const tableText = state.sliceDoc(from, to)
        decorations.push(
          Decoration.replace({
            widget: new TableWidget(tableText),
            block: true,
          }).range(from, to)
        )
      }

      // Fenced code blocks: replace with syntax-highlighted block
      if (node.name === 'FencedCode' && !cursorInRange) {
        const codeInfoNode = node.node.getChildren('CodeInfo')
        const codeTextNode = node.node.getChildren('CodeText')
        const language =
          codeInfoNode.length > 0
            ? state.sliceDoc(codeInfoNode[0]!.from, codeInfoNode[0]!.to).trim()
            : ''
        const code =
          codeTextNode.length > 0 ? state.sliceDoc(codeTextNode[0]!.from, codeTextNode[0]!.to) : ''
        const normalizedLanguage = language.toLowerCase()
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
      }
    },
  })

  // Math detection (separate pass after tree walk to avoid code ranges)
  codeRanges.sort((a, b) => a.from - b.from)
  appendMathDecorations(state, decorations, cursor, codeRanges)

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
