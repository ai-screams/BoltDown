import type { EditorView } from '@codemirror/view'
import { useEffect, useEffectEvent, useRef, type RefObject } from 'react'

import { useEditorView } from '@/contexts/EditorViewContext'

interface UseSplitScrollSyncOptions {
  enabled: boolean
  previewScrollRef: RefObject<HTMLDivElement | null>
}

interface ScrollAnchor {
  editorTop: number // Y position in editor coordinate space (pixels from top of content)
  previewTop: number // Y position in preview coordinate space (pixels from top of content)
}

type SyncDriver = 'editor' | 'preview'

const DRIVER_LOCK_MS = 160
const SCROLL_EPSILON_PX = 1

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getScrollableHeight(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight)
}

/**
 * Generic binary search for lower bound.
 * Returns the index of the first element where getValue(item) >= value.
 */
function lowerBound<T>(items: readonly T[], value: number, getValue: (item: T) => number): number {
  let low = 0
  let high = items.length

  while (low < high) {
    const mid = (low + high) >> 1
    if (getValue(items[mid]!) < value) {
      low = mid + 1
    } else {
      high = mid
    }
  }

  return low
}

/**
 * Build scroll anchors by mapping editor line positions to preview Y coordinates.
 * Queries all [data-source-line] elements in the preview pane.
 */
function buildScrollAnchors(view: EditorView, previewScrollEl: HTMLDivElement): ScrollAnchor[] {
  const nodes = previewScrollEl.querySelectorAll<HTMLElement>('[data-source-line]')
  if (nodes.length === 0) return []

  const previewRect = previewScrollEl.getBoundingClientRect()
  const editorTopToPreviewTop = new Map<number, number>()

  for (const node of nodes) {
    const rawLine = node.dataset['sourceLine']
    if (!rawLine) continue

    const lineNumber = Number.parseInt(rawLine, 10)
    if (!Number.isFinite(lineNumber) || lineNumber < 1 || lineNumber > view.state.doc.lines) {
      continue
    }

    // Compute previewTop: Y position in preview coordinate space
    const rect = node.getBoundingClientRect()
    const previewTop = rect.top - previewRect.top + previewScrollEl.scrollTop

    // Compute editorTop: Y position in editor coordinate space
    const lineObj = view.state.doc.line(lineNumber)
    const editorTop = view.lineBlockAt(lineObj.from).top

    // Deduplicate by editorTop (keep first/smallest previewTop for same editorTop)
    const prev = editorTopToPreviewTop.get(editorTop)
    if (prev === undefined || previewTop < prev) {
      editorTopToPreviewTop.set(editorTop, previewTop)
    }
  }

  // Sort by editorTop ascending
  return Array.from(editorTopToPreviewTop.entries(), ([editorTop, previewTop]) => ({
    editorTop,
    previewTop,
  })).sort((a, b) => a.editorTop - b.editorTop)
}

/**
 * Generic scroll interpolation function that serves both directions.
 * Maps a scrollTop from one coordinate space to another using anchors.
 *
 * Anchor positions are in content-space (0..contentHeight), but scrollTop
 * only ranges 0..scrollableHeight (= contentHeight - viewportHeight).
 * When the next anchor exceeds fromScrollable, we use (fromScrollable, toScrollable)
 * as the endpoint so the full scroll range maps correctly.
 */
function interpolateScroll(
  scrollTop: number,
  anchors: readonly ScrollAnchor[],
  getFrom: (a: ScrollAnchor) => number,
  getTo: (a: ScrollAnchor) => number,
  fromScrollable: number,
  toScrollable: number
): number {
  if (fromScrollable <= 0 || toScrollable <= 0) return 0

  if (anchors.length < 2) {
    return clamp((scrollTop / fromScrollable) * toScrollable, 0, toScrollable)
  }

  // Find the segment containing scrollTop
  const nextIndex = lowerBound(anchors, scrollTop, getFrom)

  // Determine the previous interpolation point
  let prevFrom = 0
  let prevTo = 0
  if (nextIndex > 0) {
    const prev = anchors[nextIndex - 1]!
    prevFrom = getFrom(prev)
    prevTo = getTo(prev)
  }

  // Determine the next interpolation point
  // If the next anchor exceeds the scrollable range (content-space > scroll-space),
  // use the end of the scrollable range as the endpoint instead.
  let nextFrom = fromScrollable
  let nextTo = toScrollable
  if (nextIndex < anchors.length) {
    const next = anchors[nextIndex]!
    const nf = getFrom(next)
    if (nf <= fromScrollable) {
      nextFrom = nf
      nextTo = getTo(next)
    }
    // else: anchor is beyond scroll range, keep (fromScrollable, toScrollable)
  }

  const fromRange = nextFrom - prevFrom
  if (fromRange <= 0) return clamp(nextTo, 0, toScrollable)

  const ratio = (scrollTop - prevFrom) / fromRange
  return clamp(prevTo + ratio * (nextTo - prevTo), 0, toScrollable)
}

