use crate::crypto::encrypt_token;
use crate::models::AppState;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn json_or_default(s: Option<String>) -> serde_json::Value {
    s.and_then(|v| serde_json::from_str(&v).ok()).unwrap_or_default()
}

// ─── DataSource ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct DataSource {
    pub id: String,
    #[serde(rename = "pluginId")]
    pub plugin_id: String,
    #[serde(rename = "type")]
    pub source_type: String,
    pub label: String,
    pub config: serde_json::Value,
    #[serde(rename = "pollMs")]
    pub poll_ms: i64,
    pub enabled: bool,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateSource {
    #[serde(rename = "pluginId")]
    pub plugin_id: String,
    #[serde(rename = "type")]
    pub source_type: String,
    pub label: String,
    pub config: serde_json::Value,
    #[serde(rename = "pollMs")]
    pub poll_ms: Option<i64>,
    pub enabled: Option<bool>,
}

#[tauri::command]
pub fn list_sources(state: State<AppState>) -> Result<Vec<DataSource>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, plugin_id, type, label, config, poll_ms, enabled, created_at, updated_at FROM sources")
        .map_err(|e| e.to_string())?;
    let rows: Vec<Result<DataSource, rusqlite::Error>> = stmt
        .query_map([], |row| {
            let config_str: Option<String> = row.get(4)?;
            let mut config = json_or_default(config_str);
            
            // Decrypt token for frontend display (mask it for security)
            if let Some(token) = config.get("token").and_then(|t| t.as_str()) {
                if !token.is_empty() {
                    // Check if it's base64-encoded encrypted data
                    if let Ok(bytes) = BASE64.decode(token) {
                        if bytes.len() >= 28 {
                            // Try to decrypt
                            if let Ok(decrypted) = crate::crypto::decrypt_token(&state.master_key, &bytes) {
                                // Mask the token for display (show only first 8 and last 4 chars)
                                let masked = if decrypted.len() > 12 {
                                    format!("{}...{}", &decrypted[..8], &decrypted[decrypted.len()-4..])
                                } else {
                                    "***".to_string()
                                };
                                config["token"] = serde_json::json!(masked);
                            }
                        }
                    }
                    // If not base64 or decryption failed, it's plaintext - mask it
                    else {
                        let masked = if token.len() > 12 {
                            format!("{}...{}", &token[..8], &token[token.len()-4..])
                        } else {
                            "***".to_string()
                        };
                        config["token"] = serde_json::json!(masked);
                    }
                }
            }
            
            // Also handle api_token and api_key
            for key in ["api_token", "api_key"] {
                if let Some(token) = config.get(key).and_then(|t| t.as_str()) {
                    if !token.is_empty() {
                        if let Ok(bytes) = BASE64.decode(token) {
                            if bytes.len() >= 28 {
                                if let Ok(_) = crate::crypto::decrypt_token(&state.master_key, &bytes) {
                                    config[key] = serde_json::json!("***encrypted***");
                                }
                            }
                        } else {
                            config[key] = serde_json::json!("***");
                        }
                    }
                }
            }
            
            Ok(DataSource {
                id: row.get(0)?,
                plugin_id: row.get(1)?,
                source_type: row.get(2)?,
                label: row.get(3)?,
                config,
                poll_ms: row.get(5)?,
                enabled: row.get::<_, i64>(6)? == 1,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect();
    rows.into_iter().collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_source(state: State<AppState>, source: CreateSource) -> Result<DataSource, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    // Encrypt token if present before storing
    let mut config = source.config.clone();
    // GitHub / GitLab use config.token
    if let Some(token) = config.get("token").and_then(|t| t.as_str()) {
        if !token.is_empty() {
            let encrypted = encrypt_token(&state.master_key, token);
            config["token"] = serde_json::json!(BASE64.encode(&encrypted));
        }
    }
    // Jira uses config.api_token
    if let Some(token) = config.get("api_token").and_then(|t| t.as_str()) {
        if !token.is_empty() {
            let encrypted = encrypt_token(&state.master_key, token);
            config["api_token"] = serde_json::json!(BASE64.encode(&encrypted));
        }
    }
    // Linear uses config.api_key
    if let Some(token) = config.get("api_key").and_then(|t| t.as_str()) {
        if !token.is_empty() {
            let encrypted = encrypt_token(&state.master_key, token);
            config["api_key"] = serde_json::json!(BASE64.encode(&encrypted));
        }
    }
    let config_str = serde_json::to_string(&config).unwrap_or_default();

    db.execute(
        "INSERT INTO sources (id, plugin_id, type, label, config, poll_ms, enabled, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![id, source.plugin_id, source.source_type, source.label, config_str, source.poll_ms.unwrap_or(300000), source.enabled.unwrap_or(true) as i64, now.clone(), now.clone()],
    )
    .map_err(|e| e.to_string())?;

    Ok(DataSource {
        id,
        plugin_id: source.plugin_id,
        source_type: source.source_type,
        label: source.label,
        config: source.config, // Return original config (with plain token) to frontend
        poll_ms: source.poll_ms.unwrap_or(300000),
        enabled: source.enabled.unwrap_or(true),
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub fn delete_source(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM sources WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct Dashboard {
    pub id: String,
    pub name: String,
    pub layout: serde_json::Value,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    pub widgets: Vec<Widget>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Widget {
    pub id: String,
    #[serde(rename = "dashboardId")]
    pub dashboard_id: String,
    #[serde(rename = "pluginId")]
    pub plugin_id: String,
    #[serde(rename = "widgetType")]
    pub widget_type: String,
    #[serde(rename = "sourceId")]
    pub source_id: Option<String>,
    pub position: serde_json::Value,
    pub config: serde_json::Value,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateWidget {
    #[serde(rename = "dashboardId")]
    pub dashboard_id: String,
    #[serde(rename = "pluginId")]
    pub plugin_id: String,
    #[serde(rename = "widgetType")]
    pub widget_type: String,
    #[serde(rename = "sourceId")]
    pub source_id: Option<String>,
    pub position: serde_json::Value,
    pub config: Option<serde_json::Value>,
}

#[tauri::command]
pub fn list_dashboards(state: State<AppState>) -> Result<Vec<Dashboard>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Load dashboard rows
    let mut dash_stmt = db
        .prepare("SELECT id, name, layout, is_default, created_at FROM dashboards ORDER BY created_at")
        .map_err(|e| e.to_string())?;
    let dash_rows: Vec<Result<(String, String, String, i64, String), rusqlite::Error>> = dash_stmt
        .query_map([], |row| {
            let layout_str: String = row.get(2)?;
            Ok((row.get(0)?, row.get(1)?, layout_str, row.get::<_, i64>(3)?, row.get(4)?))
        })
        .map_err(|e| e.to_string())?
        .collect();

    let mut result = Vec::new();
    for row in dash_rows.into_iter().collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())? {
        let (id, name, layout_str, is_default, created_at) = row;

        // Load widgets for this dashboard
        let mut w_stmt = db
            .prepare("SELECT id, dashboard_id, plugin_id, widget_type, source_id, position, config, created_at FROM widgets WHERE dashboard_id = ?1")
            .map_err(|e| e.to_string())?;
        let widget_rows: Vec<Result<Widget, rusqlite::Error>> = w_stmt
            .query_map(params![id], |row| {
                let pos_str: String = row.get(5)?;
                let cfg_str: Option<String> = row.get(6)?;
                Ok(Widget {
                    id: row.get(0)?,
                    dashboard_id: row.get(1)?,
                    plugin_id: row.get(2)?,
                    widget_type: row.get(3)?,
                    source_id: row.get(4)?,
                    position: serde_json::from_str(&pos_str).unwrap_or(serde_json::json!({"x":0,"y":0,"w":1,"h":1})),
                    config: json_or_default(cfg_str),
                    created_at: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect();

        let widgets: Vec<Widget> = widget_rows
            .into_iter()
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        result.push(Dashboard {
            id,
            name,
            layout: serde_json::from_str(&layout_str).unwrap_or(serde_json::Value::Array(vec![])),
            is_default: is_default == 1,
            created_at,
            widgets,
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn create_dashboard(state: State<AppState>, name: String) -> Result<Dashboard, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Check if this is the first dashboard
    let is_first;
    {
        let count: i64 = db.query_row("SELECT COUNT(*) FROM dashboards", [], |r| r.get(0)).unwrap_or(0);
        is_first = count == 0;
    }
    let is_default = if is_first { 1 } else { 0 };

    db.execute(
        "INSERT INTO dashboards (id, name, layout, is_default, created_at) VALUES (?1, ?2, '[]', ?3, ?4)",
        params![id, name, is_default, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Dashboard {
        id,
        name,
        layout: serde_json::Value::Array(vec![]),
        is_default: is_first,
        created_at: now.clone(),
        widgets: vec![],
    })
}

#[tauri::command]
pub fn delete_dashboard(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM dashboards WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn create_widget(state: State<AppState>, widget: CreateWidget) -> Result<Widget, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let position_str = serde_json::to_string(&widget.position).unwrap_or_default();
    let config = widget.config.clone().unwrap_or_default();
    let config_str = serde_json::to_string(&config).unwrap_or_default();

    db.execute(
        "INSERT INTO widgets (id, dashboard_id, plugin_id, widget_type, source_id, position, config, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![id, widget.dashboard_id, widget.plugin_id, widget.widget_type, widget.source_id, position_str, config_str, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Widget {
        id,
        dashboard_id: widget.dashboard_id,
        plugin_id: widget.plugin_id,
        widget_type: widget.widget_type,
        source_id: widget.source_id,
        position: widget.position,
        config,
        created_at: now,
    })
}

#[tauri::command]
pub fn delete_widget(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM widgets WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_widget_position(
    state: State<AppState>,
    id: String,
    position: serde_json::Value,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let pos_str = serde_json::to_string(&position).map_err(|e| e.to_string())?;
    db.execute("UPDATE widgets SET position = ?1 WHERE id = ?2", params![pos_str, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Data Items ───────────────────────────────────────────────────────────────

#[tauri::command]
pub fn cleanup_data_items(state: State<AppState>, days: Option<i64>) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let cutoff_days = days.unwrap_or(7);
    let cutoff_date = chrono::Utc::now() - chrono::Duration::days(cutoff_days);
    let cutoff_str = cutoff_date.to_rfc3339();
    
    let affected = db
        .execute(
            "DELETE FROM data_items WHERE fetched_at < ?1",
            params![cutoff_str],
        )
        .map_err(|e| e.to_string())?;
    
    log::info!("Cleaned up {} data_items older than {} days", affected, cutoff_days);
    Ok(affected)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DataItem {
    pub id: String,
    #[serde(rename = "sourceId")]
    pub source_id: String,
    pub kind: String,
    #[serde(rename = "externalId")]
    pub external_id: String,
    pub title: String,
    pub body: Option<String>,
    pub url: Option<String>,
    pub status: Option<String>,
    pub author: Option<String>,
    pub metadata: serde_json::Value,
    #[serde(rename = "fetchedAt")]
    pub fetched_at: String,
}

#[tauri::command]
pub fn get_data_items(
    state: State<AppState>,
    source_id: String,
    kind: Option<String>,
) -> Result<Vec<DataItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let result: Vec<DataItem> = if let Some(k) = kind {
        let mut stmt = db
            .prepare(
                "SELECT id, source_id, kind, external_id, title, body, url, status, author, metadata, fetched_at \
                 FROM data_items WHERE source_id = ?1 AND kind = ?2 ORDER BY fetched_at DESC LIMIT 100",
            )
            .map_err(|e| e.to_string())?;
        let rows: Vec<Result<DataItem, _>> = stmt
            .query_map(params![source_id, k], |row| {
                let metadata_str: String = row.get(9)?;
                Ok(DataItem {
                    id: row.get(0)?,
                    source_id: row.get(1)?,
                    kind: row.get(2)?,
                    external_id: row.get(3)?,
                    title: row.get(4)?,
                    body: row.get(5)?,
                    url: row.get(6)?,
                    status: row.get(7)?,
                    author: row.get(8)?,
                    metadata: serde_json::from_str(&metadata_str).unwrap_or_default(),
                    fetched_at: row.get(10)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect();
        rows.into_iter().collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    } else {
        let mut stmt = db
            .prepare(
                "SELECT id, source_id, kind, external_id, title, body, url, status, author, metadata, fetched_at \
                 FROM data_items WHERE source_id = ?1 ORDER BY fetched_at DESC LIMIT 100",
            )
            .map_err(|e| e.to_string())?;
        let rows: Vec<Result<DataItem, _>> = stmt
            .query_map(params![source_id], |row| {
                let metadata_str: String = row.get(9)?;
                Ok(DataItem {
                    id: row.get(0)?,
                    source_id: row.get(1)?,
                    kind: row.get(2)?,
                    external_id: row.get(3)?,
                    title: row.get(4)?,
                    body: row.get(5)?,
                    url: row.get(6)?,
                    status: row.get(7)?,
                    author: row.get(8)?,
                    metadata: serde_json::from_str(&metadata_str).unwrap_or_default(),
                    fetched_at: row.get(10)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect();
        rows.into_iter().collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    Ok(result)
}

// ─── Settings ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub ai: serde_json::Value,
    #[serde(rename = "pollingEnabled")]
    pub polling_enabled: bool,
    #[serde(rename = "minimizeToTray")]
    pub minimize_to_tray: bool,
    #[serde(rename = "launchAtStartup")]
    pub launch_at_startup: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            ai: serde_json::json!({
                "provider": "none",
                "enabled": false,
                "baseUrl": "http://localhost:11434",
                "model": "llama3"
            }),
            polling_enabled: true,
            minimize_to_tray: true,
            launch_at_startup: false,
        }
    }
}

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<AppSettings, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let val: Option<String> = db
        .query_row("SELECT value FROM settings WHERE key = 'app'", [], |r| r.get(0))
        .ok();
    match val {
        Some(v) => serde_json::from_str(&v).map_err(|e| e.to_string()),
        None => Ok(AppSettings::default()),
    }
}

#[tauri::command]
pub fn save_settings(state: State<AppState>, settings: AppSettings) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let val = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('app', ?1)", params![val])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── AI ─────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn generate_ai_summary(
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Read AI settings
    let settings_val: Option<String> = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.query_row("SELECT value FROM settings WHERE key = 'app'", [], |r| r.get(0)).ok()
    };

    let ai_config = match &settings_val {
        Some(v) => {
            let s: serde_json::Value = serde_json::from_str(v).unwrap_or_default();
            s["ai"].clone()
        }
        None => serde_json::json!({"provider": "none", "enabled": false}),
    };

    if !ai_config["enabled"].as_bool().unwrap_or(false) {
        return Ok("AI 摘要未启用。请在设置中开启 AI 摘要功能。".to_string());
    }

    // Load today's data items
    let items: Vec<(String, String)> = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let mut stmt = db
            .prepare("SELECT kind, title FROM data_items WHERE fetched_at >= ?1 ORDER BY fetched_at DESC LIMIT 50")
            .map_err(|e| e.to_string())?;
        let rows: Vec<Result<(String, String), _>> = stmt
            .query_map(params![today], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| e.to_string())?
            .collect();
        rows.into_iter().collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    if items.is_empty() {
        return Ok("📋 今日暂无数据。添加数据源并刷新后即可生成摘要。".to_string());
    }

    let provider = ai_config["provider"].as_str().unwrap_or("none");

    match provider {
        "ollama" => generate_ollama_summary(&ai_config, &items).await,
        "openai" => generate_openai_summary(&ai_config, &items).await,
        "claude" => generate_claude_summary(&ai_config, &items).await,
        "gemini" => generate_gemini_summary(&ai_config, &items).await,
        "openai_compat" => generate_openai_summary(&ai_config, &items).await, // reuse OpenAI format
        _ => Ok(build_basic_summary(&items)),
    }
}

async fn generate_ollama_summary(
    ai_config: &serde_json::Value,
    items: &[(String, String)],
) -> Result<String, String> {
    let base_url = ai_config["baseUrl"].as_str().unwrap_or("http://localhost:11434");
    let model = ai_config["model"].as_str().unwrap_or("llama3");

    // Build prompt
    let mut item_list = String::new();
    for (kind, title) in items.iter().take(30) {
        item_list.push_str(&format!("- [{kind}] {title}\n"));
    }

    let prompt = format!(
        "你是一个开发者助手。以下是开发者今天 GitHub 上的活动数据。请用中文生成一个简洁的今日开发摘要（3-5句话），总结关键动态。\n\n数据：\n{item_list}\n\n摘要："
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": model,
        "stream": false,
        "messages": [
            { "role": "user", "content": prompt }
        ]
    });

    let resp = client
        .post(format!("{}/api/chat", base_url.trim_end_matches('/')))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama 连接失败: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Ollama API 错误: {}", resp.status()));
    }

    let result: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let summary = result["message"]["content"]
        .as_str()
        .unwrap_or("Ollama 返回了空内容，请确认模型已安装");

    Ok(summary.to_string())
}

// ─── OpenAI Summary ──────────────────────────────────────────────────────────

async fn generate_openai_summary(
    ai_config: &serde_json::Value,
    items: &[(String, String)],
) -> Result<String, String> {
    let api_key = ai_config["apiKey"].as_str().unwrap_or("");
    if api_key.is_empty() {
        return Err("OpenAI API Key 未配置".into());
    }

    let base_url = ai_config["baseUrl"].as_str().unwrap_or("https://api.openai.com/v1");
    let model = ai_config["model"].as_str().unwrap_or("gpt-4o-mini");

    let prompt = build_ai_prompt(items);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": model,
        "messages": [{ "role": "user", "content": prompt }],
        "max_tokens": 500,
        "temperature": 0.7,
    });

    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI 连接失败: {e}"))?;

    if !resp.status().is_success() {
        let status_text = resp.status().to_string();
        let err_body: String = resp.text().await.unwrap_or_default();
        return Err(format!("OpenAI API 错误 ({status_text}): {}", err_body.chars().take(200).collect::<String>()));
    }

    let result: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    result["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or("OpenAI 返回了空内容".into())
}

// ─── Claude (Anthropic) Summary ─────────────────────────────────────────────

async fn generate_claude_summary(
    ai_config: &serde_json::Value,
    items: &[(String, String)],
) -> Result<String, String> {
    let api_key = ai_config["apiKey"].as_str().unwrap_or("");
    if api_key.is_empty() {
        return Err("Anthropic API Key 未配置".into());
    }

    let base_url = ai_config["baseUrl"].as_str().unwrap_or("https://api.anthropic.com");
    let model = ai_config["model"].as_str().unwrap_or("claude-sonnet-4-20250514");

    let prompt = build_ai_prompt(items);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": model,
        "max_tokens": 500,
        "messages": [{ "role": "user", "content": prompt }],
    });

    let url = format!("{}/v1/messages", base_url.trim_end_matches('/'));
    let resp = client
        .post(&url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Claude 连接失败: {e}"))?;

    if !resp.status().is_success() {
        let status_text = resp.status().to_string();
        let err_body: String = resp.text().await.unwrap_or_default();
        return Err(format!("Claude API 错误 ({status_text}): {}", err_body.chars().take(200).collect::<String>()));
    }

    let result: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    result["content"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or("Claude 返回了空内容".into())
}

// ─── Google Gemini Summary ──────────────────────────────────────────────────

async fn generate_gemini_summary(
    ai_config: &serde_json::Value,
    items: &[(String, String)],
) -> Result<String, String> {
    let api_key = ai_config["apiKey"].as_str().unwrap_or("");
    if api_key.is_empty() {
        return Err("Gemini API Key 未配置".into());
    }

    let model = ai_config["model"].as_str().unwrap_or("gemini-2.0-flash");
    let prompt = build_ai_prompt(items);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": {
            "maxOutputTokens": 500,
            "temperature": 0.7,
        },
    });

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key
    );
    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini 连接失败: {e}"))?;

    if !resp.status().is_success() {
        let status_text = resp.status().to_string();
        let err_body: String = resp.text().await.unwrap_or_default();
        return Err(format!("Gemini API 错误 ({status_text}): {}", err_body.chars().take(200).collect::<String>()));
    }

    let result: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    result["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or("Gemini 返回了空内容".into())
}

// ─── Shared Prompt Builder ──────────────────────────────────────────────────

fn build_ai_prompt(items: &[(String, String)]) -> String {
    let mut item_list = String::new();
    for (kind, title) in items.iter().take(30) {
        item_list.push_str(&format!("- [{kind}] {title}\n"));
    }
    format!(
        "你是一个开发者助手。以下是开发者今天 GitHub 上的活动数据。请用中文生成一个简洁的今日开发摘要（3-5句话），总结关键动态。\n\n数据：\n{item_list}\n\n摘要："
    )
}

fn build_basic_summary(items: &[(String, String)]) -> String {
    use std::collections::HashMap;
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for (kind, _) in items {
        *counts.entry(kind.as_str()).or_default() += 1;
    }

    let mut summary = String::from("📊 今日开发活动摘要\n\n");
    for (kind, count) in &counts {
        let emoji = match *kind {
            "pull_request" => "🔀",
            "issue" => "🐛",
            "ci_run" => "🔄",
            "notification" => "🔔",
            "merge_request" => "🔀",
            _ => "📌",
        };
        summary.push_str(&format!("{emoji} {kind}: {count} 条\n"));
    }
    summary.push_str(&format!("\n共计 {} 条活动", items.len()));

    if counts.is_empty() {
        return "📋 今日暂无数据。添加数据源并刷新后获取摘要。".to_string();
    }

    summary
}

#[tauri::command]
pub async fn test_ai_connection(
    provider: String,
    base_url: Option<String>,
    api_key: Option<String>,
) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    match provider.as_str() {
        "ollama" => {
            let url = base_url.unwrap_or_else(|| "http://localhost:11434".into());
            let resp = client
                .get(format!("{}/api/tags", url.trim_end_matches('/')))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            Ok(resp.status().is_success())
        }
        "openai" => {
            let key = api_key.ok_or("API Key 未提供".to_string())?;
            let url = base_url.unwrap_or_else(|| "https://api.openai.com/v1".into());
            let resp = client
                .get(format!("{}/models", url.trim_end_matches('/')))
                .header("Authorization", format!("Bearer {key}"))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            Ok(resp.status().is_success())
        }
        "claude" => {
            let key = api_key.ok_or("API Key 未提供".to_string())?;
            let url = base_url.unwrap_or_else(|| "https://api.anthropic.com".into());
            let resp = client
                .get(format!("{}/v1/models", url.trim_end_matches('/')))
                .header("x-api-key", key)
                .header("anthropic-version", "2023-06-01")
                .send()
                .await
                .map_err(|e| e.to_string())?;
            Ok(resp.status().is_success())
        }
        "gemini" => {
            let key = api_key.ok_or("API Key 未提供".to_string())?;
            let model = "gemini-2.0-flash"; // lightweight check
            let resp = client
                .get(&format!(
                    "https://generativelanguage.googleapis.com/v1beta/models/{}?key={}",
                    model, key
                ))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            Ok(resp.status().is_success())
        }
        "openai_compat" => {
            let key = api_key.ok_or("API Key 未提供".to_string())?;
            let url = base_url.ok_or("Base URL 未提供".to_string())?;
            let resp = client
                .get(format!("{}/models", url.trim_end_matches('/')))
                .header("Authorization", format!("Bearer {key}"))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            Ok(resp.status().is_success())
        }
        _ => Err(format!("不支持的提供商: {provider}")),
    }
}

/// Verify GitHub token is valid and show user info
#[tauri::command]
pub async fn verify_github_token(token: String) -> Result<serde_json::Value, String> {
    if token.is_empty() {
        return Err("Token 为空".into());
    }
    let client = reqwest::Client::builder()
        .user_agent("DevDash/1.0")
        .build()
        .map_err(|e| e.to_string())?;
    
    let resp = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("网络错误: {e}"))?;
    
    let status = resp.status();
    if !status.is_success() {
        return Err(format!("Token 验证失败 (HTTP {}): 请检查 Token 是否有效或已过期", status.as_u16()));
    }
    
    let user: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "valid": true,
        "login": user["login"],
        "name": user["name"],
        "avatar_url": user["avatar_url"],
        "public_repos": user["public_repos"],
        "message": format!("Token 有效 — 用户: @{}", user["login"].as_str().unwrap_or("unknown")),
    }))
}

/// Debug command: dump database state for troubleshooting
#[tauri::command]
pub fn debug_db_state(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut out = String::new();

    // Sources
    out.push_str("=== SOURCES ===\n");
    let mut stmt = db.prepare("SELECT id, type, enabled, config FROM sources").map_err(|e| e.to_string())?;
    let rows: Vec<(String,String,i64,Option<String>)> = stmt.query_map([], |r| {
        Ok((r.get(0)?, r.get(1)?, r.get::<_,i64>(2)?, r.get(3)?))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    for (id, stype, enabled, config) in &rows {
        let cfg_preview = config.as_deref().unwrap_or("{}" ).chars().take(150).collect::<String>();
        // Check if token is encrypted (base64) or plaintext
        let token_status = if let Some(ref cfg) = config {
            if cfg.contains("\"token\"") {
                let token_start = cfg.find("\"token\":").unwrap_or(0);
                let token_val = &cfg[token_start..cfg.len().min(token_start+100)];
                if token_val.len() > 60 {
                    "encrypted"
                } else {
                    "plaintext_or_empty"
                }
            } else {
                "no_token_field"
            }
        } else {
            "no_config"
        };
        out.push_str(&format!("  {} | type={} | enabled={} | token_status={} | config={}\n", 
            &id[..8.min(id.len())], stype, enabled, token_status, cfg_preview));
    }
    if rows.is_empty() { out.push_str("  (none)\n"); }

    // Widgets
    out.push_str("\n=== WIDGETS ===\n");
    let mut stmt2 = db.prepare("SELECT id, widget_type, source_id, position FROM widgets").map_err(|e| e.to_string())?;
    let wrows: Vec<(String,String,Option<String>,String)> = stmt2.query_map([], |r| {
        Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    for (id, wtype, sid, pos) in &wrows {
        out.push_str(&format!("  {} | type={} | source={} | pos={}\n", &id[..8.min(id.len())], wtype, sid.as_deref().unwrap_or("NULL"), pos));
    }
    if wrows.is_empty() { out.push_str("  (none)\n"); }

    // Check source_id match between widgets and sources
    out.push_str("\n=== SOURCE_ID MATCH CHECK ===\n");
    let source_ids: std::collections::HashSet<String> = rows.iter().map(|(id, _, _, _)| id.clone()).collect();
    let mut mismatch_count = 0;
    for (_, _, sid, _) in &wrows {
        if let Some(ref sid) = sid {
            if !source_ids.contains(sid) {
                out.push_str(&format!("  MISMATCH: widget references source {} but not found in sources\n", &sid[..8.min(sid.len())]));
                mismatch_count += 1;
            }
        }
    }
    if mismatch_count == 0 {
        out.push_str("  All widget source_ids match sources (OK)\n");
    }

    // Data items count per source
    out.push_str("\n=== DATA_ITEMS COUNT ===\n");
    let count: i64 = db.query_row("SELECT COUNT(*) FROM data_items", [], |r| r.get(0)).unwrap_or(0);
    out.push_str(&format!("  total: {}\n", count));
    let mut stmt3 = db.prepare("SELECT source_id, COUNT(*) FROM data_items GROUP BY source_id").map_err(|e| e.to_string())?;
    let counts: Vec<(String,i64)> = stmt3.query_map([], |r| Ok((r.get(0)?, r.get(1)?))).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    for (sid, cnt) in &counts {
        out.push_str(&format!("  {}: {} items\n", &sid[..8.min(sid.len())], cnt));
    }
    if counts.is_empty() && count > 0 { out.push_str("  (has items but no per-source breakdown)\n"); }
    if count == 0 { out.push_str("  (empty)\n"); }

    // Latest data items
    if count > 0 {
        out.push_str("\n=== LATEST DATA ITEMS ===\n");
        let mut stmt4 = db.prepare("SELECT kind, title, status, fetched_at FROM data_items ORDER BY fetched_at DESC LIMIT 5").map_err(|e| e.to_string())?;
        let items = stmt4.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, String>(3)?,
            ))
        }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect::<Vec<_>>();
        for (kind, title, status, fetched_at) in items {
            out.push_str(&format!("  [{}] {} (status={:?}, fetched={})\n", kind, &title[..title.len().min(50)], status, fetched_at));
        }
    }

    // Check token decryption
    out.push_str("\n=== TOKEN DECRYPTION CHECK ===\n");
    use crate::crypto::decrypt_token;
    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
    for (id, _, _, config) in &rows {
        if let Some(ref cfg) = config {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(cfg) {
                if let Some(token) = json["token"].as_str() {
                    if token.len() > 40 {
                        // Try to decrypt
                        if let Ok(bytes) = BASE64.decode(token) {
                            if bytes.len() >= 28 {
                                match decrypt_token(&state.master_key, &bytes) {
                                    Ok(decrypted) => {
                                        let preview = &decrypted[..decrypted.len().min(10)];
                                        out.push_str(&format!("  {}: Decrypted OK (starts with: {}...)\n", &id[..8.min(id.len())], preview));
                                    }
                                    Err(e) => {
                                        out.push_str(&format!("  {}: DECRYPT FAILED: {}\n", &id[..8.min(id.len())], e));
                                    }
                                }
                            } else {
                                out.push_str(&format!("  {}: Token too short (not encrypted?)\n", &id[..8.min(id.len())]));
                            }
                        } else {
                            out.push_str(&format!("  {}: Token is plaintext (not base64)\n", &id[..8.min(id.len())]));
                        }
                    } else {
                        out.push_str(&format!("  {}: Token empty or too short (len={})\n", &id[..8.min(id.len())], token.len()));
                    }
                } else {
                    out.push_str(&format!("  {}: No token field in config\n", &id[..8.min(id.len())]));
                }
            }
        }
    }

    Ok(out)
}

/// Migrate plaintext tokens to encrypted storage
#[tauri::command]
pub fn encrypt_existing_tokens(state: State<AppState>) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    
    // Get all sources
    let mut stmt = db.prepare("SELECT id, config FROM sources").map_err(|e| e.to_string())?;
    let sources: Vec<(String, String)> = stmt.query_map([], |r| {
        Ok((r.get(0)?, r.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
    
    let mut migrated = 0;
    let mut already_encrypted = 0;
    let mut failed = 0;
    
    for (id, config_str) in sources {
        let mut config: serde_json::Value = serde_json::from_str(&config_str).unwrap_or_default();
        let mut changed = false;
        
        // Encrypt token if it's plaintext
        if let Some(token) = config.get("token").and_then(|t| t.as_str()) {
            if !token.is_empty() && !token.starts_with("ghp_") && token.len() > 40 {
                // Already base64 encoded, skip
                already_encrypted += 1;
            } else if token.starts_with("ghp_") {
                // Plaintext GitHub token, encrypt it
                let encrypted = crate::crypto::encrypt_token(&state.master_key, token);
                config["token"] = serde_json::json!(BASE64.encode(&encrypted));
                changed = true;
                migrated += 1;
            }
        }
        
        // Encrypt api_token if it's plaintext
        if let Some(token) = config.get("api_token").and_then(|t| t.as_str()) {
            if !token.is_empty() && token.len() < 100 {
                let encrypted = crate::crypto::encrypt_token(&state.master_key, token);
                config["api_token"] = serde_json::json!(BASE64.encode(&encrypted));
                changed = true;
                migrated += 1;
            } else if token.len() >= 100 {
                already_encrypted += 1;
            }
        }
        
        // Encrypt api_key if it's plaintext
        if let Some(token) = config.get("api_key").and_then(|t| t.as_str()) {
            if !token.is_empty() && token.len() < 100 {
                let encrypted = crate::crypto::encrypt_token(&state.master_key, token);
                config["api_key"] = serde_json::json!(BASE64.encode(&encrypted));
                changed = true;
                migrated += 1;
            } else if token.len() >= 100 {
                already_encrypted += 1;
            }
        }
        
        if changed {
            let new_config_str = serde_json::to_string(&config).unwrap_or_default();
            match db.execute(
                "UPDATE sources SET config = ?1 WHERE id = ?2",
                params![new_config_str, id],
            ) {
                Ok(_) => {}
                Err(e) => {
                    log::error!("Failed to update source {}: {}", id, e);
                    failed += 1;
                    migrated -= 1;
                }
            }
        }
    }
    
    Ok(serde_json::json!({
        "migrated": migrated,
        "already_encrypted": already_encrypted,
        "failed": failed,
        "message": if migrated > 0 {
            format!("成功加密 {} 个 token", migrated)
        } else if already_encrypted > 0 {
            "所有 token 已经加密".to_string()
        } else {
            "没有找到需要加密的 token".to_string()
        }
    }))
}
