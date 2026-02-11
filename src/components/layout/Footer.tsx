import { memo } from 'react'

import { useEditorStore } from '@/stores/editorStore'
import { useTabStore } from '@/stores/tabStore'

function useActiveCharCount() {
  return useTabStore(s => {
    const tab = s.tabs.find(t => t.id === s.activeTabId)
    return tab?.content.length ?? 0
  })
}

function useActiveWordCount() {
  return useTabStore(s => {
    const tab = s.tabs.find(t => t.id === s.activeTabId)
    const content = tab?.content ?? ''
    return content.split(/\s+/).filter(Boolean).length
  })
}

export default memo(function Footer() {
  const charCount = useActiveCharCount()
  const wordCount = useActiveWordCount()
  const readingTime = Math.max(1, Math.ceil(wordCount / 225))
  const statusText = useEditorStore(s => s.statusText)

  return (
    <footer className="flex h-8 items-center justify-between border-t border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800">
      <span className="text-xs text-thunder-gray">{statusText || 'Ready'}</span>
      <span className="text-xs tabular-nums text-thunder-gray">
        {wordCount.toLocaleString()} words · {readingTime} min read · {charCount.toLocaleString()}{' '}
        chars
      </span>
    </footer>
  )
})
