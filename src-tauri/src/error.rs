use serde::Serialize;

/// Application-wide error type for Tauri commands.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error("Path validation failed: {0}")]
    PathValidation(String),

    #[error("Path traversal detected")]
    PathTraversal,

    #[error("Not a directory: {0}")]
    NotADirectory(String),

    #[error("File too large: {size} bytes (max: {max} bytes)")]
    FileTooLarge { size: u64, max: u64 },

    #[error("IME operation failed: {0}")]
    #[cfg(target_os = "macos")]
    Ime(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
