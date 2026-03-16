#!/bin/bash
# Cloudflare Pages 构建脚本
# 在 Cloudflare Pages 控制台配置以下环境变量：
#   HUGO_VERSION = "0.157.0"（或更新版本）
#   NODE_VERSION = "18"（用于运行 Pagefind CLI）
#
# 构建命令：bash build.sh
# 输出目录：public

set -e

echo "Building Hugo site..."
hugo --minify

echo "Generating Pagefind search index..."
npx pagefind --site public

echo "Build complete. Output in public/"
