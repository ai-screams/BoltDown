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
const BOUNDARY_RATIO_EPSILON = 0.001
const BOUNDARY_MIN_TOLERANCE_PX = 2
const BOUNDARY_MAX_TOLERANCE_PX = 12
const OFFSET_DECAY_TAU = 150 // exponential decay time constant in ms
const MAX_SUBLINE_PREVIEW_AMPLIFICATION = 3

interface SourceLineEntry {
  line: number
  contentTop: number
  elementHeight: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getScrollableHeight(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight)
}

function getBoundaryTolerancePx(scrollable: number): number {
  if (scrollable <= 0) return BOUNDARY_MIN_TOLERANCE_PX
  return clamp(
    scrollable * BOUNDARY_RATIO_EPSILON,
    BOUNDARY_MIN_TOLERANCE_PX,
    BOUNDARY_MAX_TOLERANCE_PX
  )
}

function getScrollProgress(scrollTop: number, scrollable: number): number {
  if (scrollable <= 0) return 0
  return clamp(scrollTop / scrollable, 0, 1)
}

function mapAtScrollBounds(
  sourceScrollTop: number,
  sourceScrollable: number,
  targetScrollable: number
): number | null {
  if (sourceScrollable <= 0 || targetScrollable <= 0) return 0

  const tolerancePx = getBoundaryTolerancePx(sourceScrollable)
  const progress = getScrollProgress(sourceScrollTop, sourceScrollable)
  const distanceToTop = Math.max(sourceScrollTop, 0)
  const distanceToBottom = Math.max(sourceScrollable - sourceScrollTop, 0)

  const nearTop = distanceToTop <= tolerancePx || progress <= BOUNDARY_RATIO_EPSILON
  const nearBottom = distanceToBottom <= tolerancePx || progress >= 1 - BOUNDARY_RATIO_EPSILON

  if (nearTop && nearBottom) {
    return distanceToTop <= distanceToBottom ? 0 : targetScrollable
  }

  if (nearTop) return 0
  if (nearBottom) return targetScrollable

  return null
}

function isProgrammaticEcho(current: number, lastProgrammatic: number): boolean {
  return (
    Number.isFinite(lastProgrammatic) && Math.abs(current - lastProgrammatic) <= SCROLL_EPSILON_PX
  )
}

function getEffectivePreviewSublineSpan(editorSpan: number, previewSpan: number): number {
  if (editorSpan <= 0 || previewSpan <= 0) return 0
  return Math.min(previewSpan, editorSpan * MAX_SUBLINE_PREVIEW_AMPLIFICATION)
}

function getEditorLineBlockTop(view: EditorView, lineNumber: number): number {
  const line = view.state.doc.line(lineNumber)
  return view.lineBlockAt(line.from).top
}

function getEditorLineBlockHeight(view: EditorView, lineNumber: number): number {
  const line = view.state.doc.line(lineNumber)
  return Math.max(view.lineBlockAt(line.from).height, SCROLL_EPSILON_PX)
}

