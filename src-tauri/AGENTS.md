<!-- Parent: ../AGENTS.md -->

# src-tauri/ — Rust Backend (Tauri 2.0)

## Purpose

Rust backend providing desktop shell, native file system access, and IPC commands for the React frontend via Tauri 2.0.

## Key Files

- `src/main.rs` — Tauri entry point with 6 IPC commands: `greet`, `read_file`, `write_file`, `list_directory`, `read_settings`, `write_settings`
- `src/lib.rs` — Shared utilities: `word_count`, `reading_time`, placeholder `markdown_to_html`
- `Cargo.toml` — Rust dependencies (tauri 2.0, tokio, serde, notify); aggressive release optimizations (LTO, strip, opt-level=z)
- `tauri.conf.json` — App config: window 1400x900 (min 800x600), CSP policy, asset protocol, bundle targets
- `build.rs` — Tauri build script

## Subdirectories

- `src/` — Rust source code
- `icons/` — App icons (macOS .icns, Windows .ico, iOS, Android)

## IPC Commands

| Command          | Signature                                                        | Purpose                                                       |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| `greet`          | `(name: &str) → String`                                          | Test greeting                                                 |
| `read_file`      | `(path: String) → Result<String, String>`                        | Read file contents (async)                                    |
| `write_file`     | `(path: String, content: String) → Result<(), String>`           | Write file contents (async)                                   |
| `list_directory` | `(path: String) → Result<Vec<FileEntry>, String>`                | List directory (filters hidden/system dirs, sorts dirs first) |
| `read_settings`  | `(app_handle: AppHandle) → Result<String, String>`               | Read app settings from appDataDir/settings.json               |
| `write_settings` | `(app_handle: AppHandle, settings: String) → Result<(), String>` | Write app settings to appDataDir/settings.json                |

## Tauri Plugins

- `tauri-plugin-fs` — File system access
- `tauri-plugin-dialog` — Open/Save file dialogs
- `tauri-plugin-shell` — Shell commands (print)

## For AI Agents

- All IPC commands are `async` and return `Result<T, String>`
- `list_directory` filters: hidden files, node_modules, target, dist, build, **pycache**, .git
- `read_settings`/`write_settings` use `AppHandle` pattern to access appDataDir (not user-provided paths)
- Release profile uses `opt-level = "z"` (size over speed), LTO, strip — produces ~3.7MB DMG
- Phase 2/3 dependencies (image, hunspell, git2, grep-searcher, rusqlite) are commented in Cargo.toml
- Test with `cd src-tauri && cargo test`

## Dependencies

- Frontend communicates via `@tauri-apps/api/core` invoke()
- Frontend uses `@tauri-apps/plugin-dialog` for file picker
