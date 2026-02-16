import { type Extension, type Range } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view'

const dimmedLineDeco = Decoration.line({ attributes: { class: 'cm-focus-dimmed' } })
const contextLineDeco = Decoration.line({ attributes: { class: 'cm-focus-context' } })

class FocusPlugin {
  decorations: DecorationSet

  constructor(
    view: EditorView,
    private contextLines: number
  ) {
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate) {
    if (update.selectionSet || update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const decorations: Range<Decoration>[] = []
    const { state } = view
    const cursorLines = new Set<number>()

    // Collect all cursor line numbers (multi-cursor support)
    for (const range of state.selection.ranges) {
      cursorLines.add(state.doc.lineAt(range.head).number)
    }

    // Build context range set (lines within contextLines of any cursor)
    const contextLineSet = new Set<number>()
    if (this.contextLines > 0) {
      for (const cursorLine of cursorLines) {
        for (let i = -this.contextLines; i <= this.contextLines; i++) {
          const lineNum = cursorLine + i
          if (lineNum > 0 && lineNum <= state.doc.lines) {
            contextLineSet.add(lineNum)
          }
        }
      }
    }

    // Only iterate visible ranges for performance
    for (const { from, to } of view.visibleRanges) {
      let pos = from
      while (pos <= to) {
        const line = state.doc.lineAt(pos)
        const lineNum = line.number

        if (!cursorLines.has(lineNum)) {
          if (contextLineSet.has(lineNum)) {
            decorations.push(contextLineDeco.range(line.from))
          } else {
            decorations.push(dimmedLineDeco.range(line.from))
          }
        }

        pos = line.to + 1
      }
    }

    return Decoration.set(decorations, true)
  }
}

export function focusExtension(contextLines: number): Extension {
  const normalizedContextLines = Math.max(0, Math.floor(contextLines))

  return ViewPlugin.define(view => new FocusPlugin(view, normalizedContextLines), {
    decorations: plugin => plugin.decorations,
  })
}
