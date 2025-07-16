const { app, BrowserWindow, Menu, Tray, shell, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tray;
let closeDialogWindow;
let isQuiting = false;
let pendingClose = false;

// 设置文件路径 - 使用用户数据目录确保在打包环境中可写
const settingsPath = path.join(app.getPath('userData'), 'Settings.json');

// 读取设置
function readSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(data);
    } else {
      // 如果设置文件不存在，创建默认设置文件
      const defaultSettings = {};
      saveSettings(defaultSettings);
      console.log('Created default settings file:', settingsPath);
      return defaultSettings;
    }
  } catch (error) {
    console.error('Failed to read settings file:', error);
    // If reading fails, try to create default settings file
    const defaultSettings = {};
    saveSettings(defaultSettings);
    return defaultSettings;
  }
}

// 保存设置
function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save settings file:', error);
  }
}

// 添加命令行参数以支持媒体功能
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,WebAssembly,WebAssemblyStreaming,WebAssemblyThreads');
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
app.commandLine.appendSwitch('enable-web-bluetooth');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// 网络请求监控和调试
let requestLog = [];
function logRequest(details) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: details.method,
    url: details.url,
    resourceType: details.resourceType,
    referrer: details.referrer
  };
  requestLog.push(logEntry);
  
  // Monitor WASM and audio related requests
  if (details.url.includes('.wasm') || 
      details.url.includes('wasm') || 
      details.url.includes('audio') || 
      details.url.includes('noise') || 
      details.url.includes('denoise') ||
      details.resourceType === 'media') {
    console.log('🔍 Important Request:', logEntry);
  }
  
  // 保持日志大小在合理范围内
  if (requestLog.length > 1000) {
    requestLog = requestLog.slice(-500);
  }
}

function logResponse(details) {
  const responseEntry = {
    timestamp: new Date().toISOString(),
    url: details.url,
    statusCode: details.statusCode,
    statusLine: details.statusLine,
    responseHeaders: details.responseHeaders
  };
  
  // Monitor WASM and audio related responses
  if (details.url.includes('.wasm') || 
      details.url.includes('wasm') || 
      details.url.includes('audio') || 
      details.url.includes('noise') || 
      details.url.includes('denoise')) {
    console.log('📥 Important Response:', responseEntry);
    
    // Check for error status codes
    if (details.statusCode >= 400) {
      console.error('❌ Request Failed:', details.url, 'Status Code:', details.statusCode);
    }
  }
}
// Security and performance switches
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('allow-running-insecure-content');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('enable-wasm-threads');
app.commandLine.appendSwitch('enable-wasm-simd');
app.commandLine.appendSwitch('js-flags', '--experimental-wasm-threads --experimental-wasm-simd');

// Allow Cloudflare and external resources
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('allow-running-insecure-content');
app.commandLine.appendSwitch('disable-features', 'BlockInsecurePrivateNetworkRequests');
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('ignore-ssl-errors');
app.commandLine.appendSwitch('ignore-certificate-errors-spki-list');
app.commandLine.appendSwitch('disable-extensions-except');
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('allow-file-access-from-files');

// Ensure only one application instance is running
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // When running a second instance, focus on the main window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.show();
    }
  });
}

