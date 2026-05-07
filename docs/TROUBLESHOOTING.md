# DevDash 故障排除指南

## 症状：所有 Widget 显示"暂无数据"

### 快速诊断步骤

#### 1. 检查数据源配置

打开 DevDash，进入**设置 → 数据源**，确认：

- [ ] 已添加 GitHub 数据源
- [ ] 数据源状态为"已启用"
- [ ] Token 已正确填写（至少 40 个字符的 Personal Access Token）

#### 2. 验证 GitHub Token

在设置页面点击"验证 Token"按钮，确认：

- 显示"Token 有效 — 用户: @yourusername"
- 如果失败，请重新生成 Token：
  1. 访问 https://github.com/settings/tokens
  2. 点击 "Generate new token (classic)"
  3. 勾选 `repo` 和 `read:user` 权限
  4. 复制 Token 到 DevDash

#### 3. 检查 Widget 关联

打开浏览器控制台（F12），运行：

```javascript
// 查看所有数据源
await __TAURI__.core.invoke("list_sources")

// 查看数据库状态
await __TAURI__.core.invoke("debug_db_state")
```

确认：
- Widget 的 `sourceId` 与某个数据源的 `id` 匹配
- 如果不匹配，删除 widget 重新添加

#### 4. 手动触发数据拉取

在控制台运行：

```javascript
// 手动拉取数据
const result = await __TAURI__.core.invoke("fetch_github_data");
console.log(result);
```

检查返回结果：
- `prs` 应该 > 0（如果有 PR）
- `errors` 数组应该为空

#### 5. 检查搜索条件

如果你的 GitHub 账号没有：
- 别人请求你审查的 PR (`review-requested:@me`)
- 你自己创建的开放 PR (`author:@me`)
- 分配给你的 PR (`assignee:@me`)
- 你参与的 PR (`involves:@me`)

那么 PR 列表会显示为空。这是正常的。

**解决方案**：在 GitHub 上创建或参与一些 PR，或者使用 `all_repos` 模式查看所有仓库的 PR。

#### 6. 检查 CI 数据

CI 数据来自 GitHub Actions。如果你的仓库没有配置 workflow，会显示"暂无构建记录"。

**解决方案**：在仓库中添加 `.github/workflows/*.yml` 文件。

### 常见问题

#### Q: 为什么贡献热力图有数据但其他 widget 没有？
A: 贡献热力图使用独立的 API 端点，不依赖 PR/Issue 搜索条件。它显示的是你的 Git 提交活动。

#### Q: 为什么通知显示为空？
A: GitHub 通知需要你在 GitHub 网站上有未读通知。访问 https://github.com/notifications 查看。

#### Q: 如何启用 `all_repos` 模式？
A: 在设置 → 数据源 → GitHub 配置中，勾选"获取所有仓库"选项。这会拉取你所有可访问仓库的数据。

### 仍然有问题？

1. 打开浏览器控制台（F12）
2. 复制所有 `[DevDash]` 开头的日志
3. 运行 `await __TAURI__.core.invoke("debug_db_state")` 并复制输出
4. 提交 Issue 时附上这些信息
