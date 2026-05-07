use super::client::{discover_starred_repos, discover_user_repos, gh_get};
use super::types::{FetchResult, GhItem, GithubConfig};
use crate::crypto::decrypt_token;
use crate::models::AppState;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rusqlite::params;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

// ─── PR Fetching ─────────────────────────────────────────────────────────────

pub async fn fetch_gh_prs(
    http: &reqwest::Client,
    token: &str,
    config: &GithubConfig,
) -> Result<Vec<GhItem>, String> {
    let mut all_items: Vec<GhItem> = Vec::new();

    // Per-repo fetch: list PRs for specific repos
    match (&config.owner, &config.repo) {
        (Some(o), Some(r)) => {
            let url = format!(
                "https://api.github.com/repos/{o}/{r}/pulls?state=open&per_page=50"
            );
            log::info!("[DevDash] fetch_gh_prs (repo): url={}", url);
            let items = gh_get(http, &url, token).await?;
            log::info!("[DevDash] fetch_gh_prs (repo): got {} items", items.len());
            for item in &items {
                if item["draft"].as_bool().unwrap_or(false) {
                    continue;
                }
                let merged = !item["merged_at"].is_null();
                let state = item["state"].as_str().unwrap_or("open");
                let status = if merged { "merged" } else { state };
                all_items.push(GhItem {
                    kind: "pull_request".into(),
                    external_id: item["number"].as_i64().unwrap_or(0).to_string(),
                    title: item["title"].as_str().unwrap_or("").to_string(),
                    body: item["body"].as_str().map(String::from),
                    url: item["html_url"].as_str().map(String::from),
                    status: status.into(),
                    author: item["user"]["login"].as_str().unwrap_or("").to_string(),
                    metadata: serde_json::json!({
                        "labels": item["labels"].as_array().map(|a| a.iter().filter_map(|l| l["name"].as_str().map(String::from)).collect::<Vec<_>>()).unwrap_or_default(),
                        "repo": item["base"]["repo"]["full_name"].as_str().unwrap_or(""),
                        "search_source": "repo_list",
                    }),
                });
            }
            return Ok(all_items);
        }
        _ => {}
    }

    if token.is_empty() {
        return Ok(vec![]);
    }

    // User-scoped search: multiple queries for better coverage
    let queries = vec![
        // Most important: PRs requesting my review
        ("review_requested", "is:pr+is:open+review-requested:@me"),
        // My own open PRs
        ("author", "is:pr+is:open+author:@me"),
        // PRs assigned to me
        ("assignee", "is:pr+is:open+assignee:@me"),
        // PRs I commented on or am involved in
        ("involves", "is:pr+is:open+involves:@me"),
    ];

    let mut seen_ids = std::collections::HashSet::new();

    for (source, query) in &queries {
        let url = format!(
            "https://api.github.com/search/issues?q={}&per_page=50",
            query
        );
        log::info!("[DevDash] fetch_gh_prs ({}): url={}", source, url);
        match gh_get(http, &url, token).await {
            Ok(items) => {
                log::info!(
                    "[DevDash] fetch_gh_prs ({}): got {} items",
                    source,
                    items.len()
                );
                for item in &items {
                    if item["draft"].as_bool().unwrap_or(false) {
                        continue;
                    }
                    let id = item["id"].as_i64().unwrap_or(0);
                    if seen_ids.contains(&id) {
                        continue;
                    }
                    seen_ids.insert(id);

                    let merged = !item["merged_at"].is_null();
                    let state = item["state"].as_str().unwrap_or("open");
                    let status = if merged { "merged" } else { state };
                    all_items.push(GhItem {
                        kind: "pull_request".into(),
                        external_id: item["number"].as_i64().unwrap_or(0).to_string(),
                        title: item["title"].as_str().unwrap_or("").to_string(),
                        body: item["body"].as_str().map(String::from),
                        url: item["html_url"].as_str().map(String::from),
                        status: status.into(),
                        author: item["user"]["login"].as_str().unwrap_or("").to_string(),
                        metadata: serde_json::json!({
                            "labels": item["labels"].as_array().map(|a| a.iter().filter_map(|l| l["name"].as_str().map(String::from)).collect::<Vec<_>>()).unwrap_or_default(),
                            "repo": item["repository_url"].as_str().map(|u| u.replace("https://api.github.com/repos/", "")).unwrap_or_default(),
                            "search_source": source,
                        }),
                    });
                }
            }
            Err(e) => {
                log::warn!("[DevDash] fetch_gh_prs ({}): error: {}", source, e);
            }
        }
    }

    log::info!(
        "[DevDash] fetch_gh_prs: total unique PRs: {}",
        all_items.len()
    );
    Ok(all_items)
}

