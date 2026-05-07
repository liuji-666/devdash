use reqwest;
use serde_json;
use std::time::Duration;
use tokio::time::sleep;

/// Maximum retry attempts for transient errors
const MAX_RETRIES: u32 = 3;

/// Base delay in milliseconds for exponential backoff
const BASE_DELAY_MS: u64 = 1000;

/// Status codes that are retryable (server errors + rate limit)
fn is_retryable(status: u16) -> bool {
    // 429 Too Many Requests, 500 Internal Server Error,
    // 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout
    matches!(status, 429 | 500 | 502 | 503 | 504)
}

/// Make a GET request to GitHub API with exponential backoff retry
pub async fn gh_get(
    http: &reqwest::Client,
    url: &str,
    token: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let mut last_err = String::new();

    for attempt in 0..=MAX_RETRIES {
        let mut req = http
            .get(url)
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "DevDash/1.0");
        if !token.is_empty() {
            req = req.header("Authorization", format!("Bearer {token}"));
        }

        let result = req.send().await;

        match result {
            Ok(resp) => {
                let status = resp.status();

                if !status.is_success() {
                    let code = status.as_u16();
                    eprintln!("[DevDash] gh_get FAILED: status={} url={} attempt={}", status, url, attempt);

                    // Non-retryable errors: return immediately with helpful message
                    if !is_retryable(code) {
                        let msg = if code == 401 {
                            "401 Unauthorized — 检查你的 Token".into()
                        } else if code == 403 {
                            "403 Forbidden — 可能触发频率限制或权限不足".into()
                        } else if code == 404 {
                            "404 Not Found — repo 不存在或没有权限".into()
                        } else {
                            format!("GitHub API {}", status)
                        };
                        return Err(msg);
                    }

                    // Retryable: wait with exponential backoff then retry
                    last_err = format!("GitHub API {} (attempt {})", status, attempt + 1);
                    if attempt < MAX_RETRIES {
                        let delay_ms = BASE_DELAY_MS * 2u64.pow(attempt);
                        eprintln!("[DevDash] Retrying in {}ms...", delay_ms);
                        sleep(Duration::from_millis(delay_ms)).await;
                        continue;
                    }
                } else {
                    // Success path
                    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
                    let body_kind = if body.is_array() { "array" } else if body.is_object() { "object" } else { "other" };
                    eprintln!("[DevDash] gh_get: status={} body_kind={} keys={:?}", status.as_u16(), body_kind, body.as_object().map(|o| o.keys().take(5).collect::<Vec<_>>()));
                    if let Some(arr) = body.as_array() {
                        return Ok(arr.clone());
                    }
                    if let Some(items) = body["items"].as_array() {
                        return Ok(items.clone());
                    }
                    if let Some(runs) = body["workflow_runs"].as_array() {
                        return Ok(runs.clone());
                    }
                    eprintln!("[DevDash] gh_get: no recognized array field, returning empty vec");
                    return Ok(vec![]);
                }
            }
            Err(e) => {
                // Network-level error (connection refused, timeout, DNS)
                last_err = format!("network: {e} (attempt {})", attempt + 1);
                eprintln!("[DevDash] gh_get network error: {} attempt={}", e, attempt);
                if attempt < MAX_RETRIES {
                    let delay_ms = BASE_DELAY_MS * 2u64.pow(attempt);
                    sleep(Duration::from_millis(delay_ms)).await;
                    continue;
                }
            }
        }
    }

    Err(format!("{} — 重试 {} 次后仍失败", last_err, MAX_RETRIES))
}

/// Discover starred repos for the authenticated user.
pub async fn discover_starred_repos(
    http: &reqwest::Client,
    token: &str,
) -> Result<Vec<super::types::RepoSpec>, String> {
    let mut all_repos = Vec::new();
    let mut page = 1u32;

    loop {
        let url = format!("https://api.github.com/user/starred?per_page=100&page={page}");
        let items = gh_get(http, &url, token).await?;
        if items.is_empty() {
            break;
        }

        for item in &items {
            let full_name = item["full_name"].as_str().unwrap_or("");
            let parts: Vec<&str> = full_name.splitn(2, '/').collect();
            if parts.len() == 2 {
                all_repos.push(super::types::RepoSpec {
                    owner: parts[0].to_string(),
                    repo: parts[1].to_string(),
                });
            }
        }

        if items.len() < 100 {
            break;
        }
        page += 1;
        if page > 3 {
            break;
        } // Limit to 300 starred repos max
    }

    Ok(all_repos)
}

/// Discover all repos accessible to the authenticated user.
pub async fn discover_user_repos(
    http: &reqwest::Client,
    token: &str,
) -> Result<Vec<super::types::RepoSpec>, String> {
    let mut all_repos = Vec::new();
    let mut page = 1u32;

    loop {
        let url = format!(
            "https://api.github.com/user/repos?per_page=100&sort=updated&page={page}&affiliation=owner,collaborator"
        );
        eprintln!("[DevDash DIAG] discover_user_repos: calling gh_get url={}", url);
        let items = gh_get(http, &url, token).await?;
        eprintln!("[DevDash DIAG] discover_user_repos: got {} items", items.len());
        if items.is_empty() {
            eprintln!("[DevDash DIAG] discover_user_repos page {}: empty/zero items", page);
            break;
        }

        for item in &items {
            let full_name = item["full_name"].as_str().unwrap_or("");
            let parts: Vec<&str> = full_name.splitn(2, '/').collect();
            if parts.len() == 2 {
                all_repos.push(super::types::RepoSpec {
                    owner: parts[0].to_string(),
                    repo: parts[1].to_string(),
                });
            }
        }

        // If we got fewer than 100, no more pages
        if items.len() < 100 {
            break;
        }
        page += 1;

        // Safety limit
        if page > 10 {
            break;
        }
    }

    Ok(all_repos)
}
