const { app, BrowserWindow, Tray, Menu, shell, ipcMain } = require('electron');
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
      console.log('已创建默认设置文件:', settingsPath);
      return defaultSettings;
    }
  } catch (error) {
    console.error('读取设置文件失败:', error);
    // 如果读取失败，也尝试创建默认设置文件
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
    console.error('保存设置文件失败:', error);
  }
}

// 确保只有一个应用实例运行
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 当运行第二个实例时，将焦点放在主窗口上
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
      webSecurity: true
    },
    show: false, // 初始不显示，等加载完成后显示
    titleBarStyle: 'default'
  });

  // 设置User-Agent
  mainWindow.webContents.setUserAgent('convbased-desktop');
  
  // 加载目标网页
  mainWindow.loadURL('https://weights.chat/#/auth/login');

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

  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 阻止导航到外部链接
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const currentUrl = new URL(mainWindow.webContents.getURL());
    
    // 允许在同一域名内导航
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

// 当 Electron 完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  createWindow();
  createTray();
  
  app.on('activate', () => {
    // 在 macOS 上，当点击 dock 图标并且没有其他窗口打开时，
    // 通常在应用程序中重新创建一个窗口。
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

// 当所有窗口都被关闭时退出应用
app.on('window-all-closed', () => {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 在应用退出前清理
app.on('before-quit', () => {
  isQuiting = true;
});

// 处理关闭动作
function handleCloseAction(action) {
  if (action === 'minimize') {
    mainWindow.hide();
    
    // 首次最小化到托盘时显示提示
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
    // 显示关闭对话框让用户选择
    pendingClose = true;
    createCloseDialog();
    return; // 不设置pendingClose为false，等对话框处理完成
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