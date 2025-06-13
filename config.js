// 翻译服务配置
module.exports = {
  // 翻译服务优先级（按顺序尝试）
  translationServices: [
    'google',      // Google 翻译（免费，无需密钥）
    'microsoft',   // 微软翻译（需要 API 密钥）
    'youdao'       // 有道翻译（免费，无需密钥）
  ],
  
  // API 密钥配置
  apiKeys: {
    microsoft: process.env.MICROSOFT_TRANSLATE_KEY || '',
    // 可以添加其他服务的 API 密钥
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
    translate: 'CommandOrControl+Shift+T'  // 翻译快捷键
  },
  
  // 窗口设置
  window: {
    translatorButtonTimeout: 3000,  // 翻译按钮显示时间（毫秒）
    translationPopupTimeout: 6000   // 翻译结果显示时间（毫秒）
  }
}; 