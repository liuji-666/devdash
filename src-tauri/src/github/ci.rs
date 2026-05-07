use super::client::gh_get;
use super::types::{GhItem, GithubConfig};

/// Fetch CI runs for a specific repo
pub async fn fetch_gh_ci_runs(
    http: &reqwest::Client,
    token: &str,
    config: &GithubConfig,
) -> Result<Vec<GhItem>, String> {
    let (owner, repo) = match (&config.owner, &config.repo) {
        (Some(o), Some(r)) if !token.is_empty() => (o, r),
        _ => return Ok(vec![]),
    };
    let url = format!(
        "https://api.github.com/repos/{owner}/{repo}/actions/runs?per_page=20"
    );
    let items = gh_get(http, &url, token).await?;
    Ok(items
        .iter()
        .filter_map(|item| {
            let conclusion = item["conclusion"].as_str();
            let status = item["status"].as_str().unwrap_or("unknown");
            // Map status + conclusion
            let item_status = match (status, conclusion) {
                ("completed", Some("success")) => "success",
                ("completed", Some("failure")) => "failure",
                ("completed", Some("cancelled")) => "cancelled",
                ("completed", _) => "failure",
                ("in_progress", _) => "running",
                ("queued", _) => "pending",
                _ => "pending",
            };
            Some(GhItem {
                kind: "ci_run".into(),
                external_id: item["id"].as_i64()?.to_string(),
                title: item["name"].as_str().unwrap_or("unknown").to_string(),
                body: None,
                url: item["html_url"].as_str().map(String::from),
                status: item_status.into(),
                author: item["head_branch"].as_str().unwrap_or("").to_string(),
                metadata: serde_json::json!({
                    "workflow": item["workflow_name"].as_str().unwrap_or(""),
                    "branch": item["head_branch"].as_str().unwrap_or(""),
                    "event": item["event"].as_str().unwrap_or(""),
                }),
            })
        })
        .collect())
}
