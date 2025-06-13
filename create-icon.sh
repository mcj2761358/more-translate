#!/bin/bash

# 创建应用图标的脚本
# 需要安装 ImageMagick: brew install imagemagick

echo "创建应用图标..."

# 创建临时目录
mkdir -p temp_icon

# 创建一个简单的图标（蓝色圆形背景，白色翻译符号）
convert -size 1024x1024 xc:none \
  -fill "#667eea" \
  -draw "circle 512,512 512,100" \
  -fill white \
  -font Arial-Bold \
  -pointsize 400 \
  -gravity center \
  -draw "text 0,0 '🌐'" \
  temp_icon/icon_1024.png

# 生成不同尺寸的图标
sizes=(16 32 64 128 256 512 1024)
for size in "${sizes[@]}"; do
  convert temp_icon/icon_1024.png -resize ${size}x${size} temp_icon/icon_${size}.png
done

# 创建 .icns 文件
mkdir -p temp_icon/icon.iconset
cp temp_icon/icon_16.png temp_icon/icon.iconset/icon_16x16.png
cp temp_icon/icon_32.png temp_icon/icon.iconset/icon_16x16@2x.png
cp temp_icon/icon_32.png temp_icon/icon.iconset/icon_32x32.png
cp temp_icon/icon_64.png temp_icon/icon.iconset/icon_32x32@2x.png
cp temp_icon/icon_128.png temp_icon/icon.iconset/icon_128x128.png
cp temp_icon/icon_256.png temp_icon/icon.iconset/icon_128x128@2x.png
cp temp_icon/icon_256.png temp_icon/icon.iconset/icon_256x256.png
cp temp_icon/icon_512.png temp_icon/icon.iconset/icon_256x256@2x.png
cp temp_icon/icon_512.png temp_icon/icon.iconset/icon_512x512.png
cp temp_icon/icon_1024.png temp_icon/icon.iconset/icon_512x512@2x.png

# 生成 .icns 文件
iconutil -c icns temp_icon/icon.iconset -o icon.icns

# 清理临时文件
rm -rf temp_icon

echo "应用图标已创建: icon.icns" 