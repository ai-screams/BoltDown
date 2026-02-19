import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import type { EditorState, Range } from '@codemirror/state'
import { Decoration, type DecorationSet } from '@codemirror/view'
import Prism from 'prismjs'

import { useTabStore } from '@/stores/tabStore'
import type { MermaidSecurityLevel } from '@/types/settings'
import { stripInlineMarkdown } from '@/utils/markdownText'

import { appendMathDecorations } from './BlockMathWidget'
import { BulletWidget } from './BulletWidget'
import { getFencedCodeBlockIdFromRange } from './codeBlockArrowNavigationModel'
import { LanguageBadgeWidget, applyPrismTokens, getCodeBlockPalette } from './CodeBlockWidget'
import { ImageWidget } from './ImageWidget'
import {
  appendInlineHtmlTagDecorations,
  parseInlineHtmlMarker,
  type InlineHtmlMarker,
} from './inlineHtmlDecorations'
import { MermaidWidget } from './MermaidWidget'
import { TableWidget } from './TableWidget'
import { TaskCheckboxWidget } from './TaskCheckboxWidget'
import { TocWidget, type TocHeadingItem } from './TocWidget'
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

function isTocMarkerParagraphText(text: string): boolean {
  return /^\[toc\]$/i.test(text.trim())
}

function isRangeWithinAnyRange(range: DocRange, ranges: readonly DocRange[]): boolean {
  return ranges.some(candidate => range.from >= candidate.from && range.to <= candidate.to)
}

