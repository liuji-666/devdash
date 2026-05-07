use crate::crypto::decrypt_token;
use crate::models::AppState;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use uuid::Uuid;

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JiraConfig {
    pub base_url: String,    // e.g. https://yourcompany.atlassian.net
    pub email: String,       // Atlassian account email
    pub api_token: String,   // Jira API token
    pub jql: Option<String>, // Custom JQL filter (default: assignee = currentUser())
    pub project_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LinearConfig {
    pub api_key: String,     // Linear API key
    pub team_id: Option<String>, // Optional team filter
}

#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct TrackerResult {
    pub jira_count: i64,
    pub linear_count: i64,
    pub errors: Vec<String>,
}

impl Default for TrackerResult {
    fn default() -> Self {
        Self { jira_count: 0, linear_count: 0, errors: Vec::new() }
    }
}

#[derive(Debug, Default)]
#[allow(dead_code)]
struct TrackerItem {
    kind: String,
    external_id: String,
    title: String,
    body: Option<String>,
    url: Option<String>,
    status: String,
    author: String,
    metadata: serde_json::Value,
}

// ─── Jira ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fetch_jira_data(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<i64, String> {
    let sources: Vec<(String, JiraConfig)> = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = db
            .prepare("SELECT id, config FROM sources WHERE type = 'jira' AND enabled = 1")
            .map_err(|e| e.to_string())?;
        let rows: Vec<Result<(String, JiraConfig), _>> = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let config_str = row.get::<_, Option<String>>(1)?.unwrap_or_default();
                let mut config: JiraConfig = serde_json::from_str(&config_str).unwrap_or(JiraConfig {
                    base_url: String::new(),
                    email: String::new(),
                    api_token: String::new(),
                    jql: None,
                    project_key: None,
                });

                // Decrypt token
                if let Ok(bytes) = BASE64.decode(&config.api_token) {
                    if bytes.len() >= 28 {
                        if let Ok(decrypted) = decrypt_token(&state.master_key, &bytes) {
                            config.api_token = decrypted;
                        }
                    }
                }
                Ok((id, config))
            })
            .map_err(|e| e.to_string())?
            .collect();
        rows.into_iter().collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    if sources.is_empty() { return Ok(0); }

    let http = reqwest::Client::builder()
        .user_agent("DevDash/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let mut total = 0i64;

    for (source_id, config) in sources {
        if config.base_url.is_empty() || config.email.is_empty() || config.api_token.is_empty() {
            continue;
        }

        let base = config.base_url.trim_end_matches('/');
        let jql = config.jql.clone().unwrap_or_else(|| "assignee = currentUser() ORDER BY updated DESC".to_string());

        let url = format!("{base}/rest/api/3/search?jql={}&maxResults=50", urlencoding::encode(&jql));

        let resp = http.get(&url)
            .header("Accept", "application/json")
            .header("User-Agent", "DevDash/1.0")
            .basic_auth(&config.email, Some(&config.api_token))
            .send()
            .await
            .map_err(|e| format!("Jira 网络错误: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            log::warn!("Jira API returned {}", status);
            continue;
        }

        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let issues = body["issues"].as_array().cloned().unwrap_or_default();
        let count = issues.len() as i64;
        total += count;

        {
            let db = state.db.lock().map_err(|e| e.to_string())?;
            let now = chrono::Utc::now().to_rfc3339();
            for item in &issues {
                let id = Uuid::new_v4().to_string();
                let key = item["key"].as_str().unwrap_or("");
                let summary = item["fields"]["summary"].as_str().unwrap_or("");
                let status_name = item["fields"]["status"]["name"].as_str().unwrap_or("Unknown");
                let issue_type = item["fields"]["issuetype"]["name"].as_str().unwrap_or("Task");
                let priority = item["fields"]["priority"]["name"].as_str().unwrap_or("None");
                let assignee = item["fields"]["assignee"]["displayName"].as_str().unwrap_or("Unassigned");
                let url = format!("{base}/browse/{key}");

                let status_lower = status_name.to_lowercase();
                let item_status = match status_lower.as_str() {
                    "to do" | "backlog" => "todo",
                    "in progress" | "in review" => "in_progress",
                    "done" | "closed" | "resolved" => "done",
                    _ => "todo",
                };

                let meta = serde_json::json!({
                    "tracker": "jira",
                    "issue_type": issue_type,
                    "priority": priority,
                    "key": key,
                    "project": item["fields"]["project"]["key"].as_str().unwrap_or(""),
                    "labels": item["fields"]["labels"].as_array().map(|a| a.iter().filter_map(|l| l.as_str().map(String::from)).collect::<Vec<_>>()).unwrap_or_default(),
                });

                db.execute(
                    "INSERT OR REPLACE INTO data_items (id, source_id, kind, external_id, title, url, status, author, metadata, fetched_at) VALUES (?1, ?2, 'task', ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![id, source_id, key, summary, url, item_status, assignee, serde_json::to_string(&meta).unwrap_or_default(), now],
                ).ok();
            }
        }
    }

    let _ = app.emit("data-updated", ());
    Ok(total)
}

// ─── Combined tracker fetch with error reporting ─────────────────────────────

#[tauri::command]
pub async fn fetch_tracker_data(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<TrackerResult, String> {
    let mut result = TrackerResult::default();

    // Fetch Jira (capture errors, don't crash)
    match fetch_jira_data(app.clone(), state.clone()).await {
        Ok(count) => result.jira_count = count,
        Err(e) => result.errors.push(format!("Jira: {e}")),
    }

    // Fetch Linear (capture errors, don't crash)
    match fetch_linear_data(app.clone(), state.clone()).await {
        Ok(count) => result.linear_count = count,
        Err(e) => result.errors.push(format!("Linear: {e}")),
    }

    Ok(result)
}

// ─── Linear ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn fetch_linear_data(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<i64, String> {
    let sources: Vec<(String, LinearConfig)> = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = db
            .prepare("SELECT id, config FROM sources WHERE type = 'linear' AND enabled = 1")
            .map_err(|e| e.to_string())?;
        let rows: Vec<Result<(String, LinearConfig), _>> = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let config_str = row.get::<_, Option<String>>(1)?.unwrap_or_default();
                let mut config: LinearConfig = serde_json::from_str(&config_str).unwrap_or(LinearConfig {
                    api_key: String::new(),
                    team_id: None,
                });

                // Decrypt token
                if let Ok(bytes) = BASE64.decode(&config.api_key) {
                    if bytes.len() >= 28 {
                        if let Ok(decrypted) = decrypt_token(&state.master_key, &bytes) {
                            config.api_key = decrypted;
                        }
                    }
                }
                Ok((id, config))
            })
            .map_err(|e| e.to_string())?
            .collect();
        rows.into_iter().collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    if sources.is_empty() { return Ok(0); }

    let http = reqwest::Client::builder()
        .user_agent("DevDash/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let mut total = 0i64;

    for (source_id, config) in sources {
        if config.api_key.is_empty() {
            continue;
        }

        // GraphQL query for assigned issues
        let team_filter = config.team_id.as_ref().map_or(String::new(), |tid| {
            format!(", filter: {{ team: {{ id: {{ eq: \"{}\" }} }} }}", tid)
        });

        let query = serde_json::json!({
            "query": format!(r#"
                {{
                    viewer {{ assignedIssues(first: 50{team_filter}) {{
                        nodes {{
                            id title url identifier
                            state {{ name type }}
                            team {{ key name }}
                            priority
                            labels {{ nodes {{ name }} }}
                            createdAt updatedAt
                        }}
                    }} }}
                }}
            "#)
        });

        let resp = http.post("https://api.linear.app/graphql")
            .header("Authorization", config.api_key.clone())
            .header("Content-Type", "application/json")
            .header("User-Agent", "DevDash/1.0")
            .json(&query)
            .send()
            .await
            .map_err(|e| format!("Linear 网络错误: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            log::warn!("Linear API returned {}", status);
            continue;
        }

        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let issues = body["data"]["viewer"]["assignedIssues"]["nodes"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        let count = issues.len() as i64;
        total += count;

        {
            let db = state.db.lock().map_err(|e| e.to_string())?;
            let now = chrono::Utc::now().to_rfc3339();
            for item in &issues {
                let id = Uuid::new_v4().to_string();
                let identifier = item["identifier"].as_str().unwrap_or("");
                let title = item["title"].as_str().unwrap_or("");
                let url = item["url"].as_str().unwrap_or("");
                let _state_name = item["state"]["name"].as_str().unwrap_or("Backlog");
                let state_type = item["state"]["type"].as_str().unwrap_or("unstarted");
                let team_key = item["team"]["key"].as_str().unwrap_or("");
                let priority = match item["priority"].as_i64() {
                    Some(0) => "No priority",
                    Some(1) => "Urgent",
                    Some(2) => "High",
                    Some(3) => "Medium",
                    Some(4) => "Low",
                    _ => "None",
                };

                let item_status = match state_type {
                    "unstarted" => "todo",
                    "started" => "in_progress",
                    "completed" => "done",
                    "cancelled" => "cancelled",
                    _ => "todo",
                };

                let labels: Vec<String> = item["labels"]["nodes"]
                    .as_array()
                    .map(|a| a.iter().filter_map(|l| l["name"].as_str().map(String::from)).collect())
                    .unwrap_or_default();

                let meta = serde_json::json!({
                    "tracker": "linear",
                    "identifier": identifier,
                    "team": team_key,
                    "priority": priority,
                    "labels": labels,
                });

                db.execute(
                    "INSERT OR REPLACE INTO data_items (id, source_id, kind, external_id, title, url, status, author, metadata, fetched_at) VALUES (?1, ?2, 'task', ?3, ?4, ?5, ?6, 'Me', ?7, ?8)",
                    params![id, source_id, identifier, title, url, item_status, serde_json::to_string(&meta).unwrap_or_default(), now],
                ).ok();
            }
        }
    }

    let _ = app.emit("data-updated", ());
    Ok(total)
}