// 创建关闭对话框窗口
function createCloseDialog() {
  if (closeDialogWindow) {
    closeDialogWindow.focus();
    return;
  }

  closeDialogWindow = new BrowserWindow({
    width: 450,
    height: 450,
    resizable: false,
    minimizable: false,
    maximizable: false,
    modal: true,
    parent: mainWindow,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'src', 'close-dialog-preload.js'),
      webSecurity: true
    }
  });

  // 加载关闭对话框页面
  closeDialogWindow.loadFile(path.join(__dirname, 'src', 'close-dialog.html'));

  // 窗口准备好后显示
  closeDialogWindow.once('ready-to-show', () => {
    closeDialogWindow.show();
    closeDialogWindow.center();
    closeDialogWindow.focus();
  });

  // 处理失去焦点事件
  closeDialogWindow.on('blur', () => {
    // 当对话框失去焦点时，检查是否是因为点击了其他应用
    setTimeout(() => {
      if (!closeDialogWindow.isFocused() && !mainWindow.isFocused()) {
        // 如果主窗口和对话框都失去焦点，说明用户切换到了其他应用
        // 隐藏对话框而不是关闭，保持在Electron应用内
        if (closeDialogWindow && !closeDialogWindow.isDestroyed()) {
          closeDialogWindow.hide();
        }
      }
    }, 100);
  });

  // 当主窗口重新获得焦点时，如果对话框存在且隐藏，则重新显示
  mainWindow.on('focus', () => {
    if (closeDialogWindow && !closeDialogWindow.isDestroyed() && !closeDialogWindow.isVisible() && pendingClose) {
      closeDialogWindow.show();
      closeDialogWindow.focus();
    }
  });

  // 窗口关闭时清理引用
  closeDialogWindow.on('closed', () => {
    closeDialogWindow = null;
  });

  return closeDialogWindow;
}

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 1190,
    minWidth: 800,
    minHeight: 600,
    title: 'Convbased Desktop',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      sandbox: false,
      enableBlinkFeatures: 'MediaStreamTrack,MediaRecorder,AudioWorklet,WebAssembly,SharedArrayBuffer,AudioWorkletGlobalScope',
      additionalArguments: [
        '--enable-features=VaapiVideoDecoder,WebAssembly,WebAssemblyStreaming,WebAssemblyThreads',
        '--disable-features=VizDisplayCompositor,OutOfBlinkCors,BlockInsecurePrivateNetworkRequests',
        '--enable-wasm-threads',
        '--enable-wasm-simd',
        '--js-flags=--experimental-wasm-threads --experimental-wasm-simd',
        '--enable-unsafe-webgpu',
        '--disable-web-security',
        '--disable-site-isolation-trials',
        '--allow-running-insecure-content',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--ignore-certificate-errors-spki-list',
        '--disable-extensions',
        '--allow-file-access-from-files',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    },
    show: false, // 初始不显示，等加载完成后显示
    titleBarStyle: 'default'
  });

  // 设置User-Agent - 完全动态获取系统信息
  const os = require('os');
  const { app } = require('electron');
  const platform = os.platform();
  const arch = os.arch();
  const release = os.release();
  const cpus = os.cpus();
  const totalmem = os.totalmem();
  
  // 获取Electron和Chrome版本信息
  const electronVersion = process.versions.electron;
  const chromeVersion = process.versions.chrome;
  const nodeVersion = process.versions.node;
  const v8Version = process.versions.v8;
  
  // 动态生成WebKit版本（基于Chrome版本的前两位数字）
  let webkitVersion = '537.36';
  if (chromeVersion) {
    const chromeMajor = parseInt(chromeVersion.split('.')[0]);
    // WebKit版本通常与Chrome版本相关
    if (chromeMajor >= 120) {
      webkitVersion = '537.36';
    } else if (chromeMajor >= 110) {
      webkitVersion = '537.36';
    } else if (chromeMajor >= 100) {
      webkitVersion = '537.36';
    } else {
      webkitVersion = '537.36';
    }
  }
  
  // 辅助函数：获取详细的系统信息
  function getDetailedSystemInfo() {
    const systemInfo = {
      platform,
      arch,
      release,
      cpuModel: cpus.length > 0 ? cpus[0].model : 'Unknown',
      cpuCount: cpus.length,
      totalMemoryGB: Math.round(totalmem / (1024 * 1024 * 1024)),
      nodeVersion,
      v8Version,
      electronVersion,
      chromeVersion
    };
    
    // 尝试获取更详细的系统信息
    try {
      if (platform === 'win32') {
        systemInfo.hostname = os.hostname();
        systemInfo.userInfo = os.userInfo();
      } else if (platform === 'darwin') {
        systemInfo.hostname = os.hostname();
      } else if (platform === 'linux') {
        systemInfo.hostname = os.hostname();
        // 尝试读取发行版信息
        try {
          const fs = require('fs');
          if (fs.existsSync('/etc/os-release')) {
            const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
            const distroMatch = osRelease.match(/PRETTY_NAME="([^"]+)"/i);
            if (distroMatch) {
              systemInfo.linuxDistro = distroMatch[1];
            }
          }
        } catch (e) {
          // 忽略读取错误
        }
      }
    } catch (e) {
      // 忽略获取详细信息时的错误
    }
    
    return systemInfo;
  }
  
  const systemInfo = getDetailedSystemInfo();
  
  // 根据系统平台动态生成User-Agent
  let userAgent;
  if (platform === 'win32') {
    // 动态解析Windows版本 - 支持更多版本
    const versionParts = release.split('.');
    const majorVersion = parseInt(versionParts[0]);
    const minorVersion = parseInt(versionParts[1]) || 0;
    const buildVersion = parseInt(versionParts[2]) || 0;
    
    let windowsVersion;
    let windowsName = 'Windows';
    
    // 更精确的Windows版本检测
    if (majorVersion >= 10) {
      if (buildVersion >= 22000) {
        windowsVersion = '10.0';
        windowsName = 'Windows 11';
      } else {
        windowsVersion = '10.0';
        windowsName = 'Windows 10';
      }
    } else if (majorVersion === 6) {
      if (minorVersion >= 3) {
        windowsVersion = '6.3';
        windowsName = 'Windows 8.1';
      } else if (minorVersion >= 2) {
        windowsVersion = '6.2';
        windowsName = 'Windows 8';
      } else if (minorVersion >= 1) {
        windowsVersion = '6.1';
        windowsName = 'Windows 7';
      } else {
        windowsVersion = '6.0';
        windowsName = 'Windows Vista';
      }
    } else if (majorVersion === 5) {
      if (minorVersion >= 2) {
        windowsVersion = '5.2';
        windowsName = 'Windows Server 2003';
      } else if (minorVersion >= 1) {
        windowsVersion = '5.1';
        windowsName = 'Windows XP';
      } else {
        windowsVersion = '5.0';
        windowsName = 'Windows 2000';
      }
    } else {
      // 对于未知版本，使用实际的版本号
      windowsVersion = `${majorVersion}.${minorVersion}`;
      windowsName = `Windows ${majorVersion}.${minorVersion}`;
    }
    
    // 更精确的架构检测
    let archString;
    if (arch === 'x64' || arch === 'x86_64') {
      archString = 'Win64; x64';
    } else if (arch === 'arm64') {
      archString = 'ARM64';
    } else if (arch === 'arm') {
      archString = 'ARM';
    } else if (arch === 'ia32' || arch === 'x86') {
      archString = 'Win32';
    } else {
      archString = `${arch}`;
    }
    
    userAgent = `Mozilla/5.0 (Windows NT ${windowsVersion}; ${archString}) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
    
  } else if (platform === 'darwin') {
    // 更精确的macOS版本检测
    const macVersion = release.split('.').map(v => parseInt(v));
    const macMajor = macVersion[0];
    const macMinor = macVersion[1] || 0;
    const macPatch = macVersion[2] || 0;
    
    // Darwin版本到macOS版本的精确映射
    let osxVersion;
    let macOSName = 'macOS';
    
    if (macMajor >= 24) {
      // macOS 15.x Sequoia (Darwin 24.x)
      const macOSMajor = 15;
      const macOSMinor = macMinor >= 0 ? macMinor : 0;
      osxVersion = `${macOSMajor}_${macOSMinor}_${macPatch}`;
      macOSName = 'macOS Sequoia';
    } else if (macMajor >= 23) {
      // macOS 14.x Sonoma (Darwin 23.x)
      const macOSMajor = 14;
      const macOSMinor = macMinor >= 0 ? macMinor : 0;
      osxVersion = `${macOSMajor}_${macOSMinor}_${macPatch}`;
      macOSName = 'macOS Sonoma';
    } else if (macMajor >= 22) {
      // macOS 13.x Ventura (Darwin 22.x)
      const macOSMajor = 13;
      const macOSMinor = macMinor >= 0 ? macMinor : 0;
      osxVersion = `${macOSMajor}_${macOSMinor}_${macPatch}`;
      macOSName = 'macOS Ventura';
    } else if (macMajor >= 21) {
      // macOS 12.x Monterey (Darwin 21.x)
      const macOSMajor = 12;
      const macOSMinor = macMinor >= 0 ? macMinor : 0;
      osxVersion = `${macOSMajor}_${macOSMinor}_${macPatch}`;
      macOSName = 'macOS Monterey';
    } else if (macMajor >= 20) {
      // macOS 11.x Big Sur (Darwin 20.x)
      const macOSMajor = 11;
      const macOSMinor = macMinor >= 0 ? macMinor : 0;
      osxVersion = `${macOSMajor}_${macOSMinor}_${macPatch}`;
      macOSName = 'macOS Big Sur';
    } else if (macMajor >= 19) {
      // macOS 10.15.x Catalina (Darwin 19.x)
      osxVersion = `10_15_${macPatch}`;
      macOSName = 'macOS Catalina';
    } else if (macMajor >= 18) {
      // macOS 10.14.x Mojave (Darwin 18.x)
      osxVersion = `10_14_${macPatch}`;
      macOSName = 'macOS Mojave';
    } else if (macMajor >= 17) {
      // macOS 10.13.x High Sierra (Darwin 17.x)
      osxVersion = `10_13_${macPatch}`;
      macOSName = 'macOS High Sierra';
    } else if (macMajor >= 16) {
      // macOS 10.12.x Sierra (Darwin 16.x)
      osxVersion = `10_12_${macPatch}`;
      macOSName = 'macOS Sierra';
    } else {
      // 对于更老的版本，使用实际检测到的版本
      const estimatedMajor = Math.max(10, 10 + (macMajor - 10));
      const estimatedMinor = Math.max(0, macMajor - 10);
      osxVersion = `${estimatedMajor}_${estimatedMinor}_${macPatch}`;
      macOSName = `macOS ${estimatedMajor}.${estimatedMinor}`;
    }
    
    // 更精确的Mac架构检测
    let macArch;
    if (arch === 'arm64') {
      macArch = 'ARM64';
    } else if (arch === 'x64' || arch === 'x86_64') {
      macArch = 'Intel';
    } else {
      macArch = arch.toUpperCase();
    }
    
    userAgent = `Mozilla/5.0 (Macintosh; ${macArch} Mac OS X ${osxVersion}) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
    
  } else if (platform === 'linux') {
    // 更精确的Linux架构和发行版检测
    let linuxArch;
    if (arch === 'x64' || arch === 'x86_64') {
      linuxArch = 'x86_64';
    } else if (arch === 'arm64' || arch === 'aarch64') {
      linuxArch = 'aarch64';
    } else if (arch === 'arm') {
      linuxArch = 'armv7l';
    } else if (arch === 'ia32' || arch === 'x86') {
      linuxArch = 'i686';
    } else if (arch === 'mips') {
      linuxArch = 'mips';
    } else if (arch === 'mipsel') {
      linuxArch = 'mipsel';
    } else if (arch === 'ppc64') {
      linuxArch = 'ppc64';
    } else if (arch === 's390x') {
      linuxArch = 's390x';
    } else {
      linuxArch = arch;
    }
    
    userAgent = `Mozilla/5.0 (X11; Linux ${linuxArch}) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
    
  } else if (platform === 'freebsd') {
    // FreeBSD支持
    const freebsdArch = arch === 'x64' ? 'amd64' : arch === 'arm64' ? 'arm64' : arch;
    userAgent = `Mozilla/5.0 (X11; FreeBSD ${freebsdArch}) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
    
  } else if (platform === 'openbsd') {
    // OpenBSD支持
    const openbsdArch = arch === 'x64' ? 'amd64' : arch;
    userAgent = `Mozilla/5.0 (X11; OpenBSD ${openbsdArch}) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
    
  } else if (platform === 'netbsd') {
    // NetBSD支持
    const netbsdArch = arch === 'x64' ? 'amd64' : arch;
    userAgent = `Mozilla/5.0 (X11; NetBSD ${netbsdArch}) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
    
  } else if (platform === 'sunos') {
    // Solaris/SunOS支持
    const solarisArch = arch === 'x64' ? 'x86_64' : arch;
    userAgent = `Mozilla/5.0 (X11; SunOS ${solarisArch}) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
    
  } else {
    // 对于未知平台，使用检测到的实际信息构建User-Agent
    const unknownArch = arch === 'x64' ? 'x86_64' : arch;
    userAgent = `Mozilla/5.0 (${platform.charAt(0).toUpperCase() + platform.slice(1)}; ${unknownArch}) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
  }
  
  mainWindow.webContents.setUserAgent(userAgent);
  
  // Output detailed system information and User-Agent
  console.log('=== Enhanced Dynamic User-Agent Generation Info ===');
  console.log('Platform:', platform);
  console.log('Architecture:', arch);
  console.log('OS Release:', release);
  console.log('CPU Model:', systemInfo.cpuModel);
  console.log('CPU Count:', systemInfo.cpuCount);
  console.log('Total Memory (GB):', systemInfo.totalMemoryGB);
  if (systemInfo.hostname) {
    console.log('Hostname:', systemInfo.hostname);
  }
  if (systemInfo.linuxDistro) {
    console.log('Linux Distribution:', systemInfo.linuxDistro);
  }
  console.log('Electron Version:', electronVersion);
  console.log('Chrome Version:', chromeVersion);
  console.log('Node.js Version:', nodeVersion);
  console.log('V8 Version:', v8Version);
  console.log('WebKit Version:', webkitVersion);
  console.log('Final User-Agent:', userAgent);
  console.log('User-Agent Length:', userAgent.length, 'characters');
  console.log('====================================================');
  
  // Configure session and network request listeners
  const { session } = require('electron');
  
  // Configure session permissions for Cloudflare and external resources
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Allow all permissions for better compatibility
    callback(true);
  });
  
  // Set CSP to allow Cloudflare resources
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders || {};
    
    // Remove restrictive CSP headers
    delete responseHeaders['content-security-policy'];
    delete responseHeaders['Content-Security-Policy'];
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['X-Frame-Options'];
    
    // Add permissive headers for Cloudflare resources
    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
    responseHeaders['Access-Control-Allow-Headers'] = ['*'];
    
    callback({ responseHeaders });
  });
  
  // Monitor all network requests
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    logRequest(details);
    
    // Special handling for Cloudflare Turnstile API
    if (details.url.includes('challenges.cloudflare.com')) {
      console.log(' Cloudflare Turnstile Request:', details.url);
    }
    
    callback({});
  });
  
  // 监听所有网络响应
  session.defaultSession.webRequest.onCompleted((details) => {
    logResponse(details);
  });
  
  // Monitor request failures
  session.defaultSession.webRequest.onErrorOccurred((details) => {
    console.error('Network Request Failed:', {
      url: details.url,
      error: details.error,
      timestamp: new Date().toISOString()
    });
  });
  
  // 添加IPC处理器以便从渲染进程获取请求日志
  const { ipcMain } = require('electron');
  ipcMain.handle('get-request-log', () => {
    return requestLog;
  });
  
  ipcMain.handle('clear-request-log', () => {
    requestLog = [];
    console.log('📋 Request log cleared');
    return true;
  });
  
  // 加载目标网页
  mainWindow.loadURL('https://weights.chat/#/auth/register?code=6UMCRj');

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // 确保标题显示为应用名称
    mainWindow.setTitle('Convbased Desktop');
    
    // 开发模式下打开开发者工具
    if (process.argv.includes('--dev')) {
      mainWindow.webContents.openDevTools();
    }
  });

  // 强制保持应用标题的函数
  const forceTitle = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const currentTitle = mainWindow.getTitle();
      if (currentTitle !== 'Convbased Desktop') {
        mainWindow.setTitle('Convbased Desktop');
      }
    }
  };

  // 监听页面标题变化事件
  mainWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault(); // 阻止页面修改标题
    mainWindow.setTitle('Convbased Desktop');
  });

  // 页面开始加载时设置标题
  mainWindow.webContents.on('did-start-loading', () => {
    mainWindow.setTitle('Convbased Desktop');
  });

  // 页面加载完成后重新设置标题
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.setTitle('Convbased Desktop');
    
    // 注入调试代码以支持媒体功能和WebAssembly
     mainWindow.webContents.executeJavaScript(`
       // 重写getUserMedia以确保权限
       if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
         const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
         navigator.mediaDevices.getUserMedia = function(constraints) {
           console.log('getUserMedia called with:', constraints);
           return originalGetUserMedia(constraints).catch(error => {
             console.error('getUserMedia error:', error);
             throw error;
           });
         };
       }
       
       // 确保AudioContext可用
       window.AudioContext = window.AudioContext || window.webkitAudioContext;
       
       // 监控音频降噪相关功能
       console.log('🎵 音频功能检查:');
       console.log('- AudioContext:', typeof AudioContext);
       console.log('- MediaDevices:', typeof navigator.mediaDevices);
       console.log('- getUserMedia:', typeof navigator.mediaDevices?.getUserMedia);
       console.log('- AudioWorklet:', typeof AudioWorklet);
       console.log('- SharedArrayBuffer:', typeof SharedArrayBuffer);
       
       // 监控所有fetch请求，特别是音频相关的
       const originalFetch = window.fetch;
       window.fetch = function(...args) {
         const url = args[0];
         if (typeof url === 'string') {
           if (url.includes('noise') || url.includes('denoise') || url.includes('audio') || url.includes('.wasm')) {
             console.log('🔍 音频相关请求:', url);
           }
         }
         return originalFetch.apply(this, args).then(response => {
           if (typeof url === 'string' && (url.includes('noise') || url.includes('denoise') || url.includes('audio') || url.includes('.wasm'))) {
             console.log('📥 Audio-related response:', url, 'Status:', response.status);
           }
           return response;
         }).catch(error => {
           if (typeof url === 'string' && (url.includes('noise') || url.includes('denoise') || url.includes('audio') || url.includes('.wasm'))) {
             console.error('❌ Audio-related request failed:', url, error);
           }
           throw error;
         });
       };
       
       // 监控AudioWorklet的使用
       if (typeof AudioContext !== 'undefined') {
         const OriginalAudioContext = AudioContext;
         window.AudioContext = function(...args) {
           const ctx = new OriginalAudioContext(...args);
           console.log('🎵 AudioContext created:', ctx.state);
           
           // 监控addModule调用
           if (ctx.audioWorklet) {
             const originalAddModule = ctx.audioWorklet.addModule.bind(ctx.audioWorklet);
             ctx.audioWorklet.addModule = function(moduleURL, options) {
               console.log('🔧 AudioWorklet.addModule called:', moduleURL);
               return originalAddModule(moduleURL, options).then(result => {
                 console.log('✅ AudioWorklet module loaded successfully:', moduleURL);
                 return result;
               }).catch(error => {
                 console.error('❌ AudioWorklet module failed to load:', moduleURL, error);
                 throw error;
               });
             };
           }
           
           return ctx;
         };
         
         // 复制原型
         Object.setPrototypeOf(window.AudioContext.prototype, OriginalAudioContext.prototype);
         Object.setPrototypeOf(window.AudioContext, OriginalAudioContext);
       }
       
       // 检查WebAssembly支持
        if (typeof WebAssembly !== 'undefined') {
          console.log('WebAssembly is supported');
          console.log('WebAssembly.instantiateStreaming:', typeof WebAssembly.instantiateStreaming);
          
          // 监控WASM模块加载
          const originalInstantiate = WebAssembly.instantiate;
          WebAssembly.instantiate = function(...args) {
            console.log('WebAssembly.instantiate called with:', args[0]);
            return originalInstantiate.apply(this, args).then(result => {
              console.log('WebAssembly module instantiated successfully');
              return result;
            }).catch(error => {
              console.error('WebAssembly instantiation failed:', error);
              throw error;
            });
          };
          
          if (WebAssembly.instantiateStreaming) {
            const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
            WebAssembly.instantiateStreaming = function(...args) {
              console.log('WebAssembly.instantiateStreaming called with:', args[0]);
              return originalInstantiateStreaming.apply(this, args).then(result => {
                console.log('WebAssembly streaming instantiation successful');
                return result;
              }).catch(error => {
                console.error('WebAssembly streaming instantiation failed:', error);
                throw error;
              });
            };
          }
        } else {
          console.error('WebAssembly is not supported');
        }
        
        // 检查SharedArrayBuffer支持
        if (typeof SharedArrayBuffer !== 'undefined') {
          console.log('SharedArrayBuffer is supported');
        } else {
          console.warn('SharedArrayBuffer is not supported - some features may not work');
        }
        
        // 检查跨域隔离状态
        console.log('crossOriginIsolated:', window.crossOriginIsolated);
        
        // 监控fetch请求（特别是WASM文件）
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
          const url = args[0];
          if (typeof url === 'string' && (url.includes('.wasm') || url.includes('wasm'))) {
            console.log('Fetching WASM file:', url);
          }
          return originalFetch.apply(this, args).then(response => {
            if (typeof url === 'string' && (url.includes('.wasm') || url.includes('wasm'))) {
              console.log('WASM fetch response:', response.status, response.statusText);
            }
            return response;
          }).catch(error => {
            if (typeof url === 'string' && (url.includes('.wasm') || url.includes('wasm'))) {
              console.error('WASM fetch failed:', url, error);
            }
            throw error;
          });
        };
       
       // 确保音频元素可用于WebRTC
        window.ensureAudioElement = function() {
          if (!window.remoteAudio) {
            window.remoteAudio = document.createElement('audio');
            window.remoteAudio.autoplay = true;
            window.remoteAudio.controls = false;
            window.remoteAudio.style.display = 'none';
            
            // 确保DOM准备好后再添加到body
            if (document.body) {
              document.body.appendChild(window.remoteAudio);
              console.log('Remote audio element created and added to body');
            } else {
              // 如果DOM还没准备好，等待DOMContentLoaded事件
              document.addEventListener('DOMContentLoaded', function() {
                if (document.body && window.remoteAudio && !window.remoteAudio.parentNode) {
                  document.body.appendChild(window.remoteAudio);
                  console.log('Remote audio element added to body after DOM ready');
                }
              });
              console.log('Remote audio element created, waiting for DOM ready');
            }
          }
          return window.remoteAudio;
        };
        
        // 重写RTCPeerConnection的ontrack处理
        if (window.RTCPeerConnection) {
          const originalRTCPeerConnection = window.RTCPeerConnection;
          window.RTCPeerConnection = function(...args) {
            try {
              const pc = new originalRTCPeerConnection(...args);
              
              // 保存原始的ontrack处理函数
              const originalOntrack = pc.ontrack;
              
              // 添加track事件监听器
              pc.addEventListener('track', function(event) {
                try {
                  console.log('Track received:', event.track.kind);
                  
                  // 处理音频轨道
                  if (event.track && event.track.kind === 'audio') {
                    // 确保音频元素存在
                    const audioElement = window.ensureAudioElement();
                    
                    // 尝试连接音频流
                    if (event.streams && event.streams.length > 0) {
                      try {
                        audioElement.srcObject = event.streams[0];
                        console.log('Audio stream attached to element');
                        
                        // 确保音频播放
                        audioElement.play().then(() => {
                          console.log('Audio playback started successfully');
                        }).catch(err => {
                          console.warn('Audio playback failed to start:', err);
                          // 尝试自动播放失败时的备用方案
                          document.addEventListener('click', function audioClickHandler() {
                            audioElement.play();
                            document.removeEventListener('click', audioClickHandler);
                            console.log('Audio playback started after user interaction');
                          }, { once: true });
                        });
                      } catch (streamErr) {
                        console.error('Error attaching audio stream:', streamErr);
                        // 创建备用音频元素
                        const backupAudio = document.createElement('audio');
                        backupAudio.autoplay = true;
                        backupAudio.srcObject = event.streams[0];
                        console.log('Created backup audio element as fallback');
                      }
                    } else {
                      console.warn('Audio track received but no streams available');
                    }
                  }
                } catch (trackErr) {
                  console.error('Error in track event handler:', trackErr);
                }
              });
              
              return pc;
            } catch (pcErr) {
              console.error('Error creating RTCPeerConnection:', pcErr);
              // 出错时回退到原始构造函数
              return new originalRTCPeerConnection(...args);
            }
          };
          
          // 复制原始构造函数的属性
          Object.setPrototypeOf(window.RTCPeerConnection.prototype, originalRTCPeerConnection.prototype);
          Object.setPrototypeOf(window.RTCPeerConnection, originalRTCPeerConnection);
          console.log('RTCPeerConnection successfully enhanced for audio handling');
        }
        
        console.log('Media APIs, WebAssembly and WebRTC audio initialized');
     `);
  });

  // 页面导航时设置标题
  mainWindow.webContents.on('did-navigate', () => {
    mainWindow.setTitle('Convbased Desktop');
  });

  // 页面导航完成时设置标题
  mainWindow.webContents.on('did-navigate-in-page', () => {
    mainWindow.setTitle('Convbased Desktop');
  });

  // 定期检查标题（作为备用机制）
  const titleInterval = setInterval(forceTitle, 100); // 每100ms检查一次
  
  // 窗口关闭时清除定时器
  mainWindow.on('closed', () => {
    if (titleInterval) {
      clearInterval(titleInterval);
    }
  });

  // 处理窗口关闭事件
  mainWindow.on('close', (event) => {
    if (!isQuiting && !pendingClose) {
      event.preventDefault();
      
      // 检查是否记住了用户选择
      const settings = readSettings();
      let closeAction = settings.closeAction;
      
      if (!closeAction) {
        // 显示Vue组件对话框
        pendingClose = true;
        createCloseDialog();
      } else {
        // 直接执行已保存的选择
        handleCloseAction(closeAction);
      }
    }
  });

  // Add webContents error handling
  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error('WebContents crashed:', { killed });
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.error('WebContents became unresponsive');
  });

  mainWindow.webContents.on('responsive', () => {
    console.log('WebContents became responsive again');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error('Failed to load:', { errorCode, errorDescription, validatedURL, isMainFrame });
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    // Filter out common Electron warnings
    if (message.includes('Script failed to execute') || 
        message.includes('UnhandledPromiseRejectionWarning')) {
      console.log('[Filtered Console Message]:', message);
      return;
    }
    console.log(`Console [${level}]:`, message);
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prevent navigation to external links
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const currentUrl = new URL(mainWindow.webContents.getURL());
    
    // Allow navigation within the same domain
    if (parsedUrl.origin !== currentUrl.origin) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });
}

