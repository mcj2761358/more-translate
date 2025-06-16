const { app, BrowserWindow, globalShortcut, clipboard, ipcMain, screen, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// 设置日志文件
const logFile = path.join(app.getPath('userData'), 'app.log');

// 禁用开发者工具的错误信息
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
process.env.ELECTRON_DISABLE_DEVTOOLS_WARNINGS = 'true';

// 禁用Chrome的一些警告
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('--disable-dev-shm-usage');
app.commandLine.appendSwitch('--no-sandbox');
app.commandLine.appendSwitch('--disable-web-security');
app.commandLine.appendSwitch('--disable-logging');
app.commandLine.appendSwitch('--silent-debugger-extension-api');

// 重写console.error来过滤特定的错误信息
const originalConsoleError = console.error;
console.error = function(...args) {
  const message = args.join(' ');
  
  // 过滤掉开发者工具的错误
  const ignoredPatterns = [
    'Unknown VE context',
    'Autofill.enable',
    'Autofill.setAddresses',
    'language-mismatch',
    'visual_logging',
    'protocol_client',
    'devtools://',
    'wasn\'t found',
    'bundled/ui/legacy/legacy.js',
    'bundled/panels/emulation/emulation.js',
    'bundled/entrypoints/main/main.js'
  ];
  
  for (const pattern of ignoredPatterns) {
    if (message.includes(pattern)) {
      return; // 不输出这些错误
    }
  }
  
  // 输出其他错误
  originalConsoleError.apply(console, args);
};

function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // 同时输出到控制台和文件
  console.log(message);
  
  try {
    fs.appendFileSync(logFile, logMessage);
  } catch (error) {
    console.error('写入日志失败:', error);
  }
}

function writeDragLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  // 添加到拖动日志数组
  dragLogs.push(logMessage);
  
  // 只保留最近100条日志
  if (dragLogs.length > 100) {
    dragLogs = dragLogs.slice(-100);
  }
  
  // 同时输出到控制台
  console.log(`[DRAG] ${message}`);
  
  // 通知主窗口更新日志显示
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('drag-log-update', logMessage);
  }
}

let mainWindow;
let translatorWindow;
let resultWindow; // 新增：翻译结果窗口
let lastClipboardText = ''; // 新增：记录上次剪贴板内容
let isTranslating = false; // 新增：翻译状态标志
let dragLogs = []; // 新增：拖动日志

function createMainWindow() {
  writeLog('=== 创建主窗口 ===');
  
  // 检查是否为开发模式
  const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
  
  // 创建主窗口
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    show: isDev, // 只在开发模式下显示
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: isDev // 只在开发模式下启用开发者工具
    },
    title: isDev ? 'More Translator - 调试模式' : 'More Translator'
  });

  mainWindow.loadFile('index.html');
  
  // 添加窗口事件监听
  mainWindow.on('ready-to-show', () => {
    writeLog('主窗口已准备显示');
  });
  
  mainWindow.on('closed', () => {
    writeLog('主窗口已关闭');
    mainWindow = null;
  });
  
  // 只在开发模式下打开开发者工具
  if (isDev) {
    // 延迟打开开发者工具，避免初始化错误
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        mainWindow.webContents.openDevTools();
      }, 1000); // 延迟1秒打开
    });
    
    // 拦截并过滤控制台错误
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      // 过滤掉开发者工具的内部错误
      const ignoredMessages = [
        'Unknown VE context',
        'Autofill.enable',
        'Autofill.setAddresses',
        'language-mismatch',
        'visual_logging',
        'protocol_client',
        'devtools://',
        'wasn\'t found',
        'bundled/ui/legacy/legacy.js',
        'bundled/panels/emulation/emulation.js',
        'bundled/entrypoints/main/main.js'
      ];
      
      for (const ignoredMessage of ignoredMessages) {
        if (message.includes(ignoredMessage)) {
          event.preventDefault(); // 阻止错误输出
          return;
        }
      }
    });
  }
  
  writeLog('主窗口创建完成');
}

