<!-- Parent: ../AGENTS.md -->

# findreplace/ — Find & Replace Modal

## Purpose

Custom Find & Replace UI integrated with CodeMirror 6 search API, providing keyboard-driven search with ReDoS protection and performance optimizations.

## Key Files

- `FindReplaceModal.tsx` — 704-line modal component with CM6 integration. Features: auto-fill selected text on open, debounced search (150ms), ReDoS pattern validation (max 500 chars, max 10 groups, dangerous pattern detection), search timeout protection (2000ms), lazy line info population (only for first 200 displayed matches), memoized MatchRow components (reduce reconciliation), CM6 update listener (replaces polling), keyboard navigation (Enter/Shift+Enter/↑/↓/Escape), toggle shortcuts (Alt+C/R/W), backdrop click-to-close, match highlighting with `<mark>` tags, replace/replace-all with error surfacing, select-all-occurrences. Uses `useShallow` for single Zustand selector. Display limits: 200 results shown, 10000 max total matches. Status messages with 2s auto-clear. Reads EditorView from EditorViewContext.

## For AI Agents

### Architecture

```
FindReplaceModal
├── Store: useFindReplaceStore (isOpen, searchText, replaceText, flags)
├── Context: useEditorView (EditorViewRef from EditorViewContext)
├── CM6 API: setSearchQuery, findNext, findPrevious, replaceNext, replaceAll, selectMatches
├── ReDoS Protection: validateRegexComplexity before search execution
├── Performance: debounced search (150ms), lazy line info, memoized rows, RAF cursor sync
└── Keyboard: Enter (scroll to match), Shift+Enter (prev), ↑/↓ (nav), Escape (close), Alt+C/R/W (toggles)
```

### Key Patterns

- **ReDoS Protection**: Validates regex complexity before executing search (prevents browser freeze)
- **Lazy Line Info**: Only populates line numbers/text for first 200 displayed matches (reduces initial search cost)
- **Memoized Rows**: `MatchRow` component wrapped in `memo()` to reduce reconciliation on currentIndex changes
- **CM6 Update Listener**: Uses `StateEffect.appendConfig` to install permanent listener (replaces expensive polling)
- **Cursor Sync**: Derives currentIndex from cursor position with `requestAnimationFrame` (avoids layout thrashing)
- **Stale Closure Prevention**: `buildQuery` reads replaceText from store via `getState()` at call time
- **Auto-fill**: Copies selected text to search input when modal opens (if single-line selection)

### ReDoS Validation Rules

- Max pattern length: 500 characters
- Max capture groups: 10
- Dangerous patterns detected: `(a+)+`, `(a*)*`, excessive alternation `(a|b|c|d)+`
- Search timeout: 2000ms (throws error if exceeded)

### Display Limits

- `MAX_RESULTS_DISPLAY = 200` — Only first 200 matches rendered in list
- `MAX_TOTAL_MATCHES = 10000` — Search stops after 10k matches found
- Status text shows "X of Y+" when limit exceeded

## Dependencies

- `@codemirror/search` — SearchQuery, findNext, findPrevious, replaceNext, replaceAll, selectMatches, setSearchQuery
- `@codemirror/state` — EditorSelection, StateEffect, Text
- `@codemirror/view` — EditorView
- `EditorViewContext` — Shared EditorView ref (from MarkdownEditor)
- `findReplaceStore` — UI state and preferences
