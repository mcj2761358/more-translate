# Mac Translator 打包指南

本指南将帮助你将 Mac Translator 打包成可以在其他 Mac 上使用的安装包。

## 准备工作

### 1. 安装依赖

```bash
# 安装项目依赖
npm install

# 安装打包工具（如果还没有）
npm install --save-dev electron-builder
```

### 2. 创建应用图标

```bash
# 给脚本执行权限
chmod +x create-icon.sh

# 运行图标生成脚本（需要 ImageMagick）
./create-icon.sh
```

如果没有 ImageMagick，可以手动创建 `icon.icns` 文件，或者使用在线工具生成。

### 3. 创建 DMG 背景（可选）

创建一个 `dmg-background.png` 文件作为 DMG 安装界面的背景。

## 打包步骤

### 方法1：生成 DMG 安装包（推荐）

```bash
# 生成 DMG 安装包
npm run build-dmg
```

这将在 `dist` 目录下生成：
- `Mac Translator-1.0.0.dmg` - DMG 安装包
- `Mac Translator-1.0.0-arm64.dmg` - ARM64 版本
- `Mac Translator-1.0.0-x64.dmg` - Intel 版本

### 方法2：生成 ZIP 压缩包

```bash
# 生成 ZIP 压缩包
npm run build-mac
```

这将在 `dist` 目录下生成：
- `Mac Translator-1.0.0-mac.zip` - 压缩包版本

### 方法3：生成所有格式

```bash
# 生成所有格式
npm run build
```

## 分发方式

### 1. DMG 安装包（推荐）

DMG 是最常见的 macOS 应用分发格式：

1. 用户双击 `.dmg` 文件
2. 将应用拖拽到 Applications 文件夹
3. 从 Applications 文件夹启动应用

### 2. ZIP 压缩包

适合快速分发：

1. 解压 ZIP 文件
2. 将 `.app` 文件拖拽到 Applications 文件夹
3. 从 Applications 文件夹启动应用

## 安装说明

### 首次安装

1. **下载安装包**：获取 DMG 或 ZIP 文件
2. **安装应用**：
   - DMG：双击打开，拖拽到 Applications
   - ZIP：解压后拖拽到 Applications
3. **启动应用**：从 Applications 文件夹启动
4. **授予权限**：
   - 系统偏好设置 > 安全性与隐私 > 辅助功能
   - 添加 Mac Translator 并勾选

### 使用说明

1. **选择英文文本**：在任何应用中选中英文文本
2. **按快捷键**：按 `CMD+Shift+T`
3. **点击翻译**：点击出现的翻译按钮
4. **查看结果**：翻译结果会弹出显示

## 代码签名（可选）

如果要发布到 App Store 或避免安全警告，需要代码签名：

### 1. 获取开发者证书

1. 注册 Apple Developer 账户
2. 在 Xcode 中创建开发者证书
3. 导出证书和私钥

### 2. 配置签名

在 `package.json` 中添加：

```json
{
  "build": {
    "mac": {
      "identity": "你的开发者证书名称"
    }
  }
}
```

### 3. 公证（可选）

对于 macOS Catalina 及以上版本，建议进行公证：

```bash
# 设置环境变量
export APPLE_ID="你的Apple ID"
export APPLE_ID_PASSWORD="你的应用专用密码"

# 打包并公证
npm run build-dmg
```

## 故障排除

### 1. 打包失败

- 检查所有必需文件是否存在
- 确保 `node_modules` 已安装
- 检查 `package.json` 配置是否正确

### 2. 应用无法启动

- 检查 macOS 版本兼容性
- 确认权限设置正确
- 查看控制台错误信息

### 3. 翻译功能不工作

- 确认网络连接正常
- 检查辅助功能权限
- 查看应用日志

## 文件结构

打包后的文件结构：

```
dist/
├── Mac Translator-1.0.0.dmg          # DMG 安装包
├── Mac Translator-1.0.0-arm64.dmg    # ARM64 版本
├── Mac Translator-1.0.0-x64.dmg      # Intel 版本
└── mac/                              # 原始文件
    └── Mac Translator.app/           # 应用包
```

## 注意事项

1. **兼容性**：支持 macOS 10.14 及以上版本
2. **架构**：同时支持 Intel 和 Apple Silicon
3. **权限**：需要辅助功能权限才能使用全局快捷键
4. **网络**：需要网络连接进行翻译
5. **安全**：首次运行可能需要在安全设置中允许

## 更新应用

要更新应用版本：

1. 修改 `package.json` 中的 `version` 字段
2. 重新打包：`npm run build-dmg`
3. 分发新的安装包

## 技术支持

如果遇到问题，请检查：
- 应用日志
- 系统偏好设置
- 网络连接
- 权限设置 