# Contributing to DevDash

感谢你对 DevDash 的关注！欢迎贡献代码、报告 Bug、建议功能。

## 🛠️ 开发环境

### 前置条件

- **Rust** 1.95+ — [rustup.rs](https://rustup.rs/)
- **Node.js** 22+ — [nodejs.org](https://nodejs.org/)
- **Git** — [git-scm.com](https://git-scm.com/)

### 快速开始

```bash
git clone https://github.com/user/devdash.git
cd devdash
npm install
npm run tauri dev
```

首次启动会打开引导向导，配置 GitHub Token 即可使用。

### 开发命令

| 命令 | 用途 |
|------|------|
| `npm run tauri dev` | 开发模式 (热重载) |
| `npm run tauri build` | 生产构建 |
| `npx tsc --noEmit` | TypeScript 类型检查 |
| `cd src-tauri && cargo check` | Rust 编译检查 |
| `cd src-tauri && cargo test` | Rust 单元测试 |

## 📐 项目架构

```
前端 (React/TypeScript) ← Tauri invoke → 后端 (Rust)
     ↓                                         ↓
  Zustand Store                           SQLite (WAL)
  Tailwind CSS                            keyring (OS凭据)
  dnd-kit                                 reqwest (HTTP)
```

### 代码结构

- **`src/components/`** — React 组件
  - `dashboard/` — Widget 组件 (PR/CI/Issue/通知/热力图)
  - `settings/` — 设置页
  - `onboarding/` — 首次引导
  - `layout/` — 布局 (TitleBar/Sidebar/StatusBar)
- **`src/stores/`** — Zustand 状态管理
- **`src/lib/`** — API 封装 + 工具函数 + i18n
- **`src-tauri/src/`** — Rust 后端
  - `commands.rs` — Tauri 命令 (CRUD + AI)
  - `github.rs` — GitHub/GitLab API 拉取
  - `crypto.rs` — 跨平台 Token 加密
  - `models.rs` — 数据模型 + SQLite schema

## 🎯 如何贡献

### 报告 Bug

1. 搜索 [现有 Issues](../../issues) 避免重复
2. 创建新 Issue，包含：
   - 复现步骤
   - 期望行为 vs 实际行为
   - 系统信息 (OS / Rust 版本 / Node 版本)
   - 错误日志 (如有)

### 提交 PR

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/my-feature`
3. 编写代码 + 测试
4. 确保通过检查：
   - `npx tsc --noEmit` → 零错误
   - `cd src-tauri && cargo check` → 零错误
5. 提交 PR，描述改动内容

### 代码风格

- **TypeScript**: 2 空格缩进，单引号
- **Rust**: `cargo fmt` 标准格式
- **组件**: 一个文件一个组件，文件名 PascalCase
- **注释**: 关键决策必须注释，解释"为什么"而非"做什么"

## 🧪 测试

### Rust 测试

```bash
cd src-tauri
cargo test
```

### 前端测试

```bash
npm run test  # 待完善
```

## 📋 优先级标签

| 标签 | 含义 |
|------|------|
| `P0` | 阻塞性问题，必须修复 |
| `P1` | 重要功能，尽快实现 |
| `P2` | 增强功能，排入计划 |
| `P3` | 锦上添花，有空再做 |
| `good first issue` | 适合新贡献者 |
| `help wanted` | 需要社区帮助 |

## 📜 行为准则

- 尊重每一位贡献者
- 建设性讨论，不人身攻击
- 关注问题本身，而非提出问题的人

---

感谢你让 DevDash 变得更好！ 🚀