// ─── Main GitHub Fetch ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn fetch_github_data(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<FetchResult, String> {
    let sources = load_github_sources(&state)?;
    eprintln!("[DevDash DIAG] fetch_github_data: loaded {} sources", sources.len());
    if sources.is_empty() {
        return Ok(FetchResult {
            prs: 0,
            issues: 0,
            ci_runs: 0,
            notifications: 0,
            errors: vec![],
        });
    }

    let http = reqwest::Client::builder()
        .user_agent("DevDash/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let mut total_prs = 0i64;
    let mut total_issues = 0i64;
    let mut total_ci = 0i64;
    let mut total_notifications = 0i64;
    let mut errors = Vec::new();

    for (source_id, config) in sources {
        let token = config.token.clone().unwrap_or_default();
        eprintln!(
            "[DevDash DIAG] Processing source {}: token_len={}, all_repos={:?}",
            &source_id[..8.min(source_id.len())],
            token.len(),
            config.all_repos
        );

        // ─── Resolve repos to fetch ──────────────────────────────────────
        let resolved_repos = config.resolved_repos();
        eprintln!("[DevDash DIAG] Resolved repos: {:?}", resolved_repos);

        // If all_repos is set, discover repos accessible to the token
        let mut repos_to_fetch = if config.all_repos.unwrap_or(false) && !token.is_empty() {
            match discover_user_repos(&http, &token).await {
                Ok(repos) => {
                    eprintln!(
                        "[DevDash DIAG] Discovered {} repos for all_repos mode",
                        repos.len()
                    );
                    repos
                }
                Err(e) => {
                    eprintln!("[DevDash DIAG] Discover repos failed: {e}");
                    errors.push(format!("Discover repos: {e}"));
                    resolved_repos // fallback to configured repos
                }
            }
        } else {
            resolved_repos
        };

        // If starred_repos is set, add starred repos
        if config.include_starred() && !token.is_empty() {
            match discover_starred_repos(&http, &token).await {
                Ok(starred) => {
                    log::info!("[DevDash] Discovered {} starred repos", starred.len());
                    // Merge without duplicates
                    for sr in &starred {
                        if !repos_to_fetch
                            .iter()
                            .any(|r| r.owner == sr.owner && r.repo == sr.repo)
                        {
                            repos_to_fetch.push(sr.clone());
                        }
                    }
                }
                Err(e) => {
                    log::warn!("[DevDash] Discover starred repos failed: {e}");
                    errors.push(format!("Discover starred: {e}"));
                }
            }
        }

        log::info!(
            "[DevDash] repos_to_fetch count: {}",
            repos_to_fetch.len()
        );

        // ─── Per-repo fetch ────────────────────────────────────────────────
        if !repos_to_fetch.is_empty() {
            for repo_spec in &repos_to_fetch {
                let repo_config = GithubConfig {
                    owner: Some(repo_spec.owner.clone()),
                    repo: Some(repo_spec.repo.clone()),
                    token: Some(token.clone()),
                    repos: None,
                    all_repos: None,
                    starred_repos: None,
                };

                let (pr_result, issue_result, ci_result) = tokio::join!(
                    fetch_gh_prs(&http, &token, &repo_config),
                    super::issues::fetch_gh_issues(&http, &token, &repo_config),
                    super::ci::fetch_gh_ci_runs(&http, &token, &repo_config),
                );

                let pr_items = pr_result.unwrap_or_else(|e| {
                    errors.push(format!("PRs ({}/{}): {e}", repo_spec.owner, repo_spec.repo));
                    vec![]
                });
                let issue_items = issue_result.unwrap_or_else(|e| {
                    errors.push(format!(
                        "Issues ({}/{}): {e}",
                        repo_spec.owner, repo_spec.repo
                    ));
                    vec![]
                });
                let ci_items = ci_result.unwrap_or_else(|e| {
                    errors.push(format!("CI ({}/{}): {e}", repo_spec.owner, repo_spec.repo));
                    vec![]
                });

                total_prs += pr_items.len() as i64;
                total_issues += issue_items.len() as i64;
                total_ci += ci_items.len() as i64;

                persist_items(&state, &source_id, pr_items, issue_items, vec![], ci_items);
            }
        }

        // ─── User-scoped fetch (no specific repo) ───────────────────────
        // Notifications are always user-scoped
        let notif_result = super::notifications::fetch_gh_notifications(&http, &token).await;
        let notif_items = notif_result.unwrap_or_else(|e| {
            errors.push(format!("Notifs: {e}"));
            vec![]
        });
        total_notifications += notif_items.len() as i64;

        // If no repos configured at all, do user-scoped PR/Issue search
        if repos_to_fetch.is_empty() && !token.is_empty() {
            let empty_config = GithubConfig {
                owner: None,
                repo: None,
                token: Some(token.clone()),
                repos: None,
                all_repos: None,
                starred_repos: None,
            };
            let (pr_result, issue_result) = tokio::join!(
                fetch_gh_prs(&http, &token, &empty_config),
                super::issues::fetch_gh_issues(&http, &token, &empty_config),
            );
            let pr_items = pr_result.unwrap_or_else(|e| {
                errors.push(format!("PRs (user): {e}"));
                vec![]
            });
            let issue_items = issue_result.unwrap_or_else(|e| {
                errors.push(format!("Issues (user): {e}"));
                vec![]
            });

            total_prs += pr_items.len() as i64;
            total_issues += issue_items.len() as i64;

            persist_items(&state, &source_id, pr_items, issue_items, notif_items, vec![]);
        } else {
            persist_items(&state, &source_id, vec![], vec![], notif_items, vec![]);
        }
    }

    let _ = app.emit("data-updated", ());

    // ─── Desktop notification: push if CI failures found ────────────
    if total_ci > 0 {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let failed_ci: i64 = db
            .query_row(
                "SELECT COUNT(*) FROM data_items WHERE kind = 'ci_run' AND status = 'failure' AND fetched_at > datetime('now', '-10 minutes')",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        drop(db);
        if failed_ci > 0 {
            let _ = app.emit(
                "ci-failure-notification",
                serde_json::json!({
                    "title": "DevDash — CI 构建失败",
                    "body": format!("{} 个 CI 构建失败，点击查看详情", failed_ci),
                }),
            );
        }
    }

    Ok(FetchResult {
        prs: total_prs,
        issues: total_issues,
        ci_runs: total_ci,
        notifications: total_notifications,
        errors,
    })
}

// ─── Source loading ──────────────────────────────────────────────────────────

pub fn load_github_sources(
    state: &tauri::State<'_, AppState>,
) -> Result<Vec<(String, GithubConfig)>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, config FROM sources WHERE type = 'github' AND enabled = 1")
        .map_err(|e| e.to_string())?;
    let rows: Vec<Result<(String, GithubConfig), _>> = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let config_str = row.get::<_, Option<String>>(1)?.unwrap_or_default();
            let mut config: GithubConfig = serde_json::from_str(&config_str).unwrap_or(GithubConfig {
                token: None,
                owner: None,
                repo: None,
                repos: None,
                all_repos: None,
                starred_repos: None,
            });

            // Decrypt token if it looks like base64-encoded encrypted data
            if let Some(token) = config.token.as_ref() {
                if let Ok(bytes) = BASE64.decode(token) {
                    if bytes.len() >= 28 {
                        // minimum encrypted size: 16 (salt) + 12 (nonce) = 28
                        match decrypt_token(&state.master_key, &bytes) {
                            Ok(decrypted) => {
                                eprintln!("[DevDash DIAG] Token decrypted OK, len={}", decrypted.len());
                                config.token = Some(decrypted);
                            }
                            Err(e) => {
                                eprintln!("[DevDash DIAG] Token decrypt FAILED: {}", e);
                            }
                        }
                    } else {
                        eprintln!("[DevDash DIAG] Token base64 too short ({} bytes)", bytes.len());
                    }
                } else {
                    eprintln!("[DevDash DIAG] Token base64 decode failed");
                }
            }
            Ok((id, config))
        })
        .map_err(|e| e.to_string())?
        .collect();
    rows.into_iter()
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

