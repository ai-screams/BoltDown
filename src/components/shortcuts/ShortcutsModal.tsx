import { Keyboard, X } from 'lucide-react'
import { memo, useCallback, useEffect, useRef } from 'react'

import { SHORTCUT_GROUPS } from '@/constants/shortcuts'

interface ShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="border-line bg-surface-muted text-fg-secondary inline-flex min-w-6 items-center justify-center rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-medium shadow-xs">
      {children}
    </kbd>
  )
}

function ShortcutKeys({ keys }: { keys: string }) {
  const parts = keys.split('+')
  return (
    <div className="flex items-center gap-0.5">
      {parts.map((part, i) => (
        <span key={`${part}-${i}`} className="flex items-center gap-0.5">
          {i > 0 && <span className="text-fg-muted">+</span>}
          <Kbd>{part}</Kbd>
        </span>
      ))}
    </div>
  )
}

export default memo(function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
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
        aria-labelledby="shortcuts-dialog-title"
        aria-modal="true"
        className="animate-dropdown border-line bg-surface flex max-h-[480px] w-[480px] flex-col overflow-hidden rounded-xl border shadow-2xl"
      >
        {/* Header */}
        <div className="border-line flex h-12 flex-none items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <Keyboard aria-hidden="true" className="text-fg-muted h-4 w-4" />
            <span id="shortcuts-dialog-title" className="text-fg text-sm font-semibold">
              Keyboard Shortcuts
            </span>
          </div>
          <button
            aria-label="Close shortcuts"
            className="text-fg-muted hover:bg-surface-muted hover:text-fg-secondary focus-visible:ring-electric-yellow/50 rounded-sm p-1.5 transition-[color,background-color,opacity,transform] duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:outline-hidden active:scale-95"
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-5">
            {SHORTCUT_GROUPS.map(group => (
              <div key={group.title}>
                <h3 className="text-fg-muted mb-2 text-xs font-semibold tracking-wider uppercase">
                  {group.title}
                </h3>
                <div className="divide-line divide-y">
                  {group.shortcuts.map(shortcut => (
                    <div key={shortcut.keys} className="flex items-center justify-between py-2">
                      <span className="text-fg-secondary text-sm">{shortcut.label}</span>
                      <ShortcutKeys keys={shortcut.keys} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})
