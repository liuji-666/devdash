use serde::{Deserialize, Serialize};
use std::collections::HashSet;

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum TriageItemKind {
    ReviewRequested,    // PR 需要我审查
    AssignedIssue,      // Issue 分配给我
    AssignedMR,         // MR 分配给我
    Notification,       // 未读通知
    CIFailure,          // CI 失败
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TriageItem {
    pub id: String,
    pub kind: TriageItemKind,
    pub title: String,
    pub source: String,        // "github", "gitlab", "jira", "linear"
    pub url: Option<String>,
    pub priority: i32,         // 计算出的优先级分数
    pub waiting_hours: i32,    // 等待处理的小时数
    pub metadata: serde_json::Value,
}

// ─── Priority Engine ─────────────────────────────────────────────────────────

#[allow(dead_code)]
pub struct TriageEngine;

#[allow(dead_code)]
impl TriageEngine {
    /// Calculate priority score for an item
    /// 
    /// Score formula:
    /// - base_priority: ReviewRequested=100, AssignedIssue=80, AssignedMR=80, Notification=20, CIFailure=150
    /// - time_factor: waiting_hours * 2
    /// - bonus: CI failure +50, waiting > 24h +20
    pub fn calculate_priority(item: &TriageItem) -> i32 {
        let base = match item.kind {
            TriageItemKind::CIFailure => 150,
            TriageItemKind::ReviewRequested => 100,
            TriageItemKind::AssignedIssue => 80,
            TriageItemKind::AssignedMR => 80,
            TriageItemKind::Notification => 20,
        };
        
        let time_bonus = item.waiting_hours * 2;
        let urgency_bonus = if item.waiting_hours > 24 { 20 } else { 0 };
        
        base + time_bonus + urgency_bonus
    }
    
    /// Sort items by priority (highest first)
    pub fn sort_by_priority(mut items: Vec<TriageItem>) -> Vec<TriageItem> {
        // Calculate priority for each item
        for item in &mut items {
            item.priority = Self::calculate_priority(item);
        }
        
        // Sort by priority descending
        items.sort_by(|a, b| b.priority.cmp(&a.priority));
        items
    }
    
    /// Remove duplicate items (same URL or same source+external_id)
    pub fn deduplicate(items: Vec<TriageItem>) -> Vec<TriageItem> {
        let mut seen = HashSet::new();
        let mut result = Vec::new();
        
        for item in items {
            let key = item.url.clone().unwrap_or_else(|| format!("{}:{}", item.source, item.id));
            if seen.insert(key) {
                result.push(item);
            }
        }
        
        result
    }
    
    /// Filter items by kind
    pub fn filter_by_kind(items: Vec<TriageItem>, kinds: Vec<TriageItemKind>) -> Vec<TriageItem> {
        let kind_set: HashSet<_> = kinds.into_iter().collect();
        items.into_iter().filter(|item| kind_set.contains(&item.kind)).collect()
    }
    
    /// Get items that need action (exclude pure notifications)
    pub fn actionable_items(items: Vec<TriageItem>) -> Vec<TriageItem> {
        items.into_iter()
            .filter(|item| !matches!(item.kind, TriageItemKind::Notification))
            .collect()
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

// ─── Tauri Commands ──────────────────────────────────────────────────────────

use tauri::State;
use crate::models::AppState;

/// Get the current triage queue (aggregated from all sources)
#[tauri::command]
pub async fn get_triage_queue(
    _state: State<'_, AppState>,
) -> Result<Vec<TriageItem>, String> {
    // TODO: Implement aggregation from data_items table
    // For now, return empty queue
    Ok(vec![])
}

/// Perform an action on a triage item
#[tauri::command]
pub async fn triage_action(
    _state: State<'_, AppState>,
    item_id: String,
    action: String,
) -> Result<bool, String> {
    // TODO: Implement actions (approve, merge, close, skip)
    log::info!("[DevDash] Triage action: {} on {}", action, item_id);
    Ok(true)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn create_item(id: &str, kind: TriageItemKind, waiting_hours: i32) -> TriageItem {
        TriageItem {
            id: id.to_string(),
            kind,
            title: format!("Test {}", id),
            source: "github".to_string(),
            url: Some(format!("https://github.com/test/{}", id)),
            priority: 0,
            waiting_hours,
            metadata: serde_json::json!({}),
        }
    }

    #[test]
    fn test_calculate_priority_review_requested() {
        let item = create_item("1", TriageItemKind::ReviewRequested, 0);
        assert_eq!(TriageEngine::calculate_priority(&item), 100);
    }

    #[test]
    fn test_calculate_priority_ci_failure() {
        let item = create_item("1", TriageItemKind::CIFailure, 0);
        assert_eq!(TriageEngine::calculate_priority(&item), 150);
    }

    #[test]
    fn test_calculate_priority_with_waiting_time() {
        let item = create_item("1", TriageItemKind::ReviewRequested, 10);
        // base 100 + time_bonus 20 + urgency_bonus 0 = 120
        assert_eq!(TriageEngine::calculate_priority(&item), 120);
    }

    #[test]
    fn test_calculate_priority_long_wait() {
        let item = create_item("1", TriageItemKind::AssignedIssue, 48);
        // base 80 + time_bonus 96 + urgency_bonus 20 = 196
        assert_eq!(TriageEngine::calculate_priority(&item), 196);
    }

    #[test]
    fn test_sort_by_priority() {
        let items = vec![
            create_item("1", TriageItemKind::Notification, 0),      // priority: 20
            create_item("2", TriageItemKind::ReviewRequested, 0),   // priority: 100
            create_item("3", TriageItemKind::AssignedIssue, 0),     // priority: 80
        ];
        
        let sorted = TriageEngine::sort_by_priority(items);
        
        assert_eq!(sorted[0].id, "2"); // ReviewRequested (100)
        assert_eq!(sorted[1].id, "3"); // AssignedIssue (80)
        assert_eq!(sorted[2].id, "1"); // Notification (20)
    }

    #[test]
    fn test_sort_by_priority_with_time() {
        let items = vec![
            create_item("1", TriageItemKind::ReviewRequested, 0),   // priority: 100
            create_item("2", TriageItemKind::AssignedIssue, 48),    // priority: 80 + 96 + 20 = 196
        ];
        
        let sorted = TriageEngine::sort_by_priority(items);
        
        assert_eq!(sorted[0].id, "2"); // AssignedIssue with 48h wait (196)
        assert_eq!(sorted[1].id, "1"); // ReviewRequested fresh (100)
    }

    #[test]
    fn test_deduplicate() {
        let items = vec![
            create_item("1", TriageItemKind::ReviewRequested, 0),
            create_item("2", TriageItemKind::ReviewRequested, 0), // different id
            create_item("1", TriageItemKind::ReviewRequested, 0), // duplicate
        ];
        
        let deduped = TriageEngine::deduplicate(items);
        
        assert_eq!(deduped.len(), 2);
    }

    #[test]
    fn test_filter_by_kind() {
        let items = vec![
            create_item("1", TriageItemKind::ReviewRequested, 0),
            create_item("2", TriageItemKind::AssignedIssue, 0),
            create_item("3", TriageItemKind::Notification, 0),
        ];
        
        let filtered = TriageEngine::filter_by_kind(
            items,
            vec![TriageItemKind::ReviewRequested, TriageItemKind::AssignedIssue]
        );
        
        assert_eq!(filtered.len(), 2);
        assert!(filtered.iter().all(|item| 
            matches!(item.kind, TriageItemKind::ReviewRequested | TriageItemKind::AssignedIssue)
        ));
    }

    #[test]
    fn test_actionable_items() {
        let items = vec![
            create_item("1", TriageItemKind::ReviewRequested, 0),
            create_item("2", TriageItemKind::Notification, 0),
            create_item("3", TriageItemKind::AssignedIssue, 0),
        ];
        
        let actionable = TriageEngine::actionable_items(items);
        
        assert_eq!(actionable.len(), 2);
        assert!(actionable.iter().all(|item| !matches!(item.kind, TriageItemKind::Notification)));
    }

    #[test]
    fn test_ci_failure_highest_priority() {
        let items = vec![
            create_item("1", TriageItemKind::Notification, 100),     // 20 + 200 + 20 = 240
            create_item("2", TriageItemKind::CIFailure, 0),          // 150
            create_item("3", TriageItemKind::ReviewRequested, 50),   // 100 + 100 + 20 = 220
        ];
        
        let sorted = TriageEngine::sort_by_priority(items);
        
        // Notification with 100h wait (240) > CIFailure (150) > ReviewRequested 50h (220)
        // Actually: Notification (240) > ReviewRequested (220) > CIFailure (150)
        assert_eq!(sorted[0].id, "1");
        assert_eq!(sorted[1].id, "3");
        assert_eq!(sorted[2].id, "2");
    }
}
