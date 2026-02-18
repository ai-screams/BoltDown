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
      className="z-60 fixed inset-0 flex items-center justify-center overscroll-contain bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-labelledby="about-dialog-title"
        aria-modal="true"
        className="animate-dropdown flex w-[360px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
      >
        {/* Header */}
        <div className="flex h-12 flex-none items-center justify-between border-b border-line px-4">
          <span id="about-dialog-title" className="text-sm font-semibold text-fg">
            About
          </span>
          <button
            aria-label="Close about"
            className="rounded p-1.5 text-fg-muted transition-[color,background-color,opacity,transform] duration-150 hover:scale-110 hover:bg-surface-muted hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95"
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center px-6 py-6">
          <div className="flex items-center gap-2">
            <Zap aria-hidden="true" className="h-8 w-8 text-electric-yellow" fill="currentColor" />
            <span className="text-xl font-bold text-fg">BoltDown</span>
          </div>
          <span className="mt-1 text-xs text-fg-muted">v{APP_VERSION}</span>
          <p className="mt-3 text-center text-sm text-fg-secondary">
            Lightning-fast Markdown editor built with Tauri.
          </p>

          <div className="mt-5 w-full space-y-2 rounded-lg border border-line bg-surface-muted p-3 text-xs text-fg-muted">
            <div className="flex justify-between">
              <span>License</span>
              <span className="font-medium text-fg-secondary">MIT</span>
            </div>
            <div className="flex justify-between">
              <span>Framework</span>
              <span className="font-medium text-fg-secondary">React 19 + Tauri 2.0</span>
            </div>
            <div className="flex justify-between">
              <span>Editor</span>
              <span className="font-medium text-fg-secondary">CodeMirror 6</span>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            {onOpenChangelog && (
              <button
                type="button"
                className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-fg-secondary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50"
                onClick={() => {
                  onClose()
                  onOpenChangelog()
                }}
              >
                Changelog
              </button>
            )}
          </div>

          <p className="mt-5 flex items-center gap-1 text-[11px] text-fg-muted">
            Made with{' '}
            <Heart aria-hidden="true" className="h-3 w-3 text-danger" fill="currentColor" /> by
            BoltDown Team
          </p>
        </div>
      </div>
    </div>
  )
})
