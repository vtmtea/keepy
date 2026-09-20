use serde::{Deserialize, Serialize};

pub const SETTINGS_VERSION: u8 = 1;
pub const MIN_INTERVAL_SECONDS: u64 = 10;
pub const MAX_INTERVAL_SECONDS: u64 = 3600;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActivityMode {
    Move,
    Click,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivitySettings {
    pub version: u8,
    pub interval_seconds: u64,
    pub mode: ActivityMode,
    pub click_acknowledged: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivitySettingsInput {
    pub interval_seconds: u64,
    pub mode: ActivityMode,
    pub click_acknowledged: bool,
}

impl Default for ActivitySettings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            interval_seconds: 60,
            mode: ActivityMode::Move,
            click_acknowledged: false,
        }
    }
}

impl TryFrom<ActivitySettingsInput> for ActivitySettings {
    type Error = String;

    fn try_from(input: ActivitySettingsInput) -> Result<Self, Self::Error> {
        if !(MIN_INTERVAL_SECONDS..=MAX_INTERVAL_SECONDS).contains(&input.interval_seconds) {
            return Err(format!(
                "间隔必须是 {MIN_INTERVAL_SECONDS} 到 {MAX_INTERVAL_SECONDS} 秒之间的整数。"
            ));
        }

        Ok(Self {
            version: SETTINGS_VERSION,
            interval_seconds: input.interval_seconds,
            mode: input.mode,
            click_acknowledged: input.click_acknowledged,
        })
    }
}

impl ActivitySettings {
    pub fn validate(self) -> Result<Self, String> {
        if self.version != SETTINGS_VERSION {
            return Err("设置版本不兼容。".into());
        }
        Self::try_from(ActivitySettingsInput {
            interval_seconds: self.interval_seconds,
            mode: self.mode,
            click_acknowledged: self.click_acknowledged,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActivityPhase {
    Paused,
    Running,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityStatus {
    pub phase: ActivityPhase,
    pub interval_seconds: u64,
    pub mode: ActivityMode,
    pub last_action_at: Option<u64>,
    pub next_action_at: Option<u64>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CloseAction {
    Quit,
    Tray,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
    pub version: u8,
    pub width: u32,
    pub height: u32,
    pub close_action: CloseAction,
    pub prompt_on_close: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            version: 1,
            width: 780,
            height: 650,
            close_action: CloseAction::Tray,
            prompt_on_close: true,
        }
    }
}

impl WindowState {
    pub fn validate(self) -> Result<Self, String> {
        if self.version != 1
            || !(620..=3840).contains(&self.width)
            || !(560..=2160).contains(&self.height)
        {
            return Err("窗口状态无效。".into());
        }
        Ok(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_settings_range() {
        let input = ActivitySettingsInput {
            interval_seconds: 9,
            mode: ActivityMode::Move,
            click_acknowledged: false,
        };
        assert!(ActivitySettings::try_from(input).is_err());
    }

    #[test]
    fn validates_window_dimensions() {
        let state = WindowState {
            width: 619,
            ..WindowState::default()
        };
        assert!(state.validate().is_err());
    }
}