/**
 * Map editor scrollTop to preview scrollTop using anchors.
 */
function mapEditorToPreview(
  editorScrollTop: number,
  anchors: readonly ScrollAnchor[],
  editorScrollable: number,
  previewScrollable: number
): number {
  return interpolateScroll(
    editorScrollTop,
    anchors,
    a => a.editorTop,
    a => a.previewTop,
    editorScrollable,
    previewScrollable
  )
}

/**
 * Map preview scrollTop to editor scrollTop using anchors.
 */
function mapPreviewToEditor(
  previewScrollTop: number,
  anchors: readonly ScrollAnchor[],
  editorScrollable: number,
  previewScrollable: number
): number {
  return interpolateScroll(
    previewScrollTop,
    anchors,
    a => a.previewTop,
    a => a.editorTop,
    previewScrollable,
    editorScrollable
  )
}

/**
 * Track image loads in the preview pane and call onImageLoaded when any image finishes loading.
 * Returns a cleanup function to abort listeners.
 */
function trackImageLoads(previewScrollEl: HTMLDivElement, onImageLoaded: () => void): () => void {
  const controller = new AbortController()
  const signal = controller.signal

  const images = previewScrollEl.querySelectorAll<HTMLImageElement>('img')
  for (const img of images) {
    if (img.complete) continue

    img.addEventListener('load', onImageLoaded, { signal })
    img.addEventListener('error', onImageLoaded, { signal })
  }

  return () => controller.abort()
}

