mod commands;
mod db;
mod email;
mod graph_api;
mod mail_watcher;
mod proxy;
mod token_cache;

use std::sync::Arc;
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 启动邮件监听器
#[tauri::command]
async fn start_mail_watcher(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, db::AppState>,
    watcher_state: tauri::State<'_, Arc<mail_watcher::MailWatcherManager>>,
    email_id: i64,
    folder: String,
    interval_secs: Option<u64>,
) -> Result<(), String> {
    let interval = interval_secs.unwrap_or(60); // 默认 60 秒
    watcher_state
        .start_watcher(app_handle, state.db.clone(), email_id, folder, interval)
        .await
}

/// 停止邮件监听器
#[tauri::command]
async fn stop_mail_watcher(
    watcher_state: tauri::State<'_, Arc<mail_watcher::MailWatcherManager>>,
    email_id: i64,
) -> Result<(), String> {
    watcher_state.stop_watcher(email_id).await
}

/// 检查邮件监听器是否正在运行
#[tauri::command]
async fn is_mail_watcher_running(
    watcher_state: tauri::State<'_, Arc<mail_watcher::MailWatcherManager>>,
    email_id: i64,
) -> Result<bool, String> {
    Ok(watcher_state.is_running(email_id).await)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let pool = db::init_db(&handle)
                    .await
                    .expect("Failed to initialize database");
                handle.manage(db::AppState { db: pool });
            });

            // 初始化邮件监听器管理器
            let watcher_manager = Arc::new(mail_watcher::MailWatcherManager::new());
            app.manage(watcher_manager);

            Ok(())
        })
        // 注册后端命令
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::add_email,
            commands::get_emails,
            commands::delete_email,
            commands::import_emails,
            commands::check_outlook_email,
            commands::batch_check_outlook_emails,
            commands::get_mail_records,
            commands::get_attachments,
            commands::get_attachment_content,
            start_mail_watcher,
            stop_mail_watcher,
            is_mail_watcher_running
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
