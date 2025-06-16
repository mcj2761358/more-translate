const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Logger {
  constructor() {
    this.logFile = null;
    this.logLevel = 'info';
    this.initialized = false;
    this.logBuffer = []; // 缓存初始化前的日志
  }

  init() {
    if (this.initialized) return;

    try {
      // 获取日志文件路径
      let logPath = process.env.LOG_FILE_PATH;
      
      if (!logPath) {
        // 如果没有配置，使用默认路径
        if (app && app.getPath) {
          // 打包环境：使用用户数据目录
          logPath = path.join(app.getPath('userData'), 'more-translator.log');
        } else {
          // 开发环境：使用临时目录
          logPath = '/tmp/more-translator.log';
        }
      }

      this.logFile = logPath;
      this.logLevel = process.env.LOG_LEVEL || 'info';

      // 确保日志目录存在
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // 写入初始化信息
      this.writeToFile(`\n=== 日志系统初始化 ${new Date().toISOString()} ===`);
      this.writeToFile(`日志文件: ${this.logFile}`);
      this.writeToFile(`日志级别: ${this.logLevel}`);
      this.writeToFile(`应用模式: ${app && app.isPackaged ? '打包模式' : '开发模式'}`);
      this.writeToFile(`Node环境: ${process.env.NODE_ENV || 'production'}`);
      this.writeToFile('='.repeat(60));

      // 输出缓存的日志
      this.logBuffer.forEach(log => this.writeToFile(log));
      this.logBuffer = [];

      this.initialized = true;
      
      console.log(`日志系统已初始化，日志文件: ${this.logFile}`);
    } catch (error) {
      console.error('日志系统初始化失败:', error);
    }
  }

  writeToFile(message) {
    if (!this.logFile) return;
    
    try {
      fs.appendFileSync(this.logFile, message + '\n');
    } catch (error) {
      console.error('写入日志文件失败:', error);
    }
  }

  formatMessage(level, ...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  log(...args) {
    const message = this.formatMessage('info', ...args);
    console.log(...args); // 仍然输出到控制台
    
    if (this.initialized) {
      this.writeToFile(message);
    } else {
      this.logBuffer.push(message);
    }
  }

  info(...args) {
    this.log(...args);
  }

  debug(...args) {
    if (this.logLevel === 'debug') {
      const message = this.formatMessage('debug', ...args);
      console.log(...args);
      
      if (this.initialized) {
        this.writeToFile(message);
      } else {
        this.logBuffer.push(message);
      }
    }
  }

  warn(...args) {
    const message = this.formatMessage('warn', ...args);
    console.warn(...args);
    
    if (this.initialized) {
      this.writeToFile(message);
    } else {
      this.logBuffer.push(message);
    }
  }

  error(...args) {
    const message = this.formatMessage('error', ...args);
    console.error(...args);
    
    if (this.initialized) {
      this.writeToFile(message);
    } else {
      this.logBuffer.push(message);
    }
  }

  // 获取日志文件路径
  getLogFile() {
    return this.logFile;
  }

  // 清空日志文件
  clearLog() {
    if (this.logFile && fs.existsSync(this.logFile)) {
      try {
        fs.writeFileSync(this.logFile, '');
        this.log('日志文件已清空');
      } catch (error) {
        this.error('清空日志文件失败:', error);
      }
    }
  }

  // 读取日志文件内容
  readLog(lines = 100) {
    if (!this.logFile || !fs.existsSync(this.logFile)) {
      return '日志文件不存在';
    }

    try {
      const content = fs.readFileSync(this.logFile, 'utf8');
      const allLines = content.split('\n');
      const recentLines = allLines.slice(-lines);
      return recentLines.join('\n');
    } catch (error) {
      this.error('读取日志文件失败:', error);
      return '读取日志文件失败';
    }
  }
}

// 创建全局日志实例
const logger = new Logger();

module.exports = logger; 