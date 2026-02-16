import { clsx } from 'clsx'
import { memo } from 'react'

import { useDocumentStats } from '@/hooks/useDocumentStats'
import { useEditorStore } from '@/stores/editorStore'

export default memo(function Footer({ className }: { className?: string }) {
  const stats = useDocumentStats()
  const readingTime = Math.max(1, Math.ceil(stats.words / 225))
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
        {stats.words.toLocaleString()} words · {readingTime} min read ·{' '}
        {stats.lines.toLocaleString()} lines · {stats.chars.toLocaleString()} chars
      </span>
    </footer>
  )
})
