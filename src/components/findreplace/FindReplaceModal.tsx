import {
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  SearchQuery,
  selectMatches,
  setSearchQuery,
} from '@codemirror/search'
import { Compartment, EditorSelection, StateEffect, type Text } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { clsx } from 'clsx'
import { ArrowRightLeft, ChevronDown, ChevronRight, ChevronUp, Search, X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import {
  FIND_REPLACE_ERRORS,
  FIND_REPLACE_SEARCH_POLICY,
  REGEX_SAFETY_POLICY,
} from '@/constants/findReplace'
import { useEditorView } from '@/contexts/EditorViewContext'
import { useFindReplaceStore } from '@/stores/findReplaceStore'

function validateRegexComplexity(pattern: string): string | null {
  if (pattern.length > REGEX_SAFETY_POLICY.maxPatternLength) {
    return `Pattern too long (max ${REGEX_SAFETY_POLICY.maxPatternLength} chars)`
  }

  const groupCount = (pattern.match(/\(/g) || []).length
  if (groupCount > REGEX_SAFETY_POLICY.maxCaptureGroups) {
    return `Pattern too complex (max ${REGEX_SAFETY_POLICY.maxCaptureGroups} groups)`
  }

  for (const dangerous of REGEX_SAFETY_POLICY.dangerousPatterns) {
    if (dangerous.test(pattern)) return 'Pattern may cause performance issues'
  }
  return null
}

// --- Types ---
interface MatchInfo {
  from: number
  to: number
  line: number
  lineFrom: number
  text: string
}

// --- Helpers ---
function getMatches(doc: Text, query: SearchQuery): MatchInfo[] {
  const matches: MatchInfo[] = []
  const cursor = query.getCursor(doc)
  const startTime = window.performance.now()
  let result = cursor.next()
  while (!result.done) {
    if (window.performance.now() - startTime > FIND_REPLACE_SEARCH_POLICY.timeoutMs) {
      throw new Error(FIND_REPLACE_ERRORS.timeout)
    }
    // Defer line info — store only positions for non-displayed matches
    matches.push({
      from: result.value.from,
      to: result.value.to,
      line: -1,
      lineFrom: -1,
      text: '',
    })
    if (matches.length >= FIND_REPLACE_SEARCH_POLICY.maxTotalMatches) break
    result = cursor.next()
  }
  // Populate line info only for displayed matches (lazy)
  const limit = Math.min(matches.length, FIND_REPLACE_SEARCH_POLICY.maxResultsDisplay)
  for (let i = 0; i < limit; i++) {
    const m = matches[i]!
    const line = doc.lineAt(m.from)
    m.line = line.number
    m.lineFrom = line.from
    m.text = line.text
  }
  return matches
}

function highlightMatch(
  text: string,
  from: number,
  to: number,
  lineStart: number
): React.ReactNode {
  const matchFrom = Math.max(0, from - lineStart)
  const matchTo = Math.min(text.length, to - lineStart)
  if (matchFrom >= matchTo) return text
  return (
    <>
      {text.slice(0, matchFrom)}
      <mark className="rounded-sm bg-electric-yellow/40 px-0.5 dark:bg-electric-yellow/30">
        {text.slice(matchFrom, matchTo)}
      </mark>
      {text.slice(matchTo)}
    </>
  )
}

// --- Memoized match row (M6: reduce reconciliation) ---
interface MatchRowProps {
  match: MatchInfo
  isActive: boolean
  onClick: () => void
}

const MatchRow = memo(function MatchRow({ match, isActive, onClick }: MatchRowProps) {
  return (
    <button
      type="button"
      className={clsx(
        'flex w-full items-start gap-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-muted',
        isActive ? 'border-l-2 border-electric-yellow bg-electric-yellow/10 pl-3.5 pr-4' : 'px-4'
      )}
      onClick={onClick}
    >
      <span className="mt-px min-w-[32px] text-right font-mono text-[10px] text-fg-muted">
        {match.line}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-fg-secondary">
        {highlightMatch(match.text, match.from, match.to, match.lineFrom)}
      </span>
    </button>
  )
})

// --- Main component ---
export default memo(function FindReplaceModal() {
  // H2: Split selectors by concern for better performance
  // 1. UI state (changes on open/close, show/hide replace)
  const { isOpen, showReplace } = useFindReplaceStore(
    useShallow(s => ({
      isOpen: s.isOpen,
      showReplace: s.showReplace,
    }))
  )

  // 2. Search state (changes on user input)
  const { searchText, replaceText, caseSensitive, useRegex, wholeWord } = useFindReplaceStore(
    useShallow(s => ({
      searchText: s.searchText,
      replaceText: s.replaceText,
      caseSensitive: s.caseSensitive,
      useRegex: s.useRegex,
      wholeWord: s.wholeWord,
    }))
  )

  // 3. Actions (referentially stable, no useShallow needed)
  const close = useFindReplaceStore(s => s.close)
  const setSearchText = useFindReplaceStore(s => s.setSearchText)
  const setReplaceText = useFindReplaceStore(s => s.setReplaceText)
  const toggleCaseSensitive = useFindReplaceStore(s => s.toggleCaseSensitive)
  const toggleRegex = useFindReplaceStore(s => s.toggleRegex)
  const toggleReplace = useFindReplaceStore(s => s.toggleReplace)
  const toggleWholeWord = useFindReplaceStore(s => s.toggleWholeWord)

  const editorViewRef = useEditorView()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const listenerCompartmentRef = useRef(new Compartment())
  const listenerViewRef = useRef<EditorView | null>(null)
  const statusTimerRef = useRef<number | null>(null)

  const [matches, setMatches] = useState<MatchInfo[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [regexError, setRegexError] = useState<string | null>(null)
  const [docVersion, setDocVersion] = useState(0)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // M1: buildQuery without replaceText dependency — read from store when needed
  const buildQuery = useCallback(
    (search: string, replace?: string) => {
      const finalReplace = replace ?? useFindReplaceStore.getState().replaceText
      return new SearchQuery({
        search,
        caseSensitive,
        regexp: useRegex,
        wholeWord,
        replace: finalReplace,
      })
    },
    [caseSensitive, useRegex, wholeWord]
  )

  // Debounced search sync to CM6
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      const view = editorViewRef.current
      if (!view) return

      if (!searchText) {
        view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: '' })) })
        setMatches([])
        setCurrentIndex(-1)
        setRegexError(null)
        return
      }

      // H3: ReDoS validation before search
      if (useRegex) {
        const regexIssue = validateRegexComplexity(searchText)
        if (regexIssue) {
          setRegexError(regexIssue)
          setMatches([])
          setCurrentIndex(-1)
          return
        }
      }

      try {
        const query = buildQuery(searchText)
        view.dispatch({ effects: setSearchQuery.of(query) })
        try {
          const found = getMatches(view.state.doc, query)
          setMatches(found)
          setCurrentIndex(found.length > 0 ? 0 : -1)
          setRegexError(null)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Search failed'
          setRegexError(msg)
          setMatches([])
          setCurrentIndex(-1)
        }
      } catch {
        setRegexError(FIND_REPLACE_ERRORS.invalidRegex)
        setMatches([])
        setCurrentIndex(-1)
      }
    }, FIND_REPLACE_SEARCH_POLICY.debounceMs)
    return () => clearTimeout(timer)
  }, [
    searchText,
    caseSensitive,
    useRegex,
    wholeWord,
    isOpen,
    buildQuery,
    editorViewRef,
    docVersion,
  ])

  // C1: CM6 update listener with compartment-based cleanup
  useEffect(() => {
    if (!isOpen) return
    const view = editorViewRef.current
    if (!view) return
    const listenerCompartment = listenerCompartmentRef.current

    if (listenerViewRef.current !== view) {
      view.dispatch({
        effects: StateEffect.appendConfig.of(listenerCompartment.of([])),
      })
      listenerViewRef.current = view
    }

    view.dispatch({
      effects: listenerCompartment.reconfigure(
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            setDocVersion(v => v + 1)
          }
        })
      ),
    })

    return () => {
      if (listenerViewRef.current === view) {
        view.dispatch({ effects: listenerCompartment.reconfigure([]) })
      }
    }
  }, [isOpen, editorViewRef])

  // Focus search input on open + auto-fill selected text (C1)
  useEffect(() => {
    if (isOpen) {
      const view = editorViewRef.current
      if (view) {
        const { from, to } = view.state.selection.main
        if (from !== to) {
          const selectedText = view.state.doc.sliceString(from, to)
          if (!selectedText.includes('\n')) {
            setSearchText(selectedText)
          }
        }
      }
      requestAnimationFrame(() => {
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      })
    }
  }, [isOpen, editorViewRef, setSearchText])

  // Clear CM6 highlights on close
  const handleClose = useCallback(() => {
    const view = editorViewRef.current
    if (view) {
      view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: '' })) })
      view.focus()
    }
    close()
  }, [close, editorViewRef])

  // Global Escape listener — works regardless of focus location
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        handleClose()
      }
    }
    window.addEventListener('keydown', handleEscape, true)
    return () => window.removeEventListener('keydown', handleEscape, true)
  }, [isOpen, handleClose])

  // H1: Derive currentIndex from cursor with requestAnimationFrame
  const syncIndexFromCursor = useCallback(
    (view: EditorView) => {
      requestAnimationFrame(() => {
        const cursorPos = view.state.selection.main.from
        const idx = matches.findIndex(m => m.from === cursorPos)
        setCurrentIndex(idx >= 0 ? idx : -1)
      })
    },
    [matches]
  )

  // Navigation
  const handleFindNext = useCallback(() => {
    const view = editorViewRef.current
    if (!view || matches.length === 0) return
    findNext(view)
    syncIndexFromCursor(view)
  }, [editorViewRef, matches.length, syncIndexFromCursor])

  const handleFindPrev = useCallback(() => {
    const view = editorViewRef.current
    if (!view || matches.length === 0) return
    findPrevious(view)
    syncIndexFromCursor(view)
  }, [editorViewRef, matches.length, syncIndexFromCursor])

  // M2: Replace with actual error surfacing
  const handleReplace = useCallback(() => {
    const view = editorViewRef.current
    if (!view) return
    try {
      replaceNext(view)
      setDocVersion(v => v + 1)
    } catch (e) {
      const message = e instanceof Error ? e.message : FIND_REPLACE_ERRORS.replaceFailed
      console.error('Replace failed:', e)
      setRegexError(message)
    }
  }, [editorViewRef])

  const handleReplaceAll = useCallback(() => {
    const view = editorViewRef.current
    if (!view) return
    try {
      const countBefore = matches.length
      replaceAll(view)
      setDocVersion(v => v + 1)
      setStatusMessage(`${countBefore}개 치환됨`)
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current)
      }
      statusTimerRef.current = window.setTimeout(
        () => setStatusMessage(null),
        FIND_REPLACE_SEARCH_POLICY.statusClearMs
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : FIND_REPLACE_ERRORS.replaceFailed
      console.error('Replace all failed:', e)
      setRegexError(message)
    }
  }, [editorViewRef, matches.length])

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isOpen) return
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current)
      statusTimerRef.current = null
    }
    setStatusMessage(null)
  }, [isOpen])

  // Select all occurrences
  const handleSelectAll = useCallback(() => {
    const view = editorViewRef.current
    if (!view || matches.length === 0) return
    selectMatches(view)
    handleClose()
  }, [editorViewRef, matches.length, handleClose])

  // Jump to match
  const handleJumpTo = useCallback(
    (match: MatchInfo, index: number) => {
      const view = editorViewRef.current
      if (!view) return
      view.dispatch({
        selection: { anchor: match.from, head: match.to },
        effects: EditorView.scrollIntoView(EditorSelection.cursor(match.from), { y: 'center' }),
      })
      setCurrentIndex(index)
    },
    [editorViewRef]
  )

  // Keyboard shortcuts (H2: removed unused handleJumpTo from deps)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
        return
      }

      // A3: Keyboard toggle shortcuts
      if (e.altKey && e.key === 'c') {
        e.preventDefault()
        toggleCaseSensitive()
        return
      }
      if (e.altKey && e.key === 'r') {
        e.preventDefault()
        toggleRegex()
        return
      }
      if (e.altKey && e.key === 'w') {
        e.preventDefault()
        toggleWholeWord()
        return
      }

      // C2: Replace input Enter = Replace
      const isInReplaceInput = document.activeElement === replaceInputRef.current
      if (isInReplaceInput && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleReplace()
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        handleFindNext()
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        handleFindPrev()
        return
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        // Scroll editor to current match without leaving search modal
        const view = editorViewRef.current
        const match = matches[currentIndex]
        if (view && match) {
          view.dispatch({
            selection: { anchor: match.from, head: match.to },
            effects: EditorView.scrollIntoView(EditorSelection.cursor(match.from), { y: 'center' }),
          })
        }
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault()
        handleFindPrev()
      }
    },
    [
      handleClose,
      handleFindNext,
      handleFindPrev,
      handleReplace,
      matches,
      currentIndex,
      editorViewRef,
      toggleCaseSensitive,
      toggleRegex,
      toggleWholeWord,
    ]
  )

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) handleClose()
    },
    [handleClose]
  )

  // Display matches capped at policy limit
  const displayMatches = useMemo(
    () => matches.slice(0, FIND_REPLACE_SEARCH_POLICY.maxResultsDisplay),
    [matches]
  )

  if (!isOpen) return null

  const hasMatches = matches.length > 0
  // M3: Show '-' when cursor is not on any match
  const matchCountText = regexError
    ? regexError
    : searchText
      ? `${currentIndex >= 0 ? currentIndex + 1 : '-'} of ${matches.length}${matches.length >= FIND_REPLACE_SEARCH_POLICY.maxTotalMatches ? '+' : ''}`
      : '0 results'

  return (
    <div
      ref={backdropRef}
      className="z-60 fixed inset-0 flex items-start justify-center overscroll-contain bg-black/40 pt-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="animate-dropdown flex w-[calc(100vw-2rem)] max-w-[560px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex h-12 flex-none items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={showReplace ? 'Hide replace panel' : 'Show replace panel'}
              className="rounded p-0.5 text-fg-muted transition-transform hover:text-fg-secondary"
              title={showReplace ? 'Hide Replace' : 'Show Replace'}
              onClick={toggleReplace}
            >
              <ChevronRight
                aria-hidden="true"
                className={clsx(
                  'h-4 w-4 transition-transform duration-150',
                  showReplace && 'rotate-90'
                )}
              />
            </button>
            <Search aria-hidden="true" className="h-4 w-4 text-fg-muted" />
            <span className="text-sm font-semibold text-fg">
              Find {showReplace ? '& Replace' : ''}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close find and replace"
            className="rounded p-1.5 text-fg-muted transition-[color,background-color,opacity,transform] duration-150 hover:scale-110 hover:bg-surface-muted hover:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95"
            title="Close"
            onClick={handleClose}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {/* Search Row */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-2">
          <input
            ref={searchInputRef}
            type="text"
            aria-label="Find text"
            className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg-secondary placeholder-fg-muted focus-visible:border-electric-yellow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric-yellow/50"
            placeholder="Search…"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />

          {/* Toggle buttons (A1: aria-pressed + aria-label) */}
          <div className="flex gap-0.5">
            <button
              type="button"
              aria-label="Case Sensitive"
              aria-pressed={caseSensitive}
              className={clsx(
                'rounded px-1.5 py-1 text-[10px] font-bold transition-colors',
                caseSensitive
                  ? 'bg-electric-yellow text-deep-blue'
                  : 'text-fg-muted hover:bg-surface-muted hover:text-fg-secondary'
              )}
              title="Case Sensitive (Alt+C)"
              onClick={toggleCaseSensitive}
            >
              Aa
            </button>
            <button
              type="button"
              aria-label="Regular Expression"
              aria-pressed={useRegex}
              className={clsx(
                'rounded px-1.5 py-1 text-[10px] font-bold transition-colors',
                useRegex
                  ? 'bg-electric-yellow text-deep-blue'
                  : 'text-fg-muted hover:bg-surface-muted hover:text-fg-secondary'
              )}
              title="Regular Expression (Alt+R)"
              onClick={toggleRegex}
            >
              .*
            </button>
            <button
              type="button"
              aria-label="Whole Word"
              aria-pressed={wholeWord}
              className={clsx(
                'rounded px-1.5 py-1 text-[10px] font-bold transition-colors',
                wholeWord
                  ? 'bg-electric-yellow text-deep-blue'
                  : 'text-fg-muted hover:bg-surface-muted hover:text-fg-secondary'
              )}
              title="Whole Word (Alt+W)"
              onClick={toggleWholeWord}
            >
              W
            </button>
          </div>

          {/* Match counter (A2: aria-live, Design: font-mono tabular-nums) */}
          <span
            role="status"
            aria-atomic="true"
            aria-live="polite"
            className={clsx(
              'min-w-[80px] text-center font-mono text-[10px] font-medium tabular-nums',
              regexError ? 'text-danger' : 'text-fg-muted'
            )}
          >
            {statusMessage ?? matchCountText}
          </span>

          {/* Prev / Next */}
          <div className="flex gap-0.5">
            <button
              type="button"
              aria-label="Previous match"
              className="rounded p-1 text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg-secondary disabled:opacity-30"
              disabled={!hasMatches}
              title="Previous Match (Shift+Enter)"
              onClick={handleFindPrev}
            >
              <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Next match"
              className="rounded p-1 text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg-secondary disabled:opacity-30"
              disabled={!hasMatches}
              title="Next Match (Enter)"
              onClick={handleFindNext}
            >
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Replace Row */}
        {showReplace && (
          <div className="flex items-center gap-2 border-b border-line px-4 py-2">
            <input
              ref={replaceInputRef}
              type="text"
              aria-label="Replace text"
              className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg-secondary placeholder-fg-muted focus-visible:border-electric-yellow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric-yellow/50"
              placeholder="Replace…"
              value={replaceText}
              onChange={e => setReplaceText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-fg-secondary transition-colors hover:bg-surface-muted hover:text-fg disabled:opacity-30"
              disabled={!hasMatches}
              title="Replace"
              onClick={handleReplace}
            >
              <ArrowRightLeft aria-hidden="true" className="h-3 w-3" />
              Replace
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[10px] font-medium text-fg-secondary transition-colors hover:bg-surface-muted hover:text-fg disabled:opacity-30"
              disabled={!hasMatches}
              title="Replace All"
              onClick={handleReplaceAll}
            >
              Replace All{hasMatches ? ` (${matches.length})` : ''}
            </button>
          </div>
        )}

        {/* Results List */}
        {searchText && (
          <div className="max-h-[240px] overflow-y-auto">
            {displayMatches.length > 0 ? (
              <>
                {displayMatches.map((match, i) => (
                  <MatchRow
                    key={`${match.from}-${match.to}-${match.line}`}
                    isActive={i === currentIndex}
                    match={match}
                    onClick={() => handleJumpTo(match, i)}
                  />
                ))}
                {matches.length > FIND_REPLACE_SEARCH_POLICY.maxResultsDisplay && (
                  <div className="px-4 py-2 text-center text-[10px] text-fg-muted">
                    Showing {FIND_REPLACE_SEARCH_POLICY.maxResultsDisplay} of {matches.length}{' '}
                    matches
                  </div>
                )}
              </>
            ) : (
              !regexError && (
                <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                  <Search aria-hidden="true" className="h-6 w-6 text-fg-muted opacity-50" />
                  <p className="text-xs text-fg-muted">No matches found</p>
                </div>
              )
            )}
          </div>
        )}

        {/* Footer with Select All */}
        {hasMatches && (
          <div className="flex items-center justify-end border-t border-line px-4 py-2">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[10px] font-medium text-fg-secondary transition-colors hover:bg-electric-yellow/10 hover:text-electric-dark"
              onClick={handleSelectAll}
            >
              Select All Occurrences
            </button>
          </div>
        )}
      </div>
    </div>
  )
})
