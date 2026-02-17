use std::path::PathBuf;

use crate::error::AppError;
use crate::utils::path::{validate_path, MAX_FILE_SIZE};

/// Reads the contents of a file as UTF-8 text.
/// Returns an error if the file exceeds [`MAX_FILE_SIZE`].
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, AppError> {
    let validated = validate_path(&path)?;

    let metadata = tokio::fs::metadata(&validated).await?;
    let size = metadata.len();
    if size > MAX_FILE_SIZE {
        return Err(AppError::FileTooLarge {
            size,
            max: MAX_FILE_SIZE,
        });
    }

    let content = tokio::fs::read_to_string(&validated).await?;
    Ok(content)
}

/// Writes text content to a file atomically (write to temp file, then rename).
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), AppError> {
    let validated = validate_path(&path)?;
    let tmp_path = {
        let mut name = validated.as_os_str().to_os_string();
        name.push(".tmp");
        PathBuf::from(name)
    };
    tokio::fs::write(&tmp_path, &content).await?;
    tokio::fs::rename(&tmp_path, &validated).await?;
    Ok(())
}

/// Renames (moves) a file from one path to another.
#[tauri::command]
pub async fn rename_file(old_path: String, new_path: String) -> Result<(), AppError> {
    let validated_old = validate_path(&old_path)?;
    let validated_new = validate_path(&new_path)?;
    tokio::fs::rename(&validated_old, &validated_new).await?;
    Ok(())
}

/// Deletes a file at the given path.
#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), AppError> {
    let validated = validate_path(&path)?;
    tokio::fs::remove_file(&validated).await?;
    Ok(())
}

/// Copies a file from source to destination.
#[tauri::command]
pub async fn copy_file(src_path: String, dest_path: String) -> Result<(), AppError> {
    let validated_src = validate_path(&src_path)?;
    let validated_dest = validate_path(&dest_path)?;
    tokio::fs::copy(&validated_src, &validated_dest).await?;
    Ok(())
}

/// Writes binary data to a file.
#[tauri::command]
pub async fn write_binary_file(dest_path: String, data: Vec<u8>) -> Result<(), AppError> {
    let validated = validate_path(&dest_path)?;
    tokio::fs::write(&validated, data).await?;
    Ok(())
}
