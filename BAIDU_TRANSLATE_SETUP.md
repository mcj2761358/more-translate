# 百度翻译API配置指南

## 概述

百度翻译API提供每月200万字符的免费额度，是一个非常好的免费翻译服务选择。

## 注册和配置步骤

### 1. 注册百度翻译开放平台

1. 访问 [百度翻译开放平台](https://fanyi-api.baidu.com/)
2. 点击"立即使用"或"管理控制台"
3. 使用百度账号登录（如果没有账号需要先注册）

### 2. 实名认证

1. 登录后进入控制台
2. 完成实名认证（个人认证即可）
3. 实名认证通过后才能使用API服务

### 3. 创建应用

1. 在控制台中点击"开发者信息"
2. 点击"申请接入"
3. 填写应用信息：
   - **应用名称**：例如 "Mac Translator"
   - **应用简介**：例如 "Mac桌面翻译工具"
   - **应用类型**：选择"通用翻译API"
   - **应用领域**：选择适合的领域，如"通用"
4. 提交申请并等待审核（通常几分钟内通过）

### 4. 获取API凭证

1. 审核通过后，在"开发者信息"页面可以看到：
   - **APP ID**：应用的唯一标识
   - **密钥**：用于API调用的密钥
2. 记录这两个值，稍后需要配置到环境变量中

### 5. 配置环境变量

在终端中设置环境变量：

```bash
# 设置百度翻译API凭证
export BAIDU_TRANSLATE_APP_ID="your_app_id_here"
export BAIDU_TRANSLATE_SECRET_KEY="your_secret_key_here"
```

**永久配置方法**：

将上述命令添加到你的shell配置文件中：

```bash
# 对于 zsh 用户（macOS默认）
echo 'export BAIDU_TRANSLATE_APP_ID="your_app_id_here"' >> ~/.zshrc
echo 'export BAIDU_TRANSLATE_SECRET_KEY="your_secret_key_here"' >> ~/.zshrc
source ~/.zshrc

# 对于 bash 用户
echo 'export BAIDU_TRANSLATE_APP_ID="your_app_id_here"' >> ~/.bash_profile
echo 'export BAIDU_TRANSLATE_SECRET_KEY="your_secret_key_here"' >> ~/.bash_profile
source ~/.bash_profile
```

### 6. 验证配置

重启翻译应用后，百度翻译应该会显示为可用状态：

```bash
cd /path/to/more-translate
npm run dev
```

## 免费额度说明

- **每月免费额度**：200万字符
- **QPS限制**：10次/秒
- **支持语言**：200+种语言
- **计费方式**：按字符数计费，中文按字符计算，英文按单词计算

## 支持的语言

百度翻译支持以下主要语言：
- 中文（简体/繁体）
- 英语
- 日语
- 韩语
- 法语
- 德语
- 西班牙语
- 意大利语
- 俄语
- 葡萄牙语
- 阿拉伯语
- 等200+种语言

## 错误代码说明

如果遇到翻译失败，可能的错误代码：

- **52001**: 请求超时，请重试
- **52002**: 系统错误，请重试
- **52003**: 未授权用户，请检查APP ID
- **54000**: 必填参数为空
- **54001**: 签名错误
- **54003**: 访问频率受限
- **54004**: 账户余额不足
- **54005**: 长query请求频繁
- **58000**: 客户端IP非法
- **58001**: 译文语言方向不支持
- **58002**: 服务当前已关闭
- **90107**: 认证未通过

## 故障排除

### 1. 检查环境变量

```bash
echo $BAIDU_TRANSLATE_APP_ID
echo $BAIDU_TRANSLATE_SECRET_KEY
```

### 2. 检查API凭证

确保APP ID和密钥正确，没有多余的空格或特殊字符。

### 3. 检查网络连接

确保能够访问 `https://fanyi-api.baidu.com/`

### 4. 查看应用日志

运行应用时查看控制台输出，寻找百度翻译相关的错误信息。

## 注意事项

1. **保护API密钥**：不要将APP ID和密钥提交到公共代码仓库
2. **监控使用量**：定期检查API使用量，避免超出免费额度
3. **合理使用**：遵守百度翻译API的使用条款和限制
4. **备用方案**：建议同时配置多个翻译服务作为备用

## 相关链接

- [百度翻译开放平台](https://fanyi-api.baidu.com/)
- [API文档](https://fanyi-api.baidu.com/doc/21)
- [错误代码说明](https://fanyi-api.baidu.com/doc/24)
- [价格说明](https://fanyi-api.baidu.com/product/112)