// github/mod.rs — GitHub integration module
// Split from the monolithic github.rs for better maintainability

pub mod client;
mod prs;
mod issues;
mod ci;
mod notifications;
mod contributions;
mod actions;
mod types;
mod gitlab;

pub use types::*;
pub use prs::*;
pub use issues::*;
pub use ci::*;
pub use notifications::*;
pub use contributions::*;
pub use actions::*;
pub use gitlab::*;

// Re-export the main fetch function for backward compatibility
pub use prs::fetch_github_data;
pub use gitlab::fetch_gitlab_data;
pub use prs::load_github_sources;

/// Diagnostic command: test GitHub API connectivity and return raw results
#[tauri::command]
pub async fn diagnose_github_data(
    _app: tauri::AppHandle,
    state: tauri::State<'_, crate::models::AppState>,
) -> Result<serde_json::Value, String> {
    let sources = load_github_sources(&state)?;
    if sources.is_empty() {
        return Ok(serde_json::json!({
            "status": "no_sources",
            "message": "没有配置 GitHub 数据源"
        }));
    }

    let http = reqwest::Client::builder()
        .user_agent("DevDash/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    for (source_id, config) in sources {
        let token = config.token.clone().unwrap_or_default();
        if token.is_empty() {
            results.push(serde_json::json!({
                "source_id": &source_id[..8.min(source_id.len())],
                "status": "no_token",
                "message": "Token 为空"
            }));
            continue;
        }

        // Test 1: Verify token
        let token_valid = match client::gh_get(&http, "https://api.github.com/user", &token).await {
            Ok(user) => {
                let login = user.get(0).and_then(|u| u["login"].as_str()).unwrap_or("unknown");
                serde_json::json!({ "valid": true, "login": login })
            }
            Err(e) => serde_json::json!({ "valid": false, "error": e })
        };

        // Test 2: Search PRs with different queries
        let mut pr_queries = Vec::new();
        for (name, query) in [
            ("review_requested", "is:pr+is:open+review-requested:@me"),
            ("author", "is:pr+is:open+author:@me"),
            ("assignee", "is:pr+is:open+assignee:@me"),
            ("involves", "is:pr+is:open+involves:@me"),
        ] {
            let url = format!("https://api.github.com/search/issues?q={}&per_page=10", query);
            match client::gh_get(&http, &url, &token).await {
                Ok(items) => {
                    pr_queries.push(serde_json::json!({
                        "query": name,
                        "count": items.len(),
                        "titles": items.iter().map(|i| i["title"].as_str().unwrap_or("")).collect::<Vec<_>>()
                    }));
                }
                Err(e) => {
                    pr_queries.push(serde_json::json!({
                        "query": name,
                        "error": e
                    }));
                }
            }
        }

        // Test 3: Check repos
        let repos = if config.all_repos.unwrap_or(false) {
            match client::discover_user_repos(&http, &token).await {
                Ok(r) => serde_json::json!({ "count": r.len(), "sample": r.iter().take(5).map(|r| format!("{}/{}", r.owner, r.repo)).collect::<Vec<_>>() }),
                Err(e) => serde_json::json!({ "error": e })
            }
        } else {
            let resolved = config.resolved_repos();
            serde_json::json!({ "count": resolved.len(), "repos": resolved.iter().map(|r| format!("{}/{}", r.owner, r.repo)).collect::<Vec<_>>() })
        };

        results.push(serde_json::json!({
            "source_id": &source_id[..8.min(source_id.len())],
            "token_valid": token_valid,
            "pr_queries": pr_queries,
            "repos": repos
        }));
    }

    Ok(serde_json::json!({
        "status": "ok",
        "sources_tested": results.len(),
        "results": results
    }))
}

use tauri::AppHandle;

/// Poll result with per-source status and errors
#[derive(Debug, serde::Serialize)]
pub struct PollResult {
    pub success: bool,
    pub message: String,
    pub github: Option<FetchResult>,
    pub gitlab: Option<i64>,
    pub jira: Option<i64>,
    pub linear: Option<i64>,
    pub errors: Vec<String>,
}

/// Poll all sources concurrently and return structured result with errors
#[tauri::command]
pub async fn poll_sources(app: AppHandle, state: tauri::State<'_, crate::models::AppState>) -> Result<PollResult, String> {
    eprintln!("[DevDash] poll_sources called (concurrent)");

    // Spawn all 4 source fetches concurrently via tokio::join!
    let (github_res, gitlab_res, jira_res, linear_res) = tokio::join!(
        // GitHub
        async {
            match fetch_github_data(app.clone(), state.clone()).await {
                Ok(r) => {
                    eprintln!("[DevDash] fetch_github_data OK: {} PRs, {} CI, {} Issues, {} errors", r.prs, r.ci_runs, r.issues, r.errors.len());
                    (Some(r), Vec::<String>::new())
                }
                Err(e) => {
                    eprintln!("[DevDash] fetch_github_data FAILED: {e}");
                    (None, vec![format!("GitHub: {e}")])
                }
            }
        },
        // GitLab
        async {
            match fetch_gitlab_data(app.clone(), state.clone()).await {
                Ok(n) => (Some(n), Vec::<String>::new()),
                Err(e) => (None, vec![format!("GitLab: {e}")]),
            }
        },
        // Jira
        async {
            match crate::issue_trackers::fetch_jira_data(app.clone(), state.clone()).await {
                Ok(n) => (Some(n), Vec::<String>::new()),
                Err(e) => (None, vec![format!("Jira: {e}")]),
            }
        },
        // Linear
        async {
            match crate::issue_trackers::fetch_linear_data(app.clone(), state.clone()).await {
                Ok(n) => (Some(n), Vec::<String>::new()),
                Err(e) => (None, vec![format!("Linear: {e}")]),
            }
        },
    );

    // Unpack results: (Option<Success>, Vec<String> errors)
    let (github_result, github_errors) = github_res;
    let (gitlab_result, gitlab_errors) = gitlab_res;
    let (jira_result, jira_errors) = jira_res;
    let (linear_result, linear_errors) = linear_res;

    // Build summary
    let mut errors: Vec<String> = Vec::new();
    let mut parts: Vec<String> = Vec::new();

    // GitHub
    if let Some(ref r) = github_result {
        if r.prs > 0 || r.ci_runs > 0 || r.issues > 0 {
            parts.push(format!("GitHub: {} PRs, {} CI, {} Issues", r.prs, r.ci_runs, r.issues));
        }
        for err in &r.errors {
            errors.push(format!("GitHub: {err}"));
        }
    }
    errors.extend(github_errors);

    // GitLab
    if let Some(n) = gitlab_result {
        if n > 0 { parts.push(format!("GitLab: {} MRs", n)); }
    }
    errors.extend(gitlab_errors);

    // Jira
    if let Some(n) = jira_result {
        if n > 0 { parts.push(format!("Jira: {} 任务", n)); }
    }
    errors.extend(jira_errors);

    // Linear
    if let Some(n) = linear_result {
        if n > 0 { parts.push(format!("Linear: {} 任务", n)); }
    }
    errors.extend(linear_errors);

    let message = if parts.is_empty() {
        if errors.is_empty() {
            "暂无数据".to_string()
        } else {
            format!("{} 个错误", errors.len())
        }
    } else {
        parts.join(" · ")
    };

    Ok(PollResult {
        success: errors.is_empty(),
        message,
        github: github_result,
        gitlab: gitlab_result,
        jira: jira_result,
        linear: linear_result,
        errors,
    })
}
