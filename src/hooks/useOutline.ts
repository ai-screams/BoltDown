import { useMemo } from 'react'

import { useTabStore } from '@/stores/tabStore'
import type { HeadingNode } from '@/types/sidebar'
import { stripInlineMarkdown } from '@/utils/markdownText'

export function useOutline(): HeadingNode[] {
  const content = useTabStore(s => {
    const tab = s.tabs.find(t => t.id === s.activeTabId)
    return tab?.content ?? ''
  })

  return useMemo(() => {
    const headings: HeadingNode[] = []
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i]?.match(/^(#{1,6})\s+(.+)$/)
      if (match?.[1] && match?.[2]) {
        const text = stripInlineMarkdown(match[2]).trim()
        headings.push({ level: match[1].length, text, line: i })
      }
    }
    return headings
  }, [content])
}
