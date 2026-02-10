import { memo, useCallback, useRef, useState } from 'react'

import { useSidebarStore } from '@/stores/sidebarStore'

const MIN_WIDTH = 180
const MAX_WIDTH = 480

export default memo(function ResizeHandle() {
  const setWidth = useSidebarStore(s => s.setWidth)
  const [isDragging, setIsDragging] = useState(false)
  const rafRef = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
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
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [setWidth]
  )

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`w-1 flex-none cursor-col-resize transition-colors ${
        isDragging
          ? 'bg-electric-yellow'
          : 'bg-gray-200 hover:bg-electric-yellow/50 dark:bg-gray-700 dark:hover:bg-electric-yellow/50'
      }`}
    />
  )
})
