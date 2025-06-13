# Mac Translator - 全局翻译工具

一个基于 Electron 的 macOS 全局翻译工具，支持多种翻译服务。

## 功能特性

- 🌐 支持多种翻译服务（Google、微软、有道）
- ⌨️ 全局快捷键 `CMD+Shift+T` 快速翻译
- 🎯 智能文本检测，自动识别英文文本
- 💫 美观的翻译界面
- ⚡ 快速响应，无需手动复制粘贴

## 翻译服务配置

### 1. Google 翻译（默认，免费）
- 无需配置 API 密钥
- 自动作为首选翻译服务

### 2. 微软翻译（可选，需要 API 密钥）
1. 访问 [Microsoft Translator](https://azure.microsoft.com/en-us/services/cognitive-services/translator/)
2. 创建 Azure 账户并获取 API 密钥
3. 设置环境变量：
   ```bash
   export MICROSOFT_TRANSLATE_KEY="your_api_key_here"
   ```

### 3. 有道翻译（备用，免费）
- 无需配置 API 密钥
- 作为备用翻译服务

## 使用方法

1. **选择文本**：在任何应用中选中英文文本
2. **按快捷键**：按 `CMD+Shift+T`
3. **点击翻译**：点击出现的翻译按钮
4. **查看结果**：翻译框会弹出显示翻译结果

## 配置说明

编辑 `config.js` 文件来自定义设置：

```javascript
module.exports = {
  // 翻译服务优先级
  translationServices: ['google', 'microsoft', 'youdao'],
  
  // 翻译设置
  translation: {
    sourceLanguage: 'en',    // 源语言
    targetLanguage: 'zh',    // 目标语言
    timeout: 5000,           // 超时时间
    maxRetries: 2            // 最大重试次数
  },
  
  // 快捷键设置
  shortcuts: {
    translate: 'CommandOrControl+Shift+T'
  }
};
```

## 安装和运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建应用
npm run build

# 构建 macOS 应用
npm run build-mac
```

## 权限设置

首次运行时需要授予辅助功能权限：

1. 系统偏好设置 > 安全性与隐私 > 辅助功能
2. 点击锁图标解锁
3. 添加 Mac Translator 应用
4. 勾选 Mac Translator

## 故障排除

### 翻译框不显示
1. 检查控制台是否有错误信息
2. 确认辅助功能权限已授予
3. 尝试重启应用

### 翻译失败
1. 检查网络连接
2. 查看控制台错误信息
3. 尝试配置其他翻译服务

## 技术栈

- Electron
- Node.js
- HTML/CSS/JavaScript
- 多种翻译 API

## 许可证

MIT License 