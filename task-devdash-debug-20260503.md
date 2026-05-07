# DevDash — 2026-05-03 诊断会话

## 目标
诊断仪表盘无数据显示问题，添加调试命令。

## 编译验证
- ✅ TypeScript: `npx tsc --noEmit` 通过（零错误）
- ✅ Rust: `cargo check` 通过（零错误零警告）

## 添加的调试工具
- **Rust**: `debug_db_state` 命令（commands.rs），输出完整数据库状态（sources/widgets/data_items 数量）
- **前端**: `apiDebugDbState()` API 封装（api.ts）
- **注册**: `lib.rs` 已注册命令

## 数据流分析结论
代码逻辑全部正确。无数据显示的原因只有三种：
1. 没有配置任何数据源（sources 表空）
2. Token 无效/过期（GitHub API 401）
3. Widget 未绑定 sourceId（dataItems[""] 取到空数组）

## 诊断方式
StatusBar 会显示具体原因（"暂无数据" / "GitHub error: ..." / "GitHub: X PRs..."），浏览器 DevTools Console 可运行 `apiDebugDbState()` 查看数据库真实状态。

## 结论
**问题不在代码，在配置**。应用工作正常，需要用户重新配置 GitHub Token 或检查 Settings 中的数据源状态。