# Mac Translator - 全局翻译工具

一个基于 Electron 的 macOS 全局翻译工具，支持多种翻译服务。

## 功能特性

- 🌐 支持多种翻译服务（Google、有道、百度、DeepL Free、微软、Amazon、腾讯）
- 🔄 **同时调用多个免费翻译服务，对比显示结果**
- ⌨️ 全局快捷键 `CMD+Shift+T` 快速翻译
- 🎯 智能文本检测，自动识别英文文本
- 💫 美观的翻译界面，支持多结果显示
- ⚡ 快速响应，无需手动复制粘贴
- ✅ 翻译失败自动标记，清晰显示每个服务的状态
- 🆓 优先使用免费服务，节省成本

## 翻译服务配置

### 免费翻译服务（同时调用显示）

#### 1. Google 翻译（完全免费）
- 无需配置 API 密钥
- 自动作为免费翻译服务之一

#### 2. 有道翻译（完全免费）
- 无需配置 API 密钥
- 自动作为免费翻译服务之一

#### 3. 百度翻译（免费额度）
1. 访问 [百度AI开放平台](https://console.bce.baidu.com/ai/)
2. 注册账户并创建机器翻译应用（每月免费额度）
3. 获取 API Key (AK) 和 Secret Key (SK)
4. 设置环境变量：
   ```bash
   export BAIDU_AK="your_api_key"
   export BAIDU_SK="your_secret_key"
   ```

#### 4. DeepL API Free（免费额度）
1. 访问 [DeepL API](https://www.deepl.com/pro-api)
2. 注册免费账户（每月50万字符免费额度）
3. 获取 API 密钥
4. 设置环境变量：
   ```bash
   export DEEPL_API_KEY="your_api_key_here"
   ```

> **注意**：默认情况下，应用会同时调用Google翻译和有道翻译，如果配置了DeepL API密钥，也会同时调用DeepL。

### 付费翻译服务（可选配置）

#### 1. 微软翻译
1. 访问 [Microsoft Translator](https://azure.microsoft.com/en-us/services/cognitive-services/translator/)
2. 创建 Azure 账户并获取 API 密钥
3. 设置环境变量：
   ```bash
   export MICROSOFT_TRANSLATE_KEY="your_api_key_here"
   ```

#### 2. Amazon Translate
1. 访问 [AWS Translate](https://aws.amazon.com/translate/)
2. 创建 AWS 账户并获取访问密钥
3. 设置环境变量：
   ```bash
   export AWS_ACCESS_KEY_ID="your_access_key_id"
   export AWS_SECRET_ACCESS_KEY="your_secret_access_key"
   export AWS_REGION="us-east-1"
   ```

#### 3. 腾讯翻译君
1. 访问 [腾讯云翻译君](https://cloud.tencent.com/product/tmt)
2. 创建腾讯云账户并获取 API 密钥
3. 设置环境变量：
   ```bash
   export TENCENT_SECRET_ID="your_secret_id"
   export TENCENT_SECRET_KEY="your_secret_key"
   export TENCENT_REGION="ap-beijing"
   ```

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

node version : 20.0.0

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建应用
npm run build

# 构建 macOS 应用
npm run build-mac
npm run build-mac-arm64

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