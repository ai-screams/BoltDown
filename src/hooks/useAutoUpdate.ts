import { useEffect, useRef } from 'react'

import { STATUS_TIMEOUT_MS } from '@/constants/feedback'
import { useEditorStore } from '@/stores/editorStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { isTauri } from '@/utils/tauri'

/** Delay before first auto-check after mount (avoids blocking app startup). */
const UPDATE_CHECK_DELAY_MS = 5_000

/** Cooldown before resetting 'up-to-date' status back to idle. */
const UP_TO_DATE_RESET_MS = 3_000

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'error'
  | 'up-to-date'

export interface UpdateState {
  status: UpdateStatus
  version: string
  progressBytes: number
  contentLength: number
  install: (() => Promise<void>) | null
  dismiss: () => void
}

type UpdateListener = (state: UpdateState) => void

// ---------------------------------------------------------------------------
// Module-level pub/sub state (same pattern as editorStore's module-level timer)
// ---------------------------------------------------------------------------

let currentState: UpdateState = {
  status: 'idle',
  version: '',
  progressBytes: 0,
  contentLength: 0,
  install: null,
  dismiss: () => {},
}

let upToDateTimer: ReturnType<typeof setTimeout> | null = null

const listeners = new Set<UpdateListener>()

function notify(patch: Partial<UpdateState>): void {
  currentState = { ...currentState, ...patch }
  listeners.forEach(fn => fn(currentState))
}

/** Subscribe to update state changes. Returns unsubscribe function. */
export function subscribeUpdate(fn: UpdateListener): () => void {
  listeners.add(fn)
  fn(currentState)
  return () => {
    listeners.delete(fn)
  }
}

/** Read current update state snapshot (non-reactive). */
export function getUpdateState(): UpdateState {
  return currentState
}

// ---------------------------------------------------------------------------
// Core check / install logic
// ---------------------------------------------------------------------------

async function checkForUpdate(): Promise<void> {
  if (!isTauri()) return
  if (currentState.status === 'checking' || currentState.status === 'downloading') return

  if (upToDateTimer) {
    clearTimeout(upToDateTimer)
    upToDateTimer = null
  }

  const flash = useEditorStore.getState().flashStatus

  notify({ status: 'checking' })

  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()

    if (update) {
      notify({
        status: 'available',
        version: update.version,
        install: async () => {
          notify({ status: 'downloading', progressBytes: 0, contentLength: 0 })

          try {
            const { relaunch } = await import('@tauri-apps/plugin-process')

            await update.downloadAndInstall(event => {
              switch (event.event) {
                case 'Started':
                  notify({ progressBytes: 0, contentLength: event.data.contentLength ?? 0 })
                  break
                case 'Progress': {
                  const bytes = currentState.progressBytes + event.data.chunkLength
                  notify({ progressBytes: bytes })
                  break
                }
                case 'Finished':
                  notify({ progressBytes: currentState.contentLength })
                  break
              }
            })

            flash('Update installed. Restarting…', STATUS_TIMEOUT_MS.default)
            await relaunch()
          } catch (err) {
            console.error('[auto-update] install failed:', err)
            notify({ status: 'error' })
            flash(
              `Update failed: ${err instanceof Error ? err.message : String(err)}`,
              STATUS_TIMEOUT_MS.critical
            )
          }
        },
        dismiss: () =>
          notify({
            status: 'idle',
            version: '',
            progressBytes: 0,
            contentLength: 0,
            install: null,
          }),
      })

      flash(`Update v${update.version} available`, STATUS_TIMEOUT_MS.warning)
    } else {
      notify({ status: 'up-to-date' })
      flash('You are on the latest version', STATUS_TIMEOUT_MS.default)
      upToDateTimer = setTimeout(() => {
        upToDateTimer = null
        if (currentState.status === 'up-to-date') {
          notify({ status: 'idle' })
        }
      }, UP_TO_DATE_RESET_MS)
    }
  } catch (err) {
    console.error('[auto-update] check failed:', err)
    notify({ status: 'error' })
    // Silent on auto-check failure — flash only on manual trigger
  }
}

export { checkForUpdate }

// ---------------------------------------------------------------------------
// Hook — mount once in App.tsx
// ---------------------------------------------------------------------------

/**
 * useAutoUpdate — checks for app updates on mount (with delay) when autoUpdate is enabled.
 * Dynamic-imports `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` for tree-shaking
 * and safe browser-dev-mode operation. Mount once in App.tsx.
 */
export default function useAutoUpdate(): void {
  const autoUpdate = useSettingsStore(s => s.settings.general.autoUpdate)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!autoUpdate || !isTauri()) return

    timerRef.current = setTimeout(() => {
      void checkForUpdate()
    }, UPDATE_CHECK_DELAY_MS)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [autoUpdate])
}
