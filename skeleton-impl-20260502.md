# DevDash 骨架屏实现 — 2026-05-02

## 目标
为 DevDash 添加加载骨架屏，提升数据加载时的用户体验。

## 实现内容

### Skeleton 基础组件
- 位置：`src/components/ui/skeleton.tsx`
- 功能：基础骨架元素，支持主题切换
- 使用 `animate-pulse` 实现脉冲动画

### WidgetSkeleton 组件
- 位置：`src/components/dashboard/WidgetSkeleton.tsx`
- 变体：
  - `pr-list` — PR 列表骨架
  - `issue-list` — Issue 列表骨架
  - `ci-status` — CI 状态骨架
  - `notifications` — 通知骨架
  - `ai-summary` — AI 摘要骨架
  - `default` — 默认骨架

### 组合骨架
- `DashboardSkeleton` — 整体仪表盘骨架网格
- `SidebarSkeleton` — 侧边栏骨架（备用）

### 主题支持
在 `index.css` 中添加：
```css
/* Dark theme */
--skeleton-bg: oklch(0.25 0 0);
--widget-surface: oklch(0.16 0 0);

/* Light theme */
--skeleton-bg: oklch(0.9 0 0);
--widget-surface: oklch(0.96 0 0);
```

### App.tsx 集成
- 新增 `bootstrapLoading` 状态
- 启动时显示骨架屏（侧边栏 + 仪表盘）
- 初始化完成后切换到真实内容

## 验证结果
- TypeScript: `tsc --noEmit` → 0 errors ✅
- Rust: `cargo check` → 0 errors (3 warnings) ✅

## 文件清单
- `src/components/ui/skeleton.tsx` — 新建
- `src/components/dashboard/WidgetSkeleton.tsx` — 新建
- `src/index.css` — 添加骨架变量
- `src/App.tsx` — 添加 bootstrapLoading 状态和骨架渲染
- `src/components/dashboard/DashboardView.tsx` — 导入并使用 DashboardSkeleton
