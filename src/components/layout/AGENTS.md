<!-- Parent: ../AGENTS.md -->

# layout/ — App Shell Layout Components

## Purpose

Top-level layout components that compose the application structure: header, footer, and main content area with accessibility enhancements.

## Key Files

- `Header.tsx` — App header (h-12, flex-none): logo (Zap icon + "BoltDown"), file operations (open/save/export dropdown), 3-mode toggle (Split/Source/Zen with icons, segmented button group), theme cycle button (Sun/Moon/Monitor icons). Export dropdown with keyboard navigation (ArrowDown/Up/Home/End/Escape), auto-focus first item on open. Uses `useSettingsStore` for theme state. Memoized with `memo()`.

- `Footer.tsx` — Status bar (h-8, flex-none): left side shows status text with `aria-live="polite"` and `aria-atomic="true"` for screen reader announcements (`editorStore.statusText` or "Ready"), right side shows word count, reading time (225 wpm), line count, character count with `toLocaleString()` formatting. Computed via `useDocumentStats()` hook. Memoized with `memo()`. Accepts optional `className` prop for zen mode dimming.

- `MainLayout.tsx` — Flex-based split layout with draggable divider. Accepts `editor`, `preview`, `toolbar` ReactNode slots. Reads `editorStore.mode` to toggle panels ('split' = both, 'source'/'zen' = editor only). Divider uses `requestAnimationFrame` for 60fps resize, clamps ratio 0.2–0.8, double-click resets to 50/50. Window blur safety (cleanup on window blur). Pointer overlay during drag (fixed inset-0 z-40 with cursor-col-resize) prevents text selection. Preview container has `overscroll-contain` to prevent scroll chaining.

## Accessibility Features

### Header

- **Export Menu**: Full keyboard navigation with ArrowDown/Up/Home/End/Escape
- **Auto-focus**: First menu item receives focus when dropdown opens
- **ARIA**: `aria-controls`, `aria-expanded`, `aria-haspopup="menu"` on dropdown button
- **Menu Items**: `role="menuitem"` with focus-visible rings

### Footer

- **Status Announcements**: `aria-live="polite"` + `aria-atomic="true"` on status text for screen reader updates
- **Tab Index**: Statistics text is presentational (no tabindex)

### Header Export Menu

```tsx
// Auto-focus pattern
useEffect(() => {
  if (exportOpen && menuItemRefs.current[0]) {
    menuItemRefs.current[0]?.focus()
  }
}, [exportOpen])

// Keyboard navigation
handleMenuKeyDown(e: React.KeyboardEvent) {
  // ArrowDown: next item (wrap)
  // ArrowUp: previous item (wrap)
  // Home: first item
  // End: last item
  // Escape: close menu
}
```

## For AI Agents

- All three components are memoized with `memo()`
- MainLayout receives children as slots from App.tsx (pre-created as stable JSX constants)
- Mode display: `split` = both panels, `source` = editor only, `zen` = editor with WYSIWYG decorations
- Export dropdown uses click-outside detection via `useEffect` + `document.addEventListener('mousedown')`
- Layout scroll prevention: html/body/#root have `height:100% + overflow:hidden` in index.css
- Header has `flex-none h-12`, Footer has `flex-none h-8` — prevents them from scrolling away with content
- Footer `className` prop allows zen mode to apply `zen-footer-dim` class for visual dimming
- Header export menu follows WAI-ARIA menu pattern with roving focus
- `beforeunload` event handler in App.tsx warns users about unsaved changes when closing window

## WIG Compliance

### Header Export Menu

- ✅ Keyboard navigation (ArrowDown/Up/Home/End/Escape)
- ✅ Auto-focus first item on open
- ✅ ARIA attributes (`aria-controls`, `aria-expanded`, `aria-haspopup`)
- ✅ Focus management with ref array

### Footer

- ✅ `aria-live="polite"` for status announcements
- ✅ `aria-atomic="true"` for complete phrase reading
- ✅ Semantic text presentation