function updateCloseAction(action) {
  const settings = readSettings();
  settings.closeAction = action;
  saveSettings(settings);
  
  // 重新创建托盘菜单以更新圆点显示
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray || tray.isDestroyed()) {
    return;
  }
  
  // 获取当前设置
  const settings = readSettings();
  const currentCloseAction = settings.closeAction || 'ask';
  
  // 创建新的托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: '重新加载',
      click: () => {
        mainWindow.reload();
      }
    },
    {
      type: 'separator'
    },
    {
      label: '设置',
      submenu: [
        {
          label: '关闭设置',
          enabled: false
        },
        {
          type: 'separator'
        },
        {
          label: currentCloseAction === 'minimize' ? '● 最小化到系统托盘' : '最小化到系统托盘',
          click: () => {
            updateCloseAction('minimize');
          }
        },
        {
          label: currentCloseAction === 'exit' ? '● 立即退出应用' : '立即退出应用',
          click: () => {
            updateCloseAction('exit');
          }
        },
        {
          label: currentCloseAction === 'ask' ? '● 每次询问我的选择' : '每次询问我的选择',
          click: () => {
            updateCloseAction('ask');
          }
        }
      ]
    },
    {
      type: 'separator'
    },
    {
      label: '开发者工具',
      click: () => {
        mainWindow.webContents.openDevTools();
      }
    },
    {
      type: 'separator'
    },
    {
      label: '退出',
      click: () => {
        isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  // 更新托盘菜单
  tray.setContextMenu(contextMenu);
}

function createTray() {
  // 创建系统托盘
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  tray = new Tray(iconPath);
  
  // 设置托盘提示文本
  tray.setToolTip('Convbased Desktop');
  
  // 创建托盘菜单
  updateTrayMenu();
  
  // 双击托盘图标显示窗口
  tray.on('double-click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Add global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

// Handle renderer process crashes
app.on('render-process-gone', (event, webContents, details) => {
  console.error('Renderer process gone:', details);
});

// Handle child process crashes
app.on('child-process-gone', (event, details) => {
  console.error('Child process gone:', details);
});

// Called when Electron has finished initialization and is ready to create browser windows
app.whenReady().then(() => {
  // Set permission handler to allow all media access requests
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('Permission requested:', permission);
    // Allow all permission requests including microphone, camera, notifications, etc.
    callback(true);
  });
  
  // Set permission check handler
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    console.log('Permission check:', permission, 'from:', requestingOrigin);
    // Allow all permission checks
    return true;
  });
  
  // 设置设备权限处理器
  session.defaultSession.setDevicePermissionHandler((details) => {
    console.log('Device permission requested:', details);
    return true;
  });
  
  // Handle certificate errors
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    callback(0); // Ignore all certificate errors
  });
  
  // Disable network security policies and add cross-origin isolation support
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = {
      ...details.responseHeaders,
      'Access-Control-Allow-Origin': ['*'],
      'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS'],
      'Access-Control-Allow-Headers': ['*']
    };
    
    // Completely remove CSP to avoid restrictions
    delete responseHeaders['Content-Security-Policy'];
    delete responseHeaders['content-security-policy'];
    
    // For WASM files, use more relaxed cross-origin policy
    if (details.url.includes('.wasm') || details.url.includes('wasm')) {
      responseHeaders['Cross-Origin-Embedder-Policy'] = ['credentialless'];
      responseHeaders['Cross-Origin-Opener-Policy'] = ['unsafe-none'];
      responseHeaders['Cross-Origin-Resource-Policy'] = ['cross-origin'];
    } else {
      // 对于其他资源，保持原有的跨域隔离设置
      responseHeaders['Cross-Origin-Embedder-Policy'] = ['require-corp'];
      responseHeaders['Cross-Origin-Opener-Policy'] = ['same-origin'];
      responseHeaders['Cross-Origin-Resource-Policy'] = ['cross-origin'];
    }
    
    callback({ responseHeaders });
  });
  
  // Add request headers to support SharedArrayBuffer and WASM
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    // For WASM file requests, use more relaxed policy
    if (details.url.includes('.wasm') || details.url.includes('wasm')) {
      details.requestHeaders['Cross-Origin-Embedder-Policy'] = 'credentialless';
      details.requestHeaders['Cross-Origin-Opener-Policy'] = 'unsafe-none';
    } else {
      details.requestHeaders['Cross-Origin-Embedder-Policy'] = 'require-corp';
      details.requestHeaders['Cross-Origin-Opener-Policy'] = 'same-origin';
    }
    
    // Add general CORS headers
    details.requestHeaders['Access-Control-Allow-Origin'] = '*';
    details.requestHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    details.requestHeaders['Access-Control-Allow-Headers'] = '*';
    
    callback({ requestHeaders: details.requestHeaders });
  });
  
  createWindow();
  createTray();
  
  app.on('activate', () => {
    // On macOS, when clicking the dock icon and no other windows are open,
    // it's common to re-create a window in the app.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

// Exit app when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, unless the user explicitly quits with Cmd + Q,
  // most apps and their menu bar remain active.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up before app exit
app.on('before-quit', () => {
  isQuiting = true;
});

// Handle close action
function handleCloseAction(action) {
  if (action === 'minimize') {
    mainWindow.hide();
    
    // Show notification when first minimized to tray
    if (!mainWindow.isVisible()) {
      tray.displayBalloon({
        iconType: 'info',
        title: 'Convbased Desktop',
        content: '应用已最小化到系统托盘，点击托盘图标可重新打开。'
      });
    }
  } else if (action === 'exit') {
    isQuiting = true;
    app.quit();
  } else if (action === 'ask') {
    // Show close dialog for user to choose
    pendingClose = true;
    createCloseDialog();
    return; // Don't set pendingClose to false, wait for dialog completion
  }
  pendingClose = false;
}

// 处理来自渲染进程的消息
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-window', () => {
  mainWindow.show();
  mainWindow.focus();
});

ipcMain.handle('hide-window', () => {
  mainWindow.hide();
});

// 设置相关的IPC处理程序已移除，现在使用托盘菜单直接设置

// 处理关闭对话框结果
ipcMain.on('close-dialog-result', (event, result) => {
  if (closeDialogWindow) {
    closeDialogWindow.close();
  }
  
  if (result.action === 'cancel') {
    pendingClose = false;
    return;
  }
  
  // 如果用户选择记住选择，保存到设置文件
  if (result.remember) {
    const settings = readSettings();
    settings.closeAction = result.action;
    saveSettings(settings);
  }
  
  // 执行关闭动作
  handleCloseAction(result.action);
});

// 防止应用被意外关闭
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});