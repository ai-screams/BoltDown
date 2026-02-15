import { type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate, scrollPastEnd } from '@codemirror/view'

export function typewriterExtension(): Extension {
  return [
    // Keep cursor line centered on screen
    ViewPlugin.fromClass(
      class {
        private lastHead = -1
        private pendingScroll = false

        update(update: ViewUpdate) {
          if (!update.selectionSet && !update.docChanged) return

          const head = update.state.selection.main.head
          // Skip if cursor didn't actually move (e.g. arrow key at document boundary)
          if (head === this.lastHead && !update.docChanged) return
          this.lastHead = head

          if (this.pendingScroll) return
          this.pendingScroll = true
          // Use requestAnimationFrame to break out of the update cycle
          // and ensure DOM is ready for scroll calculation
          requestAnimationFrame(() => {
            this.pendingScroll = false
            // Guard: view may have been destroyed
            if (!update.view.dom.parentNode) return
            update.view.dispatch({
              effects: EditorView.scrollIntoView(head, { y: 'center' }),
            })
          })
        }
      }
    ),
    // Allow scrolling past the last line so it can reach center
    scrollPastEnd(),
  ]
}
