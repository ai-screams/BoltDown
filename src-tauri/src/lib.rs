mod commands;
mod error;
mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::file::read_file,
            commands::file::write_file,
            commands::file::rename_file,
            commands::file::delete_file,
            commands::file::copy_file,
            commands::file::write_binary_file,
            commands::directory::list_directory,
            commands::settings::read_settings,
            commands::settings::write_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
