# DevDash 编译修复 — 2026-05-01

## 修复内容

1. **DashboardView.tsx** — `handleDragEnd` 中加入 `if (!active) return;` 空值守卫
2. **commands.rs** — 删除第 375 行多余的 `}` 闭合括号
3. **github.rs:221** — 移除 `unwrap_or("unknown")?.to_string()` 中无效的 `?` 运算符（`?` 不能用于 `&str`）
4. **lib.rs** — Tauri v2 `TrayIconBuilder::menu()` API 变更：从闭包改为预先构建 `&tray_menu` 引用
5. **lib.rs** — `close_handler` → `_close_handler` 消除未使用变量 warning

## 最终状态

- TypeScript: ✅ 零错误
- Rust: ✅ 零错误零 warning
- 项目可直接 `npm run tauri dev` 启动
