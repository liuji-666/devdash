use super::client::gh_get;
use super::types::{GhItem, GithubConfig};

/// Fetch GitHub issues
pub async fn fetch_gh_issues(
    http: &reqwest::Client,
    token: &str,
    config: &GithubConfig,
) -> Result<Vec<GhItem>, String> {
    let mut all_items: Vec<GhItem> = Vec::new();

    // Per-repo fetch
    match (&config.owner, &config.repo) {
        (Some(o), Some(r)) => {
            let url = format!(
                "https://api.github.com/repos/{o}/{r}/issues?state=open&per_page=50"
            );
            log::info!("[DevDash] fetch_gh_issues (repo): url={}", url);
            let items = gh_get(http, &url, token).await?;
            log::info!(
                "[DevDash] fetch_gh_issues (repo): got {} items",
                items.len()
            );
            for item in &items {
                if item["pull_request"].is_object() {
                    continue;
                }
                all_items.push(GhItem {
                    kind: "issue".into(),
                    external_id: item["number"].as_i64().unwrap_or(0).to_string(),
                    title: item["title"].as_str().unwrap_or("").to_string(),
                    body: item["body"].as_str().map(String::from),
                    url: item["html_url"].as_str().map(String::from),
                    status: item["state"].as_str().unwrap_or("open").into(),
                    author: item["user"]["login"].as_str().unwrap_or("").to_string(),
                    metadata: serde_json::json!({
                        "labels": item["labels"].as_array().map(|a| a.iter().filter_map(|l| l["name"].as_str().map(String::from)).collect::<Vec<_>>()).unwrap_or_default(),
                        "repo": item["repository_url"].as_str().map(|u| u.replace("https://api.github.com/repos/", "")).unwrap_or_default(),
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

    // User-scoped search: multiple queries
    let queries = vec![
        // Most important: Issues assigned to me
        ("assignee", "is:issue+is:open+assignee:@me"),
        // Issues mentioning me
        ("mentions", "is:issue+is:open+mentions:@me"),
        // My own issues
        ("author", "is:issue+is:open+author:@me"),
        // Issues I'm involved in
        ("involves", "is:issue+is:open+involves:@me"),
    ];

    let mut seen_ids = std::collections::HashSet::new();

    for (source, query) in &queries {
        let url = format!(
            "https://api.github.com/search/issues?q={}&per_page=50",
            query
        );
        log::info!("[DevDash] fetch_gh_issues ({}): url={}", source, url);
        match gh_get(http, &url, token).await {
            Ok(items) => {
                log::info!(
                    "[DevDash] fetch_gh_issues ({}): got {} items",
                    source,
                    items.len()
                );
                for item in &items {
                    if item["pull_request"].is_object() {
                        continue;
                    }
                    let id = item["id"].as_i64().unwrap_or(0);
                    if seen_ids.contains(&id) {
                        continue;
                    }
                    seen_ids.insert(id);

                    all_items.push(GhItem {
                        kind: "issue".into(),
                        external_id: item["number"].as_i64().unwrap_or(0).to_string(),
                        title: item["title"].as_str().unwrap_or("").to_string(),
                        body: item["body"].as_str().map(String::from),
                        url: item["html_url"].as_str().map(String::from),
                        status: item["state"].as_str().unwrap_or("open").into(),
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
                log::warn!("[DevDash] fetch_gh_issues ({}): error: {}", source, e);
            }
        }
    }

    log::info!(
        "[DevDash] fetch_gh_issues: total unique issues: {}",
        all_items.len()
    );
    Ok(all_items)
}
