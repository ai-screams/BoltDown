// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use tauri::Manager;

/// Validate that a path does not contain traversal components after resolution.
/// For destination paths where the file may not yet exist, validates the parent directory.
fn validate_path(path_str: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path_str);

    // Try to canonicalize directly (works for existing paths)
    let canonical = path.canonicalize().or_else(|_| {
        // For new files: canonicalize parent, then append the filename
        let parent = path
            .parent()
            .ok_or_else(|| "Invalid path: no parent directory".to_string())?;
        let file_name = path
            .file_name()
            .ok_or_else(|| "Invalid path: no file name".to_string())?;
        parent
            .canonicalize()
            .map(|p| p.join(file_name))
            .map_err(|e| format!("Parent directory does not exist: {}", e))
    })?;

    // Reject if any component is still a parent-dir reference
    if canonical
        .components()
        .any(|c| c == std::path::Component::ParentDir)
    {
        return Err("Path traversal detected".to_string());
    }

    Ok(canonical)
}

// Tauri commands
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    let validated = validate_path(&path)?;
    tokio::fs::read_to_string(&validated)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    let validated = validate_path(&path)?;
    tokio::fs::write(&validated, content)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    let validated_old = validate_path(&old_path)?;
    let validated_new = validate_path(&new_path)?;
    tokio::fs::rename(&validated_old, &validated_new)
        .await
        .map_err(|e| format!("Failed to rename file: {}", e))
}

#[tauri::command]
async fn delete_file(path: String) -> Result<(), String> {
    let validated = validate_path(&path)?;
    tokio::fs::remove_file(&validated)
        .await
        .map_err(|e| format!("Failed to delete file: {}", e))
}

#[tauri::command]
async fn copy_file(src_path: String, dest_path: String) -> Result<(), String> {
    let validated_src = validate_path(&src_path)?;
    let validated_dest = validate_path(&dest_path)?;
    tokio::fs::copy(&validated_src, &validated_dest)
        .await
        .map(|_| ())
        .map_err(|e| format!("Failed to copy file: {}", e))
}

#[tauri::command]
async fn write_binary_file(dest_path: String, data: Vec<u8>) -> Result<(), String> {
    let validated = validate_path(&dest_path)?;
    tokio::fs::write(&validated, data)
        .await
        .map_err(|e| format!("Failed to write binary file: {}", e))
}

#[derive(serde::Serialize)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    modified: u64,
}

#[tauri::command]
async fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let mut dir = tokio::fs::read_dir(&path)
        .await
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let skip_dirs: std::collections::HashSet<&str> = [
        "node_modules",
        "target",
        "dist",
        "build",
        "__pycache__",
        ".git",
    ]
    .into_iter()
    .collect();

    let mut entries = Vec::new();

    while let Some(entry) = dir
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read entry: {}", e))?
    {
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') || skip_dirs.contains(name.as_str()) {
            continue;
        }

        let metadata = entry
            .metadata()
            .await
            .map_err(|e| format!("Failed to read metadata: {}", e))?;

        let modified = metadata
            .modified()
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        entries.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            modified,
        });
    }

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
async fn read_settings(app_handle: tauri::AppHandle) -> Result<String, String> {
    let path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?
        .join("settings.json");

    if !path.exists() {
        return Ok("null".to_string());
    }

    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read settings: {}", e))
}

#[tauri::command]
async fn write_settings(app_handle: tauri::AppHandle, settings: String) -> Result<(), String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;

    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("Failed to create settings dir: {}", e))?;

    let path = dir.join("settings.json");

    tokio::fs::write(&path, settings)
        .await
        .map_err(|e| format!("Failed to write settings: {}", e))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            rename_file,
            delete_file,
            copy_file,
            write_binary_file,
            list_directory,
            read_settings,
            write_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
