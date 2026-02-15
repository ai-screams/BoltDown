// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

// Tauri commands
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
async fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    tokio::fs::rename(&old_path, &new_path)
        .await
        .map_err(|e| format!("Failed to rename file: {}", e))
}

#[tauri::command]
async fn delete_file(path: String) -> Result<(), String> {
    tokio::fs::remove_file(&path)
        .await
        .map_err(|e| format!("Failed to delete file: {}", e))
}

#[tauri::command]
async fn copy_file(src_path: String, dest_path: String) -> Result<(), String> {
    tokio::fs::copy(&src_path, &dest_path)
        .await
        .map(|_| ())
        .map_err(|e| format!("Failed to copy file: {}", e))
}

#[tauri::command]
async fn write_binary_file(dest_path: String, data: Vec<u8>) -> Result<(), String> {
    tokio::fs::write(&dest_path, data)
        .await
        .map_err(|e| format!("Failed to write binary file: {}", e))
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("⚡ Hello, {}! Welcome to BoltDown!", name)
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
            greet,
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
