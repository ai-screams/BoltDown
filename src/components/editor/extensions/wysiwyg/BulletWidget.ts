import { WidgetType } from '@codemirror/view'

export class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span')
    span.textContent = '\u2022'
    span.style.cssText = 'opacity: 0.5; font-size: 1.2em; margin-right: 4px;'
    return span
  }
  eq() {
    return true
  }
}
