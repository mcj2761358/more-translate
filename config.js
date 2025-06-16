// 翻译服务配置
module.exports = {
  // 免费翻译服务（同时调用显示）
  freeTranslationServices: [
    'google',      // Google 翻译（免费，无需密钥）
    'amazon',      // 亚马逊翻译（免费，无需密钥）
    'baidu',       // 百度翻译（免费额度，需要API密钥）
    // 'deepl_free'   // DeepL API Free（需要免费API密钥）
  ],
  
  // 付费翻译服务（作为备用）
  paidTranslationServices: [
    'microsoft',   // 微软翻译（需要 API 密钥）
    'amazon',      // Amazon Translate（需要 AWS 凭证）
    'tencent'      // 腾讯翻译君（需要 API 密钥）
  ],
  
  // 翻译服务优先级（按顺序尝试，保持向后兼容）
  translationServices: [
    'google',      // Google 翻译（免费，无需密钥）
    'microsoft',   // 微软翻译（需要 API 密钥）
    'youdao'       // 有道翻译（免费，无需密钥）
  ],
  
  // API 密钥配置
  apiKeys: {
    microsoft: process.env.MICROSOFT_TRANSLATE_KEY || '',
    deepl: process.env.DEEPL_API_KEY || '',
    baidu: {
      ak: process.env.BAIDU_AK || '',
      sk: process.env.BAIDU_SK || ''
    },
    tencent: {
      secretId: process.env.TENCENT_SECRET_ID || '',
      secretKey: process.env.TENCENT_SECRET_KEY || '',
      region: process.env.TENCENT_REGION || 'ap-beijing'
    },
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_REGION || 'us-east-1'
    }
  },
  
  // 翻译设置
  translation: {
    sourceLanguage: 'en',    // 源语言
    targetLanguage: 'zh',    // 目标语言
    timeout: 5000,           // 超时时间（毫秒）
    maxRetries: 2            // 最大重试次数
  },
  
  // 快捷键设置
  shortcuts: {
    translate: 'Shift+X'  // 翻译快捷键
  },
  
  // 窗口设置
  window: {
    translatorButtonTimeout: 3000,  // 翻译按钮显示时间（毫秒）
    translationPopupTimeout: 6000   // 翻译结果显示时间（毫秒）
  }
}; 