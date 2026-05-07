# DevDash 项目深度审计 2026-05-02

## 审计目标
作为高级开发工程师视角，评估 DevDash 项目当前完成度、缺失功能、以及上 GitHub 成为热门开源项目的路线图。

## 审计范围
- 全量代码审查（前端 + Rust 后端）
- 功能完成度评估
- 安全性、工程化、UI/UX 问题
- 竞品对比与差异化策略

## 关键发现

### 致命问题（4个）
1. Token 明文存 SQLite — 开源项目一票否决
2. data_items 无清理机制 — 数据库会无限膨胀
3. CSP localhost:* 通配 — 生产环境安全隐患
4. 无错误上报/日志系统

### 功能缺失
- Onboarding 引导（P0）
- GitHub OAuth（P0）
- 多仓库支持（P0）
- Notification Widget（P1）
- 桌面通知（P1）
- 贡献热力图 Widget（P1，Wow 效果）
- 自动更新（P1）

### UI/UX 问题
- AI 设置页 5 个 provider 无图标无说明
- Widget 标题/侧边栏硬编码中文未走 i18n
- 添加 Widget 无预览

### 工程化缺失
- 零 CI/CD、零测试、无 CONTRIBUTING.md
- 仅 Windows 构建，缺 macOS/Linux

## 上线路线图
- Phase 1 (2周): Token加密+数据清理+Onboarding+CI/CD → v0.1.0
- Phase 2 (4周): 热力图+桌面通知+快捷键+自动更新
- Phase 3 (8周): 插件系统+AI主动提醒+生态

## 差异化杀手锏
1. 贡献热力图（视觉冲击力）
2. AI 主动提醒（差异化）
3. Tauri 超轻量（硬核开发者最爱）
4. 插件生态（飞轮效应）

## 项目评分
当前: 6/10（功能原型阶段）
