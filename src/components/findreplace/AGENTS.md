<!-- Parent: ../AGENTS.md -->

# findreplace/ — Find & Replace Modal

## Purpose

Custom Find & Replace UI integrated with CodeMirror 6 search API, providing keyboard-driven search with ReDoS protection, performance optimizations, and full accessibility support.

## Key Files

- `FindReplaceModal.tsx` — 752-line modal component with CM6 integration. Features: auto-fill selected text on open, debounced search (150ms), ReDoS pattern validation (max 500 chars, max 10 groups, dangerous pattern detection), search timeout protection (2000ms), lazy line info population (only for first 200 displayed matches), memoized MatchRow components (reduce reconciliation), CM6 update listener (replaces polling), keyboard navigation (Enter/Shift+Enter/↑/↓/Escape), toggle shortcuts (Alt+C/R/W), backdrop click-to-close, match highlighting with `<mark>` tags, replace/replace-all with error surfacing, select-all-occurrences. Uses `useShallow` for split Zustand selectors (UI state vs search state). Display limits: 200 results shown, 10000 max total matches. Status messages with 2s auto-clear. Reads EditorView from EditorViewContext. Dialog has `aria-labelledby="find-replace-dialog-title"` and `aria-modal="true"`. Toggle buttons use `aria-pressed` and `aria-label`. Match counter has `role="status"`, `aria-live="polite"`, `aria-atomic="true"`. Input fields have `aria-label`. Navigation buttons have `aria-label` and disabled state. All icons marked with `aria-hidden="true"`.

## Accessibility Features

### Dialog

- **ARIA Attributes**: `role="dialog"`, `aria-labelledby="find-replace-dialog-title"`, `aria-modal="true"`
- **Title Element**: `<span id="find-replace-dialog-title">Find {showReplace ? '& Replace' : ''}</span>`
- **Keyboard**: Escape key closes dialog (capture phase for global handling)

### Form Controls

- **Input Labels**: `aria-label="Find text"` and `aria-label="Replace text"` on inputs
- **Toggle Buttons**:
  - `aria-label="Case Sensitive"`, `aria-pressed={caseSensitive}`
  - `aria-label="Regular Expression"`, `aria-pressed={useRegex}`
  - `aria-label="Whole Word"`, `aria-pressed={wholeWord}`
- **Navigation Buttons**: `aria-label="Previous match"`, `aria-label="Next match"` with disabled state
- **Action Buttons**: `aria-label="Replace current match"`, clear text labels on others

### Live Region

- **Match Counter**: `role="status"`, `aria-live="polite"`, `aria-atomic="true"` announces search results
- **Status Messages**: Replace count announcements via same live region

### Icons

- **Decorative**: All icons marked with `aria-hidden="true"` (Search, ChevronUp/Down, X, ArrowRightLeft)

```tsx
// Toggle button pattern
<button
  type="button"
  aria-label="Case Sensitive"
  aria-pressed={caseSensitive}
  title="Case Sensitive (Alt+C)"
  onClick={toggleCaseSensitive}
>
  Aa
</button>

// Live region for results
<span
  role="status"
  aria-atomic="true"
  aria-live="polite"
  className="font-mono tabular-nums"
>
  {statusMessage ?? matchCountText}
</span>

// Navigation button
<button
  type="button"
  aria-label="Previous match"
  disabled={!hasMatches}
  title="Previous Match (Shift+Enter)"
  onClick={handleFindPrev}
>
  <ChevronUp aria-hidden="true" />
</button>
```

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
- **CM6 Update Listener**: Uses `StateEffect.appendConfig` with Compartment to install permanent listener (replaces expensive polling)
- **Cursor Sync**: Derives currentIndex from cursor position with `requestAnimationFrame` (avoids layout thrashing)
- **Stale Closure Prevention**: `buildQuery` reads replaceText from store via `getState()` at call time
- **Auto-fill**: Copies selected text to search input when modal opens (if single-line selection)
- **Split Selectors**: Separates UI state (`isOpen`, `showReplace`) from search state (`searchText`, etc.) for better performance

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
- `@codemirror/state` — EditorSelection, StateEffect, Text, Compartment
- `@codemirror/view` — EditorView
- `EditorViewContext` — Shared EditorView ref (from MarkdownEditor)
- `findReplaceStore` — UI state and preferences

## WIG Compliance

### Dialog Accessibility

- ✅ `role="dialog"` with `aria-labelledby` and `aria-modal="true"`
- ✅ Accessible name via `id="find-replace-dialog-title"`
- ✅ Escape key closes dialog (capture phase)

### Form Accessibility

- ✅ Input fields have `aria-label` attributes
- ✅ Toggle buttons use `aria-pressed` and `aria-label`
- ✅ Navigation buttons have `aria-label` and disabled state
- ✅ Match counter has `role="status"`, `aria-live="polite"`, `aria-atomic="true"`
- ✅ All icons marked with `aria-hidden="true"`
- ✅ Focus-visible rings on all interactive elements
- ✅ Keyboard shortcuts documented in title attributes
