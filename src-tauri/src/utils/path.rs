use std::path::{Component, PathBuf};

use crate::error::AppError;

/// Maximum file size for read operations (50 MB).
pub const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;

/// Validates that a path does not contain traversal components after resolution.
/// For destination paths where the file may not yet exist, validates the parent directory.
pub fn validate_path(path_str: &str) -> Result<PathBuf, AppError> {
    let path = PathBuf::from(path_str);

    // Try to canonicalize directly (works for existing paths).
    // For new files: canonicalize parent, then append the filename.
    let canonical = path.canonicalize().or_else(|_| {
        let parent = path
            .parent()
            .ok_or_else(|| AppError::PathValidation("No parent directory".into()))?;
        let file_name = path
            .file_name()
            .ok_or_else(|| AppError::PathValidation("No file name".into()))?;
        parent
            .canonicalize()
            .map(|p| p.join(file_name))
            .map_err(|e| {
                AppError::PathValidation(format!("Parent directory does not exist: {}", e))
            })
    })?;

    // Reject if any component is still a parent-dir reference
    if canonical.components().any(|c| c == Component::ParentDir) {
        return Err(AppError::PathTraversal);
    }

    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_existing_path() {
        let result = validate_path("/tmp");
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_nonexistent_parent() {
        let result = validate_path("/nonexistent/path/file.txt");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_new_file_in_existing_dir() {
        let result = validate_path("/tmp/boltdown_test_new_file.txt");
        assert!(result.is_ok());
    }
}
