import type { Range } from '@codemirror/state'
import { Decoration } from '@codemirror/view'

import { createRangeChecker, isSelectionInRange, type DocRange } from './utils'

const SUPPORTED_INLINE_HTML_TAGS = ['u', 'sup', 'sub'] as const

export type SupportedInlineHtmlTag = (typeof SUPPORTED_INLINE_HTML_TAGS)[number]
export type InlineHtmlMarkerType = 'open' | 'close'

export interface InlineHtmlMarker {
  type: InlineHtmlMarkerType
  tag: SupportedInlineHtmlTag
  from: number
  to: number
}

interface InlineHtmlTagPair {
  tag: SupportedInlineHtmlTag
  open: DocRange
  close: DocRange
  content: DocRange
  range: DocRange
}

const MARKER_DIM_STYLE = 'opacity: 0.35;'

const tagContentStyles: Record<SupportedInlineHtmlTag, string> = {
  u: 'text-decoration: underline;',
  sup: 'vertical-align: super; font-size: 0.75em; line-height: 1;',
  sub: 'vertical-align: sub; font-size: 0.75em; line-height: 1;',
}

function isSupportedInlineHtmlTag(tagName: string): tagName is SupportedInlineHtmlTag {
  return (SUPPORTED_INLINE_HTML_TAGS as readonly string[]).includes(tagName)
}

function isRangeExcluded(range: DocRange, excludedRanges: readonly DocRange[]): boolean {
  for (const excludedRange of excludedRanges) {
    if (excludedRange.to <= range.from) continue
    if (excludedRange.from >= range.to) break
    return true
  }

  return false
}

function splitRangeByExcludedRanges(
  range: DocRange,
  excludedRanges: readonly DocRange[]
): DocRange[] {
  const segments: DocRange[] = []
  let currentFrom = range.from

  for (const excludedRange of excludedRanges) {
    if (excludedRange.to <= currentFrom) continue
    if (excludedRange.from >= range.to) break

    const segmentTo = Math.min(excludedRange.from, range.to)
    if (currentFrom < segmentTo) {
      segments.push({ from: currentFrom, to: segmentTo })
    }

    currentFrom = Math.max(currentFrom, excludedRange.to)
    if (currentFrom >= range.to) break
  }

  if (currentFrom < range.to) {
    segments.push({ from: currentFrom, to: range.to })
  }

  return segments
}

function popMatchingOpenMarker(
  stack: InlineHtmlMarker[],
  tag: SupportedInlineHtmlTag
): InlineHtmlMarker | null {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const marker = stack[index]!
    if (marker.tag !== tag) continue

    // Malformed nesting recovery:
    // Drop unmatched inner markers above the matched opener.
    stack.length = index
    return marker
  }

  return null
}

function pairInlineHtmlTagMarkers(
  markers: readonly InlineHtmlMarker[],
  excludedRanges: readonly DocRange[]
): InlineHtmlTagPair[] {
  const sortedMarkers = [...markers].sort((a, b) => a.from - b.from || a.to - b.to)
  const sortedExcludedRanges = [...excludedRanges].sort((a, b) => a.from - b.from)
  const isInExcludedRange = createRangeChecker(sortedExcludedRanges)
  const stack: InlineHtmlMarker[] = []
  const pairs: InlineHtmlTagPair[] = []

  for (const marker of sortedMarkers) {
    if (marker.from >= marker.to) continue

    const markerRange: DocRange = { from: marker.from, to: marker.to }
    if (isInExcludedRange(marker.from) || isInExcludedRange(marker.to - 1)) continue
    if (isRangeExcluded(markerRange, sortedExcludedRanges)) continue

    if (marker.type === 'open') {
      stack.push(marker)
      continue
    }

    const openMarker = popMatchingOpenMarker(stack, marker.tag)
    if (!openMarker) continue

    if (openMarker.to > marker.from) continue

    pairs.push({
      tag: marker.tag,
      open: { from: openMarker.from, to: openMarker.to },
      close: markerRange,
      content: { from: openMarker.to, to: marker.from },
      range: { from: openMarker.from, to: marker.to },
    })
  }

  return pairs
}

export function parseInlineHtmlMarker(
  rawTagText: string,
  from: number,
  to: number
): InlineHtmlMarker | null {
  if (from >= to) return null

  const markerMatch = /^<\s*(\/?)\s*([a-zA-Z][\w:-]*)\b[^>]*>$/.exec(rawTagText)
  if (!markerMatch) return null
  if (/\/\s*>$/.test(rawTagText)) return null

  const tagName = (markerMatch[2] ?? '').toLowerCase()
  if (!isSupportedInlineHtmlTag(tagName)) return null

  return {
    type: (markerMatch[1] ?? '') === '/' ? 'close' : 'open',
    tag: tagName,
    from,
    to,
  }
}

export function appendInlineHtmlTagDecorations(
  decorations: Range<Decoration>[],
  selection: { from: number; to: number },
  markers: readonly InlineHtmlMarker[],
  excludedRanges: readonly DocRange[]
) {
  const sortedExcludedRanges: DocRange[] = [...excludedRanges].sort((a, b) => a.from - b.from)
  const pairs = pairInlineHtmlTagMarkers(markers, sortedExcludedRanges)

  for (const pair of pairs) {
    const revealInline = isSelectionInRange(selection, pair.range.from, pair.range.to)

    const contentSegments = splitRangeByExcludedRanges(pair.content, sortedExcludedRanges)
    for (const contentSegment of contentSegments) {
      decorations.push(
        Decoration.mark({ attributes: { style: tagContentStyles[pair.tag] } }).range(
          contentSegment.from,
          contentSegment.to
        )
      )
    }

    if (!revealInline) {
      decorations.push(Decoration.replace({}).range(pair.open.from, pair.open.to))
      decorations.push(Decoration.replace({}).range(pair.close.from, pair.close.to))
    } else {
      decorations.push(
        Decoration.mark({ attributes: { style: MARKER_DIM_STYLE } }).range(
          pair.open.from,
          pair.open.to
        )
      )
      decorations.push(
        Decoration.mark({ attributes: { style: MARKER_DIM_STYLE } }).range(
          pair.close.from,
          pair.close.to
        )
      )
    }
  }
}
