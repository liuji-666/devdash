use super::client::gh_get;
use super::types::GhItem;

/// Fetch GitHub notifications
pub async fn fetch_gh_notifications(
    http: &reqwest::Client,
    token: &str,
) -> Result<Vec<GhItem>, String> {
    if token.is_empty() {
        return Ok(vec![]);
    }
    let items = gh_get(http, "https://api.github.com/notifications", token).await?;
    Ok(items
        .iter()
        .filter_map(|item| {
            let url = item["subject"]["url"]
                .as_str()
                .map(|s| {
                    s.replace("api.github.com/repos", "github.com")
                        .replace("/pulls/", "/pull/")
                })
                .unwrap_or_default();

            Some(GhItem {
                kind: "notification".into(),
                external_id: item["id"].as_str()?.to_string(),
                title: item["subject"]["title"].as_str()?.to_string(),
                body: None,
                url: Some(url),
                status: "unread".into(),
                author: item["repository"]["full_name"]
                    .as_str()
                    .unwrap_or("")
                    .to_string(),
                metadata: serde_json::json!({
                    "reason": item["reason"].as_str().unwrap_or(""),
                    "unread": item["unread"].as_bool().unwrap_or(false)
                }),
            })
        })
        .collect())
}
