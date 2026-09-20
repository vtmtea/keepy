use crate::model::ActivityMode;
use std::{thread, time::Duration};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MousePosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScreenBounds {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

pub trait MouseDriver: Send + Sync {
    fn get_position(&self) -> Result<MousePosition, String>;
    fn screen_bounds_at(&self, position: MousePosition) -> Result<ScreenBounds, String>;
    fn move_to(&self, position: MousePosition) -> Result<(), String>;
    fn click(&self) -> Result<(), String>;
}

pub fn perform_activity_action(driver: &dyn MouseDriver, mode: ActivityMode) -> Result<(), String> {
    if mode == ActivityMode::Click {
        return driver.click();
    }

    let original = driver.get_position()?;
    let bounds = driver.screen_bounds_at(original)?;
    let target = choose_nudge_position(original, bounds);
    let before_move = driver.get_position()?;
    if before_move != original || target == original {
        return Ok(());
    }

    driver.move_to(target)?;
    thread::sleep(Duration::from_millis(80));
    if driver.get_position()? == target {
        driver.move_to(original)?;
    }
    Ok(())
}

pub fn choose_nudge_position(position: MousePosition, bounds: ScreenBounds) -> MousePosition {
    let step = 2;
    let right = bounds.x + (bounds.width - 1).max(0);
    let bottom = bounds.y + (bounds.height - 1).max(0);
    if position.x + step <= right {
        MousePosition {
            x: position.x + step,
            y: position.y,
        }
    } else if position.x - step >= bounds.x {
        MousePosition {
            x: position.x - step,
            y: position.y,
        }
    } else if position.y + step <= bottom {
        MousePosition {
            x: position.x,
            y: position.y + step,
        }
    } else if position.y - step >= bounds.y {
        MousePosition {
            x: position.x,
            y: position.y - step,
        }
    } else {
        position
    }
}

#[cfg(windows)]
pub struct NativeMouseDriver;

#[cfg(windows)]
impl MouseDriver for NativeMouseDriver {
    fn get_position(&self) -> Result<MousePosition, String> {
        use windows::Win32::{Foundation::POINT, UI::WindowsAndMessaging::GetCursorPos};
        let mut point = POINT::default();
        unsafe { GetCursorPos(&mut point) }.map_err(|error| error.to_string())?;
        Ok(MousePosition {
            x: point.x,
            y: point.y,
        })
    }

    fn screen_bounds_at(&self, position: MousePosition) -> Result<ScreenBounds, String> {
        use windows::Win32::{
            Foundation::{POINT, RECT},
            Graphics::Gdi::{
                GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
            },
        };
        let monitor = unsafe {
            MonitorFromPoint(
                POINT {
                    x: position.x,
                    y: position.y,
                },
                MONITOR_DEFAULTTONEAREST,
            )
        };
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            rcMonitor: RECT::default(),
            rcWork: RECT::default(),
            dwFlags: 0,
        };
        if !unsafe { GetMonitorInfoW(monitor, &mut info) }.as_bool() {
            return Err("无法读取显示器边界。".into());
        }
        Ok(ScreenBounds {
            x: info.rcMonitor.left,
            y: info.rcMonitor.top,
            width: info.rcMonitor.right - info.rcMonitor.left,
            height: info.rcMonitor.bottom - info.rcMonitor.top,
        })
    }

    fn move_to(&self, position: MousePosition) -> Result<(), String> {
        use windows::Win32::UI::WindowsAndMessaging::SetCursorPos;
        unsafe { SetCursorPos(position.x, position.y) }.map_err(|error| error.to_string())
    }

    fn click(&self) -> Result<(), String> {
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
            MOUSEINPUT,
        };
        let inputs = [
            INPUT {
                r#type: INPUT_MOUSE,
                Anonymous: INPUT_0 {
                    mi: MOUSEINPUT {
                        dwFlags: MOUSEEVENTF_LEFTDOWN,
                        ..Default::default()
                    },
                },
            },
            INPUT {
                r#type: INPUT_MOUSE,
                Anonymous: INPUT_0 {
                    mi: MOUSEINPUT {
                        dwFlags: MOUSEEVENTF_LEFTUP,
                        ..Default::default()
                    },
                },
            },
        ];
        let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
        if sent == inputs.len() as u32 {
            Ok(())
        } else {
            Err("无法发送鼠标点击。".into())
        }
    }
}

#[cfg(not(windows))]
pub struct NativeMouseDriver;

#[cfg(not(windows))]
impl MouseDriver for NativeMouseDriver {
    fn get_position(&self) -> Result<MousePosition, String> {
        Err("鼠标操作仅支持 Windows。".into())
    }
    fn screen_bounds_at(&self, _: MousePosition) -> Result<ScreenBounds, String> {
        Err("鼠标操作仅支持 Windows。".into())
    }
    fn move_to(&self, _: MousePosition) -> Result<(), String> {
        Err("鼠标操作仅支持 Windows。".into())
    }
    fn click(&self) -> Result<(), String> {
        Err("鼠标操作仅支持 Windows。".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nudges_left_at_right_edge() {
        assert_eq!(
            choose_nudge_position(
                MousePosition { x: 1919, y: 500 },
                ScreenBounds {
                    x: 0,
                    y: 0,
                    width: 1920,
                    height: 1080
                }
            ),
            MousePosition { x: 1917, y: 500 }
        );
    }
}
