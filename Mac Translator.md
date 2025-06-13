# Mac Translator

一个基于 Electron 的 Mac OS 全局翻译工具，能够在任何应用中选择英文文本后显示翻译按钮，点击即可获得中文翻译。

## 功能特性

- 🌐 **全局翻译**: 在任何应用中选择英文文本即可翻译
- 🎯 **智能检测**: 自动识别英文文本，只对英文内容显示翻译按钮
- 🚀 **快速响应**: 使用快捷键 Cmd+C 触发，翻译按钮自动出现
- 🎨 **精美界面**: 现代化设计，透明悬浮窗口，不干扰正常使用
- 🔄 **多重备份**: 支持 Google 翻译和 DeepL 翻译服务
- ⚡ **轻量高效**: 基于 Electron 构建，资源占用少

## 安装要求

- macOS 10.14 或更高版本
- 网络连接（用于翻译服务）

## 使用方法

1. **启动应用**: 双击运行 Mac Translator
2. **授权权限**: 首次使用需要在"系统偏好设置 > 安全性与隐私 > 辅助功能"中授权此应用
3. **选择文本**: 在任何应用中选择英文文本
4. **复制触发**: 按 `⌘ + C` 复制文本
5. **点击翻译**: 翻译按钮会自动出现在鼠标附近，点击即可查看翻译结果

## 开发和构建

### 环境要求

- Node.js 20.0 或更高版本
- npm 或 yarn

### 安装依赖

\`\`\`bash
npm install
\`\`\`

### 开发模式

\`\`\`bash
npm run dev
\`\`\`

### 构建应用

\`\`\`bash
npm run build
\`\`\`

### 打包 DMG

\`\`\`bash
npm run build-mac
\`\`\`

## 配置选项

### 环境变量

创建 `.env` 文件来配置可选的翻译服务：

\`\`\`
# DeepL API 密钥（可选，用于更高质量的翻译）
DEEPL_API_KEY=your_deepl_api_key_here

# 翻译超时时间（毫秒）
TRANSLATION_TIMEOUT=5000

# 最大文本长度
MAX_TEXT_LENGTH=1000
\`\`\`

### DeepL API 配置

1. 访问 [DeepL API](https://www.deepl.com/pro-api) 申请免费 API 密钥
2. 每月可免费翻译 50 万字符
3. 将 API 密钥添加到 `.env` 文件中

## 技术架构

- **主框架**: Electron
- **翻译服务**: Google 翻译（非官方 API）+ DeepL API（可选）
- **UI 框架**: 原生 HTML/CSS/JavaScript
- **权限管理**: macOS 辅助功能 API
- **打包工具**: electron-builder

## 文件结构

\`\`\`
mac-translator/
├── main.js              # 主进程文件
├── index.html           # 主窗口界面
├── translator.html      # 翻译按钮界面
├── package.json         # 项目配置
├── .env.example         # 环境变量示例
└── README.md           # 说明文档
\`\`\`

## 常见问题

### Q: 翻译按钮不出现？
A: 请检查以下几点：
1. 确保已在系统设置中授权辅助功能权限
2. 确保选择的是英文文本
3. 确保按了 Cmd+Shift+T 复制文本

### Q: 翻译失败？
A: 请检查网络连接，或尝试配置 DeepL API 密钥作为备用翻译服务。

### Q: 如何卸载？
A: 将应用拖到废纸篓，并在系统设置中移除辅助功能权限。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 更新日志

### v1.0.0
- 初始版本发布
- 支持全局英文翻译
- 集成 Google 翻译和 DeepL API
- 现代化 UI 设计

