<!-- Parent: ../AGENTS.md -->

# types/ — TypeScript Type Definitions

## Purpose

Shared TypeScript interfaces and type aliases used across the frontend.

## Key Files

- `editor.ts` — `EditorMode` type (`'split' | 'source' | 'zen'`) and `Tab` interface (`id`, `filePath`, `fileName`, `content`, `savedContent`). Note: `isDirty` is derived, not stored.
- `sidebar.ts` — `FileTreeNode` (hierarchical tree data), `RecentFile` (path + name + timestamp), `SidebarTab` (`'files' | 'recent' | 'outline'`), `HeadingNode` (level, text, line).
- `settings.ts` — Settings system types: `ThemeMode` (`'light' | 'dark' | 'system'`), `FontFamily`, `MermaidSecurityLevel` (`'strict' | 'loose'`), `ThemeSettings`, `EditorSettings` (includes `vimMode: boolean`), `PreviewSettings`, `GeneralSettings` (includes `autoSave`, `autoSaveDelay`, `restoreLastFile`), `AppSettings` aggregate, `SettingsCategory = keyof AppSettings`. All `DEFAULT_*` constants exported.

## For AI Agents

- Types use `.ts` extension (not `.d.ts`)
- `Tab.isDirty` was deliberately removed — always derive as `content !== savedContent`
- `FileTreeNode` maps to react-arborist's expected node shape
- `SidebarTab` now includes `'outline'` for the Outline Panel (heading navigation)
- `HeadingNode` used by useOutline hook and OutlinePanel component
- `SettingsCategory` is derived as `keyof AppSettings` — automatically extends when new categories are added
- `GeneralSettings` includes auto-save configuration (`autoSave` boolean, `autoSaveDelay` ms)
