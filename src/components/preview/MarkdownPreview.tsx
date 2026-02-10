import { memo, useCallback, useEffect, useRef } from 'react'

import { useMarkdownParser } from '@/hooks/useMarkdownParser'
import { useEditorStore } from '@/stores/editorStore'

async function renderMermaidBlocks(container: HTMLElement) {
  const blocks = container.querySelectorAll<HTMLPreElement>('pre.mermaid-block')
  if (blocks.length === 0) return

  const mermaid = (await import('mermaid')).default
  mermaid.initialize({
    startOnLoad: false,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
    securityLevel: 'loose',
  })

  for (const block of blocks) {
    const code = block.querySelector('code')?.textContent
    if (!code || block.dataset['rendered'] === 'true') continue

    try {
      const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`
      const { svg } = await mermaid.render(id, code)
      block.innerHTML = svg
      block.dataset['rendered'] = 'true'
      block.classList.add('mermaid-rendered')
    } catch {
      // Leave as code block on error
    }
  }
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

export default memo(function MarkdownPreview() {
  const content = useEditorStore(s => s.content)
  const html = useMarkdownParser(content)
  const containerRef = useRef<HTMLDivElement>(null)

  const enhancePreview = useCallback(() => {
    if (!containerRef.current) return
    void renderMermaidBlocks(containerRef.current)
    addCopyButtons(containerRef.current)
  }, [])

  useEffect(() => {
    enhancePreview()
  }, [html, enhancePreview])

  return (
    <div
      ref={containerRef}
      className="prose dark:prose-invert max-w-none p-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})
