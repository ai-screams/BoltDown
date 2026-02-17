import { memo, useCallback, useRef, useState } from 'react'

import { SIDEBAR_WIDTH_LIMITS } from '@/constants/sidebar'
import { useSidebarStore } from '@/stores/sidebarStore'

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
          const newWidth = Math.min(
            SIDEBAR_WIDTH_LIMITS.max,
            Math.max(SIDEBAR_WIDTH_LIMITS.min, ev.clientX)
          )
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
    setWidth(SIDEBAR_WIDTH_LIMITS.default)
  }, [setWidth])

  const dragStyle = isDragging
    ? {
        boxShadow: '0 0 8px rgb(var(--c-sidebar-resize-glow) / 0.6)',
      }
    : undefined

  return (
    <div
      role="separator"
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      className={`group relative flex-none cursor-col-resize transition-[width,background-color,box-shadow] duration-150 ${
        isDragging
          ? 'w-1.5 bg-electric-yellow'
          : 'bg-border w-1 hover:w-1.5 hover:bg-electric-yellow/50'
      }`}
      style={dragStyle}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
    />
  )
})
