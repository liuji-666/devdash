#!/usr/bin/env bash
# -*- coding: utf-8 -*-
# DevDash 一键安装脚本 (macOS / Linux)
# 用法: curl -fsSL https://devdash.dev/install.sh | bash

set -euo pipefail

REPO="devdash/devdash"
APP="DevDash"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

echo ""
echo -e "  ${CYAN}╔═══════════════════════════════════╗${NC}"
echo -e "  ${CYAN}║       DevDash 一键安装            ║${NC}"
echo -e "  ${CYAN}║   开发者晨间桌面伴侣              ║${NC}"
echo -e "  ${CYAN}╚═══════════════════════════════════╝${NC}"
echo ""

# 检测平台
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
    Darwin)
        PLATFORM="macos"
        EXT="dmg"
        ;;
    Linux)
        PLATFORM="linux"
        EXT="AppImage"
        ;;
    *)
        echo -e "  ${RED}❌ 不支持的操作系统: $OS${NC}"
        echo -e "  ${GRAY}目前仅支持 macOS 和 Linux${NC}"
        exit 1
        ;;
esac

case "$ARCH" in
    x86_64|amd64)  ARCH_TAG="amd64" ;;
    arm64|aarch64) ARCH_TAG="arm64" ;;
    *)
        echo -e "  ${RED}❌ 不支持的架构: $ARCH${NC}"
        exit 1
        ;;
esac

# 获取最新版本
echo -e "  ${BLUE}🔍 正在获取最新版本...${NC} \c"
VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null | grep '"tag_name"' | head -1 | sed -E 's/.*"v?([^"]+)".*/\1/')

if [ -z "$VERSION" ]; then
    echo -e "${RED}失败${NC}"
    echo -e "  ${RED}❌ 无法获取版本信息。请检查网络连接。${NC}"
    echo -e "  ${GRAY}手动下载: https://github.com/$REPO/releases/latest${NC}"
    exit 1
fi
echo -e "${GREEN}v$VERSION${NC}"

# 构建下载 URL
case "$PLATFORM" in
    macos)
        FILE="DevDash_${VERSION}_${ARCH_TAG}.${EXT}"
        URL="https://github.com/$REPO/releases/download/v$VERSION/$FILE"
        ;;
    linux)
        FILE="DevDash_${VERSION}_${ARCH_TAG}.${EXT}"
        URL="https://github.com/$REPO/releases/download/v$VERSION/$FILE"
        ;;
esac

# 下载
TEMP_DIR="$(mktemp -d)"
TEMP_FILE="$TEMP_DIR/$FILE"

echo -e "  ${BLUE}⬇️  正在下载 DevDash v$VERSION for $PLATFORM/$ARCH_TAG...${NC}"
echo -e "      ${GRAY}$URL${NC}"

if ! curl -fSL --progress-bar -o "$TEMP_FILE" "$URL"; then
    echo -e "  ${RED}❌ 下载失败${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

SIZE=$(du -h "$TEMP_FILE" | cut -f1)
echo -e "  ${GREEN}✅ 下载完成 ($SIZE)${NC}"

# 安装
case "$PLATFORM" in
    macos)
        echo -e "  ${BLUE}🚀 正在挂载 DMG...${NC}"
        hdiutil attach "$TEMP_FILE" -quiet
        VOLUME=$(ls /Volumes/ | grep -i devdash | head -1)
        if [ -n "$VOLUME" ]; then
            echo -e "  ${BLUE}📦 拖拽到 Applications...${NC}"
            cp -R "/Volumes/$VOLUME/DevDash.app" /Applications/ 2>/dev/null || \
                echo -e "  ${YELLOW}⚠️  请手动将 DevDash 拖到 Applications 文件夹${NC}"
            hdiutil detach "/Volumes/$VOLUME" -quiet
        fi
        ;;
    linux)
        echo -e "  ${BLUE}📦 正在安装 AppImage...${NC}"
        INSTALL_DIR="$HOME/.local/bin"
        mkdir -p "$INSTALL_DIR"
        chmod +x "$TEMP_FILE"
        mv "$TEMP_FILE" "$INSTALL_DIR/DevDash"
        echo -e "  ${GREEN}✅ 已安装到 $INSTALL_DIR/DevDash${NC}"
        echo -e "  ${GRAY}运行: $INSTALL_DIR/DevDash${NC}"
        ;;
esac

# 清理
rm -rf "$TEMP_DIR"

echo ""
echo -e "  ${GREEN}✨ DevDash 安装完成！${NC}"
echo -e "  ${GRAY}启动后按引导配置 GitHub Token 即可使用。${NC}"
echo ""
