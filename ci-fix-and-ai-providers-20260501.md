# CI 修复 + AI 多提供商 — 2026-05-01 23:37

## Bug 1: CI/CD Widget 空数据 ✅ 已修复
**根因**: `gh_get()` 函数只处理了 `body.as_array()` 和 `body["items"].as_array()`，但 GitHub Actions API 返回的是 `body["workflow_runs"]` 数组。
**修复**: github.rs 的 `gh_get` 添加 `body["workflow_runs"].as_array()` 分支。

## Feature: AI 多提供商支持 ✅ 已实现
**新增 5 个 AI 提供商**（后端 + 前端完整实现）：

| 提供商 | 后端函数 | 默认模型 | 特点 |
|--------|---------|---------|------|
| Ollama | `generate_ollama_summary` (已有) | qwen2.5 | 本地、隐私优先 |
| OpenAI | `generate_openai_summary` (新) | gpt-4o-mini | GPT-4o 系列 |
| Claude | `generate_claude_summary` (新) | claude-sonnet-4 | Anthropic 系列 |
| Gemini | `generate_gemini_summary` (新) | gemini-2.0-flash | Google 免费额度大 |
| OpenAI 兼容 | `generate_openai_summary` (复用) | 用户自定义 | DeepSeek/通义千问/vLLM 等 |

### 后端改动 (commands.rs)
- `generate_ai_summary`: 路由分发到 5 个 provider
- 新增 `generate_openai_summary`: POST /chat/completions
- 新增 `generate_claude_summary`: POST /v1/messages (Anthropic 格式)
- 新增 `generate_gemini_summary`: POST generateContent (Google 格式)
- 提取 `build_ai_prompt()`: 共享 prompt 构建逻辑
- `test_ollama` → `test_ai_connection`: 统一测试入口，支持所有 provider

### 前端改动 (SettingsView.tsx)
- AI Tab 完全重写：5 个提供商选项卡 + 各自配置表单
- 每个提供商有：API Key 输入、模型选择、测试连接按钮
- OpenAI 兼容模式额外提供 Base URL 字段

### 其他文件
- lib.rs: `test_ollama` → `test_ai_connection`
- api.ts: `apiTestOllama` → `apiTestAiConnection`
- github.rs: gh_get 添加 workflow_runs 分支

## 编译状态
- TypeScript (`tsc --noEmit`) ✅ 零错误
- Rust (`cargo check`) ✅ 零错误

## 待验证
1. 重启应用后 CI Widget 是否显示 tauri-apps/tauri 的 Actions 数据
2. 切换到不同 AI 提供商后 UI 是否正常渲染
3. 测试连接功能是否工作（需要真实 API Key）
