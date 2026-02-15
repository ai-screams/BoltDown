import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'

class TypewriterPlugin {
  private pendingScroll = false

  update(update: ViewUpdate) {
    if (update.selectionSet && !this.pendingScroll) {
      this.pendingScroll = true
      update.view.requestMeasure({
        read: () => {
          const { state } = update.view
          const cursorPos = state.selection.main.head
          return cursorPos
        },
        write: (cursorPos, view) => {
          view.dispatch({
            effects: EditorView.scrollIntoView(cursorPos, { y: 'center' }),
          })
          this.pendingScroll = false
        },
      })
    }
  }
}

export function typewriterExtension() {
  return ViewPlugin.define(() => new TypewriterPlugin())
}
