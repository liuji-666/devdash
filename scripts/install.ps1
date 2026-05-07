# -*- coding: utf-8 -*-
# DevDash 一键安装脚本 (Windows PowerShell)
# 用法: irm https://devdash.dev/install.ps1 | iex

$ErrorActionPreference = "Stop"

$REPO = "devdash/devdash"
$APP = "DevDash"

function Get-LatestVersion {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$REPO/releases/latest" -ErrorAction Stop
    return $release.tag_name -replace '^v', ''
}

function Get-DownloadUrl {
    param([string]$Version)
    return "https://github.com/$REPO/releases/download/v$Version/DevDash_${Version}_x64-setup.exe"
}

Write-Host ""
Write-Host "  ╔═══════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║       DevDash 一键安装            ║" -ForegroundColor Cyan
Write-Host "  ║   开发者晨间桌面伴侣              ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# 检查是否已安装
$existing = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like "*DevDash*" }

if ($existing) {
    Write-Host "  ℹ️  检测到已安装 DevDash ($($existing.DisplayVersion))" -ForegroundColor Yellow
    $update = Read-Host "  是否更新到最新版本? [Y/n]"
    if ($update -eq "n") {
        Write-Host "  已取消安装。" -ForegroundColor Gray
        exit 0
    }
}

# 获取最新版本
Write-Host "  🔍 正在获取最新版本..." -ForegroundColor Blue -NoNewline
try {
    $version = Get-LatestVersion
    Write-Host " v$version" -ForegroundColor Green
} catch {
    Write-Host " 失败" -ForegroundColor Red
    Write-Host "  ❌ 无法获取版本信息。请检查网络连接。" -ForegroundColor Red
    Write-Host ""
    Write-Host "  手动下载: https://github.com/$REPO/releases/latest" -ForegroundColor Gray
    exit 1
}

# 下载
$url = Get-DownloadUrl -Version $version
$tempFile = Join-Path $env:TEMP "DevDash_${version}_x64-setup.exe"

Write-Host "  ⬇️  正在下载 DevDash v$version..." -ForegroundColor Blue
Write-Host "      $url" -ForegroundColor DarkGray

try {
    Invoke-WebRequest -Uri $url -OutFile $tempFile -UseBasicParsing
    Write-Host "  ✅ 下载完成 ($([math]::Round((Get-Item $tempFile).Length / 1MB, 1)) MB)" -ForegroundColor Green
} catch {
    Write-Host "  ❌ 下载失败: $_" -ForegroundColor Red
    exit 1
}

# 运行安装
Write-Host "  🚀 正在启动安装程序..." -ForegroundColor Blue
Start-Process -FilePath $tempFile -Wait

# 清理
Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "  ✨ DevDash 安装完成！" -ForegroundColor Green
Write-Host "  启动后按引导配置 GitHub Token 即可使用。" -ForegroundColor Gray
Write-Host ""
