use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, PhysicalSize, State, WebviewWindow};

use crate::{
    activity::ActivityController,
    model::{ActivitySettings, ActivitySettingsInput, ActivityStatus, CloseAction, WindowState},
    store::Stores,
};

pub struct AppState {
    pub activity: Arc<ActivityController>,
    pub stores: Stores,
    pub window_state: Mutex<WindowState>,
    pub quitting: Mutex<bool>,
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> ActivitySettings {
    state.activity.settings()
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    input: ActivitySettingsInput,
) -> Result<ActivitySettings, String> {
    let settings = ActivitySettings::try_from(input)?;
    state.stores.save_settings(&settings)?;
    state.activity.update_settings(&app, settings.clone());
    Ok(settings)
}

#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> ActivityStatus {
    state.activity.status()
}

#[tauri::command]
pub fn start_activity(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ActivityStatus, String> {
    state.activity.start(&app)
}

#[tauri::command]
pub fn pause_activity(app: AppHandle, state: State<'_, AppState>) -> ActivityStatus {
    state.activity.pause(&app)
}

#[tauri::command]
pub fn show_window(app: AppHandle) -> Result<(), String> {
    show_main_window(&app)
}

#[tauri::command]
pub fn resolve_close(
    app: AppHandle,
    state: State<'_, AppState>,
    action: CloseAction,
    remember: bool,
) -> Result<(), String> {
    if remember {
        let next = {
            let mut window_state = state
                .window_state
                .lock()
                .map_err(|error| error.to_string())?;
            window_state.close_action = action;
            window_state.prompt_on_close = false;
            window_state.clone()
        };
        state.stores.save_window_state(&next)?;
    }
    apply_close_action(&app, &state, action)
}

#[tauri::command]
pub fn quit_app(app: AppHandle, state: State<'_, AppState>) {
    *state.quitting.lock().expect("quitting lock poisoned") = true;
    state.activity.dispose();
    app.exit(0);
}

pub fn apply_close_action(
    app: &AppHandle,
    state: &AppState,
    action: CloseAction,
) -> Result<(), String> {
    match action {
        CloseAction::Quit => {
            *state.quitting.lock().map_err(|error| error.to_string())? = true;
            state.activity.dispose();
            app.exit(0);
        }
        CloseAction::Tray => {
            app.get_webview_window("main")
                .ok_or_else(|| "主窗口不存在。".to_string())?
                .hide()
                .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

pub fn show_main_window(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "主窗口不存在。".to_string())?;
    if window.is_minimized().map_err(|error| error.to_string())? {
        window.unminimize().map_err(|error| error.to_string())?;
    }
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

pub fn restore_window(window: &WebviewWindow, state: &WindowState) {
    let _ = window.set_size(PhysicalSize::new(state.width, state.height));
}

pub fn save_window_size(window: &WebviewWindow, state: &AppState) {
    let Ok(size) = window.inner_size() else {
        return;
    };
    let next = {
        let Ok(mut window_state) = state.window_state.lock() else {
            return;
        };
        window_state.width = size.width.clamp(620, 3840);
        window_state.height = size.height.clamp(560, 2160);
        window_state.clone()
    };
    let _ = state.stores.save_window_state(&next);
}
