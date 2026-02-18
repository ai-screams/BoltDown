import { Keyboard, X } from 'lucide-react'
import { memo, useCallback, useEffect, useRef } from 'react'

import { SHORTCUT_GROUPS } from '@/constants/shortcuts'

interface ShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-line bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-fg-secondary shadow-sm">
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
      className="z-60 fixed inset-0 flex items-center justify-center overscroll-contain bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-labelledby="shortcuts-dialog-title"
        aria-modal="true"
        className="animate-dropdown flex max-h-[480px] w-[480px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
      >
        {/* Header */}
        <div className="flex h-12 flex-none items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2">
            <Keyboard aria-hidden="true" className="h-4 w-4 text-fg-muted" />
            <span id="shortcuts-dialog-title" className="text-sm font-semibold text-fg">
              Keyboard Shortcuts
            </span>
          </div>
          <button
            aria-label="Close shortcuts"
            className="rounded p-1.5 text-fg-muted transition-[color,background-color,opacity,transform] duration-150 hover:scale-110 hover:bg-surface-muted hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95"
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
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
                  {group.title}
                </h3>
                <div className="divide-y divide-line">
                  {group.shortcuts.map(shortcut => (
                    <div key={shortcut.keys} className="flex items-center justify-between py-2">
                      <span className="text-sm text-fg-secondary">{shortcut.label}</span>
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