// ─── Persistence ─────────────────────────────────────────────────────────────

fn persist_items(
    state: &tauri::State<'_, AppState>,
    source_id: &str,
    pr_items: Vec<GhItem>,
    issue_items: Vec<GhItem>,
    notif_items: Vec<GhItem>,
    ci_items: Vec<GhItem>,
) {
    let db = match state.db.lock() {
        Ok(d) => d,
        Err(_) => return,
    };
    let now = chrono::Utc::now().to_rfc3339();

    let all_items: Vec<GhItem> = pr_items
        .into_iter()
        .chain(issue_items)
        .chain(notif_items)
        .chain(ci_items)
        .collect();

    log::info!(
        "[DevDash] persist_items: source={} items={}",
        &source_id[..8.min(source_id.len())],
        all_items.len()
    );

    for item in all_items {
        let id = Uuid::new_v4().to_string();
        let meta_str = serde_json::to_string(&item.metadata).unwrap_or("{}".to_string());
        match db.execute(
            "INSERT OR REPLACE INTO data_items (id, source_id, kind, external_id, title, body, url, status, author, metadata, fetched_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                id,
                source_id,
                item.kind,
                item.external_id,
                item.title,
                item.body,
                item.url,
                item.status,
                item.author,
                meta_str,
                now
            ],
        ) {
            Ok(_) => {}
            Err(e) => log::error!("[DevDash] persist_items insert failed: {e}"),
        }
    }
}
