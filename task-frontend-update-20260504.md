# 前端 Widget 更新任务完成

## 目标
验证并优化前端代码，消除构建警告，确保与后端新模块兼容。

## 完成工作

### 1. 构建警告修复
**问题**: Vite 动态导入警告
- `api.ts` 被动态导入（dashboardStore.ts）又静态导入（多个组件）
- `dashboardStore.ts` 被动态导入（settingsStore.ts）又静态导入（App.tsx 等）

**修复**:
- `dashboardStore.ts`: 将 `apiGetDataItems` 和 `apiListSources` 改为静态导入
- `settingsStore.ts`: 将 `apiPollSources` 改为静态导入，移除动态导入 `dashboardStore`

### 2. 编译验证
- ✅ TypeScript: `tsc && vite build` 通过，无错误
- ✅ Rust: `cargo check` 通过，0 errors, 0 warnings
- 构建产物: 459.76 kB JS (gzip: 138.34 kB), 56.40 kB CSS

### 3. 前端组件状态
所有 Widget 组件已完整且功能正常：

| 组件 | 文件 | 状态 |
|------|------|------|
| PR List | `PlaceholderWidgets.tsx` | ✅ 含 PRActionsMenu |
| CI Status | `PlaceholderWidgets.tsx` | ✅ |
| AI Summary | `PlaceholderWidgets.tsx` | ✅ |
| Issue List | `PlaceholderWidgets.tsx` | ✅ |
| Activity Calendar | `ActivityCalendarWidget.tsx` | ✅ |
| Notification Feed | `NotificationFeedWidget.tsx` | ✅ |
| Sprint Board | `SprintBoardWidget.tsx` | ✅ |
| Command Palette | `CommandPalette.tsx` | ✅ Ctrl+K |
| Morning Triage | `MorningTriageModal.tsx` | ✅ Ctrl+T |

### 4. 与后端模块兼容性
- `api.ts` 已包含所有新 API（PR 操作、贡献、Jira/Linear）
- `types/index.ts` 类型定义完整
- `DashboardView.tsx` WidgetRenderer 已注册所有 widget 类型

## 文件修改
- `src/stores/dashboardStore.ts` - 静态导入 api 函数
- `src/stores/settingsStore.ts` - 静态导入 api 和 dashboardStore

## 状态
- 构建: ✅ 成功
- 编译: ✅ TypeScript + Rust 双零错误
- 时间: 2026-05-04 21:15
