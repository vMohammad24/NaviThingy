use serde::Deserialize;
#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

#[cfg(desktop)]
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};

use std::sync::{Arc, Mutex};
use tauri::Manager;

pub mod mpv;
use mpv::MpvPlayer;

pub mod discord_rpc;
use discord_rpc::DiscordClient;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mpv_player = Arc::new(Mutex::new(MpvPlayer::new()));
    let discord_client = Arc::new(Mutex::new(DiscordClient::new()));

    let builder = tauri::Builder::default()
        .manage(mpv_player.clone())
        .manage(discord_client.clone())
        .invoke_handler(tauri::generate_handler![
            mpv_init,
            mpv_get_status,
            mpv_load,
            mpv_play,
            mpv_pause,
            mpv_stop,
            mpv_seek,
            mpv_seek_precise,
            mpv_set_volume,
            mpv_load_playlist,
            mpv_load_playlist_optimized,
            mpv_set_playlist_position,
            mpv_playlist_next,
            mpv_playlist_prev,
            mpv_playlist_play_index,
            mpv_playlist_jump_to_index,
            update_rpc
        ]);

    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::MacosLauncher;
        let builder = builder
            .plugin(tauri_plugin_autostart::init(
                MacosLauncher::LaunchAgent,
                Some(vec![]),
            ))
            .plugin(tauri_plugin_window_state::Builder::new().build())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_os::init())
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                let window = app.get_webview_window("main").expect("no main window");
                let _ = window.set_focus();
                let _ = window.restore_state(StateFlags::all());
            }))
            .setup(|app| {
                if let Some(discord_state) = app.try_state::<Arc<Mutex<DiscordClient>>>() {
                    if let Ok(mut client) = discord_state.lock() {
                        client.initialize();
                    }
                }

                let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

                let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            let mpv_state = app.state::<Arc<Mutex<MpvPlayer>>>();
                            if let Ok(mut player) = mpv_state.lock() {
                                player.shutdown();
                            }
                            if let Some(discord_state) =
                                app.try_state::<Arc<Mutex<DiscordClient>>>()
                            {
                                if let Ok(mut client) = discord_state.lock() {
                                    client.shutdown();
                                }
                            }

                            app.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    })
                    .build(app)?;

                Ok(())
            })
            .on_window_event(|window, event| match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = window.app_handle().save_window_state(StateFlags::all());
                    if let Some(window) = window.app_handle().get_webview_window("main") {
                        let _ = window.hide();
                    } else {
                        window.close().unwrap();
                    }
                }
                tauri::WindowEvent::Destroyed => {
                    let app_handle = window.app_handle();
                    if let Some(state) = app_handle.try_state::<Arc<Mutex<MpvPlayer>>>() {
                        let player_ref = state.clone();
                        let _ = player_ref.lock().map(|mut player| player.shutdown());
                    }

                    if let Some(discord_state) = app_handle.try_state::<Arc<Mutex<DiscordClient>>>()
                    {
                        let discord_ref = discord_state.clone();
                        let _ = discord_ref.lock().map(|mut client| client.shutdown());
                    }
                }
                _ => {}
            });

        builder
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }

    #[cfg(mobile)]
    {
        builder
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }
}

#[tauri::command]
fn mpv_init(custom_path: Option<String>, app_handle: tauri::AppHandle) -> Result<bool, String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let mut player = state.lock().unwrap();
    player.init(custom_path)
}

#[tauri::command]
fn mpv_get_status(app_handle: tauri::AppHandle) -> Result<mpv::MpvStatus, String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let player = state.lock().unwrap();
    Ok(player.get_status())
}

#[tauri::command]
fn mpv_load(url: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let mut player = state.lock().unwrap();
    player.load(&url)
}

#[tauri::command]
fn mpv_play(app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let mut player = state.lock().unwrap();
    player.play()
}

#[tauri::command]
fn mpv_pause(app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let mut player = state.lock().unwrap();
    player.pause()
}

#[tauri::command]
fn mpv_stop(app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let mut player = state.lock().unwrap();
    player.stop()
}

#[tauri::command]
fn mpv_seek(position: f64, app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let mut player = state.lock().unwrap();
    player.seek(position)
}

#[tauri::command]
fn mpv_set_volume(volume: f64, app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let mut player = state.lock().unwrap();
    player.set_volume(volume)
}

#[tauri::command]
fn mpv_load_playlist(urls: Vec<String>, app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let mut player = state.lock().unwrap();
    player.load_playlist(urls)
}

#[tauri::command]
fn mpv_load_playlist_optimized(
    urls: Vec<String>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let mut player = state.lock().unwrap();
    player.load_playlist_optimized(urls)
}

#[tauri::command]
fn mpv_set_playlist_position(index: usize, app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let mut player = state.lock().unwrap();
    player.set_playlist_position(index)
}

#[tauri::command]
fn mpv_playlist_next(app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let mut player = state.lock().unwrap();
    player.playlist_next()
}

#[tauri::command]
fn mpv_playlist_prev(app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let mut player = state.lock().unwrap();
    player.playlist_prev()
}

#[tauri::command]
fn mpv_playlist_play_index(index: usize, app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let mut player = state.lock().unwrap();
    player.playlist_play_index(index)
}

#[tauri::command]
fn mpv_playlist_jump_to_index(index: usize, app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let mut player = state.lock().unwrap();
    player.playlist_jump_to_index(index)
}

#[tauri::command]
fn mpv_seek_precise(position: f64, app_handle: tauri::AppHandle) -> Result<(), String> {
    let state = app_handle.state::<Arc<Mutex<MpvPlayer>>>();
    let mut player = state.lock().unwrap();
    player.seek(position)
}

#[derive(Deserialize)]
struct DiscordRPC {
    app_id: Option<String>,
    details: Option<String>,
    state: Option<String>,
    large_image: Option<String>,
    small_image: Option<String>,
    start_time: Option<String>,
    end_time: Option<String>,
}

#[tauri::command]
async fn update_rpc(rpc: DiscordRPC, app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(discord_state) = app_handle.try_state::<Arc<Mutex<DiscordClient>>>() {
        if let Ok(mut client) = discord_state.lock() {
            return client.update_presence(
                rpc.app_id,
                rpc.details,
                rpc.state,
                rpc.large_image,
                rpc.small_image,
                rpc.start_time,
                rpc.end_time,
            );
        }
    }
    Err("failed to setup discord rpc".into())
}
