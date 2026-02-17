<!-- Parent: ../AGENTS.md -->

# src-tauri/ — Rust Backend (Tauri 2.0)

## Purpose

Rust backend providing desktop shell, native file system access, and IPC commands for the React frontend via Tauri 2.0. Refactored to modular architecture with clean separation of concerns.

## Architecture

```
src-tauri/src/
├── lib.rs              — Tauri entry point, plugin registration, command registration
├── commands/
│   ├── mod.rs          — Command module exports (file, directory, settings)
│   ├── file.rs         — File operations (read, write, rename, delete, copy, write_binary)
│   ├── directory.rs    — Directory listing with filtering
│   └── settings.rs     — Settings persistence (read, write)
├── error.rs            — Unified error type with thiserror
└── utils/
    ├── mod.rs          — Utility module exports
    └── path.rs         — Path validation and traversal protection
```

## Key Files

### Entry Point

- `src/lib.rs` — Tauri application entry point. Registers plugins (fs, dialog, shell) and 9 IPC commands via `invoke_handler!` macro. Clean modular structure with `mod commands; mod error; mod utils;`

### Command Modules

- `src/commands/mod.rs` — Re-exports command submodules: `pub mod file;`, `pub mod directory;`, `pub mod settings;`
- `src/commands/file.rs` — 6 async file operations: `read_file` (with size limit), `write_file` (atomic with .tmp), `rename_file`, `delete_file`, `copy_file`, `write_binary_file`. All use `validate_path()` for security.
- `src/commands/directory.rs` — `list_directory` command with `FileEntry` struct (name, path, is_dir, size, modified). Filters hidden files and common dirs (node_modules, target, dist, build, **pycache**, .git). Sorts directories first, then alphabetically.
- `src/commands/settings.rs` — `read_settings` and `write_settings` using Tauri `AppHandle.path().app_data_dir()`. Atomic writes with .tmp file. Returns `"null"` string when settings.json doesn't exist.

### Error Handling

- `src/error.rs` — Unified `AppError` enum with `thiserror::Error` derive. Variants: `Io(std::io::Error)`, `PathValidation(String)`, `PathTraversal`, `NotADirectory(String)`, `FileTooLarge { size, max }`. Implements `Serialize` for Tauri IPC error responses.

### Utilities

- `src/utils/mod.rs` — Re-exports utility submodules: `pub mod path;`
- `src/utils/path.rs` — Path security utilities. `MAX_FILE_SIZE = 50MB` constant. `validate_path(path_str)` function: canonicalizes paths, handles new files by validating parent directory, rejects paths with `ParentDir` components (traversal protection). Includes unit tests.

### Configuration

- `Cargo.toml` — Rust dependencies (tauri 2.0, tokio, serde, thiserror); aggressive release optimizations (LTO, strip, opt-level=z)
- `tauri.conf.json` — App config: window 1400x900 (min 800x600), CSP policy, asset protocol, bundle targets
- `capabilities/default.json` — Tauri 2.0 ACL permissions: `core:default`, `dialog:default`, `shell:default`, `fs:default` scoped to `main` window
- `build.rs` — Tauri build script

## IPC Commands

| Command             | Module                | Signature                                                          | Purpose                                                       |
| ------------------- | --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `read_file`         | `commands::file`      | `(path: String) → Result<String, AppError>`                        | Read file contents (async, 50MB limit)                        |
| `write_file`        | `commands::file`      | `(path: String, content: String) → Result<(), AppError>`           | Write file contents (atomic with .tmp)                        |
| `rename_file`       | `commands::file`      | `(old_path: String, new_path: String) → Result<(), AppError>`      | Rename/move file (async)                                      |
| `delete_file`       | `commands::file`      | `(path: String) → Result<(), AppError>`                            | Delete file (async)                                           |
| `copy_file`         | `commands::file`      | `(src_path: String, dest_path: String) → Result<(), AppError>`     | Copy file (async)                                             |
| `write_binary_file` | `commands::file`      | `(dest_path: String, data: Vec<u8>) → Result<(), AppError>`        | Write binary data (for image drag & drop)                     |
| `list_directory`    | `commands::directory` | `(path: String) → Result<Vec<FileEntry>, AppError>`                | List directory (filters hidden/system dirs, sorts dirs first) |
| `read_settings`     | `commands::settings`  | `(app_handle: AppHandle) → Result<String, AppError>`               | Read app settings from appDataDir/settings.json               |
| `write_settings`    | `commands::settings`  | `(app_handle: AppHandle, settings: String) → Result<(), AppError>` | Write app settings to appDataDir/settings.json (atomic)       |

## Tauri Plugins

- `tauri-plugin-fs` — File system access
- `tauri-plugin-dialog` — Open/Save file dialogs
- `tauri-plugin-shell` — Shell commands (print)

## Security Features

- **Path Validation**: All file operations use `validate_path()` to prevent directory traversal attacks
- **Canonicalization**: Paths are canonicalized to resolve symlinks and relative components
- **Size Limits**: 50MB maximum file size for read operations
- **Atomic Writes**: File and settings writes use .tmp file + rename pattern for atomicity
- **Filtered Listing**: Directory listing automatically filters sensitive directories

## For AI Agents

- All IPC commands are `async` and return `Result<T, AppError>`
- Error responses are automatically serialized to strings via `AppError::Serialize` implementation
- `list_directory` filters: hidden files (starting with `.`), node_modules, target, dist, build, **pycache**, .git
- `read_settings`/`write_settings` use `AppHandle` pattern to access appDataDir (not user-provided paths)
- `validate_path()` works for both existing files and new files (validates parent directory for new files)
- Release profile uses `opt-level = "z"` (size over speed), LTO, strip — produces ~3.7MB DMG
- Test with `cd src-tauri && cargo test`
- **Tauri 2.0 ACL**: All IPC commands require matching permission in `capabilities/default.json`. Without it, plugin commands silently fail.

## Dependencies

- Frontend communicates via `@tauri-apps/api/core` invoke()
- Frontend uses `@tauri-apps/plugin-dialog` for file picker
- `thiserror` provides ergonomic error handling with derive macros
- `tokio` provides async runtime for file operations
