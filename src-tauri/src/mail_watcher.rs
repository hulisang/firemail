//! 邮件监听器模块
//!
//! 提供后台轮询邮件的功能，通过 Tauri 事件机制通知前端

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::Serialize;
use sqlx::{Pool, Sqlite};
use tauri::{AppHandle, Emitter};

use crate::email::{self, MailRecord};

/// 邮件更新事件的 payload
#[derive(Debug, Clone, Serialize)]
pub struct MailUpdateEvent {
    /// 邮箱 ID
    pub email_id: i64,
    /// 文件夹
    pub folder: String,
    /// 新邮件数量
    pub new_count: usize,
    /// 删除邮件数量
    pub deleted_count: usize,
    /// 邮件记录列表
    pub records: Vec<MailRecord>,
    /// 消息
    pub message: String,
}

/// 进度事件的 payload
#[derive(Debug, Clone, Serialize)]
pub struct MailProgressEvent {
    /// 邮箱 ID
    pub email_id: i64,
    /// 进度 (0-100)
    pub progress: u8,
    /// 消息
    pub message: String,
}

/// 监听器状态
struct WatcherState {
    /// 是否正在运行
    running: bool,
    /// 取消信号
    cancel_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

/// 全局监听器管理器
pub struct MailWatcherManager {
    /// 每个邮箱的监听器状态 (email_id -> state)
    watchers: Arc<Mutex<HashMap<i64, WatcherState>>>,
}

impl MailWatcherManager {
    pub fn new() -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 启动邮件监听器
    pub async fn start_watcher(
        &self,
        app_handle: AppHandle,
        pool: Pool<Sqlite>,
        email_id: i64,
        folder: String,
        interval_secs: u64,
    ) -> Result<(), String> {
        let mut watchers = self.watchers.lock().await;

        // 如果已经在运行，先停止
        if let Some(state) = watchers.get_mut(&email_id) {
            if state.running {
                if let Some(tx) = state.cancel_tx.take() {
                    let _ = tx.send(());
                }
            }
        }

        // 创建取消信号
        let (cancel_tx, cancel_rx) = tokio::sync::oneshot::channel();

        // 更新状态
        watchers.insert(email_id, WatcherState {
            running: true,
            cancel_tx: Some(cancel_tx),
        });

        let watchers_clone = self.watchers.clone();

        // 启动后台任务
        tokio::spawn(async move {
            run_watcher(
                app_handle,
                pool,
                email_id,
                folder,
                interval_secs,
                cancel_rx,
                watchers_clone,
            ).await;
        });

        Ok(())
    }

    /// 停止邮件监听器
    pub async fn stop_watcher(&self, email_id: i64) -> Result<(), String> {
        let mut watchers = self.watchers.lock().await;

        if let Some(state) = watchers.get_mut(&email_id) {
            if state.running {
                if let Some(tx) = state.cancel_tx.take() {
                    let _ = tx.send(());
                }
                state.running = false;
            }
        }

        watchers.remove(&email_id);
        Ok(())
    }

    /// 检查监听器是否正在运行
    pub async fn is_running(&self, email_id: i64) -> bool {
        let watchers = self.watchers.lock().await;
        watchers.get(&email_id).map(|s| s.running).unwrap_or(false)
    }
}

/// 运行监听器的后台任务
async fn run_watcher(
    app_handle: AppHandle,
    pool: Pool<Sqlite>,
    email_id: i64,
    folder: String,
    interval_secs: u64,
    mut cancel_rx: tokio::sync::oneshot::Receiver<()>,
    watchers: Arc<Mutex<HashMap<i64, WatcherState>>>,
) {
    log::info!("邮件监听器启动: email_id={}, folder={}, interval={}s", email_id, folder, interval_secs);

    // 发送启动事件
    let _ = app_handle.emit("mail-watcher-started", serde_json::json!({
        "email_id": email_id,
        "folder": folder,
    }));

    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_secs));

    loop {
        tokio::select! {
            _ = interval.tick() => {
                // 发送进度事件
                let _ = app_handle.emit("mail-progress", MailProgressEvent {
                    email_id,
                    progress: 10,
                    message: "正在检查新邮件...".to_string(),
                });

                // 执行收件
                match email::check_outlook_email(&pool, email_id, &folder).await {
                    Ok(result) => {
                        log::info!("邮件检查完成: email_id={}, fetched={}, saved={}, deleted={}",
                            email_id, result.fetched, result.saved, result.deleted);

                        // 获取最新的邮件列表
                        let records = match email::get_mail_records(&pool, email_id).await {
                            Ok(r) => r,
                            Err(e) => {
                                log::error!("获取邮件记录失败: {}", e);
                                vec![]
                            }
                        };

                        // 过滤当前文件夹的邮件
                        let folder_records: Vec<MailRecord> = records
                            .into_iter()
                            .filter(|r| {
                                r.folder.as_ref()
                                    .map(|f| normalize_folder(f) == normalize_folder(&folder))
                                    .unwrap_or(false)
                            })
                            .collect();

                        // 发送更新事件
                        let _ = app_handle.emit("mail-updated", MailUpdateEvent {
                            email_id,
                            folder: folder.clone(),
                            new_count: result.saved,
                            deleted_count: result.deleted,
                            records: folder_records,
                            message: result.message,
                        });
                    }
                    Err(e) => {
                        log::error!("邮件检查失败: email_id={}, error={}", email_id, e);

                        // 发送错误事件
                        let _ = app_handle.emit("mail-error", serde_json::json!({
                            "email_id": email_id,
                            "folder": folder,
                            "error": e.to_string(),
                        }));
                    }
                }

                // 发送进度完成事件
                let _ = app_handle.emit("mail-progress", MailProgressEvent {
                    email_id,
                    progress: 100,
                    message: "检查完成".to_string(),
                });
            }
            _ = &mut cancel_rx => {
                log::info!("邮件监听器收到停止信号: email_id={}", email_id);
                break;
            }
        }
    }

    // 清理状态
    let mut watchers_guard = watchers.lock().await;
    watchers_guard.remove(&email_id);

    // 发送停止事件
    let _ = app_handle.emit("mail-watcher-stopped", serde_json::json!({
        "email_id": email_id,
        "folder": folder,
    }));

    log::info!("邮件监听器已停止: email_id={}", email_id);
}

/// 标准化文件夹名称
fn normalize_folder(folder: &str) -> String {
    let normalized = folder.trim().to_lowercase();
    if normalized.contains("junk") || normalized.contains("spam") || normalized.contains("垃圾") {
        "junk".to_string()
    } else {
        "inbox".to_string()
    }
}
