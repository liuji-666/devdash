# 修复数据流断裂 — 2026-05-01

## 问题描述
用户添加数据源后，界面没有任何数据显示。

## 根因分析
三个数据流断裂点：

1. **无默认 Dashboard** — `init()` 调用 `apiListDashboards()`，数据库首次启动无 dashboard，`activeDashboardId` 为 null，界面显示"选择一个工作台开始"。用户从未创建 dashboard，所以无法添加 widget。

2. **refreshDataItems 只看 Widget 的 sourceId** — `refreshDataItems` 只收集已有 widget 关联的 sourceId 去查 data_items。如果没有 dashboard/widget，即使 poll 成功写入了 data_items，前端也不会读出来。

3. **Bootstrap 顺序问题** — `init()` 和 `load()` 是 fire-and-forget，不等待完成就开始 poll。而 `refreshDataItems` 依赖 dashboards 数据已加载。

## 修复内容

### 1. dashboardStore.ts — init 自动创建默认 Dashboard
- `init()` 检测到 `dashboards.length === 0` 时，自动调用 `apiCreateDashboard("我的工作台")` 创建首个 dashboard

### 2. dashboardStore.ts — refreshDataItems 扩展 sourceId 收集
- 不仅从 widgets 收集 sourceId，还调用 `apiListSources()` 收集所有 enabled 的数据源 ID
- 确保即使没添加 widget，也能读取已 poll 的数据

### 3. App.tsx — Bootstrap 等待 init 完成
- `useEffect` 改为 async：先 `await init() + load()`，再 `await apiPollSources() + refreshDataItems()`
- 去掉 auto-poll 的初始 `doPoll()` 调用（bootstrap 已处理）

### 4. commands.rs — 首个 Dashboard 标记为 default
- `create_dashboard` 查询现有 dashboard 数量，第一个创建的 `is_default = true`
- 确保前端 `init()` 中的 `dashboards.find(d => d.isDefault)` 能命中

## 编译验证
- `tsc --noEmit` ✅ 零错误
- `cargo check` ✅ 零错误零警告

## 正确使用流程（修复后）
1. 设置 → 数据源 → 添加 GitHub Token + owner/repo → 保存
2. 回到仪表盘 → 点「添加组件」→ 选择 Widget → 选数据源 → 添加
3. 数据自动拉取并显示（5 分钟刷新，或手动点刷新）

## 文件变更
- `src/stores/dashboardStore.ts` — init 自动创建 dashboard + refreshDataItems 扩展
- `src/App.tsx` — bootstrap 串行等待
- `src-tauri/src/commands.rs` — create_dashboard 首条标记 is_default
