<!-- Parent: ../AGENTS.md -->

# components/ — React UI Components

## Purpose

All React UI components organized by feature area. Every exported component uses `memo()` wrapper. Full accessibility support with ARIA attributes, keyboard navigation, and screen reader compatibility.

## Subdirectories

- `editor/` — CodeMirror 6 editor, tab bar with WAI-ARIA tabs pattern, toolbar, CM6 extensions (see editor/AGENTS.md)
- `layout/` — App shell: Header with keyboard-navigable export menu, Footer with aria-live status, MainLayout (see layout/AGENTS.md)
- `preview/` — Markdown preview renderer (see preview/AGENTS.md)
- `sidebar/` — File tree with keyboard-navigable context menus, recent files, resize handle with ARIA separator (see sidebar/AGENTS.md)
- `common/` — Shared UI primitives: ErrorBoundary, IconButton (see common/AGENTS.md)
- `settings/` — Settings modal with form accessibility (aria-label on all controls) (see settings/AGENTS.md)
- `findreplace/` — Find & Replace modal with ARIA live region for match counter (see findreplace/AGENTS.md)

## Accessibility Features

### Consistent Patterns

1. **Decorative Icons**: All lucide-react icons marked with `aria-hidden="true"`
2. **Interactive Elements**: Clear `aria-label` on icon-only buttons
3. **Keyboard Navigation**: Full keyboard support (Arrow keys, Home/End, Enter, Escape)
4. **Live Regions**: Status updates announced via `aria-live="polite"`
5. **Dialog Modals**: `role="dialog"`, `aria-labelledby`, `aria-modal="true"`
6. **Form Controls**: `role="switch"`, `aria-checked`, `aria-pressed`, `aria-label`
7. **Focus Management**: Visible focus rings, programmatic focus on state changes

### Component-Specific

| Component        | Accessibility Features                                                   |
| ---------------- | ------------------------------------------------------------------------ |
| TabBar           | WAI-ARIA tabs pattern, roving tabindex, ArrowLeft/Right/Home/End         |
| Header           | Export menu keyboard nav (ArrowDown/Up/Home/End/Escape), auto-focus      |
| Footer           | `aria-live="polite"` + `aria-atomic="true"` for status announcements     |
| FileTreeNode     | Context menu keyboard nav, auto-focus first item, role="menu"            |
| ResizeHandle     | `role="separator"`, `aria-orientation`, `aria-valuenow/min/max`          |
| SettingsModal    | `aria-labelledby` on dialog, `aria-label` on all form controls           |
| FindReplaceModal | `aria-labelledby` on dialog, `aria-pressed` toggles, `aria-live` counter |

## For AI Agents

- All components: `export default memo(function ComponentName() { ... })`
- Props are minimal — most data comes from Zustand stores via selectors
- Zustand selectors must return primitives (string, number, boolean) to avoid re-renders
- Use `clsx` for conditional classNames, `lucide-react` for icons
- Dark mode via Tailwind `dark:` variants (class-based)
- **ARIA Guidelines**:
  - Decorative icons always have `aria-hidden="true"`
  - Interactive elements without visible labels must have `aria-label`
  - Toggles use `aria-pressed` or `aria-checked` depending on semantics
  - Live regions use `aria-live="polite"` for non-critical updates
  - Dialogs use `role="dialog"`, `aria-labelledby`, `aria-modal="true"`

## WIG Compliance Summary

✅ **18 Accessibility Fixes Across 9 Components**:

1. **TabBar.tsx**: WAI-ARIA tabs with roving tabindex, keyboard nav
2. **Header.tsx**: Export menu keyboard nav, auto-focus first item
3. **FileTreeNode.tsx**: Context menu keyboard nav, auto-focus first item
4. **SettingsModal.tsx**: Form accessibility (aria-label on all controls)
5. **FindReplaceModal.tsx**: aria-labelledby, aria-pressed, aria-live counter
6. **Footer.tsx**: aria-live + aria-atomic on status text
7. **Sidebar.tsx**: aria-hidden on decorative icon
8. **ResizeHandle.tsx**: role="separator", aria-orientation, aria-value attributes
9. **App.tsx**: beforeunload guard for unsaved changes

All interactive components now support keyboard navigation, provide clear ARIA labels, and announce state changes to screen readers.
