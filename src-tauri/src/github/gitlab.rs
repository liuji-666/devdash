use super::types::GitlabConfig;
use crate::models::AppState;
use rusqlite::params;
use tauri::AppHandle;
use tauri::Emitter;
use uuid::Uuid;

#[tauri::command]
pub async fn fetch_gitlab_data(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<i64, String> {
    let sources: Vec<(String, GitlabConfig)> = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = db
            .prepare("SELECT id, config FROM sources WHERE type = 'gitlab' AND enabled = 1")
            .map_err(|e| e.to_string())?;
        let rows: Vec<Result<(String, GitlabConfig), _>> = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let config_str = row.get::<_, Option<String>>(1)?.unwrap_or_default();
                let mut config: GitlabConfig = serde_json::from_str(&config_str).unwrap_or(
                    GitlabConfig {
                        token: None,
                        base_url: None,
                        project_id: None,
                    },
                );

                // Decrypt token if it looks like base64-encoded encrypted data
                if let Some(token) = config.token.as_ref() {
                    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
                    if let Ok(bytes) = BASE64.decode(token) {
                        if bytes.len() >= 28 {
                            if let Ok(decrypted) =
                                crate::crypto::decrypt_token(&state.master_key, &bytes)
                            {
                                config.token = Some(decrypted);
                            }
                        }
                    }
                }
                Ok((id, config))
            })
            .map_err(|e| e.to_string())?
            .collect();
        rows.into_iter()
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };

    if sources.is_empty() {
        return Ok(0);
    }

    let http = reqwest::Client::builder()
        .user_agent("DevDash/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let mut total = 0i64;

    for (source_id, config) in sources {
        let base = config.base_url.as_deref().unwrap_or("https://gitlab.com");
        let token = config.token.as_deref().unwrap_or("");

        let mr_url = match &config.project_id {
            Some(pid) => format!(
                "{base}/api/v4/projects/{pid}/merge_requests?state=opened&per_page=30"
            ),
            None => format!(
                "{base}/api/v4/merge_requests?scope=all&state=opened&per_page=30"
            ),
        };

        let resp = http
            .get(&mr_url)
            .header("PRIVATE-TOKEN", token)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            continue;
        }

        let items: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;
        let count = items.len() as i64;
        total += count;

        {
            let db = state.db.lock().map_err(|e| e.to_string())?;
            let now = chrono::Utc::now().to_rfc3339();
            for item in &items {
                let id = Uuid::new_v4().to_string();
                let external_id = item["iid"].as_i64().unwrap_or(0).to_string();
                let title = item["title"].as_str().unwrap_or("").to_string();
                let url = item["web_url"].as_str().map(String::from);
                let status = item["state"].as_str().unwrap_or("opened").to_string();
                let author = item["author"]["username"].as_str().unwrap_or("").to_string();
                let labels: Vec<String> = item["labels"]
                    .as_array()
                    .map(|a| {
                        a.iter()
                            .filter_map(|l| l.as_str().map(String::from))
                            .collect()
                    })
                    .unwrap_or_default();
                let meta = serde_json::json!({ "labels": labels });
                db.execute(
                    "INSERT OR REPLACE INTO data_items (id, source_id, kind, external_id, title, url, status, author, metadata, fetched_at) VALUES (?1, ?2, 'merge_request', ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        id,
                        source_id,
                        external_id,
                        title,
                        url,
                        status,
                        author,
                        serde_json::to_string(&meta).unwrap_or_default(),
                        now
                    ],
                )
                .ok();
            }
        }
    }

    let _ = app.emit("data-updated", ());
    Ok(total)
}
