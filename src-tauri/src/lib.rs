mod activity;
mod commands;
mod model;
mod mouse;
mod store;
mod tray;

use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};
use tauri_plugin_single_instance::init as single_instance;

use activity::ActivityController;
use commands::AppState;
use mouse::NativeMouseDriver;
use store::Stores;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(single_instance(|app, _args, _cwd| {
            let _ = commands::show_main_window(app);
        }))
        .setup(|app| {
            let stores = Stores::new(app.handle())?;
            let settings = stores.load_settings();
            let window_state = stores.load_window_state();
            let activity = Arc::new(ActivityController::new(
                settings,
                Arc::new(NativeMouseDriver),
            ));
            app.manage(AppState {
                activity,
                stores,
                window_state: Mutex::new(window_state.clone()),
                quitting: Mutex::new(false),
            });
            tray::setup_tray(app.handle())?;
            if let Some(window) = app.get_webview_window("main") {
                commands::restore_window(&window, &window_state);
                let app_handle = app.handle().clone();
                let event_window = window.clone();
                let handler_window = window.clone();
                event_window.on_window_event(move |event| match event {
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        let state = app_handle.state::<AppState>();
                        let quitting = *state.quitting.lock().expect("quitting lock poisoned");
                        if quitting {
                            return;
                        }
                        let window_state = state
                            .window_state
                            .lock()
                            .expect("window state lock poisoned")
                            .clone();
                        commands::save_window_size(&handler_window, &state);
                        if window_state.prompt_on_close {
                            api.prevent_close();
                            let _ = handler_window.emit(
                                "window-close-request",
                                serde_json::json!({
                                    "defaultAction": window_state.close_action,
                                    "promptOnClose": window_state.prompt_on_close,
                                }),
                            );
                        } else {
                            api.prevent_close();
                            let _ = commands::apply_close_action(
                                &app_handle,
                                &state,
                                window_state.close_action,
                            );
                        }
                    }
                    tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_) => {
                        let state = app_handle.state::<AppState>();
                        commands::save_window_size(&handler_window, &state);
                    }
                    _ => {}
                });
                let _ = window.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::get_status,
            commands::start_activity,
            commands::pause_activity,
            commands::show_window,
            commands::resolve_close,
            commands::quit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Keepy");
}
