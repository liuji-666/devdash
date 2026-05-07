# DevDash 架构审查报告

## 当前架构概览

```
src-tauri/src/
├── lib.rs           # Tauri 入口 + 托盘
├── commands.rs      # CRUD + AI 摘要 + 数据清理
├── models.rs        # AppState + SQLite Schema
├── github.rs        # GitHub/GitLab API + 贡献热力图
├── crypto.rs        # 跨平台加密
└── issue_trackers.rs # Jira/Linear 集成

src/
├── App.tsx          # 主应用 + bootstrap
├── types/index.ts   # 类型定义
├── lib/api.ts       # Tauri invoke 封装
├── stores/
│   ├── dashboardStore.ts
│   └── settingsStore.ts
└── components/
    ├── dashboard/    # Widget 组件
    ├── layout/       # 布局组件
    ├── settings/     # 设置页面
    └── onboarding/   # 引导流程
```

## 发现的架构问题

### 问题 1: github.rs 过于庞大 (~1100 行)

**症状**：
- 包含 GitHub API、GitLab API、贡献热力图、PR 快捷操作
- 单一文件职责过多

**影响**：
- 难以导航
- 编译时间长
- 测试困难

**建议**：
```
src-tauri/src/
├── github/
│   ├── mod.rs          # 公共类型和入口
│   ├── prs.rs          # PR 相关 API
│   ├── issues.rs       # Issue 相关 API
│   ├── ci.rs           # CI 相关 API
│   ├── notifications.rs # 通知 API
│   ├── contributions.rs # 贡献热力图
│   └── actions.rs      # PR 快捷操作
├── gitlab/
│   └── mod.rs          # GitLab API
```

### 问题 2: 数据流耦合

**症状**：
- `get_data_items` 需要 `source_id` 参数
- Widget 通过 `widget.sourceId` 查找数据
- 如果 `sourceId` 为空，数据不显示

**影响**：
- Widget 和数据源强耦合
- 跨数据源聚合困难

**建议**：
- 新增 `get_priority_items()` 接口
- 支持按 `kind` 和 `status` 查询
- Widget 通过过滤器获取数据，而不是直接绑定 source

### 问题 3: 前端状态管理分散

**症状**：
- `dashboardStore` 管理 widgets 和 dataItems
- `settingsStore` 管理 sources 和 settings
- 两个 store 之间没有明确的分界

**影响**：
- 数据一致性难以保证
- 刷新逻辑分散

**建议**：
```
stores/
├── appStore.ts        # 全局状态（主题、加载状态）
├── dataStore.ts       # 数据层（dataItems、刷新）
├── widgetStore.ts     # Widget 层（布局、配置）
└── sourceStore.ts     # 数据源层（sources、连接测试）
```

### 问题 4: 错误处理不一致

**症状**：
- 有些函数返回 `Result<T, String>`
- 有些函数返回 `Result<T, CustomError>`
- 前端有些错误被静默忽略

**建议**：
- 统一错误类型
- 前端统一错误提示

### 问题 5: 缺少测试

**症状**：
- 没有单元测试
- 没有集成测试
- 手动测试成本高

**建议**：
- 为 TriageEngine 添加单元测试
- 为 API 调用添加 mock 测试
- 添加 E2E 测试（使用 Playwright）

## 优先级排序

### P0: 立即修复
1. **拆分 github.rs** — 提高可维护性
2. **修复数据流** — 解决数据不显示问题

### P1: 本周完成
3. **统一错误处理** — 提高稳定性
4. **添加核心测试** — TriageEngine、数据流

### P2: 本月完成
5. **重构状态管理** — 提高可扩展性
6. **添加 E2E 测试** — 防止回归

## 具体重构步骤

### 步骤 1: 拆分 github.rs

```rust
// github/mod.rs
pub mod prs;
pub mod issues;
pub mod ci;
pub mod notifications;
pub mod contributions;
pub mod actions;

pub use prs::*;
pub use issues::*;
// ...
```

### 步骤 2: 新增数据查询接口

```rust
// commands.rs
#[tauri::command]
pub async fn get_priority_items(
    state: State<'_, AppState>,
    kinds: Vec<String>,
    statuses: Vec<String>,
) -> Result<Vec<DataItem>, String> {
    // 按 kinds 和 statuses 查询，不依赖 source_id
}
```

### 步骤 3: 统一错误类型

```rust
// models.rs
#[derive(Debug, Serialize)]
pub enum DevDashError {
    Network(String),
    Auth(String),
    NotFound(String),
    Config(String),
}
```
