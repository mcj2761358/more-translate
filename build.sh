#!/bin/bash

echo "🚀 开始打包 Mac Translator..."

# 检查依赖
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到 npm，请先安装 Node.js"
    exit 1
fi

# 安装依赖
echo "📦 安装依赖..."
npm install

# 检查是否有图标文件
if [ ! -f "icon.icns" ]; then
    echo "⚠️  警告: 未找到 icon.icns 文件"
    echo "💡 提示: 可以运行 ./create-icon.sh 生成图标，或手动创建"
    echo "   继续打包，但可能没有应用图标..."
fi

# 检查是否有 DMG 背景
if [ ! -f "dmg-background.png" ]; then
    echo "⚠️  警告: 未找到 dmg-background.png 文件"
    echo "💡 提示: DMG 将使用默认背景"
fi

# 清理之前的构建
echo "🧹 清理之前的构建..."
rm -rf dist/

# 开始打包
echo "🔨 开始打包..."
npm run build-dmg

# 检查打包结果
if [ -d "dist" ]; then
    echo "✅ 打包完成！"
    echo ""
    echo "📁 生成的文件:"
    ls -la dist/
    echo ""
    echo "🎉 打包成功！你可以将以下文件分发给其他用户："
    echo "   - dist/Mac Translator-1.0.0.dmg (推荐)"
    echo "   - dist/Mac Translator-1.0.0-arm64.dmg (Apple Silicon)"
    echo "   - dist/Mac Translator-1.0.0-x64.dmg (Intel)"
    echo ""
    echo "📖 安装说明："
    echo "   1. 双击 .dmg 文件"
    echo "   2. 将应用拖拽到 Applications 文件夹"
    echo "   3. 从 Applications 启动应用"
    echo "   4. 在系统偏好设置中授予辅助功能权限"
else
    echo "❌ 打包失败！请检查错误信息"
    exit 1
fi 