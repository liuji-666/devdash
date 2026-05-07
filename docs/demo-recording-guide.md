# DEMO GIF 录制指南

## 推荐工具
- **Windows**: [ScreenToGif](https://www.screentogif.com/) (免费，可直接编辑)
- **macOS**: [Gifski](https://gif.ski/) 或 `ffmpeg`
- **跨平台**: [Peek](https://github.com/phw/peek) (Linux 优先)

## 录制步骤

1. 启动 DevDash: `npm run tauri dev`
2. 确保已配置 GitHub Token 并有真实数据
3. 用 ScreenToGif 录制以下场景:
   - 首次启动 Onboarding 引导流程 (~5s)
   - Widget 仪表盘展示 PR/Issue/CI 数据 (~5s)
   - 拖拽 Widget 重新排列 (~3s)
   - 切换深色/浅色主题 (~3s)
   - 贡献热力图 (~3s)
   - 桌面通知弹出 (~2s)

## 参数建议
- 分辨率: 1280×800 (DevDash 默认窗口大小)
- 帧率: 15fps (GIF 体积友好)
- 总时长: 20-30s
- 输出大小目标: <5MB

## ffmpeg 转换命令
```bash
# 从 MP4 转 GIF
ffmpeg -i recording.mp4 -vf "fps=15,scale=1280:-1:flags=lanczos" -loop 0 docs/demo.gif

# 压缩 GIF
gifsicle -O3 --colors 256 docs/demo.gif -o docs/demo-compressed.gif
```

## 截图
- 截取深色/浅色主题的仪表盘全屏截图
- 截取贡献热力图
- 截取通知推送
- 保存到 `docs/screenshots/`
