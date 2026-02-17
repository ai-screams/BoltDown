use tauri::Manager;

use crate::error::AppError;

/// Reads the application settings from the app data directory.
/// Returns `"null"` if the settings file does not exist yet.
#[tauri::command]
pub async fn read_settings(app_handle: tauri::AppHandle) -> Result<String, AppError> {
    let path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::PathValidation(format!("Failed to resolve app data dir: {}", e)))?
        .join("settings.json");

    match tokio::fs::read_to_string(&path).await {
        Ok(content) => Ok(content),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok("null".to_string()),
        Err(e) => Err(AppError::Io(e)),
    }
}

/// Writes the application settings to the app data directory atomically.
/// Creates the directory if it does not exist.
#[tauri::command]
pub async fn write_settings(
    app_handle: tauri::AppHandle,
    settings: String,
) -> Result<(), AppError> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::PathValidation(format!("Failed to resolve app data dir: {}", e)))?;

    tokio::fs::create_dir_all(&dir).await?;

    let path = dir.join("settings.json");
    let tmp_path = dir.join("settings.json.tmp");

    tokio::fs::write(&tmp_path, &settings).await?;
    tokio::fs::rename(&tmp_path, &path).await?;

    Ok(())
}
