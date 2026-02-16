import { clsx } from 'clsx'
import { memo, useMemo } from 'react'

import { useEditorStore } from '@/stores/editorStore'
import { useTabStore } from '@/stores/tabStore'

function useActiveContent() {
  return useTabStore(s => {
    const tab = s.tabs.find(t => t.id === s.activeTabId)
    const content = tab?.content ?? ''
    return content
  })
}

export default memo(function Footer({ className }: { className?: string }) {
  const content = useActiveContent()
  const { charCount, wordCount, lineCount } = useMemo(() => {
    const charCount = content.length
    const wordCount = content.split(/\s+/).filter(Boolean).length
    const lineCount = content.split('\n').length
    return { charCount, wordCount, lineCount }
  }, [content])
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
