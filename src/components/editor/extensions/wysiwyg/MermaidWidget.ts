import { EditorView, WidgetType } from '@codemirror/view'

import type { MermaidSecurityLevel } from '@/types/settings'
import { LruCache } from '@/utils/cache'
import { sanitizeSvgHtml } from '@/utils/sanitize'
import { getMermaidThemeFromDom } from '@/utils/themeRuntime'

import { getCodeBlockPalette } from './CodeBlockWidget'
import { scheduleEditorMeasure } from './utils'

const mermaidSvgCache = new LruCache<string>(50)

let mermaidModulePromise: Promise<(typeof import('mermaid'))['default']> | null = null
let mermaidConfigCache: { theme: 'dark' | 'default'; securityLevel: MermaidSecurityLevel } | null =
  null
let mermaidRenderCount = 0
let mermaidRenderToken = 0

async function getMermaid(securityLevel: MermaidSecurityLevel) {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then(mod => mod.default)
  }

  const mermaid = await mermaidModulePromise
  const theme = getMermaidThemeFromDom()

  if (
    !mermaidConfigCache ||
    mermaidConfigCache.theme !== theme ||
    mermaidConfigCache.securityLevel !== securityLevel
  ) {
    mermaid.initialize({
      startOnLoad: false,
      theme,
      securityLevel,
    })
    mermaidConfigCache = { theme, securityLevel }
  }

  return mermaid
}

async function renderMermaidInto(
  container: HTMLDivElement,
  code: string,
  securityLevel: MermaidSecurityLevel,
  onRendered?: () => void
) {
  const theme = getMermaidThemeFromDom()
  const cacheKey = `${code}:${theme}:${securityLevel}`
  const cachedSvg = mermaidSvgCache.get(cacheKey)
  if (cachedSvg !== undefined) {
    container.innerHTML = cachedSvg
    onRendered?.()
    return
  }

  const token = `${++mermaidRenderToken}`
  container.dataset.mermaidToken = token

  try {
    const mermaid = await getMermaid(securityLevel)
    const id = `cm-mermaid-${mermaidRenderCount++}`
    const { svg } = await mermaid.render(id, code)

    if (!container.isConnected || container.dataset.mermaidToken !== token) return
    const sanitized = sanitizeSvgHtml(svg)
    mermaidSvgCache.set(cacheKey, sanitized)
    container.innerHTML = sanitized
    onRendered?.()
  } catch {
    if (!container.isConnected || container.dataset.mermaidToken !== token) return

    const palette = getCodeBlockPalette()
    const pre = document.createElement('pre')
    pre.style.cssText = `background: ${palette.background}; color: ${palette.text}; border-radius: 6px; padding: 16px; overflow-x: auto; font-size: 0.875em; line-height: 1.6; margin: 0;`
    const codeEl = document.createElement('code')
    codeEl.textContent = code
    codeEl.style.cssText = 'font-family: monospace; white-space: pre;'
    pre.appendChild(codeEl)
    container.replaceChildren(pre)
    onRendered?.()
  }
}

export class MermaidWidget extends WidgetType {
  constructor(
    private code: string,
    private securityLevel: MermaidSecurityLevel
  ) {
    super()
  }

  toDOM(view: EditorView) {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-mermaid-widget'
    wrapper.style.cssText = 'padding: 8px 0;'

    const panel = document.createElement('div')
    panel.style.cssText =
      'border-radius: 6px; padding: 8px; background: var(--c-wys-mermaid-panel-bg); overflow-x: auto;'
    wrapper.appendChild(panel)

    const loading = document.createElement('div')
    loading.textContent = 'Rendering Mermaid diagram...'
    loading.style.cssText =
      'color: rgb(var(--c-wys-mermaid-loading-text) / 1); font-size: 0.8em; text-align: center; padding: 8px 0;'
    panel.appendChild(loading)

    void renderMermaidInto(panel, this.code, this.securityLevel, () => {
      scheduleEditorMeasure(view)
    })

    return wrapper
  }

  eq(other: MermaidWidget) {
    return this.code === other.code && this.securityLevel === other.securityLevel
  }
  ignoreEvent() {
    return false
  }
}
