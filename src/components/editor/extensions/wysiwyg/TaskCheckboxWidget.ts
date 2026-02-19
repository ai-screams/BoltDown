import type { EditorView } from '@codemirror/view'
import { WidgetType } from '@codemirror/view'

function isTaskMarkerText(text: string): boolean {
  return /^\[[ xX]\]$/.test(text)
}

function toggleTaskMarkerText(text: string): string {
  return /\[[xX]\]/.test(text) ? '[ ]' : '[x]'
}

export class TaskCheckboxWidget extends WidgetType {
  constructor(
    private readonly checked: boolean,
    private readonly markerFrom: number,
    private readonly markerTo: number
  ) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = this.checked
    checkbox.tabIndex = -1
    checkbox.setAttribute('aria-hidden', 'true')
    checkbox.style.cssText =
      'margin-right: 8px; transform: translateY(1px); width: 0.95em; height: 0.95em; accent-color: rgb(var(--c-link) / 1); cursor: pointer;'

    checkbox.addEventListener('mousedown', event => {
      event.preventDefault()
      event.stopPropagation()
    })

    checkbox.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()

      if (
        this.markerFrom < 0 ||
        this.markerTo > view.state.doc.length ||
        this.markerFrom >= this.markerTo
      ) {
        return
      }

      const markerText = view.state.sliceDoc(this.markerFrom, this.markerTo)
      if (!isTaskMarkerText(markerText)) return

      view.dispatch({
        changes: {
          from: this.markerFrom,
          to: this.markerTo,
          insert: toggleTaskMarkerText(markerText),
        },
      })
    })

    return checkbox
  }

  eq(other: TaskCheckboxWidget): boolean {
    return (
      this.checked === other.checked &&
      this.markerFrom === other.markerFrom &&
      this.markerTo === other.markerTo
    )
  }

  ignoreEvent(event: Event): boolean {
    return event instanceof MouseEvent
  }
}
