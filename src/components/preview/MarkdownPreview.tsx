import { memo, useCallback, useEffect, useRef } from 'react'

import { useMarkdownParser } from '@/hooks/useMarkdownParser'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTabStore } from '@/stores/tabStore'
import type { MermaidSecurityLevel } from '@/types/settings'
import { resolveImageSrcForDisplay } from '@/utils/imagePath'

let previewRenderToken = 0

async function renderMermaidBlocks(container: HTMLElement, securityLevel: MermaidSecurityLevel) {
  const blocks = container.querySelectorAll<HTMLPreElement>('pre.mermaid-block')
  if (blocks.length === 0) return

  const token = `${++previewRenderToken}`
  container.dataset['mermaidToken'] = token
  const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'default'
  const configKey = `${theme}:${securityLevel}`

  const mermaid = (await import('mermaid')).default
  mermaid.initialize({
    startOnLoad: false,
    theme,
    securityLevel,
  })

  await Promise.all(
    Array.from(blocks).map(async block => {
      const code = block.querySelector('code')?.textContent
      if (!code || block.dataset['renderedConfig'] === configKey) return

      try {
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
        const { svg } = await mermaid.render(id, code)

        if (!container.isConnected || container.dataset['mermaidToken'] !== token) return

        block.innerHTML = svg
        block.dataset['renderedConfig'] = configKey
        block.classList.add('mermaid-rendered')
      } catch {
        // Leave as code block on error
      }
    })
  )
}

function addCopyButtons(container: HTMLElement) {
  const pres = container.querySelectorAll<HTMLPreElement>(
    'pre:not(.mermaid-block):not(.mermaid-rendered)'
  )
  for (const pre of pres) {
    if (pre.querySelector('.copy-btn')) continue

    const btn = document.createElement('button')
    btn.className =
      'copy-btn absolute right-2 top-2 rounded bg-gray-700/80 px-2 py-1 text-xs text-gray-200 opacity-0 transition-opacity hover:bg-gray-600 group-hover:opacity-100'
    btn.textContent = 'Copy'
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? ''
      void navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!'
        setTimeout(() => {
          btn.textContent = 'Copy'
        }, 1500)
      })
    })

    pre.style.position = 'relative'
    pre.classList.add('group')
    pre.appendChild(btn)
  }
}

function resolveImageSources(container: HTMLElement, markdownFilePath: string | null) {
  const images = container.querySelectorAll<HTMLImageElement>('img')
  for (const image of images) {
    const source = image.getAttribute('src')
    if (!source) continue

    const resolved = resolveImageSrcForDisplay(source, markdownFilePath)
    if (resolved && resolved !== source) {
      image.src = resolved
    }
  }
}

function useActiveTabContent(): string {
  return useTabStore(s => {
    const tab = s.tabs.find(t => t.id === s.activeTabId)
    return tab?.content ?? ''
  })
}

function useActiveTabFilePath(): string | null {
  return useTabStore(s => {
    const tab = s.tabs.find(t => t.id === s.activeTabId)
    return tab?.filePath ?? null
  })
}

export default memo(function MarkdownPreview() {
  const content = useActiveTabContent()
  const markdownFilePath = useActiveTabFilePath()
  const html = useMarkdownParser(content)
  const containerRef = useRef<HTMLDivElement>(null)
  const preview = useSettingsStore(s => s.settings.preview)

  const enhancePreview = useCallback(() => {
    if (!containerRef.current) return
    resolveImageSources(containerRef.current, markdownFilePath)
    void renderMermaidBlocks(containerRef.current, preview.mermaidSecurityLevel)
    addCopyButtons(containerRef.current)
  }, [markdownFilePath, preview.mermaidSecurityLevel])

  useEffect(() => {
    enhancePreview()
  }, [html, enhancePreview])

  // Apply code block font size via CSS custom property
  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.style.setProperty(
      '--preview-code-font-size',
      `${preview.codeBlockFontSize}px`
    )
  }, [preview.codeBlockFontSize])

  return (
    <div
      ref={containerRef}
      className="prose dark:prose-invert mx-auto p-6"
      style={{
        fontSize: `${preview.fontSize}px`,
        lineHeight: preview.lineHeight,
        maxWidth: `${preview.maxWidth}px`,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})
