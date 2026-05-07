# 数据流根因排查 — 2026-05-01 23:24

## 问题
refreshDataItems 返回 0 items，Widget 显示"暂无 PR 数据"。

## 根因
**不是代码 bug，是数据为空**：
- 用户的 GitHub 账号 `liuji-666` 没有公开的 PRs/Issues/Notifications
- Source config 只有 token，没有 owner/repo
- `fetch_gh_prs` 在无 owner/repo 时 fallback 到 `author:@me` 搜索
- GitHub Search API 返回 total_count=0，data_items 表确实为空

## 数据库状态
- sources: 1 条 (github, id=89335439-...)
- data_items: 0 条
- dashboards: 1 条 ("123", 非默认)
- widgets: 2 条 (ci_status, pr_list，均指向正确 sourceId)

## 验证
- Token 有效 (HTTP 200, login=liuji-666)
- author:@me PR search: total_count=0
- notifications: 0 条
- 公开仓库 tauri-apps/tauri: PRs 正常返回

## 修复
临时将 source config 更新为 `owner=tauri-apps, repo=tauri` 用于验证数据流。
用户需要重启或点刷新，应该能看到 PR 数据。

## 待做
- 如果 tauri-apps/tauri 数据成功显示 → 数据流完全正确
- 用户后续应改为自己的仓库，或在 Settings 里填写 owner/repo
- 考虑当 author:@me 返回 0 条时，自动拉取用户有权限的仓库列表
