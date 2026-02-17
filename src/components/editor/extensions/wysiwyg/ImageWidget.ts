import { EditorView, WidgetType } from '@codemirror/view'

import { resolveImageSrcForDisplay } from '@/utils/imagePath'

import { scheduleEditorMeasure } from './utils'

export class ImageWidget extends WidgetType {
  constructor(
    private url: string,
    private alt: string,
    private markdownFilePath: string | null
  ) {
    super()
  }
  toDOM(view: EditorView) {
    const wrapper = document.createElement('span')
    wrapper.className = 'cm-image-widget'
    wrapper.style.cssText = 'display: inline-block; max-width: 100%; padding: 4px 0;'

    const img = document.createElement('img')

    const syncLayout = () => scheduleEditorMeasure(view)
    img.addEventListener('load', syncLayout, { once: true })
    img.addEventListener('error', syncLayout, { once: true })

    img.alt = this.alt
    img.style.display = 'block'
    img.style.maxWidth = '100%'
    img.style.borderRadius = '4px'
    img.src = resolveImageSrcForDisplay(this.url, this.markdownFilePath)

    if (img.complete) {
      syncLayout()
    }

    // Position cursor at widget start on click to trigger reveal correctly
    wrapper.addEventListener('mousedown', e => {
      e.preventDefault()
      const pos = view.posAtDOM(wrapper)
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: true })
      view.focus()
    })

    wrapper.appendChild(img)
    return wrapper
  }
  eq(other: ImageWidget) {
    return (
      this.url === other.url &&
      this.alt === other.alt &&
      this.markdownFilePath === other.markdownFilePath
    )
  }
  ignoreEvent(event: Event) {
    return event instanceof MouseEvent
  }
}
