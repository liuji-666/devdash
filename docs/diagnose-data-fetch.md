# DevDash 数据拉取诊断报告

## Phase 1: 反馈循环建立

### 问题定义
用户配置 GitHub 数据源后，所有 widget 显示"暂无数据"。

### 根因分析

#### 1. PR 搜索条件太窄

当前 `fetch_gh_prs` 使用：
```
is:pr+is:open+(author:@me+OR+assignee:@me+OR+involves:@me)
```

**问题**：
- `author:@me` — 用户自己创建的 PR。大多数开发者没有开放的自己创建的 PR
- `assignee:@me` — 分配给用户的 PR。GitHub PR 很少用 assignee
- `involves:@me` — 涉及用户的 PR。范围太广，不准确

**开发者真正关心的**：
- `review-requested:@me` — 需要我审查的 PR ✅
- `assignee:@me` — 分配给我的（Issue 更常用）

#### 2. Issue 搜索条件

当前：
```
is:issue+is:open+(author:@me+OR+assignee:@me+OR+involves:@me)
```

**问题**：
- 大多数 Issue 不是用户创建的
- `assignee:@me` 对 Issue 更有意义，但很多人不分配

#### 3. 仓库配置问题

如果用户选择 "所有仓库" (`all_repos=true`)：
- 代码会枚举用户的所有仓库
- 然后逐个仓库拉取 PR/Issue
- 但如果用户没有指定仓库，且没有 `all_repos`，则使用用户级搜索

#### 4. Token 权限

需要检查 Token 是否有：
- `repo` 范围（访问私有仓库）
- `notifications` 范围（访问通知）

---

## Phase 2: 复现

### 测试搜索 API

```bash
# 测试当前搜索条件（返回 0 条）
curl -H "Authorization: Bearer TOKEN" \
  "https://api.github.com/search/issues?q=is:pr+is:open+author:@me"

# 测试 review-requested（应该返回数据）
curl -H "Authorization: Bearer TOKEN" \
  "https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me"

# 测试 notifications
curl -H "Authorization: Bearer TOKEN" \
  "https://api.github.com/notifications"
```

---

## Phase 3: 假设

1. **假设 A**：用户没有 `author:@me` 的开放 PR → 需要添加 `review-requested:@me`
2. **假设 B**：Token 没有 `repo` 权限 → 只能访问公开数据
3. **假设 C**：用户没有配置仓库，且没有启用 `all_repos` → 搜索范围为空

---

## Phase 4: 验证

### 修复方案

#### 修复 1: 扩展 PR 搜索条件

```rust
// 添加 review-requested 搜索
let review_url = "https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=50";
```

#### 修复 2: 添加 "我的待办" 聚合查询

新建 `fetch_user_todos` 函数，聚合：
- 需要审查的 PR
- 分配给我的 Issue
- 未读通知

#### 修复 3: 改进错误提示

当返回 0 条数据时，提示用户：
- "没有找到分配给你的 PR，尝试启用 '所有仓库' 选项"
- "你的 Token 可能没有足够权限"

---

## Phase 5: 修复

### 代码修改

#### github.rs

1. 修改 `fetch_gh_prs`，添加 `review-requested:@me` 查询
2. 新增 `fetch_review_requested_prs` 函数
3. 改进日志，显示具体搜索 URL 和返回数量

#### 前端

1. Widget 显示更友好的空状态提示
2. 添加 "如何获取数据" 帮助链接

---

## Phase 6: 回归测试

1. 配置测试 GitHub 账号
2. 验证不同搜索条件返回的数据
3. 确保数据正确显示在 Widget 中