function createTranslatorWindow() {
  writeLog('=== 创建翻译窗口 ===');
  
  // 创建翻译按钮窗口
  translatorWindow = new BrowserWindow({
    width: 120,
    height: 40,
    frame: false, // 无边框
    transparent: true, // 透明
    alwaysOnTop: true, // 置顶
    resizable: false,
    movable: true, // 启用拖动功能
    minimizable: false,
    maximizable: false,
    show: false, // 先设为false，稍后会自动显示
    skipTaskbar: true, // 不在任务栏显示
    focusable: true, // 允许获得焦点
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  writeLog('翻译窗口创建完成');
  translatorWindow.loadFile('translator.html');
  
  // 设置窗口可见性
  translatorWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  translatorWindow.setAlwaysOnTop(true, 'screen-saver');
  
  // 监听窗口加载完成
  translatorWindow.webContents.on('did-finish-load', () => {
    writeLog('翻译窗口页面加载完成');
    // 自动显示翻译按钮
    showTranslatorButtonOnStartup();
  });
  
  // 监听窗口显示
  translatorWindow.on('show', () => {
    writeLog('翻译窗口已显示');
  });
  
  // 监听窗口隐藏
  translatorWindow.on('hide', () => {
    writeLog('翻译窗口已隐藏');
  });
}

function createResultWindow() {
  console.log('=== 创建翻译结果窗口 ===');
  
  // 检查现有窗口是否有效，如果有效则关闭
  if (resultWindow && !resultWindow.isDestroyed()) {
    console.log('关闭现有结果窗口');
    resultWindow.close();
    resultWindow = null;
  }
  
  // 创建翻译结果窗口
  resultWindow = new BrowserWindow({
    width: 320,
    height: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    show: false,
    skipTaskbar: true,
    focusable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  console.log('翻译结果窗口创建完成');
  
  // 设置窗口可见性
  resultWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  resultWindow.setAlwaysOnTop(true, 'screen-saver');
  
  // 监听窗口关闭事件
  resultWindow.on('closed', () => {
    console.log('翻译结果窗口已关闭');
    resultWindow = null;
  });
  
  return resultWindow;
}

function showTranslatorButton(x, y) {
  console.log('=== 显示翻译按钮 ===');
  console.log('位置:', { x, y });
  
  if (translatorWindow && !isTranslating) {
    // 调整位置，确保按钮在合适的位置显示
    translatorWindow.setPosition(x + 10, y - 50);
    translatorWindow.show();
    translatorWindow.focus(); // 确保窗口获得焦点
    
    console.log('翻译按钮窗口已显示');
    
    // 自动隐藏
    setTimeout(() => {
      if (translatorWindow && translatorWindow.isVisible() && !isTranslating) {
        translatorWindow.hide();
        console.log('翻译按钮窗口已自动隐藏');
      }
    }, config.window.translatorButtonTimeout);
  } else {
    console.error('翻译按钮窗口未创建或正在翻译中');
  }
}

function showTranslatorButtonOnStartup() {
  console.log('=== 启动时显示翻译按钮 ===');
  
  if (translatorWindow) {
    // 获取屏幕尺寸
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    
    // 将翻译按钮放在屏幕右上角
    const x = width - 150; // 距离右边150像素
    const y = 50; // 距离顶部50像素
    
    translatorWindow.setPosition(x, y);
    translatorWindow.show();
    translatorWindow.focus();
    
    console.log('翻译按钮已显示在屏幕右上角:', { x, y });
    
    // 启动时显示的翻译按钮不会自动隐藏，用户可以手动关闭或拖动
  } else {
    console.error('翻译按钮窗口未创建');
  }
}

function hideTranslatorButton() {
  if (translatorWindow && translatorWindow.isVisible()) {
    translatorWindow.hide();
  }
}

// 检查辅助功能权限
function checkAccessibilityPermission() {
  if (process.platform === 'darwin') {
    const isTrusted = systemPreferences.isTrustedAccessibilityClient(false);
    if (!isTrusted) {
      console.log('需要辅助功能权限');
      // 提示用户授权
      const { dialog } = require('electron');
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: '需要辅助功能权限',
        message: '为了监听全局文本选择，需要授权辅助功能权限',
        detail: '请在"系统偏好设置 > 安全性与隐私 > 辅助功能"中添加此应用',
        buttons: ['打开系统偏好设置', '稍后设置']
      }).then((result) => {
        if (result.response === 0) {
          // 打开系统偏好设置
          require('child_process').exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"');
        }
      });
    }
    return isTrusted;
  }
  return true;
}

app.whenReady().then(() => {
  console.log('=== 应用启动 ===');
  console.log('创建主窗口...');
  createMainWindow();
  console.log('创建翻译窗口...');
  createTranslatorWindow();

  // 检查权限
  console.log('检查辅助功能权限...');
  const hasPermission = checkAccessibilityPermission();
  console.log('权限检查结果:', hasPermission);
  
  if (hasPermission) {
    console.log('=== 注册全局快捷键 ===');
    console.log('快捷键:', config.shortcuts.translate);
    
    // 注册全局快捷键 CMD+Shift+T 来检测文本选择
    globalShortcut.register(config.shortcuts.translate, () => {
      console.log('=== 快捷键被触发 ===');
      
      // 如果正在翻译中，忽略新的快捷键
      if (isTranslating) {
        console.log('正在翻译中，忽略新的快捷键');
        return;
      }
      
      // 模拟 CMD+C 来确保剪贴板更新
      const { exec } = require('child_process');
      exec('osascript -e \'tell application "System Events" to keystroke "c" using command down\'', (error) => {
        if (error) {
          console.error('模拟复制失败:', error);
        }
        
        // 延迟一点时间确保剪贴板已更新
        setTimeout(() => {
          const selectedText = clipboard.readText();
          console.log('剪贴板内容:', selectedText);
          console.log('上次剪贴板内容:', lastClipboardText);
          
          // 检查剪贴板内容是否发生变化
          if (selectedText && selectedText.trim().length > 0 && selectedText !== lastClipboardText) {
            lastClipboardText = selectedText; // 更新记录
            console.log('检测到新的文本，长度:', selectedText.trim().length);
            
            // 检查是否为英文文本
            if (/^[a-zA-Z\s.,!?;:'"()-]+$/.test(selectedText.trim())) {
              console.log('文本符合英文格式，显示翻译按钮');
              // 获取鼠标位置
              const { x, y } = screen.getCursorScreenPoint();
              showTranslatorButton(x, y);
            } else {
              console.log('文本不符合英文格式，跳过');
            }
          } else {
            console.log('剪贴板为空、无效或内容未变化');
          }
        }, 300); // 增加延迟时间确保剪贴板更新
      });
    });
    
    console.log('快捷键注册成功');
  } else {
    console.error('没有辅助功能权限，无法注册快捷键');
  }

  console.log('=== 注册IPC处理器 ===');
  // 监听来自渲染进程的消息
  ipcMain.handle('translate-text', async (event, text) => {
    console.log('=== 收到翻译请求 ===');
    console.log('要翻译的文本:', text);
    
    // 设置翻译状态
    isTranslating = true;
    
    try {
      const translation = await translateText(text);
      console.log('翻译结果:', translation);
      
      // 显示翻译结果
      showTranslationResult(text, translation);
      
      return translation;
    } catch (error) {
      console.error('翻译错误:', error);
      const errorMsg = '翻译失败';
      showTranslationResult(text, errorMsg);
      return errorMsg;
    } finally {
      // 重置翻译状态
      isTranslating = false;
    }
  });

  ipcMain.handle('hide-translator', () => {
    console.log('=== 隐藏翻译按钮 ===');
    hideTranslatorButton();
  });

  // 新增：退出应用
  ipcMain.handle('quit-app', () => {
    console.log('=== 收到退出应用请求 ===');
    writeLog('用户确认退出应用');
    
    // 清理资源
    if (translatorWindow && !translatorWindow.isDestroyed()) {
      translatorWindow.close();
    }
    if (resultWindow && !resultWindow.isDestroyed()) {
      resultWindow.close();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
    
    // 注销全局快捷键
    globalShortcut.unregisterAll();
    
    // 退出应用
    app.quit();
  });

  // 新增：为对话框调整翻译窗口大小
  ipcMain.handle('resize-translator-for-dialog', () => {
    console.log('=== 调整翻译窗口大小以显示对话框 ===');
    if (translatorWindow && !translatorWindow.isDestroyed()) {
      // 调整窗口大小以容纳对话框
      translatorWindow.setSize(450, 300);
      translatorWindow.center(); // 居中显示
    }
  });

  // 新增：恢复翻译窗口大小
  ipcMain.handle('restore-translator-size', () => {
    console.log('=== 恢复翻译窗口大小 ===');
    if (translatorWindow && !translatorWindow.isDestroyed()) {
      // 恢复原始大小
      translatorWindow.setSize(120, 40);
    }
  });

  // 新增：复制选中文本到剪贴板并获取
  ipcMain.handle('copy-and-get-selected-text', () => {
    console.log('=== 复制选中文本到剪贴板并获取 ===');
    
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      // 先保存当前剪贴板内容
      const originalClipboard = clipboard.readText();
      console.log('原始剪贴板内容:', originalClipboard);
      
      // 使用AppleScript复制选中文本到剪贴板
      const copyScript = `
        tell application "System Events"
          set frontApp to name of first application process whose frontmost is true
        end tell
        
        tell application frontApp
          activate
        end tell
        
        tell application "System Events"
          tell process frontApp
            try
              -- 模拟 Cmd+C 复制操作
              key code 8 using command down
              delay 0.1
              return "success"
            on error
              return "failed"
            end try
          end tell
        end tell
      `;
      
      console.log('执行复制操作...');
      exec(`osascript -e '${copyScript}'`, (error, stdout, stderr) => {
        if (error) {
          console.log('复制操作失败:', error.message);
          // 复制失败，尝试直接获取选中文本
          getSelectedTextDirectly(resolve, originalClipboard);
        } else {
          console.log('复制操作结果:', stdout.trim());
          
          // 等待一小段时间确保复制完成
          setTimeout(() => {
            const newClipboard = clipboard.readText();
            console.log('复制后的剪贴板内容:', newClipboard);
            
            // 检查剪贴板是否有新内容
            if (newClipboard && newClipboard !== originalClipboard && newClipboard.trim().length > 0) {
              console.log('成功获取复制的文本:', newClipboard);
              resolve(newClipboard.trim());
            } else {
              console.log('剪贴板没有新内容，尝试直接获取选中文本');
              // 如果剪贴板没有变化，尝试直接获取
              getSelectedTextDirectly(resolve, originalClipboard);
            }
          }, 200); // 等待200ms确保复制完成
        }
      });
    });
  });

  ipcMain.handle('get-selected-text', () => {
    console.log('=== 获取选中文本 ===');
    
    // 尝试使用AppleScript获取当前选中的文本
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      getSelectedTextDirectly(resolve, '');
    });
  });

  // 辅助函数：直接获取选中文本
  function getSelectedTextDirectly(resolve, fallbackText) {
    const { exec } = require('child_process');
    
    // 使用AppleScript获取当前选中的文本
    const script = `
      tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
      end tell
      
      tell application frontApp
        activate
      end tell
      
      tell application "System Events"
        tell process frontApp
          set selectedText to ""
          try
            set selectedText to value of attribute "AXSelectedText" of window 1
          on error
            try
              set selectedText to value of attribute "AXSelectedText" of text area 1 of window 1
            on error
              try
                set selectedText to value of attribute "AXSelectedText" of text field 1 of window 1
              on error
                set selectedText to ""
              end try
            end try
          end try
          return selectedText
        end tell
      end tell
    `;
    
    exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
      if (error) {
        console.log('AppleScript获取选中文本失败:', error.message);
        // 如果AppleScript失败，使用回退文本或剪贴板
        const clipboardText = fallbackText || clipboard.readText();
        console.log('回退到剪贴板文本:', clipboardText);
        resolve(clipboardText);
      } else {
        const selectedText = stdout.trim();
        console.log('AppleScript获取的选中文本:', selectedText);
        
        if (selectedText && selectedText.length > 0) {
          resolve(selectedText);
        } else {
          // 如果AppleScript返回空，使用回退文本或剪贴板
          const clipboardText = fallbackText || clipboard.readText();
          console.log('AppleScript返回空，回退到剪贴板文本:', clipboardText);
          resolve(clipboardText);
        }
      }
    });
  }

  ipcMain.handle('check-permission', () => {
    console.log('=== 检查权限 ===');
    const hasPermission = checkAccessibilityPermission();
    console.log('权限状态:', hasPermission);
    return hasPermission;
  });
  
  // 将窗口带到前面
  ipcMain.handle('bring-to-front', () => {
    console.log('=== 将翻译窗口带到前面 ===');
    if (translatorWindow) {
      translatorWindow.setAlwaysOnTop(true, 'screen-saver');
      translatorWindow.show();
      translatorWindow.focus();
      console.log('翻译窗口已带到前面');
    }
  });
  
  // 新增：获取翻译状态
  ipcMain.handle('get-translation-status', () => {
    return isTranslating;
  });
  
  // 新增：移动翻译窗口
  ipcMain.handle('move-translator-window', (event, deltaX, deltaY) => {
    writeDragLog(`收到移动窗口请求: deltaX=${deltaX}, deltaY=${deltaY}`);
    
    if (translatorWindow && !translatorWindow.isDestroyed()) {
      const [currentX, currentY] = translatorWindow.getPosition();
      writeDragLog(`当前窗口位置: x=${currentX}, y=${currentY}`);
      
      const newX = currentX + deltaX;
      const newY = currentY + deltaY;
      writeDragLog(`计算新位置: x=${newX}, y=${newY}`);
      
      // 获取屏幕边界
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      writeDragLog(`屏幕工作区域: width=${width}, height=${height}`);
      
      // 限制窗口在屏幕范围内
      const constrainedX = Math.max(0, Math.min(newX, width - 150));
      const constrainedY = Math.max(0, Math.min(newY, height - 50));
      writeDragLog(`约束后位置: x=${constrainedX}, y=${constrainedY}`);
      
      translatorWindow.setPosition(constrainedX, constrainedY);
      writeDragLog(`窗口已移动到: x=${constrainedX}, y=${constrainedY}`);
    } else {
      writeDragLog('翻译窗口不存在或已销毁');
    }
  });
  
  // 新增：获取拖动日志
  ipcMain.handle('get-drag-logs', () => {
    return dragLogs;
  });
  
  // 新增：清空拖动日志
  ipcMain.handle('clear-drag-logs', () => {
    dragLogs = [];
    writeDragLog('拖动日志已清空');
    return true;
  });
  
  console.log('应用初始化完成');
});

