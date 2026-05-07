# 数据流诊断修复 — 2026-05-01 23:17

## 问题
用户添加 GitHub 数据源后，Widget 显示"暂无 PR 数据"，看不到任何实际数据。

## 根因
1. **错误被静默吞掉** — poll_sources 失败时仅 console.error，用户无感知
2. **添加数据源后不自动拉取** — addSource 只写 DB，不触发 poll + refresh
3. **Ollama 测试仍是假的** — setTimeout(1500) 假成功
4. **Issue Widget 不在添加组件对话框中** — DashboardView 有 issue_list case 但 AddWidgetDialog 没列出来
5. **空状态提示误导** — "在设置中添加 GitHub 数据源" 但用户已经添加了

## 修复内容

### 1. App.tsx — 添加 statusMessage 状态
- poll_sources 结果现在显示在 StatusBar
- 错误信息用户可见（如 "401 Unauthorized — 检查你的 Token"）
- 成功时显示 "GitHub: X PRs, Y CI runs, Z Issues" 4秒后消失

### 2. StatusBar.tsx — 接收 statusMessage
- 新增 statusMessage prop
- 在状态栏显示 poll 结果或错误

### 3. settingsStore.ts — 添加数据源后自动拉取
- addSource 完成后自动调用 apiPollSources + refreshDataItems
- 用户添加完数据源切回 Dashboard 即可看到数据

### 4. SettingsView.tsx — Ollama 测试改为真实调用
- 调用 apiTestOllama(baseUrl) 检查 /api/tags 端点
- 真实反馈连接成功/失败

### 5. AddWidgetDialog.tsx — 加入 Issue List Widget
- 新增 issue_list 选项（Bug 图标，橙色背景）
- 4种 Widget 类型全部可选

### 6. PlaceholderWidgets.tsx — 改善空状态提示
- PR/Issue 空状态改为"点击右上角刷新按钮拉取最新数据"
- 不再误导"在设置中添加数据源"（用户可能已添加）

### 7. dashboardStore.ts — 添加诊断日志
- refreshDataItems 中加 console.log，开发时可在 devtools 看到数据流

## 编译验证
- `tsc --noEmit` ✅ 零错误
- `cargo check` ✅ 零错误

## 下一步
- 重启 `npm run tauri dev`
- 看 StatusBar 是否显示 poll 结果
- 如果显示 "401 Unauthorized" → 检查 Token
- 如果显示 "0 PRs" → 检查 owner/repo 配置
- 打开 DevTools (F12) 查看 [DevDash] 日志
