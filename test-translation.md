# 翻译功能测试

## 测试文本

Hello world, this is a test for the translation feature.

## 测试步骤

1. 选中上面的英文文本
2. 按 `CMD+Shift+T` 快捷键
3. 点击翻译按钮
4. 查看翻译结果

## 预期结果

应该同时显示以下翻译服务的结果：
- ✅ Google 翻译：翻译结果
- ❌ 有道翻译：翻译失败（API限制）
- ❌ 百度翻译：翻译失败（未配置API密钥）
- ❌ DeepL Free：翻译失败（未配置API密钥）

## 配置百度翻译API（推荐）

如果要测试百度翻译，可以：

1. 访问 https://fanyi-api.baidu.com/
2. 注册账户并创建应用
3. 获取 APP ID 和密钥
4. 设置环境变量：
   ```bash
   export BAIDU_TRANSLATE_APP_ID="your_app_id"
   export BAIDU_TRANSLATE_SECRET_KEY="your_secret_key"
   ```
5. 重启应用

## 配置DeepL API（可选）

如果要测试DeepL翻译，可以：

1. 访问 https://www.deepl.com/pro-api
2. 注册免费账户
3. 获取API密钥
4. 设置环境变量：
   ```bash
   export DEEPL_API_KEY="your_deepl_api_key_here"
   ```
5. 重启应用

## 配置其他翻译服务（可选）

### 微软翻译
```bash
export MICROSOFT_TRANSLATE_KEY="your_microsoft_api_key"
```

### Amazon Translate
```bash
export AWS_ACCESS_KEY_ID="your_access_key_id"
export AWS_SECRET_ACCESS_KEY="your_secret_access_key"
export AWS_REGION="us-east-1"
```

### 腾讯翻译君
```bash
export TENCENT_SECRET_ID="your_secret_id"
export TENCENT_SECRET_KEY="your_secret_key"
export TENCENT_REGION="ap-beijing"
```