<!-- Parent: ../AGENTS.md -->

# types/ — TypeScript Type Definitions

## Purpose

Shared TypeScript interfaces and type aliases used across the frontend.

## Key Files

- `editor.ts` — `EditorMode` type (`'split' | 'source' | 'zen'`) and `Tab` interface (`id`, `filePath`, `fileName`, `content`, `savedContent`). Note: `isDirty` is derived, not stored.
- `sidebar.ts` — `FileTreeNode` (hierarchical tree data), `RawFileEntry` (Tauri IPC response shape), `RecentFile` (path + name + timestamp), `SidebarTab` (`'files' | 'recent'`).

## For AI Agents

- Types use `.ts` extension (not `.d.ts`)
- `Tab.isDirty` was deliberately removed — always derive as `content !== savedContent`
- `FileTreeNode` maps to react-arborist's expected node shape
- `RawFileEntry` matches the Rust `FileEntry` struct from `list_directory` IPC command
