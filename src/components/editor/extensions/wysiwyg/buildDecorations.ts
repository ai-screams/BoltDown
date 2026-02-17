import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import type { EditorState, Range } from '@codemirror/state'
import { Decoration, type DecorationSet } from '@codemirror/view'
import Prism from 'prismjs'

import { useTabStore } from '@/stores/tabStore'
import type { MermaidSecurityLevel } from '@/types/settings'

import { appendMathDecorations } from './BlockMathWidget'
import { BulletWidget } from './BulletWidget'
import {
  CodeBlockWidget,
  LanguageBadgeWidget,
  applyPrismTokens,
  getCodeBlockPalette,
} from './CodeBlockWidget'
import { ImageWidget } from './ImageWidget'
import { MermaidWidget } from './MermaidWidget'
import { TableWidget } from './TableWidget'
import { headingStyles, isCursorOnRangeLine, isSelectionInRange, type DocRange } from './utils'

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

export function buildDecorations(
  state: EditorState,
  mermaidSecurityLevel: MermaidSecurityLevel
): DecorationSet {
  const decorations: Range<Decoration>[] = []
  const cursor = state.selection.main
  const cursorLine = state.doc.lineAt(cursor.head).number
  const codeRanges: DocRange[] = []
  const tree = ensureSyntaxTree(state, state.doc.length, 50) ?? syntaxTree(state)
  const codeBlockPalette = getCodeBlockPalette()

  // Q11 fix: read markdownFilePath once here instead of inside ImageWidget.toDOM()
  const { tabs, activeTabId } = useTabStore.getState()
  const activeTab = tabs.find(t => t.id === activeTabId)
  const markdownFilePath = activeTab?.filePath ?? null

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
              widget: new ImageWidget(url, alt, markdownFilePath),
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
