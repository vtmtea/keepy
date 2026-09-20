use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{async_runtime::JoinHandle, AppHandle, Emitter};

use crate::{
    model::{ActivityPhase, ActivitySettings, ActivityStatus},
    mouse::{perform_activity_action, MouseDriver},
};

pub struct ActivityController {
    settings: Mutex<ActivitySettings>,
    status: Mutex<ActivityStatus>,
    task: Mutex<Option<JoinHandle<()>>>,
    generation: AtomicU64,
    driver: Arc<dyn MouseDriver>,
}

impl ActivityController {
    pub fn new(settings: ActivitySettings, driver: Arc<dyn MouseDriver>) -> Self {
        Self {
            status: Mutex::new(ActivityStatus {
                phase: ActivityPhase::Paused,
                interval_seconds: settings.interval_seconds,
                mode: settings.mode,
                last_action_at: None,
                next_action_at: None,
                error_message: None,
            }),
            settings: Mutex::new(settings),
            task: Mutex::new(None),
            generation: AtomicU64::new(0),
            driver,
        }
    }

    pub fn settings(&self) -> ActivitySettings {
        self.settings
            .lock()
            .expect("settings lock poisoned")
            .clone()
    }

    pub fn status(&self) -> ActivityStatus {
        self.status.lock().expect("status lock poisoned").clone()
    }

    pub fn update_settings(
        self: &Arc<Self>,
        app: &AppHandle,
        settings: ActivitySettings,
    ) -> ActivityStatus {
        *self.settings.lock().expect("settings lock poisoned") = settings.clone();
        let was_running = self.status().phase == ActivityPhase::Running;
        {
            let mut status = self.status.lock().expect("status lock poisoned");
            status.interval_seconds = settings.interval_seconds;
            status.mode = settings.mode;
        }
        if settings.mode == crate::model::ActivityMode::Click && !settings.click_acknowledged {
            self.pause(app)
        } else if was_running {
            self.start(app).expect("validated settings should restart")
        } else {
            let status = self.status();
            emit_status(app, &status);
            status
        }
    }

    pub fn start(self: &Arc<Self>, app: &AppHandle) -> Result<ActivityStatus, String> {
        let settings = self.settings();
        if settings.mode == crate::model::ActivityMode::Click && !settings.click_acknowledged {
            return Err("请先确认点击模式可能影响当前活动窗口。".into());
        }

        self.cancel_task();
        let generation = self.generation.load(Ordering::SeqCst);
        let next_action_at = now_ms() + settings.interval_seconds * 1000;
        {
            let mut status = self.status.lock().expect("status lock poisoned");
            status.phase = ActivityPhase::Running;
            status.interval_seconds = settings.interval_seconds;
            status.mode = settings.mode;
            status.next_action_at = Some(next_action_at);
            status.error_message = None;
        }
        let status = self.status();
        emit_status(app, &status);

        let controller = Arc::clone(self);
        let app = app.clone();
        let handle = tauri::async_runtime::spawn(async move {
            controller.run(generation, app).await;
        });
        *self.task.lock().expect("task lock poisoned") = Some(handle);
        Ok(status)
    }

    pub fn pause(&self, app: &AppHandle) -> ActivityStatus {
        self.cancel_task();
        {
            let mut status = self.status.lock().expect("status lock poisoned");
            status.phase = ActivityPhase::Paused;
            status.next_action_at = None;
            status.error_message = None;
        }
        let status = self.status();
        emit_status(app, &status);
        status
    }

    pub fn dispose(&self) {
        self.cancel_task();
    }

    async fn run(self: Arc<Self>, generation: u64, app: AppHandle) {
        loop {
            let settings = self.settings();
            tokio::time::sleep(Duration::from_secs(settings.interval_seconds)).await;
            if !self.is_current_running(generation) {
                return;
            }

            {
                let mut status = self.status.lock().expect("status lock poisoned");
                status.next_action_at = None;
            }
            emit_status(&app, &self.status());

            let driver = Arc::clone(&self.driver);
            let mode = settings.mode;
            let result = tauri::async_runtime::spawn_blocking(move || {
                perform_activity_action(driver.as_ref(), mode)
            })
            .await
            .unwrap_or_else(|error| Err(error.to_string()));

            if !self.is_current_running(generation) {
                return;
            }

            match result {
                Ok(()) => {
                    let next_settings = self.settings();
                    let mut status = self.status.lock().expect("status lock poisoned");
                    status.last_action_at = Some(now_ms());
                    status.interval_seconds = next_settings.interval_seconds;
                    status.mode = next_settings.mode;
                    status.next_action_at = Some(now_ms() + next_settings.interval_seconds * 1000);
                }
                Err(message) => {
                    let mut status = self.status.lock().expect("status lock poisoned");
                    status.phase = ActivityPhase::Error;
                    status.next_action_at = None;
                    status.error_message = Some(message);
                    emit_status(&app, &status);
                    return;
                }
            }
            emit_status(&app, &self.status());
        }
    }

    fn is_current_running(&self, generation: u64) -> bool {
        self.generation.load(Ordering::SeqCst) == generation
            && self.status().phase == ActivityPhase::Running
    }

    fn cancel_task(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        if let Some(task) = self.task.lock().expect("task lock poisoned").take() {
            task.abort();
        }
    }
}

pub fn emit_status(app: &AppHandle, status: &ActivityStatus) {
    let _ = app.emit("activity-status", status);
    crate::tray::update_tray(app, status);
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
