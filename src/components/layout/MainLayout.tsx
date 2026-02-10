import type { ReactNode } from 'react'

import type { EditorMode } from '@/types/editor'

interface MainLayoutProps {
  editor: ReactNode
  preview: ReactNode
  mode: EditorMode
}

export default function MainLayout({ editor, preview, mode }: MainLayoutProps) {
  // WYSIWYG: full-width editor, no separate preview
  if (mode === 'wysiwyg') {
    return <main className="flex flex-1 overflow-hidden">{editor}</main>
  }

  // Source: full-width editor
  if (mode === 'source') {
    return (
      <main className="flex flex-1 overflow-hidden">
        <div className="w-full overflow-hidden">{editor}</div>
      </main>
    )
  }

  // Split: 50/50
  return (
    <main className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-hidden">{editor}</div>
      <div className="w-px bg-gray-200 dark:bg-gray-700" />
      <div className="flex-1 overflow-auto">{preview}</div>
    </main>
  )
}