function collectSourceLineEntries(
  previewScrollEl: HTMLDivElement,
  maxEditorLineNumber: number
): SourceLineEntry[] {
  const nodes = previewScrollEl.querySelectorAll<HTMLElement>('[data-source-line]')
  if (nodes.length === 0) return []

  const previewRect = previewScrollEl.getBoundingClientRect()
  const entries: SourceLineEntry[] = []

  for (const node of nodes) {
    const rawLine = node.dataset['sourceLine']
    if (!rawLine) continue

    const lineNumber = Number.parseInt(rawLine, 10)
    if (!Number.isFinite(lineNumber) || lineNumber < 1 || lineNumber > maxEditorLineNumber) {
      continue
    }

    const rect = node.getBoundingClientRect()
    entries.push({
      line: lineNumber,
      contentTop: rect.top - previewRect.top + previewScrollEl.scrollTop,
      elementHeight: rect.height,
    })
  }

  return entries
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
 * Find the preview element whose data-source-line is closest to the given line number.
 * Elements are in document order (ascending line numbers), so we can early-exit.
 */
function findClosestSourceLineElement(
  container: HTMLElement,
  lineNumber: number
): HTMLElement | null {
  // Fast path: exact match
  const exact = container.querySelector<HTMLElement>(`[data-source-line="${lineNumber}"]`)
  if (exact) return exact

  const nodes = container.querySelectorAll<HTMLElement>('[data-source-line]')
  if (nodes.length === 0) return null

  let closest: HTMLElement | null = null
  let closestDiff = Infinity

  for (const node of nodes) {
    const raw = node.dataset['sourceLine']
    if (!raw) continue
    const num = Number.parseInt(raw, 10)
    const diff = Math.abs(num - lineNumber)
    if (diff < closestDiff) {
      closestDiff = diff
      closest = node
    }
    // Past target and diverging — stop early
    if (num > lineNumber && diff > closestDiff) break
  }

  return closest
}

/**
 * Map editor scrollTop to preview scrollTop via direct DOM element lookup.
 * More accurate than anchor interpolation around height-asymmetric elements
 * (images, diagrams, math blocks) because it maps through line numbers
 * and uses actual element heights for sub-line positioning.
 *
 * Returns null when no suitable elements are found (caller should fall back
 * to anchor-based interpolation).
 */
function mapEditorToPreviewViaDOM(
  view: EditorView,
  previewScrollEl: HTMLDivElement,
  editorScrollTop: number
): number | null {
  const previewScrollable = getScrollableHeight(previewScrollEl)
  if (previewScrollable <= 0) return null

  // Find the editor line block at the viewport top
  const topBlock = view.lineBlockAtHeight(editorScrollTop)
  const topLineNum = view.state.doc.lineAt(topBlock.from).number

  // Sub-line fraction: how far through this line block the scroll position is
  const subFraction =
    topBlock.height > 0 ? clamp((editorScrollTop - topBlock.top) / topBlock.height, 0, 1) : 0

  const previewRect = previewScrollEl.getBoundingClientRect()

  // Fast path: exact element for the top visible line
  const exact = previewScrollEl.querySelector<HTMLElement>(`[data-source-line="${topLineNum}"]`)
  if (exact) {
    const rect = exact.getBoundingClientRect()
    const contentY = rect.top - previewRect.top + previewScrollEl.scrollTop
    const effectiveSpan = getEffectivePreviewSublineSpan(topBlock.height, rect.height)
    return clamp(contentY + subFraction * effectiveSpan, 0, previewScrollable)
  }

  // No exact match — find bracketing elements (before ≤ topLine < after)
  const entries = collectSourceLineEntries(previewScrollEl, view.state.doc.lines)
  if (entries.length === 0) return null

  let before: SourceLineEntry | null = null
  let after: SourceLineEntry | null = null

  for (const entry of entries) {
    if (entry.line <= topLineNum) {
      before = entry
    } else {
      after = entry
      break // DOM order is ascending, first match after topLine is closest
    }
  }

  if (before && after) {
    const bContentY = before.contentTop
    const aContentY = after.contentTop

    const bEditorTop = getEditorLineBlockTop(view, before.line)
    const aEditorTop = getEditorLineBlockTop(view, after.line)

    const editorRange = aEditorTop - bEditorTop
    if (editorRange > 0) {
      const ratio = clamp((editorScrollTop - bEditorTop) / editorRange, 0, 1)
      return clamp(bContentY + ratio * (aContentY - bContentY), 0, previewScrollable)
    }
  }

  // Edge brackets are better handled by anchor interpolation fallback,
  // which maps full scroll ranges with synthetic endpoints.
  return null
}

/**
 * Map preview scrollTop to editor scrollTop via direct DOM element lookup.
 * Uses the same source-line elements and sub-line cap policy as editor->preview
 * to keep two-way sync behavior stable around oversized generated blocks ([toc], images, diagrams).
 */
function mapPreviewToEditorViaDOM(
  view: EditorView,
  previewScrollEl: HTMLDivElement,
  previewScrollTop: number
): number | null {
  const editorScrollable = getScrollableHeight(view.scrollDOM)
  const entries = collectSourceLineEntries(previewScrollEl, view.state.doc.lines)
  if (entries.length === 0) return null

  let before: SourceLineEntry | null = null
  let after: SourceLineEntry | null = null

  for (const entry of entries) {
    if (entry.contentTop <= previewScrollTop) {
      before = entry
      continue
    }
    after = entry
    break
  }

  if (before) {
    const editorTop = getEditorLineBlockTop(view, before.line)
    const editorSpan = getEditorLineBlockHeight(view, before.line)
    const effectivePreviewSpan = getEffectivePreviewSublineSpan(editorSpan, before.elementHeight)
    const localOffset = previewScrollTop - before.contentTop

    if (effectivePreviewSpan > 0 && localOffset >= 0 && localOffset <= effectivePreviewSpan) {
      const ratio = localOffset / effectivePreviewSpan
      return clamp(editorTop + ratio * editorSpan, 0, editorScrollable)
    }
  }

  if (before && after) {
    const previewRange = after.contentTop - before.contentTop
    if (previewRange > 0) {
      const ratio = clamp((previewScrollTop - before.contentTop) / previewRange, 0, 1)
      const beforeEditorTop = getEditorLineBlockTop(view, before.line)
      const afterEditorTop = getEditorLineBlockTop(view, after.line)
      return clamp(
        beforeEditorTop + ratio * (afterEditorTop - beforeEditorTop),
        0,
        editorScrollable
      )
    }
  }

  // Edge brackets are better handled by anchor interpolation fallback.
  return null
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

/**
 * Smooth scroll animator using RAF-based linear interpolation.
 * Animates scrollTop towards a target position with configurable lerp factor.
 */
class SmoothScroller {
  private target = -1
  private rafId = 0
  private readonly el: HTMLElement
  private readonly alpha: number
  private readonly onFrame: (scrollTop: number) => void

  constructor(el: HTMLElement, onFrame: (scrollTop: number) => void, alpha = 0.25) {
    this.el = el
    this.onFrame = onFrame
    this.alpha = alpha
  }

  scrollTo(target: number): void {
    this.target = target
    if (this.rafId === 0) {
      this.rafId = requestAnimationFrame(this.tick)
    }
  }

  cancel(): void {
    if (this.rafId !== 0) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
  }

  dispose(): void {
    this.cancel()
  }

  private tick = (): void => {
    const current = this.el.scrollTop
    const diff = this.target - current

    if (Math.abs(diff) < SCROLL_EPSILON_PX) {
      this.el.scrollTop = this.target
      this.onFrame(this.target)
      this.rafId = 0
      return
    }

    const next = current + diff * this.alpha
    this.el.scrollTop = next
    this.onFrame(next)
    this.rafId = requestAnimationFrame(this.tick)
  }
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
  const lastProgrammaticPreviewTopRef = useRef<number>(Number.NaN)
  const lastProgrammaticEditorTopRef = useRef<number>(Number.NaN)

  const scrollOffsetRef = useRef(0)
  const scrollOffsetTimeRef = useRef(0)

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

  const previewSmootherRef = useRef<SmoothScroller | null>(null)

  const syncFromEditor = useEffectEvent(() => {
    if (!enabled) return
    if (driverLockRef.current === 'preview') return

    const view = editorViewRef.current
    const previewScrollEl = previewScrollRef.current
    if (!view || !previewScrollEl) return

    const editorScrollTop = view.scrollDOM.scrollTop
    const editorScrollable = getScrollableHeight(view.scrollDOM)
    const previewScrollable = getScrollableHeight(previewScrollEl)

    const boundaryTarget = mapAtScrollBounds(editorScrollTop, editorScrollable, previewScrollable)

    // Endpoint clamp guarantees full-range reachability.
    let targetTop = boundaryTarget
    if (targetTop === null) {
      // DOM-based mapping: accurate around height-asymmetric elements (images, diagrams)
      targetTop = mapEditorToPreviewViaDOM(view, previewScrollEl, editorScrollTop)
      if (targetTop === null) {
        ensureAnchors()
        targetTop = mapEditorToPreview(
          editorScrollTop,
          anchorsRef.current,
          editorScrollable,
          previewScrollable
        )
      }
    }

    if (boundaryTarget === null && scrollOffsetRef.current !== 0) {
      const elapsed = window.performance.now() - scrollOffsetTimeRef.current
      const decay = Math.exp(-elapsed / OFFSET_DECAY_TAU)
      if (decay < 0.01) {
        scrollOffsetRef.current = 0
      } else {
        targetTop += scrollOffsetRef.current * decay
        targetTop = clamp(targetTop, 0, previewScrollable)
      }
    }

    if (Math.abs(previewScrollEl.scrollTop - targetTop) <= SCROLL_EPSILON_PX) return

    lockDriver('editor')
    previewSmootherRef.current?.scrollTo(targetTop)
  })

  const syncFromPreview = useEffectEvent(() => {
    if (!enabled) return
    if (driverLockRef.current === 'editor') return

    const view = editorViewRef.current
    const previewScrollEl = previewScrollRef.current
    if (!view || !previewScrollEl) return

    const editorScrollable = getScrollableHeight(view.scrollDOM)
    const previewScrollTop = previewScrollEl.scrollTop
    const previewScrollable = getScrollableHeight(previewScrollEl)

    const boundaryTarget = mapAtScrollBounds(previewScrollTop, previewScrollable, editorScrollable)

    let targetTop = boundaryTarget
    if (targetTop === null) {
      targetTop = mapPreviewToEditorViaDOM(view, previewScrollEl, previewScrollTop)
      if (targetTop === null) {
        ensureAnchors()
        targetTop = mapPreviewToEditor(
          previewScrollTop,
          anchorsRef.current,
          editorScrollable,
          previewScrollable
        )
      }
    }
    if (Math.abs(view.scrollDOM.scrollTop - targetTop) <= SCROLL_EPSILON_PX) return

    lockDriver('preview')
    lastProgrammaticEditorTopRef.current = targetTop
    view.scrollDOM.scrollTop = targetTop
  })

  /**
   * Cursor-click sync: when the user clicks in the editor (no scroll change),
   * scroll the preview so the rendered content appears at the same viewport-relative position.
   */
  const syncCursorToPreview = useEffectEvent(() => {
    if (!enabled) return

    const view = editorViewRef.current
    const previewScrollEl = previewScrollRef.current
    if (!view || !previewScrollEl) return

    const head = view.state.selection.main.head
    const lineNumber = view.state.doc.lineAt(head).number
    const target = findClosestSourceLineElement(previewScrollEl, lineNumber)
    if (!target) return

    // Cursor's viewport-relative fraction (0 = top, 1 = bottom)
    const lineBlock = view.lineBlockAt(head)
    const cursorViewportOffset = lineBlock.top - view.scrollDOM.scrollTop
    const editorViewportHeight = view.scrollDOM.clientHeight
    const cursorFraction = clamp(cursorViewportOffset / editorViewportHeight, 0, 1)

    // Target element's content-space Y in preview
    const previewRect = previewScrollEl.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const targetContentY = targetRect.top - previewRect.top + previewScrollEl.scrollTop

    // Scroll preview so target appears at the same viewport fraction as cursor
    const previewScrollable = getScrollableHeight(previewScrollEl)
    const targetScrollTop = clamp(
      targetContentY - cursorFraction * previewScrollEl.clientHeight,
      0,
      previewScrollable
    )

    if (Math.abs(previewScrollEl.scrollTop - targetScrollTop) <= SCROLL_EPSILON_PX) return

    // Compute and store offset between click target and scroll-sync target
    let scrollSyncTarget = mapEditorToPreviewViaDOM(view, previewScrollEl, view.scrollDOM.scrollTop)
    if (scrollSyncTarget === null) {
      ensureAnchors()
      const editorScrollable = getScrollableHeight(view.scrollDOM)
      scrollSyncTarget = mapEditorToPreview(
        view.scrollDOM.scrollTop,
        anchorsRef.current,
        editorScrollable,
        previewScrollable
      )
    }
    scrollOffsetRef.current = targetScrollTop - scrollSyncTarget
    scrollOffsetTimeRef.current = window.performance.now()

    lockDriver('editor')
    previewSmootherRef.current?.scrollTo(targetScrollTop)
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

  const resetTransientSyncState = useEffectEvent(() => {
    driverLockRef.current = null
    clearLockTimer()
    cancelScheduledFrames()
    scrollOffsetRef.current = 0
    scrollOffsetTimeRef.current = 0
    lastProgrammaticPreviewTopRef.current = Number.NaN
    lastProgrammaticEditorTopRef.current = Number.NaN
  })

  useEffect(() => {
    if (!enabled) {
      anchorsRef.current = []
      anchorsDirtyRef.current = true
      resetTransientSyncState()
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

      // Keep programmatic guards clear so first real scroll after re-entry is never suppressed.
      lastProgrammaticEditorTopRef.current = Number.NaN
      lastProgrammaticPreviewTopRef.current = Number.NaN
      scrollOffsetRef.current = 0
      scrollOffsetTimeRef.current = window.performance.now()

      // --- Editor scroll detection via RAF poll ---
      // WKWebView (Tauri/macOS) doesn't fire native scroll events on
      // CodeMirror's .cm-scroller. Polling scrollTop is universally reliable.
      // Resolve view/scrollDOM on every frame so sync survives editor remounts
      // (e.g. mode changes source <-> split).
      let polledEditorScrollEl: HTMLElement | null = view.scrollDOM
      let lastEditorScrollTop = polledEditorScrollEl.scrollTop
      let editorPollRAF = 0

      const pollEditorScroll = () => {
        if (disposed) return

        const currentView = editorViewRef.current
        const currentEditorScrollEl = currentView?.scrollDOM ?? null

        if (currentEditorScrollEl !== polledEditorScrollEl) {
          polledEditorScrollEl = currentEditorScrollEl
          lastEditorScrollTop = currentEditorScrollEl?.scrollTop ?? 0
        }

        const st = currentEditorScrollEl?.scrollTop
        if (st === undefined) {
          editorPollRAF = window.requestAnimationFrame(pollEditorScroll)
          return
        }

        if (st !== lastEditorScrollTop) {
          lastEditorScrollTop = st
          // Ignore scroll changes we caused programmatically
          if (!isProgrammaticEcho(st, lastProgrammaticEditorTopRef.current)) {
            scheduleEditorSync()
          }
        }
        editorPollRAF = window.requestAnimationFrame(pollEditorScroll)
      }
      editorPollRAF = window.requestAnimationFrame(pollEditorScroll)

      // --- Initialize smooth scroller ---
      previewSmootherRef.current = new SmoothScroller(
        previewScrollEl,
        (scrollTop: number) => {
          lastProgrammaticPreviewTopRef.current = scrollTop
        },
        0.25
      )

      // --- Preview scroll detection via DOM event ---
      const handlePreviewScroll = () => {
        // Ignore scroll changes we caused programmatically
        if (isProgrammaticEcho(previewScrollEl.scrollTop, lastProgrammaticPreviewTopRef.current)) {
          return
        }
        // Cancel smooth scroll animation when user manually scrolls
        previewSmootherRef.current?.cancel()
        scrollOffsetRef.current = 0
        schedulePreviewSync()
      }

      previewScrollEl.addEventListener('scroll', handlePreviewScroll, { passive: true })

      const mutationObserver = new MutationObserver(() => {
        markAnchorsDirty()
        scheduleEditorSync()
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

      // --- Cursor-click sync: click in editor → scroll preview to matching position ---
      let cursorSyncRAF = 0
      const handleEditorMouseUp = () => {
        const scrollTopBefore = view.scrollDOM.scrollTop
        cancelAnimationFrame(cursorSyncRAF)
        cursorSyncRAF = window.requestAnimationFrame(() => {
          // Only cursor-sync if the click didn't cause a scroll (scroll sync handles that case)
          if (Math.abs(view.scrollDOM.scrollTop - scrollTopBefore) <= SCROLL_EPSILON_PX) {
            syncCursorToPreview()
          }
        })
      }

      view.scrollDOM.addEventListener('mouseup', handleEditorMouseUp)

      markAnchorsDirty()
      scheduleEditorSync()

      let initialSyncFrame = window.requestAnimationFrame(() => {
        initialSyncFrame = window.requestAnimationFrame(() => {
          markAnchorsDirty()
          scheduleEditorSync()
        })
      })

      teardown = () => {
        window.cancelAnimationFrame(editorPollRAF)
        window.cancelAnimationFrame(cursorSyncRAF)
        window.cancelAnimationFrame(initialSyncFrame)
        view.scrollDOM.removeEventListener('mouseup', handleEditorMouseUp)
        previewScrollEl.removeEventListener('scroll', handlePreviewScroll)
        mutationObserver.disconnect()
        resizeObserver.disconnect()
        cleanupImageTracking()
        previewSmootherRef.current?.dispose()
        previewSmootherRef.current = null
      }
    }

    setup()

    return () => {
      disposed = true
      if (setupFrame !== 0) window.cancelAnimationFrame(setupFrame)
      teardown?.()
      resetTransientSyncState()
    }
  }, [enabled, editorViewRef, previewScrollRef])
}
