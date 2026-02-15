# Polish Backlog

Low-priority improvements for future polish passes.

## Cross-platform Path Handling

- **Priority**: Low
- **Location**: `sidebarStore.ts` → `loadParentDirectory`
- `filePath.lastIndexOf('/')` only handles Unix separators. Windows Tauri paths use `\`.
- **Fix**: Use `Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))` or a shared `getParentDir()` utility.

## Sidebar Auto-open on Cmd+O

- **Priority**: Low
- **Location**: `useFileSystem.ts` → `openFile` calls `loadParentDirectory(path, true)`
- Opens sidebar even if user deliberately closed it.
- **Fix**: Only open sidebar if file tree was empty (first file open), or add a user preference to control this behavior.

## Brief Tree Data Flash on Directory Switch

- **Priority**: Very Low
- **Location**: `sidebarStore.ts` → `loadParentDirectory`
- `setRootPath` fires before `setTreeData`, causing a brief render with stale tree data under the new root label.
- **Fix**: Batch both updates atomically: `set({ rootPath: dir, treeData: entries })` after loading completes (requires reordering the logic).
