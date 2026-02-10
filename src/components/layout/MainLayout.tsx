import { memo } from 'react'
import type { ReactNode } from 'react'

import { useEditorStore } from '@/stores/editorStore'

interface MainLayoutProps {
  editor: ReactNode
  preview: ReactNode
  toolbar: ReactNode
}

export default memo(function MainLayout({ editor, preview, toolbar }: MainLayoutProps) {
  const mode = useEditorStore(s => s.mode)

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      {toolbar}
      <div className="flex flex-1 overflow-hidden">
        {mode === 'split' ? (
          <>
            <div className="flex-1 overflow-hidden">{editor}</div>
            <div className="w-px bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 overflow-auto">{preview}</div>
          </>
        ) : (
          <div className="w-full overflow-hidden">{editor}</div>
        )}
      </div>
    </main>
  )
})
