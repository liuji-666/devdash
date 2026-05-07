# DevDash 功能分析与实用功能设计

## 一、现状诊断

### 1.1 已实现功能（但实用性低）

| 功能 | 状态 | 问题 |
|------|------|------|
| PR 列表展示 | ✅ | 只是展示，没有 actionable 功能 |
| Issue 列表 | ✅ | 同上，纯展示 |
| CI 状态 | ✅ | 展示构建状态，无快速操作 |
| 通知 Feed | ✅ | 展示通知，无法一键处理 |
| AI 摘要 | ✅ | 需要 Ollama，实用性有限 |
| 贡献热力图 | ✅ | 纯展示，无实际用途 |
| Sprint Board | ✅ | 需要 Jira/Linear，未验证 |
| PR 快捷操作 | ✅ | Approve/Merge/Comment，但入口隐藏 |
| 命令面板 | ✅ | 只有基础导航命令 |
| 桌面通知 | ✅ | 仅 CI 失败通知 |

### 1.2 核心问题

1. **数据拉取为 0**：GitHub Search API 需要特定条件才能返回数据
2. **功能碎片化**：每个 widget 独立，没有联动
3. **操作路径长**：PR 操作需要 hover → 点击菜单 → 选择操作
4. **缺乏工作流**：没有"早晨一键处理"的场景
5. **配置复杂**：需要手动配置多个数据源

### 1.3 用户真实需求（推测）

作为开发者，每天需要：
1. **快速知道**：今天需要我处理什么？
2. **快速处理**：一键审批/合并/评论
3. **快速创建**：从桌面直接创建 Issue/PR
4. **快速查看**：代码审查、构建状态
5. **减少干扰**：只关注重要事项

---

## 二、实用功能设计

### 功能 1: 🔥 晨间处理流 (Morning Triage)

**痛点**：开发者每天早上需要打开 GitHub/GitLab，逐个检查 PR、Issue、通知

**解决方案**：
- 一键"开始晨间处理"，按优先级展示所有待办：
  1. 需要你审查的 PR（按紧急程度排序）
  2. 分配给你的 Issue（按截止日期排序）
  3. 未读通知（按重要性排序）
- 每个项目支持快捷操作：
  - PR: 批准 / 请求修改 / 合并 / 跳过
  - Issue: 关闭 / 评论 / 转给别人
  - 通知: 标记已读 / 跳转到详情

**技术实现**：
- 新增 `MorningTriageWidget`（全屏覆盖式）
- 后端新增 `fetch_review_requested_prs` API
- 支持键盘快捷键（J/K 导航，Enter 操作）

### 功能 2: ⚡ 快捷创建 (Quick Create)

**痛点**：想快速记录一个 bug 或想法，需要打开浏览器 → 找到仓库 → 创建 Issue

**解决方案**：
- 全局快捷键（Ctrl+Shift+N）打开快速创建面板
- 支持创建：
  - GitHub Issue（选择仓库、标题、描述、标签）
  - 备忘录（本地存储，不依赖网络）
  - 待办事项（集成到 Sprint Board）
- 智能识别：粘贴代码错误自动提取堆栈信息

**技术实现**：
- 新增 `QuickCreateModal` 组件
- 后端新增 `github_create_issue` command
- 支持模板（Bug 报告、功能请求、文档改进）

### 功能 3: 🎯 智能过滤与优先级

**痛点**：信息太多，不知道哪个重要

**解决方案**：
- 自动优先级排序：
  - 🔴 紧急：CI 失败 + 需要你审查 + 今天截止
  - 🟠 重要：分配给你 + 超过 3 天未处理
  - 🟡 普通：其他未读
  - 🟢 低优先级：已读或已处理
- 支持自定义规则：
  - "包含 'urgent' 标签的 Issue 标记为紧急"
  - "来自特定仓库的 PR 优先显示"

**技术实现**：
- 新增 `PriorityEngine`（Rust 端）
- 支持规则配置存储在 SQLite
- 前端新增过滤栏

### 功能 4: 📊 代码审查助手 (Code Review Assistant)

**痛点**：审查 PR 时需要频繁切换浏览器标签

**解决方案**：
- 在桌面直接查看 PR 差异（Diff）
- 支持：
  - 查看文件变更列表
  - 查看具体 diff（语法高亮）
  - 添加评论（行级）
  - 批准 / 请求修改
