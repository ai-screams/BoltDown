import type { EditorView } from '@codemirror/view'
import { WidgetType } from '@codemirror/view'

export interface TocHeadingItem {
  from: number
  level: number
  text: string
}

function buildHeadingSignature(headings: readonly TocHeadingItem[]): string {
  return headings.map(heading => `${heading.from}:${heading.level}:${heading.text}`).join('|')
}

export class TocWidget extends WidgetType {
  private readonly headings: readonly TocHeadingItem[]
  private readonly signature: string

  constructor(headings: readonly TocHeadingItem[]) {
    super()
    this.headings = headings
    this.signature = buildHeadingSignature(headings)
  }

  eq(other: TocWidget): boolean {
    return this.signature === other.signature
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('nav')
    wrapper.className = 'markdown-toc cm-toc-widget'

    if (this.headings.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'toc-item'
      empty.textContent = 'No headings found'
      empty.style.opacity = '0.6'
      wrapper.appendChild(empty)
      return wrapper
    }

    const minLevel = Math.min(...this.headings.map(heading => heading.level))

    for (const heading of this.headings) {
      const item = document.createElement('div')
      item.className = 'toc-item'
      item.style.paddingLeft = `${(heading.level - minLevel) * 16}px`

      const link = document.createElement('a')
      link.href = '#'
      link.textContent = heading.text
      link.addEventListener('mousedown', event => {
        event.preventDefault()
      })
      link.addEventListener('click', event => {
        event.preventDefault()
        view.dispatch({ selection: { anchor: heading.from }, scrollIntoView: true })
        view.focus()
      })

      item.appendChild(link)
      wrapper.appendChild(item)
    }

    return wrapper
  }

  ignoreEvent(event: Event): boolean {
    return event instanceof MouseEvent
  }
}