export function useSplitScrollSync({ enabled, previewScrollRef }: UseSplitScrollSyncOptions): void {
  const editorViewRef = useEditorView()

  const anchorsRef = useRef<ScrollAnchor[]>([])
  const anchorsDirtyRef = useRef(true)

  const driverLockRef = useRef<SyncDriver | null>(null)
  const lockTimerRef = useRef<number | null>(null)

  const editorSyncFrameRef = useRef<number | null>(null)
  const previewSyncFrameRef = useRef<number | null>(null)

  // Track the last scrollTop we programmatically set to ignore feedback events
  const lastProgrammaticPreviewTopRef = useRef(-1)
  const lastProgrammaticEditorTopRef = useRef(-1)

  const clearLockTimer = useEffectEvent(() => {
    if (lockTimerRef.current === null) return
    window.clearTimeout(lockTimerRef.current)
    lockTimerRef.current = null
  })

  const lockDriver = useEffectEvent((driver: SyncDriver) => {
    driverLockRef.current = driver
    clearLockTimer()
    lockTimerRef.current = window.setTimeout(() => {
      driverLockRef.current = null
      lockTimerRef.current = null
    }, DRIVER_LOCK_MS)
  })

  const markAnchorsDirty = useEffectEvent(() => {
    anchorsDirtyRef.current = true
  })

  const ensureAnchors = useEffectEvent(() => {
    if (!anchorsDirtyRef.current) return
    const view = editorViewRef.current
    const previewScrollEl = previewScrollRef.current
    if (!view || !previewScrollEl) return
    anchorsRef.current = buildScrollAnchors(view, previewScrollEl)
    anchorsDirtyRef.current = false
  })

  const syncFromEditor = useEffectEvent(() => {
    if (!enabled) return
    if (driverLockRef.current === 'preview') return

    const view = editorViewRef.current
    const previewScrollEl = previewScrollRef.current
    if (!view || !previewScrollEl) return

    ensureAnchors()

    const editorScrollable = getScrollableHeight(view.scrollDOM)
    const previewScrollable = getScrollableHeight(previewScrollEl)
    const targetTop = mapEditorToPreview(
      view.scrollDOM.scrollTop,
      anchorsRef.current,
      editorScrollable,
      previewScrollable
    )
    if (Math.abs(previewScrollEl.scrollTop - targetTop) <= SCROLL_EPSILON_PX) return

    lockDriver('editor')
    lastProgrammaticPreviewTopRef.current = targetTop
    previewScrollEl.scrollTop = targetTop
  })

  const syncFromPreview = useEffectEvent(() => {
    if (!enabled) return
    if (driverLockRef.current === 'editor') return

    const view = editorViewRef.current
    const previewScrollEl = previewScrollRef.current
    if (!view || !previewScrollEl) return

    ensureAnchors()

    const editorScrollable = getScrollableHeight(view.scrollDOM)
    const previewScrollable = getScrollableHeight(previewScrollEl)
    const targetTop = mapPreviewToEditor(
      previewScrollEl.scrollTop,
      anchorsRef.current,
      editorScrollable,
      previewScrollable
    )
    if (Math.abs(view.scrollDOM.scrollTop - targetTop) <= SCROLL_EPSILON_PX) return

    lockDriver('preview')
    lastProgrammaticEditorTopRef.current = targetTop
    view.scrollDOM.scrollTop = targetTop
  })

  const scheduleEditorSync = useEffectEvent(() => {
    if (editorSyncFrameRef.current !== null) return
    editorSyncFrameRef.current = window.requestAnimationFrame(() => {
      editorSyncFrameRef.current = null
      syncFromEditor()
    })
  })

  const schedulePreviewSync = useEffectEvent(() => {
    if (previewSyncFrameRef.current !== null) return
    previewSyncFrameRef.current = window.requestAnimationFrame(() => {
      previewSyncFrameRef.current = null
      syncFromPreview()
    })
  })

  const cancelScheduledFrames = useEffectEvent(() => {
    if (editorSyncFrameRef.current !== null) {
      window.cancelAnimationFrame(editorSyncFrameRef.current)
      editorSyncFrameRef.current = null
    }

    if (previewSyncFrameRef.current !== null) {
      window.cancelAnimationFrame(previewSyncFrameRef.current)
      previewSyncFrameRef.current = null
    }
  })

  useEffect(() => {
    if (!enabled) {
      anchorsRef.current = []
      anchorsDirtyRef.current = true
      driverLockRef.current = null
      cancelScheduledFrames()
      clearLockTimer()
      return
    }

    let disposed = false
    let setupFrame = 0
    let teardown: (() => void) | null = null

    const setup = () => {
      if (disposed || teardown) return

      const view = editorViewRef.current
      const previewScrollEl = previewScrollRef.current
      if (!view || !previewScrollEl) {
        setupFrame = window.requestAnimationFrame(setup)
        return
      }

      // --- Editor scroll detection via RAF poll ---
      // WKWebView (Tauri/macOS) doesn't fire native scroll events on
      // CodeMirror's .cm-scroller. Polling scrollTop is universally reliable.
      let lastEditorScrollTop = view.scrollDOM.scrollTop
      let editorPollRAF = 0

      const pollEditorScroll = () => {
        if (disposed) return
        const st = view.scrollDOM.scrollTop
        if (st !== lastEditorScrollTop) {
          lastEditorScrollTop = st
          // Ignore scroll changes we caused programmatically
          if (Math.abs(st - lastProgrammaticEditorTopRef.current) > SCROLL_EPSILON_PX) {
            scheduleEditorSync()
          }
        }
        editorPollRAF = window.requestAnimationFrame(pollEditorScroll)
      }
      editorPollRAF = window.requestAnimationFrame(pollEditorScroll)

      // --- Preview scroll detection via DOM event ---
      const handlePreviewScroll = () => {
        // Ignore scroll changes we caused programmatically
        if (
          Math.abs(previewScrollEl.scrollTop - lastProgrammaticPreviewTopRef.current) <=
          SCROLL_EPSILON_PX
        ) {
          return
        }
        schedulePreviewSync()
      }

      previewScrollEl.addEventListener('scroll', handlePreviewScroll, { passive: true })

      const mutationObserver = new MutationObserver(() => {
        markAnchorsDirty()
      })

      mutationObserver.observe(previewScrollEl, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'src', 'data-source-line'],
      })

      const resizeObserver = new ResizeObserver(() => {
        markAnchorsDirty()
        scheduleEditorSync()
      })

      resizeObserver.observe(previewScrollEl)
      const previewContent = previewScrollEl.firstElementChild
      if (previewContent instanceof HTMLElement) {
        resizeObserver.observe(previewContent)
      }

      // Track image loads to rebuild anchors when images finish loading
      const cleanupImageTracking = trackImageLoads(previewScrollEl, () => {
        markAnchorsDirty()
        scheduleEditorSync()
      })

      markAnchorsDirty()
      scheduleEditorSync()

      teardown = () => {
        window.cancelAnimationFrame(editorPollRAF)
        previewScrollEl.removeEventListener('scroll', handlePreviewScroll)
        mutationObserver.disconnect()
        resizeObserver.disconnect()
        cleanupImageTracking()
      }
    }

    setup()

    return () => {
      disposed = true
      if (setupFrame !== 0) window.cancelAnimationFrame(setupFrame)
      teardown?.()

      driverLockRef.current = null
      cancelScheduledFrames()
      clearLockTimer()
    }
  }, [enabled, editorViewRef, previewScrollRef])
}
