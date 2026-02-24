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
      className="fixed inset-0 z-60 flex items-center justify-center overscroll-contain bg-black/40 backdrop-blur-xs"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-labelledby="changelog-dialog-title"
        aria-modal="true"
        className="animate-dropdown border-line bg-surface flex max-h-[520px] w-[480px] flex-col overflow-hidden rounded-xl border shadow-2xl"
      >
        {/* Header */}
        <div className="border-line flex h-12 flex-none items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <FileText aria-hidden="true" className="text-fg-muted h-4 w-4" />
            <span id="changelog-dialog-title" className="text-fg text-sm font-semibold">
              Changelog
            </span>
          </div>
          <button
            aria-label="Close changelog"
            className="text-fg-muted hover:bg-surface-muted hover:text-fg-secondary focus-visible:ring-electric-yellow/50 rounded-sm p-1.5 transition-[color,background-color,opacity,transform] duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:outline-hidden active:scale-95"
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
                  <span className="bg-electric-yellow/10 text-electric-dark rounded-sm px-2 py-0.5 text-sm font-semibold">
                    v{entry.version}
                  </span>
                  <span className="text-fg-muted text-xs">{entry.date}</span>
                </div>
                <ul className="space-y-1.5">
                  {entry.changes.map((change, i) => (
                    <li key={i} className="text-fg-secondary flex gap-2 text-sm">
                      <span
                        aria-hidden="true"
                        className="bg-electric-yellow/60 mt-1.5 h-1.5 w-1.5 flex-none rounded-full"
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
