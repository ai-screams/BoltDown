import { type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate, scrollPastEnd } from '@codemirror/view'

const typewriterHighlightTheme = EditorView.theme({
  '.cm-activeLine': {
    backgroundColor: 'rgba(250, 204, 21, 0.08) !important',
    boxShadow: 'inset 3px 0 0 rgba(250, 204, 21, 0.85)',
    borderRadius: '4px',
    transition: 'background-color 120ms ease-out, box-shadow 120ms ease-out',
  },
  '&.cm-focused .cm-activeLine': {
    backgroundColor: 'rgba(250, 204, 21, 0.14) !important',
    boxShadow: 'inset 3px 0 0 rgba(250, 204, 21, 1)',
  },
})

export function typewriterExtension(): Extension {
  return [
    typewriterHighlightTheme,
    // Keep cursor line centered on screen
    ViewPlugin.fromClass(
      class {
        private readonly view: EditorView
        private lastHead = -1
        private pendingScroll = false
        private pointerSelecting = false
        private recenterAfterPointerUp = false

        private readonly onPointerDown = (event: PointerEvent) => {
          if (event.button !== 0) return
          this.pointerSelecting = true
        }

        private readonly onPointerUp = () => {
          if (!this.pointerSelecting) return

          this.pointerSelecting = false
          if (!this.recenterAfterPointerUp) return

          this.recenterAfterPointerUp = false
          this.scrollHeadToCenter(this.view.state.selection.main.head)
        }

        constructor(view: EditorView) {
          this.view = view
          this.lastHead = view.state.selection.main.head

          view.dom.addEventListener('pointerdown', this.onPointerDown)
          window.addEventListener('pointerup', this.onPointerUp)
          window.addEventListener('pointercancel', this.onPointerUp)
        }

        destroy() {
          this.view.dom.removeEventListener('pointerdown', this.onPointerDown)
          window.removeEventListener('pointerup', this.onPointerUp)
          window.removeEventListener('pointercancel', this.onPointerUp)
        }

        private scrollHeadToCenter(head: number) {
          if (this.pendingScroll) return
          this.pendingScroll = true

          requestAnimationFrame(() => {
            this.pendingScroll = false
            if (!this.view.dom.parentNode) return
            this.view.dispatch({
              effects: EditorView.scrollIntoView(head, { y: 'center' }),
            })
          })
        }

        update(update: ViewUpdate) {
          if (!update.selectionSet && !update.docChanged) return

          const head = update.state.selection.main.head
          // Skip if cursor didn't actually move (e.g. arrow key at document boundary)
          if (head === this.lastHead && !update.docChanged) return
          this.lastHead = head

          // Avoid fighting with mouse drag-selection. Recenter once drag ends.
          if (this.pointerSelecting) {
            this.recenterAfterPointerUp = true
            return
          }

          this.scrollHeadToCenter(head)
        }
      }
    ),
    // Allow scrolling past the last line so it can reach center
    scrollPastEnd(),
  ]
}
