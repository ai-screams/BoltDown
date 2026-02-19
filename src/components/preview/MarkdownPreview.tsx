import { clsx } from 'clsx'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'

import { useMarkdownParser } from '@/hooks/useMarkdownParser'
import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTabStore } from '@/stores/tabStore'
import type { MermaidSecurityLevel } from '@/types/settings'
import { LruCache } from '@/utils/cache'
import { resolveImageSrcForDisplay } from '@/utils/imagePath'
import { sanitizeSvgHtml } from '@/utils/sanitize'
import { getMermaidThemeFromDom } from '@/utils/themeRuntime'

let mermaidDebounceTimer: ReturnType<typeof setTimeout> | null = null
const mermaidPreviewCache = new LruCache<string>(50)

/** Apply rendered SVG to a mermaid block and mark it as rendered. */
function commitMermaidBlock(block: HTMLPreElement, svg: string, configKey: string): void {
  block.innerHTML = svg
  block.dataset['renderedConfig'] = configKey
  block.classList.add('mermaid-rendered')
}

/** Synchronously apply cached Mermaid SVGs — no debounce, no flash. Returns true if ALL blocks were cache hits. */
function applyCachedMermaidBlocks(
  container: HTMLElement,
  securityLevel: MermaidSecurityLevel
): boolean {
  const theme: string = getMermaidThemeFromDom()
  const configKey: string = `${theme}:${securityLevel}`
  const blocks: NodeListOf<HTMLPreElement> = container.querySelectorAll('pre.mermaid-block')
  let allCached: boolean = true

  for (const block of blocks) {
    if (
      block.classList.contains('mermaid-rendered') &&
      block.dataset['renderedConfig'] === configKey
    ) {
      continue
    }

    const code: string | undefined = block.querySelector('code')?.textContent ?? undefined
    if (!code) continue

    const cacheKey: string = `${code}:${configKey}`
    const cached: string | undefined = mermaidPreviewCache.get(cacheKey)
    if (cached === undefined) {
      allCached = false
      continue
    }

    commitMermaidBlock(block, cached, configKey)
  }

  return allCached
}

async function renderMermaidBlocks(
  container: HTMLElement,
  securityLevel: MermaidSecurityLevel,
  tokenRef: { current: number }
) {
  if (mermaidDebounceTimer) {
    clearTimeout(mermaidDebounceTimer)
  }

  return new Promise<void>(resolve => {
    mermaidDebounceTimer = setTimeout(async () => {
      const blocks = container.querySelectorAll<HTMLPreElement>('pre.mermaid-block')
      if (blocks.length === 0) {
        resolve()
        return
      }

      const token = `${++tokenRef.current}`
      container.dataset['mermaidToken'] = token
      const theme = getMermaidThemeFromDom()
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

          const cacheKey = `${code}:${configKey}`
          const cached = mermaidPreviewCache.get(cacheKey)

          if (cached !== undefined) {
            if (!container.isConnected || container.dataset['mermaidToken'] !== token) return
            commitMermaidBlock(block, cached, configKey)
            return
          }

          try {
            const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
            const { svg } = await mermaid.render(id, code)

            if (!container.isConnected || container.dataset['mermaidToken'] !== token) return

            const sanitizedSvg = sanitizeSvgHtml(svg)
            mermaidPreviewCache.set(cacheKey, sanitizedSvg)
            commitMermaidBlock(block, sanitizedSvg, configKey)
          } catch {
            // Leave as code block on error
          }
        })
      )

      resolve()
    }, 150)
  })
}

function addCopyButtons(container: HTMLElement) {
  const pres = container.querySelectorAll<HTMLPreElement>(
    'pre:not(.mermaid-block):not(.mermaid-rendered)'
  )
  for (const pre of pres) {
    if (pre.querySelector('.copy-btn')) continue

    const btn = document.createElement('button')
    btn.className =
      'copy-btn absolute right-2 top-2 rounded bg-surface-elevated/80 px-2 py-1 text-xs text-fg-secondary opacity-0 transition-opacity hover:bg-surface-elevated group-hover:opacity-100'
    btn.textContent = 'Copy'
    btn.type = 'button'
    btn.setAttribute('aria-label', 'Copy code block')
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? ''
      void navigator.clipboard
        .writeText(code)
        .then(() => {
          btn.textContent = 'Copied!'
          setTimeout(() => {
            btn.textContent = 'Copy'
          }, 1500)
        })
        .catch(() => {
          btn.textContent = 'Failed'
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
  const images = container.querySelectorAll<HTMLImageElement>('img:not([data-src-resolved])')
  for (const image of images) {
    const source = image.getAttribute('src')
    if (!source) continue

    const resolved = resolveImageSrcForDisplay(source, markdownFilePath)
    if (resolved && resolved !== source) {
      image.src = resolved
    }
    image.dataset['srcResolved'] = 'true'
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
  const renderTokenRef = useRef(0)
  const mode = useEditorStore(s => s.mode)
  const preview = useSettingsStore(s => s.settings.preview)

  const enhancePreview = useCallback(() => {
    if (!containerRef.current) return
    resolveImageSources(containerRef.current, markdownFilePath)

    // Synchronous cache-hit path: apply cached SVGs immediately (no flash)
    const allCached: boolean = applyCachedMermaidBlocks(
      containerRef.current,
      preview.mermaidSecurityLevel
    )

    // Only enter debounced async path for cache misses
    if (!allCached) {
      void renderMermaidBlocks(containerRef.current, preview.mermaidSecurityLevel, renderTokenRef)
    }

    addCopyButtons(containerRef.current)
  }, [markdownFilePath, preview.mermaidSecurityLevel])

  useEffect(() => {
    enhancePreview()
  }, [html, enhancePreview])

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (mermaidDebounceTimer) {
        clearTimeout(mermaidDebounceTimer)
        mermaidDebounceTimer = null
      }
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      enhancePreview()
    })

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-theme-resolved'],
    })

    return () => {
      observer.disconnect()
    }
  }, [enhancePreview])

  // Apply code block font size via CSS custom property
  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.style.setProperty(
      '--preview-code-font-size',
      `${preview.codeBlockFontSize}px`
    )
  }, [preview.codeBlockFontSize])

  const previewStyle = useMemo(
    () => ({
      fontSize: `${preview.fontSize}px`,
      lineHeight: preview.lineHeight,
      maxWidth: `${preview.maxWidth}px`,
    }),
    [preview.fontSize, preview.lineHeight, preview.maxWidth]
  )

  const containerClassName = clsx(
    'prose dark:prose-invert p-6',
    mode === 'split' ? 'max-w-3xl' : 'mx-auto'
  )

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      style={previewStyle}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})
