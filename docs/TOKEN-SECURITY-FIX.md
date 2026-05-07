# Token 安全修复指南

## 问题

GitHub Token 以明文形式存储在数据库中，存在安全风险。

## 修复步骤

### 1. 启动应用并打开控制台

1. 打开 DevDash 应用
2. 按 **F12** 打开浏览器控制台

### 2. 运行加密命令

在控制台执行：

```javascript
await __TAURI__.core.invoke("encrypt_existing_tokens")
```

预期输出：
```json
{
  "migrated": 1,
  "already_encrypted": 0,
  "failed": 0,
  "message": "成功加密 1 个 token"
}
```

### 3. 验证加密结果

再次运行：

```javascript
await __TAURI__.core.invoke("encrypt_existing_tokens")
```

预期输出：
```json
{
  "migrated": 0,
  "already_encrypted": 1,
  "failed": 0,
  "message": "所有 token 已经加密"
}
```

### 4. 检查 Token 显示

打开设置 → 数据源，Token 字段应该显示为：
- `ghp_x76O...lAFF`（部分掩码）

而不是完整的明文 token。

### 5. 测试数据拉取

点击刷新按钮，确认数据仍然可以正常拉取。

## 安全改进说明

### 加密方案

- **Master Key**: 256-bit 随机密钥，存储在 OS 凭据管理器中
  - Windows: Credential Manager
  - macOS: Keychain
  - Linux: Secret Service

- **Token 加密**: AES-256-GCM + Argon2id
  - 每个 token 使用独立的 salt 和 nonce
  - 加密后的数据以 base64 存储

- **Fallback**: 如果 OS 凭据管理器不可用，使用机器绑定派生密钥

### 前端显示

- Token 在前端显示时会被掩码（只显示前 8 位和后 4 位）
- 完整的 token 永远不会传输到前端

## 注意事项

1. **备份**: 在运行加密前，确保你有 GitHub Token 的备份
2. **Master Key**: 如果删除 `devdash.mk` 文件或清除 OS 凭据，加密的 token 将无法解密
3. **重新安装**: 如果重新安装应用，可能需要重新配置数据源

## 故障排除

### 加密失败

如果 `encrypt_existing_tokens` 返回 `failed > 0`：

1. 检查应用日志
2. 确认 `devdash.mk` 文件存在
3. 尝试重启应用后再次运行

### Token 无法解密

如果数据拉取失败并提示 token 错误：

1. 删除现有的数据源
2. 重新添加并输入新的 GitHub Token
3. 新 token 会自动加密
