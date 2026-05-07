# DevDash Onboarding 实现 — 2026-05-02

## 目标
实现首次启动引导流程，帮助新用户配置数据源和 AI。

## 实现内容

### OnboardingWizard 组件
- 4 步引导向导：欢迎 → 数据源 → AI 配置 → 完成
- 支持中文/英文双语界面
- GitHub/GitLab 数据源选择
- Token 输入与仓库配置（可选）
- AI 提供商选择：Ollama / OpenAI / 跳过
- 连接测试功能

### App.tsx 集成
- 启动时检测是否存在数据源
- 无数据源时显示 Onboarding
- 完成后自动刷新数据

## 技术细节
- 使用 lucide-react 图标（GitBranch/GitMerge 替代无导出的 Github/Gitlab）
- 调用 `apiTestAiConnection` 测试 AI 连接
- 通过 `useSettingsStore` 管理状态

## 验证结果
- TypeScript: `tsc --noEmit` → 0 errors ✅
- Rust: `cargo check` → 0 errors (3 warnings) ✅

## 下一步
- P1: 加载骨架屏（Loading Skeleton）
- P2: 贡献热力图 Widget

## 文件
- `src/components/onboarding/OnboardingWizard.tsx` — 15KB 新建
- `src/App.tsx` — 添加 onboarding 状态和逻辑
