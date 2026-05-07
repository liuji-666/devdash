# DevDash 领域上下文

## 核心概念

### Dashboard（仪表盘）
开发者的工作台，包含多个 Widget 的集合。每个 Dashboard 是一个独立的工作空间。

### Widget（组件）
仪表盘上的信息展示单元。每个 Widget 展示特定类型的数据：
- **PR List**: 拉取请求列表
- **Issue List**: 问题列表
- **CI Status**: 持续集成状态
- **Notification Feed**: 通知流
- **Activity Calendar**: 贡献热力图
- **Sprint Board**: 迭代看板
- **AI Summary**: AI 生成的摘要

### Source（数据源）
数据的来源配置。包括：
- **GitHub**: GitHub 仓库、PR、Issue、通知
- **GitLab**: GitLab 项目、MR
- **Jira**: 任务追踪
- **Linear**: 现代 Issue 追踪

### Data Item（数据项）
从数据源拉取的具体数据单元。存储在 SQLite 中，有过期时间（TTL）。

### Triage（晨间处理）
开发者每天早上快速浏览和处理待办事项的工作流。

## 共享语言

| 术语 | 定义 |
|------|------|
| 待办 (Todo) | 需要用户处理的事项（审查请求、分配的 Issue） |
| 队列 (Queue) | 按优先级排序的待办列表 |
| 快捷操作 (Quick Action) | 不离开 Dashboard 就能完成的操作（批准、合并、关闭） |
| 聚合 (Aggregate) | 跨多个数据源合并数据 |
| 刷新 (Refresh) | 从所有数据源重新拉取数据 |
| 轮询 (Poll) | 定时自动刷新 |

## 架构决策

### ADR-001: 本地优先
所有数据存储在本地 SQLite，确保隐私和离线访问。

### ADR-002: 跨平台加密
Token 使用 OS 级加密（Windows Credential Manager / macOS Keychain / Linux Secret Service）。

### ADR-003: 数据源插件化
通过 Source 配置支持多种后端，Widget 不直接依赖具体数据源。

### ADR-004: 数据 TTL
data_items 默认 7 天过期，自动清理旧数据。
