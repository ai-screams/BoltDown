<!-- Parent: ../AGENTS.md -->

# sidebar/ — File Sidebar Components

## Purpose

File management sidebar with directory tree browsing, recent files list, and resizable panel.

## Key Files

- `Sidebar.tsx` — Container with two tabs (FILES / RECENT). Opens folders via Tauri dialog. Renders either FileTree or RecentFiles based on active sidebar tab. Uses `loadDirectoryEntries()` from `utils/directoryLoader.ts`.
- `FileTree.tsx` — Virtualized directory tree using `react-arborist`. Lazy-loads child directories on expand. Handles node toggle (folders) and file activation (opens in editor tab). Uses shared `loadDirectoryEntries()`.
- `FileTreeNode.tsx` — Custom tree node renderer with color-coded icons by file extension (blue for folders, green for .md, orange for .ts/.tsx, etc.). Handles click-to-toggle (dirs) and click-to-activate (files).
- `RecentFiles.tsx` — Scrollable list of recently opened files (max 20, persisted in localStorage). Uses `data-*` attribute click pattern instead of curried callbacks (O(1) closures).
- `ResizeHandle.tsx` — 1px draggable divider bar. Constrains sidebar width 180–480px. Uses `requestAnimationFrame` for smooth resize. Width persisted to localStorage via debounced store setter.

## For AI Agents

- `loadDirectoryEntries()` is shared (DRY) between Sidebar.tsx and FileTree.tsx via `utils/directoryLoader.ts`
- Sidebar width persistence uses 300ms debounce to prevent 60x/sec localStorage writes during drag
- react-arborist provides virtualization (only visible nodes rendered) + keyboard navigation
- RecentFiles uses `data-path` / `data-name` attributes with single `useCallback` handler (not per-item closures)
- ResizeHandle has no props — reads/writes sidebar width directly from `useSidebarStore`

## Dependencies

- `sidebarStore` — isOpen, width, treeData, recentFiles, activeTab
- `utils/directoryLoader.ts` — loadDirectoryEntries()
- `react-arborist` — Tree component
- `@tauri-apps/plugin-dialog` — Folder picker (in Sidebar.tsx)
