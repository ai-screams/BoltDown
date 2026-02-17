<!-- Parent: ../AGENTS.md -->

# src/ — React Frontend

## Purpose

React 19 + TypeScript frontend for BoltDown. Contains all UI components, state management, hooks, utilities, and type definitions with full accessibility support.

## Key Files

- `App.tsx` — Root component with stable slot pattern (tabBar, toolbar, editor, preview hoisted outside render to prevent recreation). Keyboard shortcuts via `useKeyboardShortcuts` hook (Cmd+O/S/N/\\/,/F/H, Shift+Cmd+E). Watches `activeTabId` via `useEffect`, syncs sidebar file tree via `sidebarStore.loadParentDirectory(tab.filePath)` when tab changes. Calls `useCustomCss()` hook to inject custom CSS from settings. **WIG**: `beforeunload` event handler warns about unsaved changes when closing window. Lazy-loads SettingsModal and FindReplaceModal with `lazy()` + `Suspense`. Wraps Sidebar, MarkdownEditor, and MarkdownPreview with ErrorBoundary.

- `main.tsx` — React 19 entry point (StrictMode wrapper). Uses `createRoot()` from 'react-dom/client'.

- `index.css` — Tailwind base + `.prose` preview styles + brand CSS variables + KaTeX CSS import + CSS custom properties for preview settings (--preview-font-size, --preview-line-height, etc.) + `.cm-searchMatch` / `.cm-searchMatch-selected` highlight styles (electric-yellow theme) + `prefers-reduced-motion: reduce` media query disables animations. HTML/body/root have `height: 100%` and `overflow: hidden` for proper layout containment.

- `vite-env.d.ts` — Vite type definitions

## Subdirectories

- `components/` — React UI components (see components/AGENTS.md)
- `stores/` — Zustand state stores (see stores/AGENTS.md)
- `hooks/` — Custom React hooks (see hooks/AGENTS.md)
- `types/` — TypeScript type definitions (see types/AGENTS.md)
- `utils/` — Shared utilities (see utils/AGENTS.md)
- `contexts/` — React context providers (see contexts/AGENTS.md)
- `test/` — Test setup (Vitest config)

## For AI Agents

- All components use `memo()` wrapper pattern: `export default memo(function Name() { ... })`
- Import order: external → internal (@/ aliases) → relative
- Path aliases: `@/` = `src/`, `@components/` = `src/components/`, etc.
- No barrel files (index.ts) — always import directly from the file
- Types file uses `.ts` extension (not `.d.ts`)
- Accessibility: ARIA attributes on all interactive elements, decorative icons with `aria-hidden="true"`, keyboard navigation support
- React 19: Uses `use()` hook for contexts instead of `useContext()`

## Component Hierarchy

```
App (EditorViewProvider wrapper)
├── Header (logo, file ops, mode toggle, theme)
│   └── Export dropdown (keyboard nav: ArrowDown/Up/Home/End/Escape)
├── Sidebar + ResizeHandle
│   ├── FileTree (react-arborist)
│   │   └── FileTreeNode (context menu with keyboard nav)
│   ├── OutlinePanel
│   └── RecentFiles
├── TabBar (WAI-ARIA tabs, roving tabindex, ArrowLeft/Right/Home/End)
├── MainLayout
│   ├── EditorToolbar
│   ├── MarkdownEditor (CM6, per-tab state cache)
│   └── MarkdownPreview (markdown-it)
├── Footer (aria-live status announcements)
├── SettingsModal (lazy-loaded)
│   ├── ThemePanel (6 presets, CustomCssEditor)
│   ├── EditorPanel (form controls with aria-label)
│   ├── PreviewPanel
│   └── GeneralPanel
└── FindReplaceModal (lazy-loaded)
    ├── Search controls (aria-pressed toggles)
    ├── Match counter (aria-live region)
    └── Results list (memoized rows)
```

## WIG Compliance

### Global

- ✅ `prefers-reduced-motion` support in index.css
- ✅ `beforeunload` guard for unsaved changes
- ✅ ErrorBoundary wrapping for error resilience

### Accessibility Patterns

- ✅ Decorative icons: `aria-hidden="true"` throughout
- ✅ Interactive elements: Clear `aria-label` attributes
- ✅ Live regions: `aria-live="polite"` for status updates
- ✅ Dialog modals: `aria-labelledby` and `aria-modal="true"`
- ✅ Form controls: `role="switch"`, `aria-checked`, `aria-label`
- ✅ Keyboard navigation: Full keyboard support in all interactive components
