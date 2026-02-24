import { clsx } from 'clsx'
import { memo } from 'react'

import { DOCUMENT_STATS_POLICY } from '@/constants/feedback'
import { useDocumentStats } from '@/hooks/useDocumentStats'
import { useEditorStore } from '@/stores/editorStore'

export default memo(function Footer({ className }: { className?: string }) {
  const stats = useDocumentStats()
  const readingTime = Math.max(
    1,
    Math.ceil(stats.words / DOCUMENT_STATS_POLICY.readingWordsPerMinute)
  )
  const statusText = useEditorStore(s => s.statusText)

  return (
    <footer
      className={clsx(
        'border-line bg-surface flex h-8 flex-none items-center justify-between border-t px-4',
        className
      )}
    >
      <span aria-atomic="true" aria-live="polite" className="text-thunder-gray text-xs">
        {statusText || 'Ready'}
      </span>
      <span className="text-thunder-gray text-xs tabular-nums">
        {stats.words.toLocaleString()} words · {readingTime} min read ·{' '}
        {stats.lines.toLocaleString()} lines · {stats.chars.toLocaleString()} chars
      </span>
    </footer>
  )
})
