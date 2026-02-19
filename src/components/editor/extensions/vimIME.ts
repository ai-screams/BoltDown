/**
 * Vim IME auto-switch extension for CodeMirror 6.
 *
 * Two mechanisms:
 * 1. `vim-mode-change` event (synchronous) — switches IME on mode transitions
 * 2. `compositionstart` DOM listener — catches manual IME toggle in Normal mode
 *    and immediately forces ASCII, preventing Korean/CJK input from being composed
 *
 * - Normal/Visual mode → always ASCII (English)
 * - Insert/Replace mode → restore previously saved input source
 */
import type { Extension } from '@codemirror/state'
import { ViewPlugin } from '@codemirror/view'
import { getCM } from '@replit/codemirror-vim'

import { isTauri } from '@/utils/tauri'

// ── Cached invoke (populated eagerly at module load) ──

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>
let cachedInvoke: InvokeFn | null = null

function warmInvokeCache(): void {
  void import('@tauri-apps/api/core').then(
    m => {
      cachedInvoke = m.invoke
    },
    () => {}
  )
}

if (isTauri()) warmInvokeCache()

// ── State ──
// Single-instance assumption: BoltDown runs one EditorView at a time,
// so a module-level variable is safe. If multiple editors are ever
// needed, this should move into per-view plugin state.

let savedInputSource: string | null = null

// ── IME switch helpers (fire-and-forget) ──

function switchToAscii(): void {
  if (cachedInvoke) {
    cachedInvoke('select_ascii_input').catch(() => {})
    return
  }
  void import('@tauri-apps/api/core').then(m => {
    cachedInvoke = m.invoke
    m.invoke('select_ascii_input').catch(() => {})
  })
}

function switchToAsciiAndSave(): void {
  if (cachedInvoke) {
    cachedInvoke<string>('ime_save_and_switch_ascii')
      .then(prev => {
        if (prev && prev !== 'unsupported') savedInputSource = prev
      })
      .catch(() => {})
    return
  }
  void import('@tauri-apps/api/core').then(m => {
    cachedInvoke = m.invoke
    m.invoke<string>('ime_save_and_switch_ascii')
      .then(prev => {
        if (prev && prev !== 'unsupported') savedInputSource = prev
      })
      .catch(() => {})
  })
}

function restoreSavedIME(): void {
  if (!savedInputSource) return
  const sourceId = savedInputSource
  if (cachedInvoke) {
    cachedInvoke('select_input_source', { sourceId }).catch(() => {})
    return
  }
  void import('@tauri-apps/api/core').then(m => {
    cachedInvoke = m.invoke
    m.invoke('select_input_source', { sourceId }).catch(() => {})
  })
}

// ── Helpers ──

function isInsertLike(mode: string): boolean {
  return mode === 'insert' || mode === 'replace'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getVimMode(cm: any): string | null {
  return cm?.state?.vim?.mode ?? null
}

// ── ViewPlugin ──

const vimIMEPlugin = ViewPlugin.define(view => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cm: any = getCM(view)
  let prevInsertLike = false

  // ── 1. vim-mode-change: fires synchronously on mode transitions ──

  const onModeChange = (e: { mode: string }) => {
    const insertLikeNow = isInsertLike(e.mode)
    if (insertLikeNow === prevInsertLike) return

    if (prevInsertLike && !insertLikeNow) {
      switchToAsciiAndSave()
    } else if (!prevInsertLike && insertLikeNow) {
      restoreSavedIME()
    }

    prevInsertLike = insertLikeNow
  }

  // ── 2. compositionstart: catches manual IME toggle in Normal mode ──
  //    If user switches to Korean while in Normal mode and types,
  //    compositionstart fires → we force ASCII immediately.

  const onCompositionStart = () => {
    if (!cm) return
    const mode = getVimMode(cm)
    if (mode && !isInsertLike(mode)) {
      switchToAscii()
    }
  }

  // Register listeners
  if (cm) cm.on('vim-mode-change', onModeChange)
  view.contentDOM.addEventListener('compositionstart', onCompositionStart, { passive: true })

  return {
    update() {
      if (!cm) {
        cm = getCM(view)
        if (cm) cm.on('vim-mode-change', onModeChange)
      }
    },
    destroy() {
      if (cm) cm.off('vim-mode-change', onModeChange)
      view.contentDOM.removeEventListener('compositionstart', onCompositionStart)
    },
  }
})

/**
 * Returns a CM6 extension that auto-switches IME on vim mode changes.
 * Only active when running in Tauri (macOS).
 */
export function vimIMEExtension(): Extension {
  if (!isTauri()) return []
  return vimIMEPlugin
}
