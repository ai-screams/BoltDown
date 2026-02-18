import { WidgetType } from '@codemirror/view'
import katex from 'katex'

import { LruCache } from '@/utils/cache'
import { sanitizeKatexHtml } from '@/utils/sanitize'

export const wysiwygKatexCache = new LruCache<string>(200)

export class InlineMathWidget extends WidgetType {
  constructor(private content: string) {
    super()
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-inline-math-widget'
    const cacheKey = `i:${this.content}`
    let html = wysiwygKatexCache.get(cacheKey)
    if (html === undefined) {
      html = sanitizeKatexHtml(
        katex.renderToString(this.content, {
          throwOnError: false,
          strict: 'ignore',
        })
      )
      wysiwygKatexCache.set(cacheKey, html)
    }
    span.innerHTML = html
    return span
  }
  eq(other: InlineMathWidget) {
    return this.content === other.content
  }
  ignoreEvent() {
    return false
  }
}
