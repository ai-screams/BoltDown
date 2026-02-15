import { type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'

export function typewriterExtension(): Extension {
  return ViewPlugin.fromClass(
    class {
      update(update: ViewUpdate) {
        if (!update.selectionSet && !update.docChanged) return

        const head = update.state.selection.main.head
        // Use requestAnimationFrame to break out of the update cycle
        // and ensure DOM is ready for scroll calculation
        requestAnimationFrame(() => {
          // Guard: view may have been destroyed
          if (!update.view.dom.parentNode) return
          update.view.dispatch({
            effects: EditorView.scrollIntoView(head, { y: 'center' }),
          })
        })
      }
    }
  )
}
