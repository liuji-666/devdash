# DevDash 截图录制指南

## 准备工作

1. 确保已配置有效的 GitHub Token（Settings 页面）
2. 启动应用：`npm run tauri dev`
3. 等待数据加载完成

## 所需截图

### 1. 深色主题 (`docs/screenshots/dark-theme.png`)
- 切换到深色主题
- 确保有 PR / CI / Issue 数据展示
- 截取整个应用窗口（含侧边栏和标题栏）
- 推荐：1420×900 窗口大小

### 2. 浅色主题 (`docs/screenshots/light-theme.png`)
- 切换到浅色主题
- 同上布局
- 截取整个应用窗口

### 3. 贡献热力图 (`docs/screenshots/heatmap.png`)
- 聚焦到 Activity Calendar Widget
- 显示全年贡献数据
- 可适当放大此区域

### 4. 通知推送 (`docs/screenshots/notifications.png`)
- 显示桌面通知或 Notification Feed Widget
- 展示 CI 失败通知的示例

### 5. DEMO GIF (`docs/demo.gif`)
- 录制完整使用流程（15-30秒）：
  1. 应用启动 → 引导页跳过/Onboarding
  2. 仪表盘数据展示
  3. 拖拽 Widget 排序
  4. 刷新数据
  5. 切换主题（深色 ↔ 浅色）
  6. Ctrl+K 命令面板
  7. 系统托盘最小化
- 推荐工具：ScreenToGif（Windows）、Kap（macOS）
- 帧率：15fps，尺寸：800×600

## 快速截图命令（Windows）

```powershell
# 安装 ScreenToGif（如果未安装）
winget install NickeManarin.ScreenToGif

# 或者使用 PowerShell 截图
# 需先安装 Snipping Tool 或使用 Win+Shift+S
```

## 快速截图命令（macOS）

```bash
# 截取当前窗口
screencapture -w docs/screenshots/dark-theme.png

# 截取指定区域
screencapture -R 100,100,1420,900 docs/screenshots/light-theme.png
```

## 录制 GIF（推荐 ScreenToGif）

1. 打开 ScreenToGif
2. 选择"录制器"
3. 设置帧率 15fps
4. 录制 15-30 秒操作流程
5. 编辑：删除多余帧，添加标题
6. 导出为 GIF，尺寸 ≤ 800×600
7. 保存到 `docs/demo.gif`
