<!-- Parent: ../AGENTS.md -->

# sidebar/ — File Sidebar Components

## Purpose

File management sidebar with directory tree browsing, recent files list, and resizable panel. Full keyboard navigation and accessibility support.

## Key Files

- `Sidebar.tsx` — Container with three tabs (FILES / OUTLINE / RECENT). Opens folders via Tauri dialog. Renders FileTree, OutlinePanel, or RecentFiles based on active sidebar tab. Uses `loadDirectoryEntries()` from `utils/directoryLoader.ts`. Decorative icon in tab header marked with `aria-hidden="true"`.

- `FileTree.tsx` — Virtualized directory tree using `react-arborist`. Lazy-loads child directories on expand. Handles node toggle (folders) and file activation (opens in editor tab). Uses shared `loadDirectoryEntries()` and `findAvailableCopyPath()` from `@/utils/fileCopy` for duplicate operations.

- `FileTreeNode.tsx` — Custom tree node renderer with color-coded icons by file extension (blue for folders, green for .md, orange for .ts/.tsx, etc.). Handles click-to-toggle (dirs) and click-to-activate (files). Context menu for delete/duplicate with keyboard navigation (ArrowDown/Up/Escape), auto-focus first item on open. Menu items have `role="menuitem"`, clear `aria-label` attributes ("Duplicate", "Delete"). Icons marked with `aria-hidden="true"`.

- `OutlinePanel.tsx` — Document outline navigator. Uses `useOutline` hook to extract headings from active tab. Click scrolls editor to heading line. Shows "Open Folder" button when no file is open. Uses `flex-1 + min-h-0 + overflow-y-auto` for proper flex layout.

- `RecentFiles.tsx` — Scrollable list of recently opened files (max 20, persisted in localStorage). Uses `data-*` attribute click pattern instead of curried callbacks (O(1) closures).

- `ResizeHandle.tsx` — 1px draggable divider bar with active glow effect. Constrains sidebar width 180–480px (default 240px). Uses `requestAnimationFrame` for smooth 60fps resize. Window blur safety (cleanup on window blur). Double-click resets to 240px. Width persisted to localStorage via debounced store setter. Coordinates with Sidebar.tsx via `setResizing(boolean)` to disable CSS transitions during drag. ARIA: `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.

## Accessibility Features

### FileTreeNode Context Menu

- **Keyboard Navigation**: ArrowDown/Up for menu item navigation, Escape to close
- **Auto-focus**: First menu item receives focus when menu opens
- **ARIA**: `role="menu"` on container, `role="menuitem"` on buttons
- **Labels**: Clear `aria-label` attributes on duplicate/delete actions
- **Decorative Icons**: Icons marked with `aria-hidden="true"`

```tsx
// Auto-focus first menu item
useEffect(() => {
  if (!menuPos || !menuRef.current) return
  const firstButton = menuRef.current.querySelector<HTMLButtonElement>('button[role="menuitem"]')
  firstButton?.focus()
}, [menuPos])

// Keyboard navigation
handleMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  const menuItems = Array.from(
    menuRef.current.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
  )

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const nextIndex = (currentIndex + 1) % menuItems.length
    menuItems[nextIndex]?.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prevIndex = (currentIndex - 1 + menuItems.length) % menuItems.length
    menuItems[prevIndex]?.focus()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    setMenuPos(null)
  }
}
```

### ResizeHandle

- **ARIA Separator**: `role="separator"` indicates resizable divider
- **Orientation**: `aria-orientation="vertical"` for screen readers
- **Value Attributes**: `aria-valuenow={width}`, `aria-valuemin={MIN_WIDTH}`, `aria-valuemax={MAX_WIDTH}`
- **Label**: `aria-label="Resize sidebar"` provides context

### Sidebar

- **Decorative Icon**: File icon in tab header marked with `aria-hidden="true"`

## For AI Agents

- `loadDirectoryEntries()` is shared (DRY) between Sidebar.tsx and FileTree.tsx via `utils/directoryLoader.ts`
- Sidebar width persistence uses 300ms debounce to prevent 60x/sec localStorage writes during drag
- react-arborist provides virtualization (only visible nodes rendered) + keyboard navigation
- RecentFiles uses `data-path` / `data-name` attributes with single `useCallback` handler (not per-item closures)
- ResizeHandle has no props — reads/writes sidebar width + isResizing directly from `useSidebarStore`
- Sidebar.tsx uses `clsx` to conditionally disable transitions during resize: `!isResizing && 'transition-[width] duration-200'`
- FileTreeNode context menu follows WAI-ARIA menu pattern with roving focus
- FileTreeNode hover actions use CSS `group-focus-within` pattern for keyboard accessibility

## Dependencies

- `sidebarStore` — isOpen, width, treeData, recentFiles, activeTab
- `utils/directoryLoader.ts` — loadDirectoryEntries()
- `react-arborist` — Tree component
- `@tauri-apps/plugin-dialog` — Folder picker (in Sidebar.tsx)
- `@react-symbols/icons/utils` — FileIcon, FolderIcon

## WIG Compliance

### FileTreeNode Context Menu

- ✅ Keyboard navigation (ArrowDown/Up/Escape)
- ✅ Auto-focus first menu item on open
- ✅ ARIA attributes (`role="menu"`, `role="menuitem"`)
- ✅ Clear `aria-label` on duplicate/delete actions
- ✅ Decorative icons hidden from screen readers

### ResizeHandle

- ✅ `role="separator"` with `aria-orientation="vertical"`
- ✅ `aria-valuenow`, `aria-valuemin`, `aria-valuemax` for current/min/max width
- ✅ `aria-label="Resize sidebar"` for context

### Sidebar

- ✅ Decorative icon marked with `aria-hidden="true"`
