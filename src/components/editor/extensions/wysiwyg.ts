import { syntaxTree } from '@codemirror/language'
import type { EditorState, Range } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view'

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

// Heading styles based on level
const headingStyles: Record<string, string> = {
  '1': 'font-size: 2em; font-weight: 700; line-height: 1.2;',
  '2': 'font-size: 1.5em; font-weight: 700; line-height: 1.3;',
  '3': 'font-size: 1.25em; font-weight: 600; line-height: 1.4;',
  '4': 'font-size: 1.1em; font-weight: 600; line-height: 1.4;',
  '5': 'font-size: 1em; font-weight: 600; line-height: 1.5;',
  '6': 'font-size: 0.9em; font-weight: 600; line-height: 1.5; color: #6b7280;',
}

function buildDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = []
  const cursor = state.selection.main

  syntaxTree(state).iterate({
    enter(node) {
      const { from, to } = node
      const cursorInRange = cursor.from >= from && cursor.to <= to

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
    },
  })

  return Decoration.set(decorations, true)
}

export const wysiwygPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view.state)
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.state)
      }
    }
  },
  {
    decorations: v => v.decorations,
  }
)
