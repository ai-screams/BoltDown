import { FileText, X } from 'lucide-react'
import { memo, useCallback, useEffect, useRef } from 'react'

import { CHANGELOG } from '@/constants/changelog'

interface ChangelogModalProps {
  isOpen: boolean
  onClose: () => void
}

export default memo(function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
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
        aria-labelledby="changelog-dialog-title"
        aria-modal="true"
        className="animate-dropdown flex max-h-[520px] w-[480px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
      >
        {/* Header */}
        <div className="flex h-12 flex-none items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2">
            <FileText aria-hidden="true" className="h-4 w-4 text-fg-muted" />
            <span id="changelog-dialog-title" className="text-sm font-semibold text-fg">
              Changelog
            </span>
          </div>
          <button
            aria-label="Close changelog"
            className="rounded p-1.5 text-fg-muted transition-[color,background-color,opacity,transform] duration-150 hover:scale-110 hover:bg-surface-muted hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95"
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {CHANGELOG.map(entry => (
              <div key={entry.version}>
                <div className="mb-3 flex items-baseline gap-2">
                  <span className="rounded bg-electric-yellow/10 px-2 py-0.5 text-sm font-semibold text-electric-dark">
                    v{entry.version}
                  </span>
                  <span className="text-xs text-fg-muted">{entry.date}</span>
                </div>
                <ul className="space-y-1.5">
                  {entry.changes.map((change, i) => (
                    <li key={i} className="flex gap-2 text-sm text-fg-secondary">
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-electric-yellow/60"
                      />
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})
