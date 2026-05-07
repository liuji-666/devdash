use serde::{Deserialize, Serialize};

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RepoSpec {
    pub owner: String,
    pub repo: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GithubConfig {
    pub token: Option<String>,
    /// Single repo (legacy format: { owner, repo })
    pub owner: Option<String>,
    pub repo: Option<String>,
    /// Multiple repos (new format: [{ owner, repo }, ...])
    pub repos: Option<Vec<RepoSpec>>,
    /// If true, fetch all repos accessible to the token user
    #[serde(alias = "allRepos")]
    pub all_repos: Option<bool>,
    /// If true, fetch starred repos
    pub starred_repos: Option<bool>,
}

impl GithubConfig {
    /// Resolve the list of repos to fetch from.
    /// Priority: repos[] > owner/repo (legacy) > all_repos
    pub fn resolved_repos(&self) -> Vec<RepoSpec> {
        if let Some(repos) = &self.repos {
            if !repos.is_empty() {
                return repos.clone();
            }
        }
        // Legacy single-repo format
        if let (Some(owner), Some(repo)) = (&self.owner, &self.repo) {
            if !owner.is_empty() && !repo.is_empty() {
                return vec![RepoSpec { owner: owner.clone(), repo: repo.clone() }];
            }
        }
        if self.all_repos.unwrap_or(false) {
            // Caller will enumerate repos via API; return sentinel to signal "all"
            return Vec::new();
        }
        vec![]
    }

    pub fn include_starred(&self) -> bool {
        self.starred_repos.unwrap_or(false)
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct ContributionDay {
    pub date: String,   // "2026-05-01"
    pub count: i64,     // contribution count
    pub level: i64,     // 0-4 heat level
}

#[derive(Debug, Serialize)]
pub struct ContributionsResponse {
    pub days: Vec<ContributionDay>,
    pub total: i64,
    pub streak: i64,
}

#[derive(Debug, Serialize)]
pub struct FetchResult {
    pub prs: i64,
    pub issues: i64,
    pub ci_runs: i64,
    pub notifications: i64,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitlabConfig {
    pub token: Option<String>,
    pub base_url: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Default)]
pub struct GhItem {
    pub kind: String,
    pub external_id: String,
    pub title: String,
    pub body: Option<String>,
    pub url: Option<String>,
    pub status: String,
    pub author: String,
    pub metadata: serde_json::Value,
}

// ─── PR Action Types ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct PRActionResult {
    pub success: bool,
    pub message: String,
    pub action: String,
}
