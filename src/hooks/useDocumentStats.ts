import { useEffect, useState } from 'react'

import { useTabStore } from '@/stores/tabStore'

interface DocumentStats {
  chars: number
  words: number
  lines: number
}

const EMPTY_STATS: DocumentStats = { chars: 0, words: 0, lines: 0 }

export function useDocumentStats(debounceMs = 150): DocumentStats {
  const content = useTabStore(s => {
    const tab = s.tabs.find(t => t.id === s.activeTabId)
    return tab?.content ?? ''
  })
  const [stats, setStats] = useState<DocumentStats>(EMPTY_STATS)

  useEffect(() => {
    const timer = setTimeout(() => {
      setStats({
        chars: content.length,
        words: content.split(/\s+/).filter(Boolean).length,
        lines: content.split('\n').length,
      })
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [content, debounceMs])

  return stats
}
