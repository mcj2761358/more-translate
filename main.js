const { app, BrowserWindow, globalShortcut, clipboard, ipcMain, screen, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');

// 加载环境变量配置
require('dotenv').config();

// 引入日志系统
const logger = require('./logger');

// 加载基础配置
let config = require('./config');

// 在应用启动时合并配置
function initializeConfig() {
  logger.log('=== 初始化配置 ===');
  
  // 检查环境变量是否加载
  logger.log('环境变量检查:');
  logger.log('- AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '已设置' : '未设置');
  logger.log('- AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '已设置' : '未设置');
  logger.log('- BAIDU_AK:', process.env.BAIDU_AK ? '已设置' : '未设置');
  logger.log('- BAIDU_SK:', process.env.BAIDU_SK ? '已设置' : '未设置');
  
  // 尝试从用户配置文件加载API配置
  try {
    const userConfig = loadApiConfig();
    if (userConfig && Object.keys(userConfig).length > 0) {
      logger.log('从用户配置文件加载API密钥');
      
      // 合并API密钥配置
      if (userConfig.microsoft) config.apiKeys.microsoft = userConfig.microsoft;
      if (userConfig.deepl) config.apiKeys.deepl = userConfig.deepl;
      if (userConfig.baidu) {
        config.apiKeys.baidu.ak = userConfig.baidu.ak || config.apiKeys.baidu.ak;
        config.apiKeys.baidu.sk = userConfig.baidu.sk || config.apiKeys.baidu.sk;
      }
      if (userConfig.tencent) {
        config.apiKeys.tencent.secretId = userConfig.tencent.secretId || config.apiKeys.tencent.secretId;
        config.apiKeys.tencent.secretKey = userConfig.tencent.secretKey || config.apiKeys.tencent.secretKey;
        config.apiKeys.tencent.region = userConfig.tencent.region || config.apiKeys.tencent.region;
      }
      if (userConfig.aws) {
        config.apiKeys.aws.accessKeyId = userConfig.aws.accessKeyId || config.apiKeys.aws.accessKeyId;
        config.apiKeys.aws.secretAccessKey = userConfig.aws.secretAccessKey || config.apiKeys.aws.secretAccessKey;
        config.apiKeys.aws.region = userConfig.aws.region || config.apiKeys.aws.region;
      }
    }
  } catch (error) {
    logger.log('用户配置文件加载失败，使用默认配置:', error.message);
  }
  
  logger.log('配置初始化完成');
  logger.log('最终API密钥状态:');
  logger.log('- 百度 AK:', config.apiKeys.baidu.ak ? '已配置' : '未配置');
  logger.log('- 百度 SK:', config.apiKeys.baidu.sk ? '已配置' : '未配置');
  logger.log('- AWS Access Key:', config.apiKeys.aws.accessKeyId ? '已配置' : '未配置');
  logger.log('- AWS Secret Key:', config.apiKeys.aws.secretAccessKey ? '已配置' : '未配置');
}

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
  logger.info(message);
  
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
  logger.info(`[DRAG] ${message}`);
  
  // 通知主窗口更新日志显示
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('drag-log-update', logMessage);
  }
}

let mainWindow;
let translatorWindow;
let resultWindow; // 新增：翻译结果窗口
let settingsWindow; // 新增：设置窗口
let progressWindow; // 新增：进度提示窗口
let lastClipboardText = ''; // 新增：记录上次剪贴板内容
let isTranslating = false; // 新增：翻译状态标志
let dragLogs = []; // 新增：拖动日志
let currentShortcut = config.shortcuts.translate; // 当前快捷键

function createMainWindow() {
  writeLog('=== 创建主窗口 ===');
  
  // 检查是否为开发模式或调试模式
  const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
  const isDebug = process.argv.includes('--debug') || isDev;
  
  // 创建主窗口
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    show: isDebug, // 在开发模式或调试模式下显示
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true // 始终启用开发者工具
    },
    title: isDebug ? 'More Translator - 调试模式' : 'More Translator'
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
  
  // 在调试模式下打开开发者工具
  if (isDebug) {
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
  
  // 添加菜单栏用于调试
  if (!isDev) {
    const { Menu } = require('electron');
    const template = [
      {
        label: '调试',
        submenu: [
          {
            label: '显示开发者工具',
            accelerator: 'CmdOrCtrl+Shift+I',
            click: () => {
              if (mainWindow) {
                mainWindow.webContents.openDevTools();
                mainWindow.show();
              }
            }
          },
          {
            label: '重新加载',
            accelerator: 'CmdOrCtrl+R',
            click: () => {
              if (mainWindow) {
                mainWindow.webContents.reload();
              }
            }
          },
          {
            label: '显示主窗口',
            click: () => {
              if (mainWindow) {
                mainWindow.show();
              }
            }
          }
        ]
      }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
  
  writeLog('主窗口创建完成');
}

function createTranslatorWindow() {
  writeLog('=== 创建翻译窗口 ===');
  
  // 创建翻译按钮窗口
  translatorWindow = new BrowserWindow({
    width: 220, // 增加宽度以容纳翻译按钮、设置按钮和关闭按钮
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
  logger.info('=== 创建翻译结果窗口 ===');
  
  // 检查现有窗口是否有效，如果有效则关闭
  if (resultWindow && !resultWindow.isDestroyed()) {
    logger.info('关闭现有结果窗口');
    resultWindow.close();
    resultWindow = null;
  }
  
  // 创建翻译结果窗口
  resultWindow = new BrowserWindow({
    width: 320,
    height: 200,
    minWidth: 280,
    minHeight: 180,
    maxWidth: 800,
    maxHeight: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true, // 启用调整大小
    movable: true, // 启用系统拖动作为备用
    minimizable: false,
    maximizable: false,
    show: false,
    skipTaskbar: true,
    focusable: true,
    hasShadow: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  logger.info('翻译结果窗口创建完成');
  
  // 设置窗口可见性
  resultWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  resultWindow.setAlwaysOnTop(true, 'screen-saver');
  
  // 监听窗口关闭事件
  resultWindow.on('closed', () => {
    logger.info('翻译结果窗口已关闭');
    resultWindow = null;
  });
  
  return resultWindow;
}

function createSettingsWindow() {
  logger.info('=== 创建设置窗口 ===');
  
  // 检查现有窗口是否有效，如果有效则显示
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }
  
  // 创建设置窗口
  settingsWindow = new BrowserWindow({
    width: 700,
    height: 500,
    minWidth: 600,
    minHeight: 400,
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    resizable: true,
    movable: true,
    minimizable: true,
    maximizable: true,
    show: false,
    skipTaskbar: false,
    focusable: true,
    title: '翻译工具设置',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  logger.info('设置窗口创建完成');
  settingsWindow.loadFile('settings.html');
  
  // 监听窗口关闭事件
  settingsWindow.on('closed', () => {
    logger.info('设置窗口已关闭');
    settingsWindow = null;
  });
  
  // 窗口准备显示时显示
  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
    settingsWindow.focus();
  });
  
  return settingsWindow;
}

function createProgressWindow() {
  logger.info('=== 创建进度窗口 ===');
  
  // 如果进度窗口已存在，先关闭
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.close();
  }
  
  // 获取屏幕尺寸
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  progressWindow = new BrowserWindow({
    width: 280,
    height: 120,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    x: Math.round((screenWidth - 280) / 2), // 居中显示
    y: Math.round((screenHeight - 120) / 2)
  });

  progressWindow.loadFile('progress.html');
  
  // 设置窗口属性
  progressWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  progressWindow.setAlwaysOnTop(true, 'screen-saver');
  
  progressWindow.on('closed', () => {
    logger.info('进度窗口已关闭');
    progressWindow = null;
  });
  
  // 页面加载完成后显示窗口
  progressWindow.webContents.once('did-finish-load', () => {
    progressWindow.show();
    logger.info('进度窗口显示');
  });
  
  logger.info('进度窗口创建完成');
}

function updateProgress(status, text, detail = '', progress = 0) {
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.webContents.send('update-progress', {
      status,
      text,
      detail,
      progress
    });
  }
}

function closeProgressWindow() {
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.webContents.send('close-progress');
    setTimeout(() => {
      if (progressWindow && !progressWindow.isDestroyed()) {
        progressWindow.close();
      }
    }, 1000); // 延迟1秒关闭，让用户看到最终状态
  }
}

function showTranslatorButton(x, y) {
  logger.info('=== 显示翻译按钮 ===');
  logger.info('位置:', { x, y });
  
  if (translatorWindow && !isTranslating) {
    // 调整位置，确保按钮在合适的位置显示
    translatorWindow.setPosition(x + 10, y - 50);
    translatorWindow.show();
    translatorWindow.focus(); // 确保窗口获得焦点
    
    logger.info('翻译按钮窗口已显示');
    
    // 自动隐藏
    setTimeout(() => {
      if (translatorWindow && translatorWindow.isVisible() && !isTranslating) {
        translatorWindow.hide();
        logger.info('翻译按钮窗口已自动隐藏');
      }
    }, config.window.translatorButtonTimeout);
  } else {
    console.error('翻译按钮窗口未创建或正在翻译中');
  }
}

function showTranslatorButtonOnStartup() {
  logger.info('=== 启动时显示翻译按钮 ===');
  
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
    
    logger.info('翻译按钮已显示在屏幕右上角:', { x, y });
    
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

// 新增：通过快捷键触发翻译
async function triggerTranslationFromShortcut() {
  logger.info('=== 通过快捷键触发翻译 ===');
  
  try {
    // 设置翻译状态
    isTranslating = true;
    
    // 创建并显示进度窗口
    createProgressWindow();
    updateProgress('copying', '正在复制选中文本...', '', 10);
    
    // 保存当前剪贴板内容，以便后续恢复
    const originalClipboard = clipboard.readText();
    logger.info('保存原始剪贴板内容:', originalClipboard);
    
    // 使用更可靠的AppleScript来复制选中文本
    const { exec } = require('child_process');
    const copyScript = `
      tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
      end tell
      
      tell application frontApp
        activate
      end tell
      
      delay 0.1
      
      tell application "System Events"
        tell process frontApp
          try
            -- 模拟 Cmd+C 复制操作
            key code 8 using command down
            delay 0.2
            return "success"
          on error errMsg
            return "failed: " & errMsg
          end try
        end tell
      end tell
    `;
    
    logger.info('执行复制选中文本的AppleScript...');
    exec(`osascript -e '${copyScript}'`, async (error, stdout, stderr) => {
      try {
        if (error) {
          console.error('AppleScript执行失败:', error);
          updateProgress('error', '复制失败', '无法复制选中文本，请确保有文本被选中', 0);
          setTimeout(() => {
            closeProgressWindow();
            showTranslationResult('', [{
              service: 'system',
              result: '无法复制选中文本，请确保有文本被选中',
              success: false
            }]);
          }, 2000);
          return;
        }
        
        const scriptResult = stdout.trim();
        logger.info('AppleScript执行结果:', scriptResult);
        
        if (scriptResult.startsWith('failed:')) {
          console.error('复制操作失败:', scriptResult);
          updateProgress('error', '复制失败', '请确保有文本被选中', 0);
          setTimeout(() => {
            closeProgressWindow();
            showTranslationResult('', [{
              service: 'system',
              result: '复制失败，请确保有文本被选中',
              success: false
            }]);
          }, 2000);
          return;
        }
        
        // 等待一段时间确保剪贴板已更新
        setTimeout(async () => {
          try {
            const newClipboard = clipboard.readText();
            logger.info('复制后的剪贴板内容:', newClipboard);
            
            // 检查剪贴板是否有新内容
            if (!newClipboard || newClipboard.trim().length === 0) {
              logger.info('剪贴板为空');
              updateProgress('error', '未检测到文本', '请先选中要翻译的文本', 0);
              setTimeout(() => {
                closeProgressWindow();
                showTranslationResult('', [{
                  service: 'system',
                  result: '没有检测到选中的文本，请先选中要翻译的文本',
                  success: false
                }]);
              }, 2000);
              return;
            }
            
            // 检查是否真的复制了新内容（与原剪贴板内容不同）
            if (newClipboard === originalClipboard) {
              logger.info('剪贴板内容未变化，可能没有选中文本');
              // 仍然尝试翻译，可能用户就是想翻译剪贴板中的内容
            }
            
            const textToTranslate = newClipboard.trim();
            logger.info('开始翻译文本:', textToTranslate);
            
            updateProgress('copying', '复制完成', `已复制: ${textToTranslate.substring(0, 20)}${textToTranslate.length > 20 ? '...' : ''}`, 30);
            
            setTimeout(async () => {
              updateProgress('translating', '开始翻译...', '正在连接翻译服务', 40);
              
              try {
                // 执行翻译，传递进度回调
                const translation = await translateText(textToTranslate, (status, text, detail, progress) => {
                  updateProgress(status, text, detail, progress);
                });
                logger.info('翻译结果:', translation);
                
                updateProgress('success', '翻译完成', '正在显示结果...', 100);
                
                setTimeout(() => {
                  closeProgressWindow();
                  // 显示翻译结果
                  showTranslationResult(textToTranslate, translation);
                }, 1000);
                
              } catch (error) {
                console.error('翻译失败:', error);
                updateProgress('error', '翻译失败', error.message, 0);
                setTimeout(() => {
                  closeProgressWindow();
                  showTranslationResult('', [{
                    service: 'system',
                    result: '翻译失败: ' + error.message,
                    success: false
                  }]);
                }, 2000);
              }
            }, 500);
            
            
          } catch (error) {
            console.error('翻译过程中发生错误:', error);
            updateProgress('error', '翻译过程出错', error.message, 0);
            setTimeout(() => {
              closeProgressWindow();
              showTranslationResult('', [{
                service: 'system',
                result: '翻译失败，请稍后重试: ' + error.message,
                success: false
              }]);
            }, 2000);
          }
        }, 400); // 增加等待时间确保复制完成
        
      } catch (error) {
        console.error('处理复制结果时发生错误:', error);
        updateProgress('error', '处理失败', error.message, 0);
        setTimeout(() => {
          closeProgressWindow();
          showTranslationResult('', [{
            service: 'system',
            result: '处理复制结果失败: ' + error.message,
            success: false
          }]);
        }, 2000);
      } finally {
        // 重置翻译状态
        isTranslating = false;
      }
    });
    
  } catch (error) {
    console.error('快捷键翻译失败:', error);
    updateProgress('error', '快捷键翻译失败', error.message, 0);
    setTimeout(() => {
      closeProgressWindow();
      showTranslationResult('', [{
        service: 'system',
        result: '快捷键翻译失败: ' + error.message,
        success: false
      }]);
    }, 2000);
    isTranslating = false;
  }
}

// 检查辅助功能权限
function checkAccessibilityPermission() {
  if (process.platform === 'darwin') {
    const isTrusted = systemPreferences.isTrustedAccessibilityClient(false);
    if (!isTrusted) {
      logger.info('需要辅助功能权限');
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
  logger.log('=== 应用启动 ===');
  
  // 初始化日志系统
  logger.init();
  
  // 初始化配置
  initializeConfig();
  
  logger.log('创建主窗口...');
  createMainWindow();
  logger.log('创建翻译窗口...');
  createTranslatorWindow();

  // 检查权限
  logger.info('检查辅助功能权限...');
  const hasPermission = checkAccessibilityPermission();
  logger.info('权限检查结果:', hasPermission);
  
  if (hasPermission) {
    logger.info('=== 注册全局快捷键 ===');
    logger.info('快捷键:', config.shortcuts.translate);
    
    // 注册全局快捷键 CMD+Shift+T 来直接触发翻译
    globalShortcut.register(config.shortcuts.translate, () => {
      logger.info('=== 翻译快捷键被触发 ===');
      
      // 如果正在翻译中，忽略新的快捷键
      if (isTranslating) {
        logger.info('正在翻译中，忽略新的快捷键');
        return;
      }
      
      // 直接触发翻译功能
      triggerTranslationFromShortcut();
    });
    
    logger.info('快捷键注册成功');
  } else {
    console.error('没有辅助功能权限，无法注册快捷键');
  }

  logger.info('=== 注册IPC处理器 ===');
  // 监听来自渲染进程的消息
  ipcMain.handle('translate-text', async (event, text) => {
    logger.info('=== 收到翻译请求 ===');
    logger.info('要翻译的文本:', text);
    
    // 设置翻译状态
    isTranslating = true;
    
    try {
      const translation = await translateText(text);
      logger.info('翻译结果:', translation);
      
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
    logger.info('=== 隐藏翻译按钮 ===');
    hideTranslatorButton();
  });

  // 新增：退出应用
  ipcMain.handle('quit-app', () => {
    logger.info('=== 收到退出应用请求 ===');
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
    logger.info('=== 调整翻译窗口大小以显示对话框 ===');
    if (translatorWindow && !translatorWindow.isDestroyed()) {
      // 调整窗口大小以容纳对话框 - 增加尺寸确保完整显示
      translatorWindow.setSize(500, 400);
      translatorWindow.center(); // 居中显示
    }
  });

  // 新增：恢复翻译窗口大小
  ipcMain.handle('restore-translator-size', () => {
    logger.info('=== 恢复翻译窗口大小 ===');
    if (translatorWindow && !translatorWindow.isDestroyed()) {
      // 恢复原始大小
      translatorWindow.setSize(120, 40);
    }
  });

  // 新增：复制选中文本到剪贴板并获取
  ipcMain.handle('copy-and-get-selected-text', () => {
    logger.info('=== 复制选中文本到剪贴板并获取 ===');
    
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      // 先保存当前剪贴板内容
      const originalClipboard = clipboard.readText();
      logger.info('原始剪贴板内容:', originalClipboard);
      
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
      
      logger.info('执行复制操作...');
      exec(`osascript -e '${copyScript}'`, (error, stdout, stderr) => {
        if (error) {
          logger.info('复制操作失败:', error.message);
          // 复制失败，尝试直接获取选中文本
          getSelectedTextDirectly(resolve, originalClipboard);
        } else {
          logger.info('复制操作结果:', stdout.trim());
          
          // 等待一小段时间确保复制完成
          setTimeout(() => {
            const newClipboard = clipboard.readText();
            logger.info('复制后的剪贴板内容:', newClipboard);
            
            // 检查剪贴板是否有新内容
            if (newClipboard && newClipboard !== originalClipboard && newClipboard.trim().length > 0) {
              logger.info('成功获取复制的文本:', newClipboard);
              resolve(newClipboard.trim());
            } else {
              logger.info('剪贴板没有新内容，尝试直接获取选中文本');
              // 如果剪贴板没有变化，尝试直接获取
              getSelectedTextDirectly(resolve, originalClipboard);
            }
          }, 200); // 等待200ms确保复制完成
        }
      });
    });
  });

  ipcMain.handle('get-selected-text', () => {
    logger.info('=== 获取选中文本 ===');
    
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
        logger.info('AppleScript获取选中文本失败:', error.message);
        // 如果AppleScript失败，使用回退文本或剪贴板
        const clipboardText = fallbackText || clipboard.readText();
        logger.info('回退到剪贴板文本:', clipboardText);
        resolve(clipboardText);
      } else {
        const selectedText = stdout.trim();
        logger.info('AppleScript获取的选中文本:', selectedText);
        
        if (selectedText && selectedText.length > 0) {
          resolve(selectedText);
        } else {
          // 如果AppleScript返回空，使用回退文本或剪贴板
          const clipboardText = fallbackText || clipboard.readText();
          logger.info('AppleScript返回空，回退到剪贴板文本:', clipboardText);
          resolve(clipboardText);
        }
      }
    });
  }

  ipcMain.handle('check-permission', () => {
    logger.info('=== 检查权限 ===');
    const hasPermission = checkAccessibilityPermission();
    logger.info('权限状态:', hasPermission);
    return hasPermission;
  });
  
  // 将窗口带到前面
  ipcMain.handle('bring-to-front', () => {
    logger.info('=== 将翻译窗口带到前面 ===');
    if (translatorWindow) {
      translatorWindow.setAlwaysOnTop(true, 'screen-saver');
      translatorWindow.show();
      translatorWindow.focus();
      logger.info('翻译窗口已带到前面');
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
  
  // 新增：移动翻译结果窗口
  ipcMain.handle('move-result-window', (event, deltaX, deltaY) => {
    logger.info('收到移动结果窗口请求:', { deltaX, deltaY });
    if (resultWindow && !resultWindow.isDestroyed()) {
      const [currentX, currentY] = resultWindow.getPosition();
      const newX = currentX + deltaX;
      const newY = currentY + deltaY;
      
      logger.info(`当前位置: (${currentX}, ${currentY}), 新位置: (${newX}, ${newY})`);
      
      // 直接设置新位置，不限制边界，允许拖动到任意位置
      resultWindow.setPosition(newX, newY);
      logger.info(`翻译结果窗口移动到: x=${newX}, y=${newY}`);
    } else {
      logger.info('结果窗口不存在或已销毁');
    }
  });
  
  // 新增：调整翻译结果窗口大小
  ipcMain.handle('resize-result-window', (event, newWidth, newHeight) => {
    if (resultWindow && !resultWindow.isDestroyed()) {
      // 限制最小和最大尺寸
      const constrainedWidth = Math.max(280, Math.min(newWidth, 800));
      const constrainedHeight = Math.max(180, Math.min(newHeight, 600));
      
      resultWindow.setSize(constrainedWidth, constrainedHeight);
    }
  });
  
  // 新增：获取翻译结果窗口大小
  ipcMain.handle('get-result-window-size', () => {
    if (resultWindow && !resultWindow.isDestroyed()) {
      const [width, height] = resultWindow.getSize();
      return { width, height };
    }
    return { width: 320, height: 200 };
  });
  
  // 新增：打开设置窗口
  ipcMain.handle('open-settings', () => {
    logger.info('=== 收到打开设置窗口请求 ===');
    createSettingsWindow();
  });
  
  // 新增：获取当前设置
  ipcMain.handle('get-settings', () => {
    logger.info('=== 获取当前设置 ===');
    return {
      shortcuts: {
        translate: currentShortcut
      }
    };
  });
  
  // 新增：保存快捷键设置
  ipcMain.handle('save-shortcut', (event, newShortcut) => {
    logger.info('=== 保存快捷键设置 ===', newShortcut);
    
    try {
      // 验证快捷键格式
      if (!newShortcut || typeof newShortcut !== 'string') {
        return { success: false, error: '无效的快捷键格式' };
      }
      
      // 注销旧的快捷键
      if (currentShortcut) {
        globalShortcut.unregister(currentShortcut);
        logger.info('已注销旧快捷键:', currentShortcut);
      }
      
      // 注册新的快捷键
      const success = globalShortcut.register(newShortcut, () => {
        logger.info('=== 新快捷键被触发 ===', newShortcut);
        
        // 如果正在翻译中，忽略新的快捷键
        if (isTranslating) {
          logger.info('正在翻译中，忽略新的快捷键');
          return;
        }
        
        // 直接触发翻译功能
        triggerTranslationFromShortcut();
      });
      
      if (success) {
        currentShortcut = newShortcut;
        logger.info('新快捷键注册成功:', newShortcut);
        
        // 这里可以保存到配置文件或用户偏好设置
        // 暂时只保存在内存中
        
        return { success: true };
      } else {
        console.error('快捷键注册失败:', newShortcut);
        
        // 如果注册失败，恢复旧的快捷键
        if (currentShortcut) {
          globalShortcut.register(currentShortcut, () => {
            triggerTranslationFromShortcut();
          });
        }
        
        return { success: false, error: '快捷键已被其他应用占用或格式无效' };
      }
    } catch (error) {
      console.error('保存快捷键时发生错误:', error);
      return { success: false, error: error.message };
    }
  });
  
  // API配置管理
  const configPath = path.join(app.getPath('userData'), 'api-config.json');

  function loadApiConfig() {
    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.error('加载API配置失败:', error);
    }
    return {};
  }

  function saveApiConfig(apiConfig) {
    try {
      fs.writeFileSync(configPath, JSON.stringify(apiConfig, null, 2));
      
      // 更新运行时配置
      config.apiKeys = {
        microsoft: apiConfig.microsoft || '',
        deepl: apiConfig.deepl || '',
        baidu: {
          ak: apiConfig.baidu?.ak || '',
          sk: apiConfig.baidu?.sk || ''
        },
        tencent: {
          secretId: apiConfig.tencent?.secretId || '',
          secretKey: apiConfig.tencent?.secretKey || '',
          region: apiConfig.tencent?.region || 'ap-beijing'
        },
        aws: {
          accessKeyId: apiConfig.aws?.accessKeyId || '',
          secretAccessKey: apiConfig.aws?.secretAccessKey || '',
          region: apiConfig.aws?.region || 'us-east-1'
        }
      };
      
      logger.info('API配置已更新:', config.apiKeys);
      return true;
    } catch (error) {
      console.error('保存API配置失败:', error);
      return false;
    }
  }

  // 添加API配置相关的IPC处理器
  ipcMain.handle('get-api-config', () => {
    logger.info('=== 获取API配置 ===');
    return loadApiConfig();
  });

  ipcMain.handle('save-api-config', (event, apiConfig) => {
    logger.info('=== 保存API配置 ===', apiConfig);
    try {
      const success = saveApiConfig(apiConfig);
      return { success, error: success ? null : '保存失败' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('test-api-config', async (event, apiConfig) => {
    logger.log('=== 测试API配置 ===');
    try {
      const availableServices = ['Google翻译', '有道翻译']; // 默认免费服务
      
      // 测试百度翻译
      if (apiConfig.baidu?.ak && apiConfig.baidu?.sk) {
        try {
          // 这里可以添加实际的API测试逻辑
          // 暂时只检查密钥是否存在
          availableServices.push('百度翻译');
        } catch (error) {
          console.error('百度翻译测试失败:', error);
        }
      }
      
      // 测试其他服务
      if (apiConfig.deepl) availableServices.push('DeepL');
      if (apiConfig.microsoft) availableServices.push('微软翻译');
      if (apiConfig.aws?.accessKeyId && apiConfig.aws?.secretAccessKey) availableServices.push('Amazon翻译');
      if (apiConfig.tencent?.secretId && apiConfig.tencent?.secretKey) availableServices.push('腾讯翻译');
      
      return { 
        success: true, 
        availableServices: availableServices
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 日志相关的IPC处理器
  ipcMain.handle('get-log-file-path', () => {
    logger.log('=== 获取日志文件路径 ===');
    return logger.getLogFile();
  });

  ipcMain.handle('read-log', (event, lines = 100) => {
    logger.log('=== 读取日志文件 ===', `最近${lines}行`);
    return logger.readLog(lines);
  });

  ipcMain.handle('clear-log', () => {
    logger.log('=== 清空日志文件 ===');
    logger.clearLog();
    return true;
  });

  // 在应用启动时加载用户API配置
  const userApiConfig = loadApiConfig();
  if (Object.keys(userApiConfig).length > 0) {
    // 合并用户配置到默认配置
    config.apiKeys = {
      ...config.apiKeys,
      microsoft: userApiConfig.microsoft || config.apiKeys.microsoft,
      deepl: userApiConfig.deepl || config.apiKeys.deepl,
      baidu: {
        ak: userApiConfig.baidu?.ak || config.apiKeys.baidu.ak,
        sk: userApiConfig.baidu?.sk || config.apiKeys.baidu.sk
      },
      tencent: {
        secretId: userApiConfig.tencent?.secretId || config.apiKeys.tencent.secretId,
        secretKey: userApiConfig.tencent?.secretKey || config.apiKeys.tencent.secretKey,
        region: userApiConfig.tencent?.region || config.apiKeys.tencent.region
      },
      aws: {
        accessKeyId: userApiConfig.aws?.accessKeyId || config.apiKeys.aws.accessKeyId,
        secretAccessKey: userApiConfig.aws?.secretAccessKey || config.apiKeys.aws.secretAccessKey,
        region: userApiConfig.aws?.region || config.apiKeys.aws.region
      }
    };
    logger.info('已加载用户API配置');
  }
  
  logger.info('应用初始化完成');
});

// 翻译函数 - 同时调用所有免费服务
async function translateText(text, progressCallback = null) {
  logger.log('=== 开始翻译流程 ===');
  logger.log('输入文本:', text);
  
  // 详细的配置调试信息
  logger.log('=== 配置调试信息 ===');
  logger.log('当前工作目录:', process.cwd());
  logger.log('应用路径:', app.getAppPath());
  logger.log('用户数据目录:', app.getPath('userData'));
  logger.log('是否为开发模式:', process.env.NODE_ENV === 'development');
  logger.log('是否为打包应用:', app.isPackaged);
  
  // 检查配置对象
  logger.log('配置对象存在:', !!config);
  if (config) {
    logger.log('免费翻译服务:', config.freeTranslationServices);
    logger.log('翻译服务:', config.translationServices);
    logger.log('源语言:', config.translation?.sourceLanguage);
    logger.log('目标语言:', config.translation?.targetLanguage);
    logger.log('超时设置:', config.translation?.timeout);
    
    // 检查API密钥配置
    logger.log('API密钥配置:');
    logger.log('- Google: 免费服务');
    logger.log('- 有道: 免费服务');
    logger.log('- 百度 AK:', config.apiKeys?.baidu?.ak ? '已配置' : '未配置');
    logger.log('- 百度 SK:', config.apiKeys?.baidu?.sk ? '已配置' : '未配置');
    logger.log('- 微软:', config.apiKeys?.microsoft ? '已配置' : '未配置');
    logger.log('- DeepL:', config.apiKeys?.deepl ? '已配置' : '未配置');
    logger.log('- AWS Access Key:', config.apiKeys?.aws?.accessKeyId ? '已配置' : '未配置');
    logger.log('- AWS Secret Key:', config.apiKeys?.aws?.secretAccessKey ? '已配置' : '未配置');
    logger.log('- 腾讯 Secret ID:', config.apiKeys?.tencent?.secretId ? '已配置' : '未配置');
    logger.log('- 腾讯 Secret Key:', config.apiKeys?.tencent?.secretKey ? '已配置' : '未配置');
  } else {
    logger.error('配置对象不存在！');
  }
  
  // 检查网络连接
  logger.log('=== 网络连接检查 ===');
  try {
    const axios = require('axios');
    const testResponse = await axios.get('https://www.google.com', { timeout: 5000 });
    logger.log('网络连接正常，状态码:', testResponse.status);
  } catch (error) {
    logger.error('网络连接异常:', error.message);
  }
  
  logger.log('配置的免费翻译服务:', config.freeTranslationServices);
  
  const totalServices = config.freeTranslationServices.length;
  let completedServices = 0;
  
  // 同时调用所有免费翻译服务
  const translationPromises = config.freeTranslationServices.map(async (service) => {
    try {
      logger.info(`\n--- 调用 ${service} 翻译服务 ---`);
      
      // 更新进度
      if (progressCallback) {
        progressCallback('translating', `正在使用${getServiceDisplayName(service)}翻译...`, `${completedServices}/${totalServices} 服务已完成`, 50 + (completedServices / totalServices) * 40);
      }
      
      let result;
      
      switch (service) {
        case 'google':
          result = await translateWithGoogle(text);
          break;
        case 'youdao':
          result = await translateWithYoudao(text);
          break;
        case 'baidu':
          if (config.apiKeys.baidu.ak && config.apiKeys.baidu.sk) {
            result = await translateWithBaidu(text);
          } else {
            throw new Error('Baidu API credentials not configured');
          }
          break;
        case 'deepl_free':
          if (config.apiKeys.deepl) {
            result = await translateWithDeepL(text);
          } else {
            throw new Error('DeepL API key not configured');
          }
          break;
        case 'microsoft':
          if (config.apiKeys.microsoft) {
            result = await translateWithMicrosoft(text);
          } else {
            throw new Error('Microsoft API key not configured');
          }
          break;
        case 'amazon':
          logger.info("Config=" + JSON.stringify(config.apiKeys))
          if (config.apiKeys.aws.accessKeyId && config.apiKeys.aws.secretAccessKey) {
            result = await translateWithAmazon(text);
          } else {
            throw new Error('AWS credentials not configured');
          }
          break;
        case 'tencent':
          if (config.apiKeys.tencent.secretId && config.apiKeys.tencent.secretKey) {
            result = await translateWithTencent(text);
          } else {
            throw new Error('Tencent API credentials not configured');
          }
          break;
        default:
          throw new Error(`Unknown translation service: ${service}`);
      }
      
      completedServices++;
      return {
        service: service,
        result: result,
        success: true
      };
    } catch (error) {
      console.error(`${service} 翻译失败:`, error.message);
      completedServices++;
      return {
        service: service,
        result: '翻译失败',
        success: false,
        error: error.message
      };
    }
  });
  
  // 等待所有翻译服务完成
  const results = await Promise.all(translationPromises);
  logger.info('所有翻译服务结果:', results);
  
  return results;
}

// 备用翻译函数 - 按优先级尝试（保持向后兼容）
async function translateTextFallback(text) {
  logger.info('=== 开始备用翻译流程 ===');
  logger.info('输入文本:', text);
  logger.info('配置的翻译服务:', config.translationServices);
  
  // 按配置的优先级尝试不同的翻译服务
  for (const service of config.translationServices) {
    logger.info(`\n--- 尝试 ${service} 翻译服务 ---`);
    
    try {
      let result;
      
      switch (service) {
        case 'google':
          logger.info('调用 Google 翻译...');
          result = await translateWithGoogle(text);
          break;
        case 'microsoft':
          if (config.apiKeys.microsoft) {
            logger.info('调用微软翻译...');
            result = await translateWithMicrosoft(text);
          } else {
            logger.info('Microsoft API key not configured, skipping...');
            continue;
          }
          break;
        case 'youdao':
          logger.info('调用有道翻译...');
          result = await translateWithYoudao(text);
          break;
        case 'baidu':
          if (config.apiKeys.baidu.ak && config.apiKeys.baidu.sk) {
            logger.info('调用百度翻译...');
            result = await translateWithBaidu(text);
          } else {
            logger.info('Baidu API credentials not configured, skipping...');
            continue;
          }
          break;
        case 'deepl_free':
          if (config.apiKeys.deepl) {
            logger.info('调用 DeepL 翻译...');
            result = await translateWithDeepL(text);
          } else {
            logger.info('DeepL API key not configured, skipping...');
            continue;
          }
          break;
        case 'amazon':
          if (config.apiKeys.aws.accessKeyId && config.apiKeys.aws.secretAccessKey) {
            logger.info('调用 Amazon 翻译...');
            result = await translateWithAmazon(text);
          } else {
            logger.info('AWS credentials not configured, skipping...');
            continue;
          }
          break;
        case 'tencent':
          if (config.apiKeys.tencent.secretId && config.apiKeys.tencent.secretKey) {
            logger.info('调用腾讯翻译...');
            result = await translateWithTencent(text);
          } else {
            logger.info('Tencent API credentials not configured, skipping...');
            continue;
          }
          break;
        default:
          logger.info(`Unknown translation service: ${service}`);
          continue;
      }
      
      if (result) {
        logger.info(`${service} 翻译成功:`, result);
        return result;
      } else {
        logger.info(`${service} 翻译返回空结果`);
      }
    } catch (error) {
      console.error(`${service} 翻译失败:`, error.message);
      continue;
    }
  }
  
  logger.info('所有翻译服务都失败了');
  return '所有翻译服务都不可用，请稍后重试';
}

// Google 翻译函数
async function translateWithGoogle(text) {
  logger.info('Google 翻译 - 开始请求');
  
  try {
    // 尝试加载axios，如果失败则使用内置的https模块
    let axios;
    try {
      axios = require('axios');
    } catch (axiosError) {
      logger.info('axios模块加载失败，使用内置https模块:', axiosError.message);
      return await translateWithGoogleFallback(text);
    }
    
    const params = {
      client: 'gtx',
      sl: config.translation.sourceLanguage,
      tl: config.translation.targetLanguage,
      dt: 't',
      q: text
    };
    logger.info('Google 翻译 - 请求参数:', params);
    
    const response = await axios.get('https://translate.googleapis.com/translate_a/single', {
      params: params,
      timeout: config.translation.timeout
    });

    logger.info('Google 翻译 - 响应状态:', response.status);
    logger.info('Google 翻译 - 响应数据:', response.data);

    if (response.data && response.data[0] && response.data[0][0]) {
      const result = response.data[0][0][0];
      logger.info('Google 翻译 - 成功获取结果:', result);
      return result;
    }
    
    logger.info('Google 翻译 - 响应格式无效');
    throw new Error('Invalid Google response format');
  } catch (error) {
    console.error('Google 翻译 - 请求失败:', error.message);
    throw error;
  }
}

// Google 翻译备用方案（使用内置https模块）
async function translateWithGoogleFallback(text) {
  logger.info('Google 翻译备用方案 - 使用内置https模块');
  const https = require('https');
  const querystring = require('querystring');
  
  return new Promise((resolve, reject) => {
    const params = querystring.stringify({
      client: 'gtx',
      sl: config.translation.sourceLanguage,
      tl: config.translation.targetLanguage,
      dt: 't',
      q: text
    });
    
    const options = {
      hostname: 'translate.googleapis.com',
      path: `/translate_a/single?${params}`,
      method: 'GET',
      timeout: config.translation.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result && result[0] && result[0][0]) {
            const translation = result[0][0][0];
            logger.info('Google 翻译备用方案 - 成功获取结果:', translation);
            resolve(translation);
          } else {
            reject(new Error('Invalid Google response format'));
          }
        } catch (parseError) {
          reject(new Error('Failed to parse Google response'));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// 备用翻译方案1：微软翻译API
async function translateWithMicrosoft(text) {
  logger.info('微软翻译 - 开始请求');
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
    
    logger.info('微软翻译 - 请求参数:', requestParams);
    logger.info('微软翻译 - 请求数据:', requestData);
    logger.info('微软翻译 - API Key:', config.apiKeys.microsoft ? '已配置' : '未配置');
    
    const response = await axios.post('https://api.cognitive.microsofttranslator.com/translate', 
      requestData, 
      {
        params: requestParams,
        headers: headers,
        timeout: config.translation.timeout
      }
    );
    
    logger.info('微软翻译 - 响应状态:', response.status);
    logger.info('微软翻译 - 响应数据:', response.data);
    
    if (response.data && response.data[0] && response.data[0].translations && response.data[0].translations[0]) {
      const result = response.data[0].translations[0].text;
      logger.info('微软翻译 - 成功获取结果:', result);
      return result;
    }
    
    logger.info('微软翻译 - 响应格式无效');
    throw new Error('Invalid Microsoft response format');
  } catch (error) {
    console.error('微软翻译 - 请求失败:', error.message);
    throw error;
  }
}

// 备用翻译方案2：有道翻译（简单实现）
async function translateWithYoudao(text) {
  logger.info('有道翻译 - 开始请求');
  const axios = require('axios');
  
  try {
    const params = {
      i: text,
      from: config.translation.sourceLanguage,
      to: config.translation.targetLanguage,
      doctype: 'json'
    };
    logger.info('有道翻译 - 请求参数:', params);
    
    // 使用有道翻译的免费API
    const response = await axios.get('https://fanyi.youdao.com/translate', {
      params: params,
      timeout: config.translation.timeout
    });
    
    logger.info('有道翻译 - 响应状态:', response.status);
    logger.info('有道翻译 - 响应数据:', response.data);
    
    if (response.data && response.data.translateResult && response.data.translateResult[0] && response.data.translateResult[0][0]) {
      const result = response.data.translateResult[0][0].tgt;
      logger.info('有道翻译 - 成功获取结果:', result);
      return result;
    }
    
    logger.info('有道翻译 - 响应格式无效');
    throw new Error('Invalid Youdao response format');
  } catch (error) {
    console.error('有道翻译 - 请求失败:', error.message);
    throw error;
  }
}

// 百度翻译API（使用百度AI开放平台）
async function translateWithBaidu(text) {
  logger.info('百度翻译 - 开始请求');
  
  try {
    // 尝试加载axios，如果失败则使用内置的https模块
    let axios;
    try {
      axios = require('axios');
    } catch (axiosError) {
      logger.info('axios模块加载失败，使用内置https模块:', axiosError.message);
      return await translateWithBaiduFallback(text);
    }
    // 百度AI开放平台API参数
    const AK = config.apiKeys.baidu.ak;
    const SK = config.apiKeys.baidu.sk;
    
    logger.info('百度翻译 - API 凭证:', AK ? '已配置' : '未配置');
    
    // 获取Access Token
    const accessToken = await getBaiduAccessToken(AK, SK);
    logger.info('百度翻译 - Access Token获取成功');
    
    // 语言代码映射
    const langMap = {
      'en': 'en',
      'zh': 'zh',
      'zh-cn': 'zh',
      'zh-tw': 'zh',
      'ja': 'jp',
      'ko': 'kor',
      'fr': 'fra',
      'de': 'de',
      'es': 'spa',
      'it': 'it',
      'ru': 'ru',
      'pt': 'pt',
      'ar': 'ara'
    };
    
    const from = langMap[config.translation.sourceLanguage] || 'en';
    const to = langMap[config.translation.targetLanguage] || 'zh';
    
    // 调用翻译API
    const options = {
      method: 'POST',
      url: `https://aip.baidubce.com/rpc/2.0/mt/texttrans/v1?access_token=${accessToken}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: JSON.stringify({
        from: from,
        to: to,
        q: text
      }),
      timeout: config.translation.timeout
    };
    
    logger.info('百度翻译 - 请求参数:', {
      from: from,
      to: to,
      q: text.substring(0, 50) + (text.length > 50 ? '...' : '')
    });
    
    const response = await axios(options);
    
    logger.info('百度翻译 - 响应状态:', response.status);
    logger.info('百度翻译 - 响应数据:', response.data);
    
    if (response.data && response.data.result && response.data.result.trans_result && response.data.result.trans_result.length > 0) {
      const result = response.data.result.trans_result[0].dst;
      logger.info('百度翻译 - 成功获取结果:', result);
      return result;
    }
    
    if (response.data && response.data.error_code) {
      const errorMessages = {
        '1': 'Unknown error',
        '2': 'Service temporarily unavailable',
        '3': 'Unsupported method',
        '4': 'Request limit reached',
        '6': 'Invalid client id',
        '17': 'Open api daily request limit reached',
        '18': 'Open api qps request limit reached',
        '19': 'Open api total request limit reached',
        '100': 'Invalid parameter',
        '110': 'Access token invalid or no longer valid',
        '111': 'Access token expired'
      };
      const errorMsg = errorMessages[response.data.error_code] || `Error code: ${response.data.error_code}`;
      throw new Error(`Baidu AI API Error: ${errorMsg}`);
    }
    
    logger.info('百度翻译 - 响应格式无效');
    throw new Error('Invalid Baidu AI response format');
  } catch (error) {
    console.error('百度翻译 - 请求失败:', error.message);
    throw error;
  }
}

// 百度翻译备用方案（使用内置https模块）
async function translateWithBaiduFallback(text) {
  logger.info('百度翻译备用方案 - 使用内置https模块');
  const https = require('https');
  const querystring = require('querystring');
  
  try {
    // 百度AI开放平台API参数
    const AK = config.apiKeys.baidu.ak;
    const SK = config.apiKeys.baidu.sk;
    
    logger.info('百度翻译备用方案 - API 凭证:', AK ? '已配置' : '未配置');
    
    // 获取Access Token
    const accessToken = await getBaiduAccessTokenFallback(AK, SK);
    logger.info('百度翻译备用方案 - Access Token获取成功');
    
    // 语言代码映射
    const langMap = {
      'en': 'en',
      'zh': 'zh',
      'zh-cn': 'zh',
      'zh-tw': 'zh',
      'ja': 'jp',
      'ko': 'kor',
      'fr': 'fra',
      'de': 'de',
      'es': 'spa',
      'it': 'it',
      'ru': 'ru',
      'pt': 'pt',
      'ar': 'ara'
    };
    
    const from = langMap[config.translation.sourceLanguage] || 'en';
    const to = langMap[config.translation.targetLanguage] || 'zh';
    
    const postData = JSON.stringify({
      from: from,
      to: to,
      q: text
    });
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'aip.baidubce.com',
        path: `/rpc/2.0/mt/texttrans/v1?access_token=${accessToken}`,
        method: 'POST',
        timeout: config.translation.timeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result && result.result && result.result.trans_result && result.result.trans_result.length > 0) {
              const translation = result.result.trans_result[0].dst;
              logger.info('百度翻译备用方案 - 成功获取结果:', translation);
              resolve(translation);
            } else if (result && result.error_code) {
              const errorMessages = {
                '1': 'Unknown error',
                '2': 'Service temporarily unavailable',
                '3': 'Unsupported method',
                '4': 'Request limit reached',
                '6': 'Invalid client id',
                '17': 'Open api daily request limit reached',
                '18': 'Open api qps request limit reached',
                '19': 'Open api total request limit reached',
                '100': 'Invalid parameter',
                '110': 'Access token invalid or no longer valid',
                '111': 'Access token expired'
              };
              const errorMsg = errorMessages[result.error_code] || `Error code: ${result.error_code}`;
              reject(new Error(`Baidu AI API Error: ${errorMsg}`));
            } else {
              reject(new Error('Invalid Baidu AI response format'));
            }
          } catch (parseError) {
            reject(new Error('Failed to parse Baidu response'));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(postData);
      req.end();
    });
    
  } catch (error) {
    console.error('百度翻译备用方案 - 请求失败:', error.message);
    throw error;
  }
}

// 获取百度AI开放平台Access Token
async function getBaiduAccessToken(AK, SK) {
  try {
    const axios = require('axios');
    
    const options = {
      method: 'POST',
      url: `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${AK}&client_secret=${SK}`,
      timeout: 5000
    };
    
    return new Promise((resolve, reject) => {
      axios(options)
        .then(res => {
          if (res.data && res.data.access_token) {
            resolve(res.data.access_token);
          } else {
            reject(new Error('Failed to get access token'));
          }
        })
        .catch(error => {
          reject(new Error(`Access token request failed: ${error.message}`));
        });
    });
  } catch (axiosError) {
    logger.info('axios模块加载失败，使用备用方案获取Access Token');
    return await getBaiduAccessTokenFallback(AK, SK);
  }
}

// 获取百度AI开放平台Access Token备用方案
async function getBaiduAccessTokenFallback(AK, SK) {
  const https = require('https');
  const querystring = require('querystring');
  
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      grant_type: 'client_credentials',
      client_id: AK,
      client_secret: SK
    });
    
    const options = {
      hostname: 'aip.baidubce.com',
      path: '/oauth/2.0/token',
      method: 'POST',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result && result.access_token) {
            resolve(result.access_token);
          } else {
            reject(new Error('Failed to get access token'));
          }
        } catch (parseError) {
          reject(new Error('Failed to parse access token response'));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Access token request failed: ${error.message}`));
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Access token request timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

// DeepL API Free 翻译
async function translateWithDeepL(text) {
  logger.info('DeepL 翻译 - 开始请求');
  const axios = require('axios');
  
  try {
    const requestData = {
      text: [text],
      source_lang: config.translation.sourceLanguage.toUpperCase(),
      target_lang: config.translation.targetLanguage === 'zh' ? 'ZH' : config.translation.targetLanguage.toUpperCase()
    };
    
    const headers = {
      'Authorization': `DeepL-Auth-Key ${config.apiKeys.deepl}`,
      'Content-Type': 'application/json'
    };
    
    logger.info('DeepL 翻译 - 请求参数:', requestData);
    logger.info('DeepL 翻译 - API Key:', config.apiKeys.deepl ? '已配置' : '未配置');
    
    const response = await axios.post('https://api-free.deepl.com/v2/translate', 
      requestData, 
      {
        headers: headers,
        timeout: config.translation.timeout
      }
    );
    
    logger.info('DeepL 翻译 - 响应状态:', response.status);
    logger.info('DeepL 翻译 - 响应数据:', response.data);
    
    if (response.data && response.data.translations && response.data.translations[0]) {
      const result = response.data.translations[0].text;
      logger.info('DeepL 翻译 - 成功获取结果:', result);
      return result;
    }
    
    logger.info('DeepL 翻译 - 响应格式无效');
    throw new Error('Invalid DeepL response format');
  } catch (error) {
    console.error('DeepL 翻译 - 请求失败:', error.message);
    throw error;
  }
}

// Amazon Translate 翻译
async function translateWithAmazon(text) {
  logger.info('Amazon 翻译 - 开始请求');
  const AWS = require('aws-sdk');
  
  try {
    // 配置 AWS
    AWS.config.update({
      accessKeyId: config.apiKeys.aws.accessKeyId,
      secretAccessKey: config.apiKeys.aws.secretAccessKey,
      region: config.apiKeys.aws.region
    });
    
    const translate = new AWS.Translate();
    
    const params = {
      Text: text,
      SourceLanguageCode: config.translation.sourceLanguage,
      TargetLanguageCode: config.translation.targetLanguage === 'zh' ? 'zh-cn' : config.translation.targetLanguage
    };
    
    logger.info('Amazon 翻译 - 请求参数:', params);
    logger.info('Amazon 翻译 - AWS 凭证:', config.apiKeys.aws.accessKeyId ? '已配置' : '未配置');
    
    const result = await translate.translateText(params).promise();
    
    logger.info('Amazon 翻译 - 响应数据:', result);
    
    if (result && result.TranslatedText) {
      logger.info('Amazon 翻译 - 成功获取结果:', result.TranslatedText);
      return result.TranslatedText;
    }
    
    logger.info('Amazon 翻译 - 响应格式无效');
    throw new Error('Invalid Amazon response format');
  } catch (error) {
    console.error('Amazon 翻译 - 请求失败:', error.message);
    throw error;
  }
}

// 腾讯翻译君 API
async function translateWithTencent(text) {
  logger.info('腾讯翻译 - 开始请求');
  const axios = require('axios');
  const crypto = require('crypto');
  
  try {
    // 腾讯云API签名算法
    function sha256(message, secret = '', encoding) {
      const hmac = crypto.createHmac('sha256', secret);
      return hmac.update(message).digest(encoding);
    }
    
    function getHash(message, encoding = 'hex') {
      const hash = crypto.createHash('sha256');
      return hash.update(message).digest(encoding);
    }
    
    function getDate(timestamp) {
      const date = new Date(timestamp * 1000);
      const year = date.getUTCFullYear();
      const month = ('0' + (date.getUTCMonth() + 1)).slice(-2);
      const day = ('0' + date.getUTCDate()).slice(-2);
      return `${year}-${month}-${day}`;
    }
    
    // 请求参数
    const endpoint = 'tmt.tencentcloudapi.com';
    const service = 'tmt';
    const region = config.apiKeys.tencent.region;
    const action = 'TextTranslate';
    const version = '2018-03-21';
    const timestamp = Math.floor(Date.now() / 1000);
    
    const payload = {
      SourceText: text,
      Source: config.translation.sourceLanguage,
      Target: config.translation.targetLanguage === 'zh' ? 'zh' : config.translation.targetLanguage,
      ProjectId: 0
    };
    
    logger.info('腾讯翻译 - 请求参数:', payload);
    logger.info('腾讯翻译 - API 凭证:', config.apiKeys.tencent.secretId ? '已配置' : '未配置');
    
    // 构建签名
    const payloadStr = JSON.stringify(payload);
    const hashedRequestPayload = getHash(payloadStr);
    const httpRequestMethod = 'POST';
    const canonicalUri = '/';
    const canonicalQueryString = '';
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${endpoint}\nx-tc-action:${action.toLowerCase()}\n`;
    const signedHeaders = 'content-type;host;x-tc-action';
    
    const canonicalRequest = httpRequestMethod + '\n' +
      canonicalUri + '\n' +
      canonicalQueryString + '\n' +
      canonicalHeaders + '\n' +
      signedHeaders + '\n' +
      hashedRequestPayload;
    
    const algorithm = 'TC3-HMAC-SHA256';
    const date = getDate(timestamp);
    const credentialScope = date + '/' + service + '/' + 'tc3_request';
    const hashedCanonicalRequest = getHash(canonicalRequest);
    const stringToSign = algorithm + '\n' +
      timestamp + '\n' +
      credentialScope + '\n' +
      hashedCanonicalRequest;
    
    const secretDate = sha256(date, 'TC3' + config.apiKeys.tencent.secretKey);
    const secretService = sha256(service, secretDate);
    const secretSigning = sha256('tc3_request', secretService);
    const signature = sha256(stringToSign, secretSigning, 'hex');
    
    const authorization = algorithm + ' ' +
      'Credential=' + config.apiKeys.tencent.secretId + '/' + credentialScope + ', ' +
      'SignedHeaders=' + signedHeaders + ', ' +
      'Signature=' + signature;
    
    const headers = {
      'Authorization': authorization,
      'Content-Type': 'application/json; charset=utf-8',
      'Host': endpoint,
      'X-TC-Action': action,
      'X-TC-Timestamp': timestamp.toString(),
      'X-TC-Version': version,
      'X-TC-Region': region
    };
    
    const response = await axios.post(`https://${endpoint}`, payloadStr, {
      headers: headers,
      timeout: config.translation.timeout
    });
    
    logger.info('腾讯翻译 - 响应状态:', response.status);
    logger.info('腾讯翻译 - 响应数据:', response.data);
    
    if (response.data && response.data.Response && response.data.Response.TargetText) {
      const result = response.data.Response.TargetText;
      logger.info('腾讯翻译 - 成功获取结果:', result);
      return result;
    }
    
    if (response.data && response.data.Response && response.data.Response.Error) {
      throw new Error(`Tencent API Error: ${response.data.Response.Error.Message}`);
    }
    
    logger.info('腾讯翻译 - 响应格式无效');
    throw new Error('Invalid Tencent response format');
  } catch (error) {
    console.error('腾讯翻译 - 请求失败:', error.message);
    throw error;
  }
}

function showTranslationResult(originalText, translationResults) {
  logger.info('=== 显示翻译结果窗口 ===');
  logger.info('原文:', originalText);
  logger.info('翻译结果:', translationResults);
  
  try {
    const resultWin = createResultWindow();
    
    if (!resultWin) {
      console.error('无法创建翻译结果窗口');
      return;
    }
    
    // 调整窗口大小以适应多个翻译结果
    resultWin.setSize(450, 350);
    
    // 生成翻译结果HTML
    let translationsHtml = '';
    
    // 检查是否为数组（多个翻译服务结果）
    if (Array.isArray(translationResults)) {
      translationResults.forEach((result, index) => {
        const serviceName = getServiceDisplayName(result.service);
        const statusClass = result.success ? 'success' : 'error';
        const statusIcon = result.success ? '✅' : '❌';
        
        translationsHtml += `
          <div class="translation-item ${statusClass}">
            <div class="service-name">${statusIcon} ${serviceName}</div>
            <div class="service-result">${result.result}</div>
          </div>
        `;
      });
    } else {
      // 兼容旧版本单个翻译结果
      translationsHtml = `
        <div class="translation-item success">
          <div class="service-name">✅ 翻译结果</div>
          <div class="service-result">${translationResults}</div>
        </div>
      `;
    }
    
    // 创建HTML内容
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>翻译结果</title>
          <style>
              body {
                  margin: 0;
                  padding: 0;
                  background: rgba(0, 0, 0, 0.9);
                  color: white;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  border-radius: 12px;
                  overflow: hidden;
                  position: relative;
                  height: 100vh;
                  user-select: none;
              }
              .drag-handle {
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 40px;
                  height: 40px;
                  cursor: move;
                  background: rgba(255, 255, 255, 0.05);
                  border-radius: 12px 12px 0 0;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: background 0.2s ease;
                  z-index: 9998;
                  -webkit-app-region: drag;
              }
              .drag-handle:hover {
                  background: rgba(255, 255, 255, 0.1);
              }
              .drag-handle::before {
                  content: '⋮⋮';
                  color: rgba(255, 255, 255, 0.4);
                  font-size: 16px;
                  letter-spacing: 2px;
                  transform: rotate(90deg);
              }
              .content {
                  padding: 50px 20px 20px 20px;
                  height: calc(100vh - 70px);
                  overflow-y: auto;
              }
              .original {
                  color: #d1d5db;
                  font-size: 12px;
                  margin-bottom: 15px;
                  padding-bottom: 10px;
                  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                  word-wrap: break-word;
              }
              .translations-container {
                  display: flex;
                  flex-direction: column;
                  gap: 12px;
              }
              .translation-item {
                  padding: 12px;
                  border-radius: 8px;
                  border: 1px solid rgba(255, 255, 255, 0.1);
              }
              .translation-item.success {
                  background: rgba(34, 197, 94, 0.1);
                  border-color: rgba(34, 197, 94, 0.3);
              }
              .translation-item.error {
                  background: rgba(239, 68, 68, 0.1);
                  border-color: rgba(239, 68, 68, 0.3);
              }
              .service-name {
                  font-size: 11px;
                  font-weight: 600;
                  margin-bottom: 6px;
                  opacity: 0.8;
              }
              .service-result {
                  font-size: 13px;
                  line-height: 1.4;
                  word-wrap: break-word;
              }
              .close-btn {
                  position: absolute;
                  top: 8px;
                  right: 12px;
                  background: rgba(255, 255, 255, 0.1);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  color: #ffffff;
                  cursor: pointer;
                  font-size: 16px;
                  font-weight: bold;
                  width: 24px;
                  height: 24px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border-radius: 50%;
                  transition: all 0.2s ease;
                  z-index: 10000;
              }
              .close-btn:hover {
                  color: #ff4757;
                  background: rgba(255, 71, 87, 0.2);
                  border-color: rgba(255, 71, 87, 0.4);
                  transform: scale(1.1);
              }
              .close-btn:active {
                  transform: scale(0.95);
              }
              .resize-handle {
                  position: absolute;
                  bottom: 0;
                  right: 0;
                  width: 20px;
                  height: 20px;
                  cursor: nw-resize;
                  background: rgba(255, 255, 255, 0.1);
                  border-radius: 12px 0 12px 0;
                  z-index: 9999;
              }
              .resize-handle::before {
                  content: '';
                  position: absolute;
                  bottom: 4px;
                  right: 4px;
                  width: 0;
                  height: 0;
                  border-left: 8px solid transparent;
                  border-bottom: 8px solid rgba(255, 255, 255, 0.3);
              }
              /* 自定义滚动条 */
              .content::-webkit-scrollbar {
                  width: 4px;
              }
              .content::-webkit-scrollbar-track {
                  background: rgba(255, 255, 255, 0.1);
                  border-radius: 2px;
              }
              .content::-webkit-scrollbar-thumb {
                  background: rgba(255, 255, 255, 0.3);
                  border-radius: 2px;
              }
              .content::-webkit-scrollbar-thumb:hover {
                  background: rgba(255, 255, 255, 0.5);
              }
          </style>
      </head>
      <body>
          <div class="drag-handle" id="dragHandle"></div>
          <button class="close-btn" onclick="closeWindow()">×</button>
          <div class="resize-handle" id="resizeHandle"></div>
          <div class="content">
              <div class="original">原文: ${originalText}</div>
              <div class="translations-container">
                  ${translationsHtml}
              </div>
          </div>
          <script>
              const { ipcRenderer } = require('electron');
              
              let isDragging = false;
              let dragOffset = { x: 0, y: 0 };
              let isResizing = false;
              let resizeStartSize = { width: 0, height: 0 };
              let resizeStartMouse = { x: 0, y: 0 };
              
              // 拖动功能 - 使用CSS -webkit-app-region: drag 作为主要方案
              const dragHandle = document.getElementById('dragHandle');
              
              logger.info('初始化翻译结果窗口拖动功能', dragHandle);
              
              if (!dragHandle) {
                  console.error('拖动手柄元素未找到！');
              } else {
                  logger.info('拖动手柄已找到，使用CSS拖动方案');
                  
                  // 添加测试点击事件
                  dragHandle.addEventListener('click', (e) => {
                      logger.info('拖动手柄被点击');
                  });
                  
                  // 添加悬停效果
                  dragHandle.addEventListener('mouseenter', () => {
                      dragHandle.style.background = 'rgba(255, 255, 255, 0.1)';
                  });
                  
                  dragHandle.addEventListener('mouseleave', () => {
                      dragHandle.style.background = 'rgba(255, 255, 255, 0.05)';
                  });
              }
              
              // 备用JavaScript拖动方案
              dragHandle && dragHandle.addEventListener('mousedown', (e) => {
                  logger.info('JavaScript拖动方案激活', e);
                  isDragging = true;
                  dragOffset.x = e.screenX;
                  dragOffset.y = e.screenY;
                  dragHandle.style.cursor = 'grabbing';
                  document.body.style.cursor = 'grabbing';
                  
                  // 添加视觉反馈
                  dragHandle.style.background = 'rgba(255, 255, 255, 0.2)';
                  
                  e.preventDefault();
                  e.stopPropagation();
                  
                  logger.info('拖动状态设置完成，isDragging:', isDragging);
              });
              
              document.addEventListener('mousemove', (e) => {
                  if (isDragging) {
                      const deltaX = e.screenX - dragOffset.x;
                      const deltaY = e.screenY - dragOffset.y;
                      
                      logger.info('拖动中:', { deltaX, deltaY, screenX: e.screenX, screenY: e.screenY });
                      
                      // 使用异步调用，不等待返回
                      ipcRenderer.invoke('move-result-window', deltaX, deltaY).catch(err => {
                          console.error('移动窗口失败:', err);
                      });
                      
                      dragOffset.x = e.screenX;
                      dragOffset.y = e.screenY;
                  }
                  
                  if (isResizing) {
                      const deltaX = e.screenX - resizeStartMouse.x;
                      const deltaY = e.screenY - resizeStartMouse.y;
                      
                      const newWidth = Math.max(280, resizeStartSize.width + deltaX);
                      const newHeight = Math.max(180, resizeStartSize.height + deltaY);
                      
                      ipcRenderer.invoke('resize-result-window', newWidth, newHeight).catch(err => {
                          console.error('调整窗口大小失败:', err);
                      });
                  }
              });
              
              document.addEventListener('mouseup', (e) => {
                  if (isDragging) {
                      logger.info('结束拖动翻译结果窗口');
                      isDragging = false;
                      dragHandle.style.cursor = 'move';
                      document.body.style.cursor = '';
                      // 恢复拖动手柄样式
                      dragHandle.style.background = 'rgba(255, 255, 255, 0.05)';
                  }
                  if (isResizing) {
                      isResizing = false;
                  }
              });
              
              // 全局鼠标释放事件（防止鼠标移出窗口时丢失事件）
              window.addEventListener('mouseup', (e) => {
                  if (isDragging) {
                      logger.info('全局鼠标释放 - 结束拖动');
                      isDragging = false;
                      dragHandle.style.cursor = 'move';
                      document.body.style.cursor = '';
                      dragHandle.style.background = 'rgba(255, 255, 255, 0.05)';
                  }
                  if (isResizing) {
                      isResizing = false;
                  }
              });
              
              // 防止拖拽时选中文本
              document.addEventListener('selectstart', (e) => {
                  if (isDragging || isResizing) {
                      e.preventDefault();
                  }
              });
              
              // 备用拖动方案：使用整个窗口顶部区域作为拖动区域
              document.body.addEventListener('mousedown', (e) => {
                  // 只有在点击顶部40px区域且不是关闭按钮时才启用拖动
                  if (e.clientY <= 40 && !e.target.classList.contains('close-btn') && !isDragging) {
                      logger.info('备用拖动方案激活');
                      isDragging = true;
                      dragOffset.x = e.screenX;
                      dragOffset.y = e.screenY;
                      document.body.style.cursor = 'grabbing';
                      e.preventDefault();
                      e.stopPropagation();
                  }
              });
              
              // 调整大小功能
              const resizeHandle = document.getElementById('resizeHandle');
              
              resizeHandle.addEventListener('mousedown', (e) => {
                  isResizing = true;
                  resizeStartMouse.x = e.screenX;
                  resizeStartMouse.y = e.screenY;
                  
                  // 获取当前窗口大小
                  ipcRenderer.invoke('get-result-window-size').then(size => {
                      resizeStartSize = size;
                  });
                  
                  e.preventDefault();
                  e.stopPropagation();
              });
              
              // 关闭窗口
              function closeWindow() {
                  window.close();
              }
              
              // 15秒后自动关闭
              setTimeout(() => {
                  window.close();
              }, 15000);
          </script>
      </body>
      </html>
    `;
    
    // 加载HTML内容
    resultWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    // 等待页面加载完成后显示窗口
    resultWin.webContents.on('did-finish-load', () => {
      logger.info('翻译结果页面加载完成');
      
      // 获取鼠标位置并显示窗口
      const { x, y } = screen.getCursorScreenPoint();
      resultWin.setPosition(x + 20, y - 150);
      resultWin.show();
      resultWin.focus();
      
      logger.info('翻译结果窗口已显示');
      
      // 15秒后自动关闭
      setTimeout(() => {
        if (resultWin && !resultWin.isDestroyed()) {
          resultWin.close();
          logger.info('翻译结果窗口已自动关闭');
        }
      }, 30000);
    });
    
    // 处理加载错误
    resultWin.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('翻译结果页面加载失败:', errorCode, errorDescription);
    });
    
  } catch (error) {
    console.error('显示翻译结果时发生错误:', error);
  }
}

// 获取翻译服务显示名称
function getServiceDisplayName(service) {
  const serviceNames = {
    'google': 'Google 翻译',
    'youdao': '有道翻译',
    'baidu': '百度翻译',
    'deepl_free': 'DeepL Free',
    'microsoft': '微软翻译',
    'amazon': 'Amazon Translate',
    'tencent': '腾讯翻译君'
  };
  return serviceNames[service] || service;
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
  logger.info('=== 应用退出 ===');
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