// 翻译函数
async function translateText(text) {
  console.log('=== 开始翻译流程 ===');
  console.log('输入文本:', text);
  console.log('配置的翻译服务:', config.translationServices);
  
  const axios = require('axios');
  
  // 按配置的优先级尝试不同的翻译服务
  for (const service of config.translationServices) {
    console.log(`\n--- 尝试 ${service} 翻译服务 ---`);
    
    try {
      let result;
      
      switch (service) {
        case 'google':
          console.log('调用 Google 翻译...');
          result = await translateWithGoogle(text);
          break;
        case 'microsoft':
          if (config.apiKeys.microsoft) {
            console.log('调用微软翻译...');
            result = await translateWithMicrosoft(text);
          } else {
            console.log('Microsoft API key not configured, skipping...');
            continue;
          }
          break;
        case 'youdao':
          console.log('调用有道翻译...');
          result = await translateWithYoudao(text);
          break;
        default:
          console.log(`Unknown translation service: ${service}`);
          continue;
      }
      
      if (result) {
        console.log(`${service} 翻译成功:`, result);
        return result;
      } else {
        console.log(`${service} 翻译返回空结果`);
      }
    } catch (error) {
      console.error(`${service} 翻译失败:`, error.message);
      continue;
    }
  }
  
  console.log('所有翻译服务都失败了');
  return '所有翻译服务都不可用，请稍后重试';
}