- 集成 AI：自动总结变更内容

**技术实现**：
- 新增 `PRReviewWidget`
- 后端新增 `github_fetch_pr_diff` command
- 使用 diff parser 渲染

### 功能 5: 🔔 智能通知中心

**痛点**：GitHub 通知太多，很多是无关的

**解决方案**：
- 通知分类：
  - 需要你行动的（审查请求、分配）
  - 你订阅的（评论回复、状态变更）
  - 系统通知（CI 失败、安全警报）
- 批量操作：
  - 一键标记所有某类通知为已读
  - 自动归档旧通知（7天+）
- 桌面推送：只推送重要通知

**技术实现**：
- 扩展现有 `NotificationFeedWidget`
- 后端新增 `github_mark_notification_read` command

### 功能 6: 🚀 一键发布流 (Release Flow)

**痛点**：发布版本需要多个步骤（打标签、写 release notes、上传构建产物）

**解决方案**：
- 检测可发布的变更（合并到 main 但未打标签的 PR）
- 自动生成 Release Notes（基于 PR 标题）
- 一键：
  - 打版本标签
  - 创建 GitHub Release
  - 上传构建产物（如果配置了 CI）

**技术实现**：
- 新增 `ReleaseWidget`
- 后端新增 `github_create_release` command

### 功能 7: 📈 团队活跃度仪表板

**痛点**：作为 Tech Lead，需要了解团队进展

**解决方案**：
- 展示团队成员的：
  - 本周合并的 PR 数
  - 待审查的 PR（按等待时间排序）
  - Issue 解决速度
  - 代码审查响应时间
- 识别瓶颈：
  - 哪个 PR 审查等待最久？
  - 哪个 Issue 被阻塞？

**技术实现**：
- 新增 `TeamDashboardWidget`
- 后端聚合多个用户数据

### 功能 8: 🔗 深度集成 IDE

**痛点**：在 IDE 和 Dashboard 之间切换

**解决方案**：
- VS Code 插件：
  - 在状态栏显示待审查 PR 数
  - 一键打开 Dashboard
  - 从代码跳转到相关 PR
- JetBrains 插件（未来）

**技术实现**：
- 提供本地 HTTP API（Dashboard 作为服务端）
- VS Code 扩展调用 API

---

## 三、实施优先级

### Phase 1: 核心实用功能（1-2 周）
1. **晨间处理流** - 解决每天早上的核心痛点
2. **快捷创建** - 降低记录成本
3. **智能过滤** - 解决信息过载

### Phase 2: 效率提升（2-3 周）
4. **代码审查助手** - 减少浏览器切换
5. **智能通知中心** - 减少干扰

### Phase 3: 团队功能（3-4 周）
6. **一键发布流** - 简化发布
7. **团队仪表板** - Tech Lead 场景

### Phase 4: 生态集成（未来）
8. **IDE 插件** - 深度工作流集成

---

## 四、技术架构调整

### 4.1 新增模块

```
src-tauri/src/
  triage.rs      # 晨间处理流逻辑
  quick_create.rs # 快捷创建
  priority.rs    # 优先级引擎
  review.rs      # 代码审查助手
  release.rs     # 发布流
  
src/components/
  triage/
    MorningTriageModal.tsx
    TriageItem.tsx
  quick-create/
    QuickCreateModal.tsx
  review/
    PRReviewWidget.tsx
    DiffViewer.tsx
```

### 4.2 数据流优化

当前问题：`get_data_items` 需要 `source_id`，导致 widget 和数据源强耦合

优化方案：
- 新增 `get_priority_items()` - 返回按优先级排序的所有待办
- 新增 `get_triage_queue()` - 返回晨间处理队列
- 支持跨数据源聚合（GitHub + GitLab + Jira）

---

## 五、立即可以做的改进

### 5.1 修复数据拉取（今天）
- 修改 GitHub API 调用，支持多种搜索模式
- 添加更详细的错误日志

### 5.2 添加"今日待办"Widget（明天）
- 聚合所有数据源的需要你行动的项目
- 按优先级排序

### 5.3 优化 PR 操作体验（本周）
- 把 PR 操作按钮从隐藏菜单移到直接展示
- 添加键盘快捷键
