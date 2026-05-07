use super::types::PRActionResult;
use crate::models::AppState;
use super::prs::load_github_sources;

/// Approve a PR (POST /repos/{owner}/{repo}/pulls/{pr_number}/reviews)
#[tauri::command]
pub async fn github_approve_pr(
    state: tauri::State<'_, AppState>,
    owner: String,
    repo: String,
    pr_number: i64,
    body: Option<String>,
) -> Result<PRActionResult, String> {
    let token = get_any_github_token(&state)?;
    let http = reqwest::Client::builder()
        .user_agent("DevDash/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/reviews"
    );
    let payload = serde_json::json!({
        "event": "APPROVE",
        "body": body.unwrap_or_else(|| "LGTM 👍".to_string()),
    });

    let resp = http
        .post(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "DevDash/1.0")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("网络错误: {e}"))?;

    if resp.status().is_success() {
        Ok(PRActionResult {
            success: true,
            message: format!("已批准 {owner}/{repo}#{pr_number}"),
            action: "approve".into(),
        })
    } else {
        let status = resp.status().as_u16();
        let err_body: serde_json::Value = resp.json().await.unwrap_or_default();
        let msg = err_body["message"].as_str().unwrap_or("未知错误");
        Ok(PRActionResult {
            success: false,
            message: format!("批准失败 ({status}): {msg}"),
            action: "approve".into(),
        })
    }
}

/// Merge a PR (PUT /repos/{owner}/{repo}/pulls/{pr_number}/merge)
#[tauri::command]
pub async fn github_merge_pr(
    state: tauri::State<'_, AppState>,
    owner: String,
    repo: String,
    pr_number: i64,
    merge_method: Option<String>, // merge, squash, rebase
) -> Result<PRActionResult, String> {
    let token = get_any_github_token(&state)?;
    let http = reqwest::Client::builder()
        .user_agent("DevDash/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/merge"
    );
    let method = merge_method.unwrap_or_else(|| "squash".to_string());
    let payload = serde_json::json!({
        "merge_method": method,
    });

    let resp = http
        .put(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "DevDash/1.0")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("网络错误: {e}"))?;

    if resp.status().is_success() {
        Ok(PRActionResult {
            success: true,
            message: format!("已合并 {owner}/{repo}#{pr_number} ({method})"),
            action: "merge".into(),
        })
    } else {
        let status = resp.status().as_u16();
        let err_body: serde_json::Value = resp.json().await.unwrap_or_default();
        let msg = err_body["message"].as_str().unwrap_or("未知错误");
        Ok(PRActionResult {
            success: false,
            message: format!("合并失败 ({status}): {msg}"),
            action: "merge".into(),
        })
    }
}

/// Comment on a PR (POST /repos/{owner}/{repo}/issues/{pr_number}/comments)
#[tauri::command]
pub async fn github_comment_pr(
    state: tauri::State<'_, AppState>,
    owner: String,
    repo: String,
    pr_number: i64,
    body: String,
) -> Result<PRActionResult, String> {
    let token = get_any_github_token(&state)?;
    let http = reqwest::Client::builder()
        .user_agent("DevDash/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://api.github.com/repos/{owner}/{repo}/issues/{pr_number}/comments"
    );
    let payload = serde_json::json!({ "body": body });

    let resp = http
        .post(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "DevDash/1.0")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("网络错误: {e}"))?;

    if resp.status().is_success() {
        Ok(PRActionResult {
            success: true,
            message: format!("已评论 {owner}/{repo}#{pr_number}"),
            action: "comment".into(),
        })
    } else {
        let status = resp.status().as_u16();
        let err_body: serde_json::Value = resp.json().await.unwrap_or_default();
        let msg = err_body["message"].as_str().unwrap_or("未知错误");
        Ok(PRActionResult {
            success: false,
            message: format!("评论失败 ({status}): {msg}"),
            action: "comment".into(),
        })
    }
}

/// Close a PR (PATCH /repos/{owner}/{repo}/pulls/{pr_number})
#[tauri::command]
pub async fn github_close_pr(
    state: tauri::State<'_, AppState>,
    owner: String,
    repo: String,
    pr_number: i64,
) -> Result<PRActionResult, String> {
    let token = get_any_github_token(&state)?;
    let http = reqwest::Client::builder()
        .user_agent("DevDash/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"
    );
    let payload = serde_json::json!({ "state": "closed" });

    let resp = http
        .patch(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "DevDash/1.0")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("网络错误: {e}"))?;

    if resp.status().is_success() {
        Ok(PRActionResult {
            success: true,
            message: format!("已关闭 {owner}/{repo}#{pr_number}"),
            action: "close".into(),
        })
    } else {
        let status = resp.status().as_u16();
        let err_body: serde_json::Value = resp.json().await.unwrap_or_default();
        let msg = err_body["message"].as_str().unwrap_or("未知错误");
        Ok(PRActionResult {
            success: false,
            message: format!("关闭失败 ({status}): {msg}"),
            action: "close".into(),
        })
    }
}

/// Request a review on a PR (POST /repos/{owner}/{repo}/pulls/{pr_number}/requested_reviewers)
#[tauri::command]
pub async fn github_request_review(
    state: tauri::State<'_, AppState>,
    owner: String,
    repo: String,
    pr_number: i64,
    reviewers: Vec<String>,
) -> Result<PRActionResult, String> {
    let token = get_any_github_token(&state)?;
    let http = reqwest::Client::builder()
        .user_agent("DevDash/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/requested_reviewers"
    );
    let payload = serde_json::json!({ "reviewers": reviewers });

    let resp = http
        .post(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "DevDash/1.0")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("网络错误: {e}"))?;

    if resp.status().is_success() {
        Ok(PRActionResult {
            success: true,
            message: format!("已请求 {owner}/{repo}#{pr_number} 的审查"),
            action: "request_review".into(),
        })
    } else {
        let status = resp.status().as_u16();
        let err_body: serde_json::Value = resp.json().await.unwrap_or_default();
        let msg = err_body["message"].as_str().unwrap_or("未知错误");
        Ok(PRActionResult {
            success: false,
            message: format!("请求审查失败 ({status}): {msg}"),
            action: "request_review".into(),
        })
    }
}

/// Helper: Get any available GitHub token from enabled sources
fn get_any_github_token(state: &tauri::State<'_, AppState>) -> Result<String, String> {
    let sources = load_github_sources(state)?;
    sources
        .first()
        .and_then(|(_, c)| c.token.clone())
        .filter(|t| !t.is_empty())
        .ok_or_else(|| "未配置 GitHub Token".to_string())
}
