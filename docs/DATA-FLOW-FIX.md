# DevDash 数据流问题修复记录

## 问题描述

用户反馈：所有 Widget 显示"暂无数据"，即使已经配置了 GitHub Token。

## 根因分析

### 1. Widget SourceId 关联问题

**问题**: 添加 Widget 时，`sourceId` 可能为空或与数据源不匹配。

**代码位置**: `src/App.tsx` 中的 `handleAddWidget`

**修复前**:
```typescript
sourceId: sourceId ?? settingsSources?.[0]?.id ?? null
```

**问题**:
- 如果 `settingsSources` 未加载完成，使用第一个源可能不正确
- 没有根据 Widget 类型选择合适的数据源
- `sprint_board` 被错误地标记为不需要 source

**修复后**:
```typescript
// 根据 Widget 类型智能选择数据源
switch (widgetType) {
  case 'pr_list':
  case 'ci_status':
  case 'issue_list':
  case 'activity_calendar':
  case 'notification_feed':
    resolvedSourceId = githubSources[0]?.id ?? gitlabSources[0]?.id ?? settingsSources[0]?.id;
    break;
  case 'sprint_board':
    resolvedSourceId = jiraSources[0]?.id ?? linearSources[0]?.id ?? settingsSources[0]?.id;
    break;
  case 'today_overview':
  case 'ai_summary':
    resolvedSourceId = null; // 不需要特定数据源
    break;
}
```

### 2. AddWidgetDialog 的 needsSource 逻辑

**问题**: `sprint_board` 被错误地标记为不需要 source，而 `today_overview` 被错误地标记为需要 source。

**修复**:
```typescript
// 修复前
const needsSource = selected && selected !== "ai_summary" && selected !== "activity_calendar" && selected !== "sprint_board";

// 修复后  
const needsSource = selected && selected !== "ai_summary" && selected !== "activity_calendar" && selected !== "today_overview";
```

### 3. 新增诊断工具

**新增命令**: `diagnose_github_data`

**用途**: 帮助用户诊断 GitHub API 连接问题

**返回信息**:
- Token 是否有效
- 各种搜索条件的返回结果数
- 配置的仓库列表
- 错误信息

**前端 API**: `apiDiagnoseGithub()`

## 用户使用指南

### 如果 Widget 仍然显示"暂无数据"

1. **检查数据源配置**
   - 打开设置 → 数据源
   - 确认 GitHub 数据源已启用
   - 确认 Token 有效（点击"验证 Token"按钮）

2. **运行诊断命令**
   打开浏览器控制台（F12），运行：
   ```javascript
   await __TAURI__.core.invoke("diagnose_github_data")
   ```
   
   或在前端代码中调用：
   ```typescript
   import { apiDiagnoseGithub } from './lib/api';
   const result = await apiDiagnoseGithub();
   console.log(result);
   ```

3. **检查返回结果**
   - `token_valid`: 确认 Token 有效
   - `pr_queries`: 查看各种搜索条件的返回数量
   - `repos`: 查看配置的仓库

4. **常见问题**
   
   **Token 无效**: 
   - 重新生成 GitHub Personal Access Token
   - 确保勾选 `repo` 和 `read:user` 权限
   
   **搜索返回空**:
   - 检查是否有 PR 请求你审查 (`review-requested:@me`)
   - 检查是否有你创建的开放 PR (`author:@me`)
   - 检查是否有分配给你的 PR (`assignee:@me`)
   - 如果没有，这是正常的，需要参与更多项目
   
   **仓库配置错误**:
   - 使用 `all_repos` 模式自动发现所有仓库
   - 或手动配置正确的 `owner/repo`

## 编译状态

- TypeScript: ✅ 零错误
- Rust: ✅ 零错误零警告

## 修改的文件

1. `src/App.tsx` - 修复 Widget 添加时的 sourceId 解析
2. `src/components/dashboard/AddWidgetDialog.tsx` - 修复 needsSource 逻辑
3. `src-tauri/src/github/mod.rs` - 添加诊断命令
4. `src-tauri/src/lib.rs` - 注册诊断命令
5. `src/lib/api.ts` - 添加前端 API 封装
6. `docs/TROUBLESHOOTING.md` - 新增故障排除指南
