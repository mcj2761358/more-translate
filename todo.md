- [x] 调研Mac OS上全局文本选择监听的实现方式
- [x] 调研Electron如何创建无边框、透明、置顶的窗口
- [x] 调研免费的翻译API（例如：非官方Google翻译API，或者其他免费翻译服务）
- [x] 确定技术栈和主要依赖库



## 技术方案总结

基于调研结果，确定以下技术方案：

### 核心技术栈
- **Node.js + Electron**: 主要框架
- **免费翻译API**: 使用Google翻译的非官方API或者DeepL免费API
- **Mac OS权限**: 需要辅助功能权限来监听全局文本选择

### 实现方案
1. **文本选择监听**: 
   - 使用Electron的globalShortcut监听快捷键
   - 结合clipboard模块获取选中的文本
   - 监听鼠标事件来检测文本选择

2. **翻译按钮显示**:
   - 创建无边框、透明、置顶的Electron窗口
   - 窗口属性: `{frame: false, transparent: true, alwaysOnTop: true}`
   - 根据鼠标位置动态显示翻译按钮

3. **翻译API集成**:
   - 优先使用Google翻译的非官方API（免费）
   - 备选方案：DeepL免费API（每月50万字符）
   - 腾讯翻译API（每月500万字符免费）

### 主要依赖库
- electron
- axios (用于API调用)
- robotjs (可选，用于更精确的鼠标位置获取)