function extractTocHeadingItem(
  state: EditorState,
  nodeName: string,
  from: number,
  to: number
): TocHeadingItem | null {
  let level: number | null = null
  let rawText = ''

  const atxMatch = /^ATXHeading([1-6])$/.exec(nodeName)
  if (atxMatch) {
    level = Number.parseInt(atxMatch[1]!, 10)
    const lineText = state.sliceDoc(from, to)
    rawText = lineText
      .replace(/^#{1,6}\s+/, '')
      .replace(/\s+#{1,6}\s*$/, '')
      .trim()
  }

  if (nodeName === 'SetextHeading1' || nodeName === 'SetextHeading2') {
    level = nodeName === 'SetextHeading1' ? 1 : 2
    const headingText = state.sliceDoc(from, to).split('\n').slice(0, -1).join(' ').trim()
    rawText = headingText
  }

  if (level === null) return null

  const text = stripInlineMarkdown(rawText).trim()
  if (!text) return null

  return {
    from,
    level,
    text,
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
  const tocParagraphRanges: DocRange[] = []
  const tocHeadings: TocHeadingItem[] = []
  const inlineHtmlMarkers: InlineHtmlMarker[] = []
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

      // Collect code ranges for math and inline HTML exclusion
      if (node.name === 'FencedCode' || node.name === 'CodeBlock' || node.name === 'InlineCode') {
        codeRanges.push({ from, to })
      }

      if (node.name === 'HTMLTag') {
        const rawTagText = state.sliceDoc(from, to)
        const marker = parseInlineHtmlMarker(rawTagText, from, to)
        if (marker) {
          inlineHtmlMarkers.push(marker)
        }
      }

      const tocHeading = extractTocHeadingItem(state, node.name, from, to)
      if (tocHeading) {
        tocHeadings.push(tocHeading)
      }

      if (node.name === 'Paragraph' && isTocMarkerParagraphText(state.sliceDoc(from, to))) {
        if (!revealBlock) {
          tocParagraphRanges.push({ from, to })
        }
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
        if (isRangeWithinAnyRange({ from, to }, tocParagraphRanges)) {
          return
        }

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
          const taskNode = node.node.getChildren('Task')[0]
          const taskMarker = taskNode?.getChildren('TaskMarker')[0]
          const listMark = node.node.getChildren('ListMark')
          if (taskMarker) {
            const taskMarkerText = state.sliceDoc(taskMarker.from, taskMarker.to)
            const isChecked = /\[[xX]\]/.test(taskMarkerText)
            const replaceFrom = listMark.length > 0 ? listMark[0]!.from : taskMarker.from
            const nextChar = state.sliceDoc(taskMarker.to, taskMarker.to + 1)
            const replaceTo = nextChar === ' ' ? taskMarker.to + 1 : taskMarker.to
            decorations.push(
              Decoration.replace({
                widget: new TaskCheckboxWidget(isChecked, taskMarker.from, taskMarker.to),
              }).range(replaceFrom, replaceTo)
            )
          } else if (listMark.length > 0) {
            const mark = listMark[0]!
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
          const taskNode = node.node.getChildren('Task')[0]
          const taskMarker = taskNode?.getChildren('TaskMarker')[0]
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

          if (taskMarker) {
            const taskMarkerText = state.sliceDoc(taskMarker.from, taskMarker.to)
            const isChecked = /\[[xX]\]/.test(taskMarkerText)
            const nextChar = state.sliceDoc(taskMarker.to, taskMarker.to + 1)
            const replaceTo = nextChar === ' ' ? taskMarker.to + 1 : taskMarker.to
            decorations.push(
              Decoration.replace({
                widget: new TaskCheckboxWidget(isChecked, taskMarker.from, taskMarker.to),
              }).range(taskMarker.from, replaceTo)
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

      // Tables: always render as editable widget in live/zen mode
      if (node.name === 'Table') {
        const tableText = state.sliceDoc(from, to)
        decorations.push(
          Decoration.replace({
            widget: new TableWidget(tableText, from, to),
            block: true,
          }).range(from, to)
        )
      }

      // Fenced code blocks: mermaid as widget, others always editable
      if (node.name === 'FencedCode') {
        const blockId = getFencedCodeBlockIdFromRange(from, to)
        const codeInfoNode = node.node.getChildren('CodeInfo')
        const codeTextNode = node.node.getChildren('CodeText')
        const language =
          codeInfoNode.length > 0
            ? state.sliceDoc(codeInfoNode[0]!.from, codeInfoNode[0]!.to).trim()
            : ''
        const code =
          codeTextNode.length > 0 ? state.sliceDoc(codeTextNode[0]!.from, codeTextNode[0]!.to) : ''
        const normalizedLanguage = language.toLowerCase()
        const openingFenceLine = state.doc.lineAt(from)
        const safeCodeInfoPos = Math.min(from + 3, to)
        const codeInfoFrom = codeInfoNode.length > 0 ? codeInfoNode[0]!.from : safeCodeInfoPos
        const codeInfoTo = codeInfoNode.length > 0 ? codeInfoNode[0]!.to : safeCodeInfoPos
        const lineAboveFrom =
          openingFenceLine.number > 1 ? state.doc.line(openingFenceLine.number - 1).from : null

        if (normalizedLanguage === 'mermaid') {
          // MERMAID: Keep existing reveal behavior (widget when outside, reveal when inside)
          if (!revealBlock) {
            decorations.push(
              Decoration.replace({
                widget: new MermaidWidget(code, mermaidSecurityLevel),
                block: true,
              }).range(from, to)
            )
          } else {
            // Cursor inside: hide fences, keep code editable with syntax highlighting
            const firstLine = state.doc.lineAt(from)
            const lastLine = state.doc.lineAt(to)

            decorations.push(Decoration.replace({}).range(firstLine.from, firstLine.to))
            decorations.push(
              Decoration.line({
                class: 'codeblock-fence-hidden-line',
                attributes: { 'data-codeblock-id': blockId },
              }).range(firstLine.from)
            )
            if (lastLine.from > firstLine.to) {
              decorations.push(Decoration.replace({}).range(lastLine.from, lastLine.to))
              decorations.push(
                Decoration.line({
                  class: 'codeblock-fence-hidden-line',
                  attributes: { 'data-codeblock-id': blockId },
                }).range(lastLine.from)
              )
            }

            const palette = codeBlockPalette
            if (codeTextNode.length > 0) {
              const codeFrom = codeTextNode[0]!.from
              const codeTo = codeTextNode[0]!.to
              const startLine = state.doc.lineAt(codeFrom)
              const endLine = state.doc.lineAt(Math.max(codeFrom, codeTo - 1))
              for (let i = startLine.number; i <= endLine.number; i++) {
                const line = state.doc.line(i)
                decorations.push(
                  Decoration.line({
                    attributes: {
                      style: `background: ${palette.background}; font-family: monospace; font-size: 0.875em;`,
                      'data-codeblock-id': blockId,
                    },
                  }).range(line.from)
                )
              }

              const grammar = Prism.languages[normalizedLanguage]
              if (grammar) {
                const tokens = Prism.tokenize(code, grammar)
                applyPrismTokens(decorations, tokens, codeFrom, palette)
              }
            }

            decorations.push(
              Decoration.widget({
                widget: new LanguageBadgeWidget(language, {
                  blockId,
                  codeInfoFrom,
                  codeInfoTo,
                  lineAboveFrom,
                }),
                side: -1,
              }).range(from)
            )
          }
        } else {
          // NON-MERMAID: Always show styled editable code block (Typora-style)
          const firstLine = state.doc.lineAt(from)
          const lastLine = state.doc.lineAt(to)

          // Hide opening fence
          decorations.push(Decoration.replace({}).range(firstLine.from, firstLine.to))
          decorations.push(
            Decoration.line({
              class: 'codeblock-fence-hidden-line',
              attributes: { 'data-codeblock-id': blockId },
            }).range(firstLine.from)
          )

          // Always hide closing fence
          if (lastLine.from > firstLine.to) {
            decorations.push(Decoration.replace({}).range(lastLine.from, lastLine.to))
            decorations.push(
              Decoration.line({
                class: 'codeblock-fence-hidden-line',
                attributes: { 'data-codeblock-id': blockId },
              }).range(lastLine.from)
            )
          }

          // Style code lines with shared CSS classes
          if (codeTextNode.length > 0) {
            const codeFrom = codeTextNode[0]!.from
            const codeTo = codeTextNode[0]!.to
            const startLine = state.doc.lineAt(codeFrom)
            const endLine = state.doc.lineAt(Math.max(codeFrom, codeTo - 1))

            for (let i = startLine.number; i <= endLine.number; i++) {
              const line = state.doc.line(i)
              const lineNum = i - startLine.number + 1
              const isFirst = i === startLine.number
              const isLast = i === endLine.number

              const attrs: Record<string, string> = {
                'data-line-number': String(lineNum),
                'data-codeblock-id': blockId,
              }
              if (isFirst) attrs['data-codeblock-first'] = ''
              if (isLast) attrs['data-codeblock-last'] = ''

              decorations.push(
                Decoration.line({
                  class: 'codeblock-line',
                  attributes: attrs,
                }).range(line.from)
              )
            }

            // Apply Prism syntax highlighting
            const grammar = Prism.languages[normalizedLanguage]
            if (grammar) {
              const tokens = Prism.tokenize(code, grammar)
              applyPrismTokens(decorations, tokens, codeFrom, codeBlockPalette)
            }
          }

          // Language badge widget (only when fence is hidden)
          decorations.push(
            Decoration.widget({
              widget: new LanguageBadgeWidget(language, {
                blockId,
                codeInfoFrom,
                codeInfoTo,
                lineAboveFrom,
              }),
              side: -1,
              block: true,
            }).range(from)
          )
        }
      }
    },
  })

  for (const tocRange of tocParagraphRanges) {
    decorations.push(
      Decoration.replace({
        widget: new TocWidget(tocHeadings),
        block: true,
      }).range(tocRange.from, tocRange.to)
    )
  }

  // Math detection (separate pass after tree walk to avoid code ranges)
  codeRanges.sort((a, b) => a.from - b.from)
  appendInlineHtmlTagDecorations(decorations, cursor, inlineHtmlMarkers, codeRanges)
  appendMathDecorations(state, decorations, cursor, cursorLine, codeRanges)

  return Decoration.set(decorations, true)
}
