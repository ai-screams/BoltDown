import { memo } from 'react'

import { useEditorStore } from '@/stores/editorStore'

export default memo(function Footer() {
  const wordCount = useEditorStore(s => s.wordCount)
  const readingTime = useEditorStore(s => s.readingTime)
  const charCount = useEditorStore(s => s.content.length)

  return (
    <footer className="flex h-8 items-center justify-between border-t border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800">
      <span className="text-xs text-thunder-gray">Ready ⚡</span>
      <span className="text-xs text-thunder-gray">
        {wordCount} words · {readingTime} min read · {charCount} chars
      </span>
    </footer>
  )
})
