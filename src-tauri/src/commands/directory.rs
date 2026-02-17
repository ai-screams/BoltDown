use serde::Serialize;

use crate::error::AppError;
use crate::utils::path::validate_path;

/// Directories to skip when listing contents.
const SKIP_DIRS: &[&str] = &[
    "node_modules",
    "target",
    "dist",
    "build",
    "__pycache__",
    ".git",
];

/// Represents a single file or directory entry.
#[derive(Debug, Clone, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
}

/// Lists the contents of a directory, sorted with directories first then by name.
/// Skips hidden files (starting with `.`) and common build/dependency directories.
#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<FileEntry>, AppError> {
    let validated = validate_path(&path)?;

    let metadata = tokio::fs::metadata(&validated).await?;

    if !metadata.is_dir() {
        return Err(AppError::NotADirectory(path));
    }

    let mut dir = tokio::fs::read_dir(&validated).await?;
    let mut entries = Vec::new();

    while let Some(entry) = dir.next_entry().await? {
        let name = entry.file_name().to_string_lossy().into_owned();

        if name.starts_with('.') || SKIP_DIRS.contains(&name.as_str()) {
            continue;
        }

        let metadata = entry.metadata().await?;

        let modified = metadata
            .modified()
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        entries.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().into_owned(),
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