// Google 翻译函数
async function translateWithGoogle(text) {
  console.log('Google 翻译 - 开始请求');
  const axios = require('axios');
  
  try {
    const params = {
      client: 'gtx',
      sl: config.translation.sourceLanguage,
      tl: config.translation.targetLanguage,
      dt: 't',
      q: text
    };
    console.log('Google 翻译 - 请求参数:', params);
    
    const response = await axios.get('https://translate.googleapis.com/translate_a/single', {
      params: params,
      timeout: config.translation.timeout
    });

    console.log('Google 翻译 - 响应状态:', response.status);
    console.log('Google 翻译 - 响应数据:', response.data);

    if (response.data && response.data[0] && response.data[0][0]) {
      const result = response.data[0][0][0];
      console.log('Google 翻译 - 成功获取结果:', result);
      return result;
    }
    
    console.log('Google 翻译 - 响应格式无效');
    throw new Error('Invalid Google response format');
  } catch (error) {
    console.error('Google 翻译 - 请求失败:', error.message);
    throw error;
  }
}

// 备用翻译方案1：微软翻译API
async function translateWithMicrosoft(text) {
  console.log('微软翻译 - 开始请求');
  const axios = require('axios');
  
  try {
    const requestData = [{ text: text }];
    const requestParams = {
      'api-version': '3.0',
      'from': config.translation.sourceLanguage,
      'to': config.translation.targetLanguage === 'zh' ? 'zh-Hans' : config.translation.targetLanguage
    };
    const headers = {
      'Ocp-Apim-Subscription-Key': config.apiKeys.microsoft,
      'Content-Type': 'application/json',
      'X-ClientTraceId': require('crypto').randomUUID()
    };
    
    console.log('微软翻译 - 请求参数:', requestParams);
    console.log('微软翻译 - 请求数据:', requestData);
    console.log('微软翻译 - API Key:', config.apiKeys.microsoft ? '已配置' : '未配置');
    
    const response = await axios.post('https://api.cognitive.microsofttranslator.com/translate', 
      requestData, 
      {
        params: requestParams,
        headers: headers,
        timeout: config.translation.timeout
      }
    );
    
    console.log('微软翻译 - 响应状态:', response.status);
    console.log('微软翻译 - 响应数据:', response.data);
    
    if (response.data && response.data[0] && response.data[0].translations && response.data[0].translations[0]) {
      const result = response.data[0].translations[0].text;
      console.log('微软翻译 - 成功获取结果:', result);
      return result;
    }
    
    console.log('微软翻译 - 响应格式无效');
    throw new Error('Invalid Microsoft response format');
  } catch (error) {
    console.error('微软翻译 - 请求失败:', error.message);
    throw error;
  }
}

