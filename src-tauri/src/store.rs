use serde::{de::DeserializeOwned, Serialize};
use std::{
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

use crate::model::{ActivitySettings, WindowState};

pub struct Stores {
    settings_path: PathBuf,
    window_state_path: PathBuf,
}

impl Stores {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?;
        fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;
        migrate_legacy_data(app, &data_dir);
        Ok(Self {
            settings_path: data_dir.join("settings.json"),
            window_state_path: data_dir.join("window-state.json"),
        })
    }

    pub fn load_settings(&self) -> ActivitySettings {
        read_json::<ActivitySettings>(&self.settings_path)
            .and_then(|value| value.validate().ok())
            .unwrap_or_default()
    }

    pub fn save_settings(&self, settings: &ActivitySettings) -> Result<(), String> {
        write_json(&self.settings_path, settings)
    }

    pub fn load_window_state(&self) -> WindowState {
        read_json::<WindowState>(&self.window_state_path)
            .and_then(|value| value.validate().ok())
            .unwrap_or_default()
    }

    pub fn save_window_state(&self, state: &WindowState) -> Result<(), String> {
        write_json(&self.window_state_path, state)
    }
}

fn read_json<T: DeserializeOwned>(path: &Path) -> Option<T> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let temporary = path.with_extension("json.tmp");
    let mut content = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    content.push('\n');
    fs::write(&temporary, content).map_err(|error| error.to_string())?;
    fs::rename(&temporary, path).map_err(|error| error.to_string())
}

fn migrate_legacy_data(app: &AppHandle, target_dir: &Path) {
    let Some(parent) = target_dir.parent() else {
        return;
    };
    let mut candidates = vec![parent.join("keepy"), parent.join("Keepy")];
    if let Ok(config_dir) = app.path().config_dir() {
        candidates.push(config_dir.join("keepy"));
        candidates.push(config_dir.join("Keepy"));
    }

    for file_name in ["settings.json", "window-state.json"] {
        let destination = target_dir.join(file_name);
        if destination.exists() {
            continue;
        }
        for candidate in &candidates {
            let source = candidate.join(file_name);
            match fs::copy(&source, &destination) {
                Ok(_) => break,
                Err(error) if error.kind() == ErrorKind::NotFound => {}
                Err(_) => break,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_and_reads_json_atomically() {
        let path = std::env::temp_dir().join(format!("keepy-settings-{}.json", std::process::id()));
        let settings = ActivitySettings::default();
        write_json(&path, &settings).unwrap();
        assert_eq!(read_json::<ActivitySettings>(&path), Some(settings));
        let _ = fs::remove_file(path);
    }
}
