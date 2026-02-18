import { WidgetType } from '@codemirror/view'

export class TaskCheckboxWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super()
  }

  toDOM() {
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = this.checked
    checkbox.disabled = true
    checkbox.setAttribute('aria-hidden', 'true')
    checkbox.style.cssText =
      'margin-right: 8px; transform: translateY(1px); width: 0.95em; height: 0.95em; accent-color: rgb(var(--c-link) / 1);'
    return checkbox
  }

  eq(other: TaskCheckboxWidget) {
    return this.checked === other.checked
  }
}
