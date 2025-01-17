#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        // .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        //     let _ = app.get_webview_window("main")
        //                .expect("no main window")
        //                .set_focus();
        // }))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
