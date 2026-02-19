import { clsx } from 'clsx'
import { memo, useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { useSplitScrollSync } from '@/hooks/useSplitScrollSync'
import { useEditorStore } from '@/stores/editorStore'

interface MainLayoutProps {
  editor: ReactNode
  preview: ReactNode
  toolbar: ReactNode
}

const MIN_RATIO = 0.2
const MAX_RATIO = 0.8
const DEFAULT_SPLIT_RATIO = 0.5

export default memo(function MainLayout({ editor, preview, toolbar }: MainLayoutProps) {
  const mode = useEditorStore(s => s.mode)
  const [splitRatio, setSplitRatio] = useState(DEFAULT_SPLIT_RATIO)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  useSplitScrollSync({ enabled: mode === 'split', previewScrollRef })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.detail >= 2) {
      e.preventDefault()
      setSplitRatio(DEFAULT_SPLIT_RATIO)
      return
    }

    e.preventDefault()
    setIsDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (ev: MouseEvent) => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const ratio = (ev.clientX - rect.left) / rect.width
        setSplitRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio)))
      })
    }

    const onMouseUp = () => {
      cancelAnimationFrame(rafRef.current)
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('blur', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    window.addEventListener('blur', onMouseUp, { once: true })
  }, [])

  const handleDoubleClick = useCallback(() => {
    setSplitRatio(DEFAULT_SPLIT_RATIO)
  }, [])

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {toolbar}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {isDragging && <div className="fixed inset-0 z-40 cursor-col-resize" />}
        {mode === 'split' ? (
          <>
            <div className="overflow-hidden" style={{ width: `${splitRatio * 100}%` }}>
              {editor}
            </div>
            <div aria-hidden="true" className="group relative w-px flex-none">
              <div
                className={clsx(
                  'pointer-events-none h-full w-px origin-center transition-[transform,background-color] duration-150',
                  isDragging
                    ? 'scale-x-100 bg-electric-yellow'
                    : 'bg-line group-hover:scale-x-150 group-hover:bg-electric-yellow/50'
                )}
              />
              <div
                className="absolute inset-y-0 -left-[6px] -right-[6px] z-10 cursor-col-resize"
                onDoubleClick={handleDoubleClick}
                onMouseDown={handleMouseDown}
              />
            </div>
            <div ref={previewScrollRef} className="flex-1 overflow-auto overscroll-contain">
              {preview}
            </div>
          </>
        ) : (
          <div className="w-full overflow-hidden">{editor}</div>
        )}
      </div>
    </main>
  )
})
