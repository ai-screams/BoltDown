import type MarkdownIt from 'markdown-it'
import { useEffect, useMemo, useRef, useState } from 'react'

import { sanitizePreviewHtml } from '@/utils/sanitize'

// Module-level cache for the md instance
let cachedMd: MarkdownIt | null = null
let loadPromise: Promise<MarkdownIt> | null = null

function getMd(): Promise<MarkdownIt> {
  if (cachedMd) return Promise.resolve(cachedMd)
  if (!loadPromise) {
    loadPromise = import('@/utils/markdownConfig').then(m => {
      cachedMd = m.md
      return m.md
    })
  }
  return loadPromise
}

export function useMarkdownParser(content: string): string {
  const [md, setMd] = useState<MarkdownIt | null>(cachedMd)
  const contentRef = useRef(content)
  contentRef.current = content

  useEffect(() => {
    if (md) return
    void getMd().then(instance => {
      setMd(instance)
    })
  }, [md])

  return useMemo(() => {
    if (!md) return ''
    return sanitizePreviewHtml(md.render(content))
  }, [md, content])
}