// 备用翻译方案2：有道翻译（简单实现）
async function translateWithYoudao(text) {
  console.log('有道翻译 - 开始请求');
  const axios = require('axios');
  
  try {
    const params = {
      i: text,
      from: config.translation.sourceLanguage,
      to: config.translation.targetLanguage,
      doctype: 'json'
    };
    console.log('有道翻译 - 请求参数:', params);
    
    // 使用有道翻译的免费API
    const response = await axios.get('https://fanyi.youdao.com/translate', {
      params: params,
      timeout: config.translation.timeout
    });
    
    console.log('有道翻译 - 响应状态:', response.status);
    console.log('有道翻译 - 响应数据:', response.data);
    
    if (response.data && response.data.translateResult && response.data.translateResult[0] && response.data.translateResult[0][0]) {
      const result = response.data.translateResult[0][0].tgt;
      console.log('有道翻译 - 成功获取结果:', result);
      return result;
    }
    
    console.log('有道翻译 - 响应格式无效');
    throw new Error('Invalid Youdao response format');
  } catch (error) {
    console.error('有道翻译 - 请求失败:', error.message);
    return '翻译服务暂时不可用，请稍后重试';
  }
}

function showTranslationResult(originalText, translatedText) {
  console.log('=== 显示翻译结果窗口 ===');
  console.log('原文:', originalText);
  console.log('译文:', translatedText);
  
  try {
    const resultWin = createResultWindow();
    
    if (!resultWin) {
      console.error('无法创建翻译结果窗口');
      return;
    }
    
    // 创建简单的HTML内容
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>翻译结果</title>
          <style>
              body {
                  margin: 0;
                  padding: 20px;
                  background: rgba(0, 0, 0, 0.9);
                  color: white;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  border-radius: 12px;
                  overflow: hidden;
              }
              .original {
                  color: #d1d5db;
                  font-size: 12px;
                  margin-bottom: 10px;
                  padding-bottom: 10px;
                  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
              }
              .translation {
                  color: #ffffff;
                  font-size: 14px;
                  line-height: 1.5;
              }
              .close-btn {
                  position: absolute;
                  top: 10px;
                  right: 15px;
                  background: none;
                  border: none;
                  color: #9ca3af;
                  cursor: pointer;
                  font-size: 18px;
                  width: 24px;
                  height: 24px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border-radius: 50%;
              }
              .close-btn:hover {
                  color: white;
                  background: rgba(255, 255, 255, 0.1);
              }
          </style>
      </head>
      <body>
          <button class="close-btn" onclick="window.close()">×</button>
          <div class="original">原文: ${originalText}</div>
          <div class="translation">译文: ${translatedText}</div>
          <script>
              // 10秒后自动关闭
              setTimeout(() => {
                  window.close();
              }, 10000);
          </script>
      </body>
      </html>
    `;
    
    // 加载HTML内容
    resultWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    // 等待页面加载完成后显示窗口
    resultWin.webContents.on('did-finish-load', () => {
      console.log('翻译结果页面加载完成');
      
      // 获取鼠标位置并显示窗口
      const { x, y } = screen.getCursorScreenPoint();
      resultWin.setPosition(x + 20, y - 100);
      resultWin.show();
      resultWin.focus();
      
      console.log('翻译结果窗口已显示');
      
      // 10秒后自动关闭
      setTimeout(() => {
        if (resultWin && !resultWin.isDestroyed()) {
          resultWin.close();
          console.log('翻译结果窗口已自动关闭');
        }
      }, 10000);
    });
    
    // 处理加载错误
    resultWin.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('翻译结果页面加载失败:', errorCode, errorDescription);
    });
    
  } catch (error) {
    console.error('显示翻译结果时发生错误:', error);
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
    createTranslatorWindow();
  }
});

app.on('will-quit', () => {
  console.log('=== 应用退出 ===');
  // 注销所有快捷键
  globalShortcut.unregisterAll();
  
  // 重置状态
  isTranslating = false;
  lastClipboardText = '';
  
  // 关闭所有窗口
  if (resultWindow && !resultWindow.isDestroyed()) {
    resultWindow.close();
    resultWindow = null;
  }
  if (translatorWindow && !translatorWindow.isDestroyed()) {
    translatorWindow.close();
    translatorWindow = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    mainWindow = null;
  }
});

