import {
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  SearchQuery,
  selectMatches,
  setSearchQuery,
} from '@codemirror/search'
import { EditorSelection, StateEffect, type Text } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { clsx } from 'clsx'
import { ArrowRightLeft, ChevronDown, ChevronRight, ChevronUp, Search, X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useEditorView } from '@/contexts/EditorViewContext'
import { useFindReplaceStore } from '@/stores/findReplaceStore'

// --- Constants ---
const MAX_RESULTS_DISPLAY = 200
const MAX_TOTAL_MATCHES = 10000
const SEARCH_DEBOUNCE_MS = 150
const SEARCH_TIMEOUT_MS = 2000
const ERROR_INVALID_REGEX = 'Invalid regex'
const ERROR_REPLACE_FAILED = 'Replace failed'

// --- ReDoS protection ---
const DANGEROUS_REGEX_PATTERNS = [
  /\(.*[+*]\)(?:[+*]|\{)/, // (a+)+ or (a*)*
  /\((?:[^()]*\|){3,}[^()]*\)/, // (a|b|c|d)+ excessive alternation
]
const MAX_REGEX_LENGTH = 500
const MAX_REGEX_GROUPS = 10

function validateRegexComplexity(pattern: string): string | null {
  if (pattern.length > MAX_REGEX_LENGTH) return `Pattern too long (max ${MAX_REGEX_LENGTH} chars)`
  const groupCount = (pattern.match(/\(/g) || []).length
  if (groupCount > MAX_REGEX_GROUPS) return `Pattern too complex (max ${MAX_REGEX_GROUPS} groups)`
  for (const dangerous of DANGEROUS_REGEX_PATTERNS) {
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
    if (window.performance.now() - startTime > SEARCH_TIMEOUT_MS) {
      throw new Error('Search timeout — pattern may be too complex')
    }
    // Defer line info — store only positions for non-displayed matches
    matches.push({
      from: result.value.from,
      to: result.value.to,
      line: -1,
      lineFrom: -1,
      text: '',
    })
    if (matches.length >= MAX_TOTAL_MATCHES) break
    result = cursor.next()
  }
  // Populate line info only for displayed matches (lazy)
  const limit = Math.min(matches.length, MAX_RESULTS_DISPLAY)
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
      onClick={onClick}
      className={clsx(
        'flex w-full items-start gap-2 py-1.5 text-left text-xs transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50',
        isActive ? 'border-l-2 border-electric-yellow bg-electric-yellow/10 pl-3.5 pr-4' : 'px-4'
      )}
    >
      <span className="mt-px min-w-[32px] text-right font-mono text-[10px] text-gray-400 dark:text-gray-500">
        {match.line}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-gray-700 dark:text-gray-300">
        {highlightMatch(match.text, match.from, match.to, match.lineFrom)}
      </span>
    </button>
  )
})

