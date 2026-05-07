# DevDash 仪表盘无数据显示 — 诊断记录
**时间**: 2026-05-03 19:44 GMT+8
**项目**: C:\Users\刘吉\.qclaw\workspace\devdash

## 编译状态
- ✅ TypeScript: 零错误 (npx tsc --noEmit 通过)
- ✅ Rust: 零错误零警告 (cargo check 通过)

## 诊断命令已添加
- `debug_db_state` — Rust 命令，输出数据库完整状态（sources / widgets / data_items）
- `apiDebugDbState()` — 前端 API 封装
- 使用方式：在浏览器 DevTools Console 执行：
  ```js
  const { apiDebugDbState } = await import('./lib/api');
  const state = await apiDebugDbState();
  console.log(state);
  ```

## 数据流分析结论

### 正常数据流（确认代码正确）
1. Bootstrap → `apiPollSources()` → Rust `poll_sources` → 写入 `data_items`
2. Bootstrap → `refreshDataItems()` → 从所有 source 读取 `data_items`
3. DashboardView → `dataItems[widget.sourceId]` → 渲染数据

### "暂无数据" 出现的三种情况
1. **没有配置任何数据源** → `sources` 表为空 → `load_github_sources()` 等返回空 → `fetch_github_data` 直接返回 `FetchResult { prs: 0, ... }` → `poll_sources` 返回 "暂无数据"
2. **Token 无效/过期** → GitHub API 返回 401 → `fetch_github_data` 返回错误 → `poll_sources` 返回 "GitHub error: ..."
3. **Widget 没有绑定 sourceId** → Widget 创建时 `sourceId` 为 null → `dataItems[null ?? ""] = dataItems[""] = []` → Widget 渲染空状态

## 调试建议
1. 打开应用 → 观察 StatusBar 显示的文字
   - "暂无数据" = 无源或全部失败
   - "GitHub error: ..." = Token 问题
   - "GitHub: X PRs..." = 正常工作
2. 在 DevTools Console 运行 `apiDebugDbState()` 查看数据库真实状态
3. 检查是否需要重新配置 Token（Onboarding 或 Settings）

## 修复项
- ✅ Rust `debug_db_state` 命令已注册 (lib.rs)
- ✅ 前端 `apiDebugDbState()` 已添加 (api.ts)
- ✅ `apiDebugDbState` 已在 App.tsx 导入（未使用，仅暴露可用）