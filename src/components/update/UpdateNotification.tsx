import { clsx } from 'clsx'
import { Download, RefreshCw, X } from 'lucide-react'
import { memo, useSyncExternalStore } from 'react'

import type { UpdateState } from '@/hooks/useAutoUpdate'
import { getUpdateState, subscribeUpdate } from '@/hooks/useAutoUpdate'

export default memo(function UpdateNotification() {
  const state: UpdateState = useSyncExternalStore(subscribeUpdate, getUpdateState)

  const handleInstall = () => {
    void state.install?.()
  }

  const handleDismiss = () => {
    state.dismiss()
  }

  if (state.status !== 'available' && state.status !== 'downloading') return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        'flex items-center gap-3 border-b px-4 py-2 text-sm',
        'border-electric-yellow/30 bg-electric-yellow/10'
      )}
    >
      {state.status === 'available' ? (
        <Download aria-hidden="true" className="text-electric-yellow h-4 w-4 flex-shrink-0" />
      ) : (
        <RefreshCw
          aria-hidden="true"
          className="text-electric-yellow h-4 w-4 flex-shrink-0 animate-spin"
        />
      )}

      <span className="text-fg min-w-0 flex-1 truncate">
        {state.status === 'available'
          ? `Update v${state.version} is available`
          : 'Downloading update…'}
      </span>

      {state.status === 'available' && (
        <button
          type="button"
          aria-label={`Update to version ${state.version}`}
          className="bg-electric-yellow text-deep-blue hover:bg-electric-yellow/80 flex-shrink-0 rounded px-3 py-1 text-xs font-medium transition-colors"
          onClick={handleInstall}
        >
          Update Now
        </button>
      )}

      {state.status === 'available' && (
        <button
          type="button"
          aria-label="Dismiss update notification"
          className="text-fg-muted hover:bg-surface-muted hover:text-fg flex-shrink-0 rounded p-1 transition-colors"
          onClick={handleDismiss}
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      )}

      {state.status === 'downloading' && (
        <div className="bg-surface-muted h-1.5 w-24 flex-shrink-0 overflow-hidden rounded-full">
          <div
            className={clsx(
              'bg-electric-yellow h-full rounded-full transition-all duration-300',
              state.contentLength === 0 && 'animate-pulse'
            )}
            style={{
              width:
                state.contentLength > 0
                  ? `${Math.min(100, Math.round((state.progressBytes / state.contentLength) * 100))}%`
                  : '100%',
            }}
          />
        </div>
      )}
    </div>
  )
})
