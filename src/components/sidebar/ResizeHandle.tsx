import { memo, useCallback, useRef, useState } from 'react'

import { useSidebarStore } from '@/stores/sidebarStore'

const MIN_WIDTH = 180
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 240

export default memo(function ResizeHandle() {
  const setWidth = useSidebarStore(s => s.setWidth)
  const setResizing = useSidebarStore(s => s.setResizing)
  const [isDragging, setIsDragging] = useState(false)
  const rafRef = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      setResizing(true)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMouseMove = (ev: MouseEvent) => {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(() => {
          const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX))
          setWidth(newWidth)
        })
      }

      const onMouseUp = () => {
        cancelAnimationFrame(rafRef.current)
        setIsDragging(false)
        requestAnimationFrame(() => setResizing(false))
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        window.removeEventListener('blur', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      window.addEventListener('blur', onMouseUp, { once: true })
    },
    [setWidth, setResizing]
  )

  const handleDoubleClick = useCallback(() => {
    setWidth(DEFAULT_WIDTH)
  }, [setWidth])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className={`group relative flex-none cursor-col-resize transition-all duration-150 ${
        isDragging
          ? 'w-1.5 bg-electric-yellow shadow-[0_0_8px_rgba(250,204,21,0.6)]'
          : 'w-1 bg-gray-200 hover:w-1.5 hover:bg-electric-yellow/50 dark:bg-gray-700 dark:hover:bg-electric-yellow/50'
      }`}
    />
  )
})
