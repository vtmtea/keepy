use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

use crate::{
    commands::show_main_window,
    model::{ActivityPhase, ActivityStatus},
};

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_menu(app, "开始 Keepy")?;
    let mut builder = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .tooltip("Keepy · 鼠标活动助手")
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show" => {
                let _ = show_main_window(app);
            }
            "toggle" => {
                let state = app.state::<crate::commands::AppState>();
                if state.activity.status().phase == ActivityPhase::Running {
                    let _ = state.activity.pause(app);
                } else if state.activity.start(app).is_err() {
                    let _ = show_main_window(app);
                }
            }
            "quit" => {
                let state = app.state::<crate::commands::AppState>();
                *state.quitting.lock().expect("quitting lock poisoned") = true;
                state.activity.dispose();
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } = event
            {
                let _ = show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder.build(app)?;
    Ok(())
}

pub fn update_tray(app: &AppHandle, status: &ActivityStatus) {
    if let Some(tray) = app.tray_by_id("main") {
        let title = if status.phase == ActivityPhase::Running {
            "暂停 Keepy"
        } else {
            "开始 Keepy"
        };
        let _ = tray.set_show_menu_on_left_click(false);
        let _ = tray.set_tooltip(Some(title));
        if let Ok(menu) = build_menu(app, title) {
            let _ = tray.set_menu(Some(menu));
        }
        let _ = app.emit("tray-status", status);
    }
}

fn build_menu(app: &AppHandle, toggle_title: &str) -> tauri::Result<Menu<tauri::Wry>> {
    let toggle = MenuItem::with_id(app, "toggle", toggle_title, true, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "打开控制面板", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出 Keepy", true, None::<&str>)?;
    Menu::with_items(app, &[&toggle, &show, &quit])
}
