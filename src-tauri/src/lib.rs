mod commands;
mod crypto;
mod github;
mod models;
mod issue_trackers;
mod triage;

// Re-export github module for backward compatibility
pub use github::*;

use models::AppState;
use rusqlite::params;
use std::panic;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    panic::set_hook(Box::new(|info| {
        eprintln!("[DevDash PANIC] {}", info);
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");

            let state = AppState::new(app_data_dir)
                .expect("failed to initialize database");

            app.manage(state);
            
            // ─── Auto cleanup old data on startup ──────────────────────────────────
            {
                let state = app.state::<AppState>();
                let db = state.db.lock().expect("db lock");
                let cutoff = chrono::Utc::now() - chrono::Duration::days(7);
                let affected = db
                    .execute(
                        "DELETE FROM data_items WHERE fetched_at < ?1",
                        params![cutoff.to_rfc3339()],
                    )
                    .unwrap_or(0);
                if affected > 0 {
                    log::info!("Auto-cleaned {} old data_items on startup", affected);
                }
            }

            // ─── Auto encrypt plaintext tokens on startup ──────────────────────────
            {
                let state = app.state::<AppState>();
                eprintln!("[DevDash DIAG] master_key len = {}", state.master_key.len());
                let db = match state.db.lock() {
                    Ok(d) => { eprintln!("[DevDash DIAG] db lock OK"); d }
                    Err(e) => { eprintln!("[DevDash DIAG] db lock FAILED: {}", e); return Ok(()); }
                };
                let mut migrated = 0;
                let errored = 0;
                
                let mut stmt = match db.prepare("SELECT id, config FROM sources") {
                    Ok(s) => { eprintln!("[DevDash DIAG] prepare OK"); s }
                    Err(e) => { eprintln!("[DevDash DIAG] prepare FAILED: {}", e); return Ok(()); }
                };
                let sources: Vec<(String, String)> = stmt.query_map([], |r| {
                    Ok((r.get(0)?, r.get::<_, String>(1)?))
                }).expect("query").filter_map(|r| r.ok()).collect();
                eprintln!("[DevDash DIAG] found {} sources", sources.len());
                drop(stmt);
                
                for (id, config_str) in &sources {
                    eprintln!("[DevDash DIAG] source id={}, config_len={}", &id[..8.min(id.len())], config_str.len());
                    let mut config: serde_json::Value = serde_json::from_str(config_str).unwrap_or_default();
                    let mut changed = false;
                    
                    // Encrypt token if it's plaintext (starts with ghp_)
                    if let Some(token) = config.get("token").and_then(|t| t.as_str()) {
                        eprintln!("[DevDash DIAG] token found, starts_with_ghp={}", token.starts_with("ghp_"));
                        if token.starts_with("ghp_") {
                            let encrypted = crypto::encrypt_token(&state.master_key, token);
                            use base64::Engine;
                            let encoded = base64::engine::general_purpose::STANDARD.encode(&encrypted);
                            eprintln!("[DevDash DIAG] encrypt OK, encoded_len={}", encoded.len());
                            config["token"] = serde_json::json!(encoded);
                            changed = true;
                            migrated += 1;
                        }
                    } else {
                        eprintln!("[DevDash DIAG] no token field in config");
                    }
                    
                    if changed {
                        let new_config = serde_json::to_string(&config).unwrap_or_default();
                        match db.execute(
                            "UPDATE sources SET config = ?1 WHERE id = ?2",
                            params![new_config, id],
                        ) {
                            Ok(rows) => eprintln!("[DevDash DIAG] UPDATE OK, rows={}", rows),
                            Err(e) => eprintln!("[DevDash DIAG] UPDATE FAILED: {}", e),
                        }
                    }
                }
                
                eprintln!("[DevDash DIAG] migrated={}, errored={}", migrated, errored);

                // ─── Auto-poll on startup ───────────────────────────────────────
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    use crate::github::poll_sources;
                    use crate::models::AppState;
                    let state = app_handle.state::<AppState>();
                    match poll_sources(app_handle.clone(), state).await {
                        Ok(r) => eprintln!("[DevDash DIAG] Startup poll result: {:?}", r),
                        Err(e) => eprintln!("[DevDash DIAG] Startup poll FAILED: {}", e),
                    }
                });
            }

            // ─── System tray ──────────────────────────────────────────────
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
            use tauri::menu::{MenuBuilder, MenuItemBuilder};
            let handle = app.handle().clone();

            let show_item = MenuItemBuilder::with_id("show", "显示窗口").build(app.handle())?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出 DevDash").build(app.handle())?;
            let tray_menu = MenuBuilder::new(app.handle()).item(&show_item).item(&quit_item).build()?;

            let _tray = TrayIconBuilder::new()
                .tooltip("DevDash — 开发者仪表盘")
                .on_tray_icon_event(move |_tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .on_menu_event(|_app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = _app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        _app.exit(0);
                    }
                    _ => {}
                })
                .menu(&tray_menu)
                .build(app)?;

            // Minimize to tray
            if let Some(window) = app.get_webview_window("main") {
                let _close_request = window.clone();
                let _close_handler = window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let minimize = {
                            let state = _close_request.state::<AppState>();
                            let db = match state.db.lock() {
                                Ok(d) => d,
                                Err(_) => { return; }
                            };
                            let val: Option<String> = db
                                .query_row("SELECT value FROM settings WHERE key = 'app'", [], |r| r.get(0))
                                .ok();
                            match val {
                                Some(v) => {
                                    let s: Result<serde_json::Value, _> = serde_json::from_str(&v);
                                    s.map(|j| j["minimizeToTray"].as_bool().unwrap_or(true)).unwrap_or(true)
                                }
                                None => true,
                            }
                        };
                        if minimize {
                            api.prevent_close();
                            let _ = _close_request.hide();
                        }
                    }
                });
            }

            log::info!("DevDash started successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Sources
            commands::list_sources,
            commands::create_source,
            commands::delete_source,
            // Dashboards
            commands::list_dashboards,
            commands::create_dashboard,
            commands::delete_dashboard,
            // Widgets
            commands::create_widget,
            commands::delete_widget,
            commands::update_widget_position,
            // Data
            commands::get_data_items,
            commands::cleanup_data_items,
            // Settings
            commands::get_settings,
            commands::save_settings,
            // AI
            commands::generate_ai_summary,
            commands::test_ai_connection,
            // GitHub / GitLab fetch
            github::fetch_github_data,
            github::fetch_gitlab_data,
            github::poll_sources,
            github::fetch_github_contributions,
            github::diagnose_github_data,
            // PR Quick Actions
            github::github_approve_pr,
            github::github_merge_pr,
            github::github_comment_pr,
            github::github_close_pr,
            github::github_request_review,
            // Issue trackers
            issue_trackers::fetch_jira_data,
            issue_trackers::fetch_linear_data,
            issue_trackers::fetch_tracker_data,
            // Triage
            triage::get_triage_queue,
            triage::triage_action,
            // Debug
            commands::debug_db_state,
            commands::verify_github_token,
            commands::encrypt_existing_tokens,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}