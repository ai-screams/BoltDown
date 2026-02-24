import { Heart, X, Zap } from 'lucide-react'
import { memo, useCallback, useEffect, useRef } from 'react'

const APP_VERSION = __APP_VERSION__

interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenChangelog?: () => void
}

export default memo(function AboutModal({ isOpen, onClose, onOpenChangelog }: AboutModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose()
    },
    [onClose]
  )

  if (!isOpen) return null

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-60 flex items-center justify-center overscroll-contain bg-black/40 backdrop-blur-xs"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-labelledby="about-dialog-title"
        aria-modal="true"
        className="animate-dropdown border-line bg-surface flex w-[360px] flex-col overflow-hidden rounded-xl border shadow-2xl"
      >
        {/* Header */}
        <div className="border-line flex h-12 flex-none items-center justify-between border-b px-4">
          <span id="about-dialog-title" className="text-fg text-sm font-semibold">
            About
          </span>
          <button
            aria-label="Close about"
            className="text-fg-muted hover:bg-surface-muted hover:text-fg-secondary focus-visible:ring-electric-yellow/50 rounded-sm p-1.5 transition-[color,background-color,opacity,transform] duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:outline-hidden active:scale-95"
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center px-6 py-6">
          <div className="flex items-center gap-2">
            <Zap aria-hidden="true" className="text-electric-yellow h-8 w-8" fill="currentColor" />
            <span className="text-fg text-xl font-bold">BoltDown</span>
          </div>
          <span className="text-fg-muted mt-1 text-xs">v{APP_VERSION}</span>
          <p className="text-fg-secondary mt-3 text-center text-sm">
            Lightning-fast Markdown editor built with Tauri.
          </p>

          <div className="border-line bg-surface-muted text-fg-muted mt-5 w-full space-y-2 rounded-lg border p-3 text-xs">
            <div className="flex justify-between">
              <span>License</span>
              <span className="text-fg-secondary font-medium">MIT</span>
            </div>
            <div className="flex justify-between">
              <span>Framework</span>
              <span className="text-fg-secondary font-medium">React 19 + Tauri 2.0</span>
            </div>
            <div className="flex justify-between">
              <span>Editor</span>
              <span className="text-fg-secondary font-medium">CodeMirror 6</span>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            {onOpenChangelog && (
              <button
                type="button"
                className="border-line text-fg-secondary hover:bg-surface-muted focus-visible:ring-electric-yellow/50 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
                onClick={() => {
                  onClose()
                  onOpenChangelog()
                }}
              >
                Changelog
              </button>
            )}
          </div>

          <p className="text-fg-muted mt-5 flex items-center gap-1 text-[11px]">
            Made with{' '}
            <Heart aria-hidden="true" className="text-danger h-3 w-3" fill="currentColor" /> by
            BoltDown Team
          </p>
        </div>
      </div>
    </div>
  )
})