// --- Main component ---
export default memo(function FindReplaceModal() {
  // H4: Single shallow selector for Zustand
  const {
    isOpen,
    showReplace,
    searchText,
    replaceText,
    caseSensitive,
    useRegex,
    wholeWord,
    close,
    setSearchText,
    setReplaceText,
    toggleCaseSensitive,
    toggleRegex,
    toggleReplace,
    toggleWholeWord,
  } = useFindReplaceStore(
    useShallow(s => ({
      isOpen: s.isOpen,
      showReplace: s.showReplace,
      searchText: s.searchText,
      replaceText: s.replaceText,
      caseSensitive: s.caseSensitive,
      useRegex: s.useRegex,
      wholeWord: s.wholeWord,
      close: s.close,
      setSearchText: s.setSearchText,
      setReplaceText: s.setReplaceText,
      toggleCaseSensitive: s.toggleCaseSensitive,
      toggleRegex: s.toggleRegex,
      toggleReplace: s.toggleReplace,
      toggleWholeWord: s.toggleWholeWord,
    }))
  )

  const editorViewRef = useEditorView()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const isOpenRef = useRef(isOpen)
  const listenerInstalledRef = useRef(false)

  const [matches, setMatches] = useState<MatchInfo[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [regexError, setRegexError] = useState<string | null>(null)
  const [docVersion, setDocVersion] = useState(0)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Keep ref in sync
  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

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
        setRegexError(ERROR_INVALID_REGEX)
        setMatches([])
        setCurrentIndex(-1)
      }
    }, SEARCH_DEBOUNCE_MS)
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

  // C1: Replace polling with CM6 update listener via StateEffect.appendConfig
  useEffect(() => {
    if (!isOpen) return
    const view = editorViewRef.current
    if (!view || listenerInstalledRef.current) return

    // Install a permanent lightweight listener that checks the isOpenRef
    view.dispatch({
      effects: StateEffect.appendConfig.of(
        EditorView.updateListener.of(update => {
          if (update.docChanged && isOpenRef.current) {
            setDocVersion(v => v + 1)
          }
        })
      ),
    })
    listenerInstalledRef.current = true
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
      const message = e instanceof Error ? e.message : ERROR_REPLACE_FAILED
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
      setTimeout(() => setStatusMessage(null), 2000)
    } catch (e) {
      const message = e instanceof Error ? e.message : ERROR_REPLACE_FAILED
      console.error('Replace all failed:', e)
      setRegexError(message)
    }
  }, [editorViewRef, matches.length])

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

  // Display matches capped at MAX_RESULTS_DISPLAY
  const displayMatches = useMemo(() => matches.slice(0, MAX_RESULTS_DISPLAY), [matches])

  if (!isOpen) return null

  const hasMatches = matches.length > 0
  // M3: Show '-' when cursor is not on any match
  const matchCountText = regexError
    ? regexError
    : searchText
      ? `${currentIndex >= 0 ? currentIndex + 1 : '-'} of ${matches.length}${matches.length >= MAX_TOTAL_MATCHES ? '+' : ''}`
      : '0 results'

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="z-60 fixed inset-0 flex items-start justify-center bg-black/40 pt-4 backdrop-blur-sm"
    >
      <div
        className="animate-dropdown flex w-[calc(100vw-2rem)] max-w-[560px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex h-12 flex-none items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleReplace}
              className="rounded p-0.5 text-gray-400 transition-transform hover:text-gray-600 dark:hover:text-gray-300"
              title={showReplace ? 'Hide Replace' : 'Show Replace'}
            >
              <ChevronRight
                className={clsx(
                  'h-4 w-4 transition-transform duration-150',
                  showReplace && 'rotate-90'
                )}
              />
            </button>
            <Search className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Find {showReplace ? '& Replace' : ''}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="rounded p-1.5 text-gray-500 transition-all duration-150 hover:scale-110 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-yellow/50 active:scale-95 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Row */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2 dark:border-gray-700/50">
          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search..."
            className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 placeholder-gray-400 focus:border-electric-yellow focus:outline-none focus:ring-1 focus:ring-electric-yellow/50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-500"
          />

          {/* Toggle buttons (A1: aria-pressed + aria-label) */}
          <div className="flex gap-0.5">
            <button
              onClick={toggleCaseSensitive}
              title="Case Sensitive (Alt+C)"
              aria-pressed={caseSensitive}
              aria-label="Case Sensitive"
              className={clsx(
                'rounded px-1.5 py-1 text-[10px] font-bold transition-colors',
                caseSensitive
                  ? 'bg-electric-yellow text-deep-blue'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300'
              )}
            >
              Aa
            </button>
            <button
              onClick={toggleRegex}
              title="Regular Expression (Alt+R)"
              aria-pressed={useRegex}
              aria-label="Regular Expression"
              className={clsx(
                'rounded px-1.5 py-1 text-[10px] font-bold transition-colors',
                useRegex
                  ? 'bg-electric-yellow text-deep-blue'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300'
              )}
            >
              .*
            </button>
            <button
              onClick={toggleWholeWord}
              title="Whole Word (Alt+W)"
              aria-pressed={wholeWord}
              aria-label="Whole Word"
              className={clsx(
                'rounded px-1.5 py-1 text-[10px] font-bold transition-colors',
                wholeWord
                  ? 'bg-electric-yellow text-deep-blue'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300'
              )}
            >
              W
            </button>
          </div>

          {/* Match counter (A2: aria-live, Design: font-mono tabular-nums) */}
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={clsx(
              'min-w-[80px] text-center font-mono text-[10px] font-medium tabular-nums',
              regexError ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {statusMessage ?? matchCountText}
          </span>

          {/* Prev / Next */}
          <div className="flex gap-0.5">
            <button
              onClick={handleFindPrev}
              disabled={!hasMatches}
              title="Previous Match (Shift+Enter)"
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleFindNext}
              disabled={!hasMatches}
              title="Next Match (Enter)"
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Replace Row */}
        {showReplace && (
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2 dark:border-gray-700/50">
            <input
              ref={replaceInputRef}
              type="text"
              value={replaceText}
              onChange={e => setReplaceText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Replace..."
              className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 placeholder-gray-400 focus:border-electric-yellow focus:outline-none focus:ring-1 focus:ring-electric-yellow/50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-500"
            />
            <button
              onClick={handleReplace}
              disabled={!hasMatches}
              title="Replace"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <ArrowRightLeft className="h-3 w-3" />
              Replace
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={!hasMatches}
              title="Replace All"
              className="rounded-md px-2 py-1 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
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
                    match={match}
                    isActive={i === currentIndex}
                    onClick={() => handleJumpTo(match, i)}
                  />
                ))}
                {matches.length > MAX_RESULTS_DISPLAY && (
                  <div className="px-4 py-2 text-center text-[10px] text-gray-400 dark:text-gray-500">
                    Showing {MAX_RESULTS_DISPLAY} of {matches.length} matches
                  </div>
                )}
              </>
            ) : (
              !regexError && (
                <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                  <Search className="h-6 w-6 text-gray-300 dark:text-gray-600" />
                  <p className="text-xs text-gray-400 dark:text-gray-500">No matches found</p>
                </div>
              )
            )}
          </div>
        )}

        {/* Footer with Select All */}
        {hasMatches && (
          <div className="flex items-center justify-end border-t border-gray-100 px-4 py-2 dark:border-gray-700/50">
            <button
              onClick={handleSelectAll}
              className="rounded-md px-2 py-1 text-[10px] font-medium text-gray-600 transition-colors hover:bg-electric-yellow/10 hover:text-electric-dark dark:text-gray-400 dark:hover:text-electric-yellow"
            >
              Select All Occurrences
            </button>
          </div>
        )}
      </div>
    </div>
  )
})
