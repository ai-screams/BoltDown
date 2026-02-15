import { clsx } from 'clsx'
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

function useActiveLineCount() {
  return useTabStore(s => {
    const tab = s.tabs.find(t => t.id === s.activeTabId)
    const content = tab?.content ?? ''
    return content.split('\n').length
  })
}

export default memo(function Footer({ className }: { className?: string }) {
  const charCount = useActiveCharCount()
  const wordCount = useActiveWordCount()
  const lineCount = useActiveLineCount()
  const readingTime = Math.max(1, Math.ceil(wordCount / 225))
  const statusText = useEditorStore(s => s.statusText)

  return (
    <footer
      className={clsx(
        'flex h-8 flex-none items-center justify-between border-t border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800',
        className
      )}
    >
      <span className="text-xs text-thunder-gray">{statusText || 'Ready'}</span>
      <span className="text-xs tabular-nums text-thunder-gray">
        {wordCount.toLocaleString()} words · {readingTime} min read · {lineCount.toLocaleString()}{' '}
        lines · {charCount.toLocaleString()} chars
      </span>
    </footer>
  )
})
