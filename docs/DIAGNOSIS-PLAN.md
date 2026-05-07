# DevDash 数据流诊断计划

## 问题
所有 Widget 显示"暂无数据"，但最初版本有数据。

## 诊断步骤（按顺序执行）

### Step 1: 验证数据库状态
运行以下命令检查数据库内容：

```bash
# 进入数据库目录
cd "C:\Users\刘吉\AppData\Roaming\com.devdash.app"

# 使用 sqlite3 检查
sqlite3 devdash.db "SELECT COUNT(*) FROM sources;"
sqlite3 devdash.db "SELECT COUNT(*) FROM data_items;"
sqlite3 devdash.db "SELECT id, type, enabled FROM sources;"
sqlite3 devdash.db "SELECT id, widget_type, source_id FROM widgets;"
```

**预期结果**:
- sources 表应该有 1+ 条记录
- data_items 表应该有数据
- widgets 表的 source_id 应该与 sources 表的 id 匹配

### Step 2: 验证 Token 解密
问题可能：master key 重新生成导致旧 token 无法解密

检查方式：
1. 打开应用设置
2. 查看 GitHub Token 是否显示为已填充（有值）
3. 如果 Token 字段为空，说明解密失败

**根因**: 
- 如果 master key 被重新生成（DPAPI 失败时），旧的加密 token 将无法解密
- Token 为空字符串时，GitHub API 返回空结果

### Step 3: 检查前端数据流
在浏览器控制台执行：

```javascript
// 1. 检查 sources
await __TAURI__.core.invoke("list_sources")

// 2. 检查 widgets
await __TAURI__.core.invoke("list_dashboards")

// 3. 检查 data_items（需要 source_id）
// 先获取 source_id，然后：
await __TAURI__.core.invoke("get_data_items", { sourceId: "YOUR_SOURCE_ID" })

// 4. 运行诊断
await __TAURI__.core.invoke("diagnose_github_data")
```

### Step 4: 验证 GitHub API 调用
检查日志输出：
1. 打开应用
2. 按 F12 打开控制台
3. 查看是否有 `[DevDash]` 开头的日志
4. 检查 `fetch_github_data` 的返回结果

**关键日志**:
- `fetch_github_data: loaded X sources` - 应该 > 0
- `Processing source XXX: token_len=Y` - Y 应该 > 0
- `fetch_gh_prs (review_requested): got Z items` - Z 可能为 0

### Step 5: 验证搜索条件
如果以上都正常，问题可能是搜索条件太严格：

当前搜索条件：
1. `review-requested:@me` - 请求你审查的 PR
2. `author:@me` - 你创建的 PR
3. `assignee:@me` - 分配给你的 PR
4. `involves:@me` - 你参与的 PR

**验证方法**:
在浏览器控制台执行：
```javascript
await __TAURI__.core.invoke("diagnose_github_data")
```

查看返回的 `pr_queries` 数组，确认每个查询的返回数量。

## 最可能的根因

根据代码分析，最可能的问题是：

### 可能性 1: Token 解密失败（最高优先级）
- 如果 master key 被重新生成，旧 token 无法解密
- 表现为：source 存在，但 token 为空字符串
- **修复**: 重新输入 GitHub Token

### 可能性 2: Widget sourceId 不匹配
- Widget 的 source_id 与 sources 表的 id 不匹配
- **修复**: 删除 widget 重新添加

### 可能性 3: 搜索条件返回空
- 用户的 GitHub 账号没有符合条件的 PR
- **修复**: 放宽搜索条件或使用 `all_repos` 模式

## 验证修复的方法

1. 重新输入 GitHub Token
2. 删除所有 widget，重新添加
3. 启用 `all_repos` 模式
4. 刷新数据，检查是否有数据

## 需要用户配合的操作

请按以下步骤操作，并提供输出：

1. 打开 DevDash 应用
2. 按 F12 打开浏览器控制台
3. 输入以下命令并复制输出：
   ```javascript
   await __TAURI__.core.invoke("debug_db_state")
   ```
4. 再输入：
   ```javascript
   await __TAURI__.core.invoke("diagnose_github_data")
   ```
5. 将输出粘贴给我
