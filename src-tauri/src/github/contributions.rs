
use crate::models::AppState;
use crate::github::types::{ContributionDay, ContributionsResponse};

#[tauri::command]
pub async fn fetch_github_contributions(
    state: tauri::State<'_, AppState>,
    username: Option<String>,
) -> Result<ContributionsResponse, String> {
    let sources = super::prs::load_github_sources(&state)?;
    let http = reqwest::Client::builder()
        .user_agent("DevDash/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    // Determine username: explicit > first source's token owner
    let token = sources
        .first()
        .and_then(|(_, c)| c.token.clone())
        .unwrap_or_default();

    let resolved_user = if let Some(u) = username {
        u
    } else if !token.is_empty() {
        // Get authenticated user's login
        let resp = http
            .get("https://api.github.com/user")
            .header("Authorization", format!("Bearer {token}"))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "DevDash/1.0")
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err("无法获取 GitHub 用户名，请在 Widget 设置中指定".to_string());
        }
        let user: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        user["login"].as_str().unwrap_or("").to_string()
    } else {
        return Err("未配置 GitHub Token，无法获取贡献数据".to_string());
    };

    if resolved_user.is_empty() {
        return Err("GitHub 用户名为空".to_string());
    }

    // Fetch events for the last 365 days
    let mut day_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();

    // Fetch user events (up to 10 pages, 100 per page = 1000 events)
    for page in 1..=10 {
        let url = format!(
            "https://api.github.com/users/{}/events?per_page=100&page={}",
            resolved_user, page
        );
        let mut req = http
            .get(&url)
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "DevDash/1.0");
        if !token.is_empty() {
            req = req.header("Authorization", format!("Bearer {token}"));
        }

        let resp = match req.send().await {
            Ok(r) => r,
            Err(_) => break,
        };

        if !resp.status().is_success() {
            break;
        }

        let events: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();
        if events.is_empty() {
            break;
        }

        for event in &events {
            let event_type = event["type"].as_str().unwrap_or("");
            let created_at = event["created_at"].as_str().unwrap_or("");
            // Extract date part only (YYYY-MM-DD)
            let date = if created_at.len() >= 10 {
                &created_at[..10]
            } else {
                continue;
            };

            // Count relevant events
            let increment = match event_type {
                "PushEvent" => {
                    // Count commits in push
                    let commits = event["payload"]["size"].as_i64().unwrap_or(1).max(1);
                    commits
                }
                "PullRequestEvent"
                | "IssuesEvent"
                | "IssueCommentEvent"
                | "PullRequestReviewEvent"
                | "CreateEvent"
                | "ReleaseEvent"
                | "WatchEvent"
                | "ForkEvent" => 1,
                _ => 0,
            };

            if increment > 0 {
                *day_map.entry(date.to_string()).or_default() += increment;
            }
        }
    }

    // Build 365 days of data
    let today = chrono::Utc::now();
    let mut days = Vec::with_capacity(365);
    let mut total = 0i64;
    for i in (0..365).rev() {
        let date = (today - chrono::Duration::days(i))
            .format("%Y-%m-%d")
            .to_string();
        let count = *day_map.get(&date).unwrap_or(&0);
        total += count;

        let level = match count {
            0 => 0,
            1..=2 => 1,
            3..=5 => 2,
            6..=9 => 3,
            _ => 4,
        };

        days.push(ContributionDay { date, count, level });
    }

    // Recalculate streak from today backwards
    let mut streak = 0i64;
    for day in days.iter().rev() {
        if day.count > 0 {
            streak += 1;
        } else {
            break;
        }
    }

    Ok(ContributionsResponse {
        days,
        total,
        streak,
    })
}
