const { contextBridge, ipcRenderer } = require('electron');

// 向渲染进程暴露安全的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取应用版本
  getVersion: () => ipcRenderer.invoke('app-version'),
  
  // 显示窗口
  showWindow: () => ipcRenderer.invoke('show-window'),
  
  // 隐藏窗口
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  
  // 监听窗口事件
  onWindowEvent: (callback) => {
    ipcRenderer.on('window-event', callback);
  },
  
  // 关闭对话框相关API
  sendCloseDialogResult: (result) => {
    ipcRenderer.send('close-dialog-result', result);
  },
  
  onShowCloseDialog: (callback) => {
    ipcRenderer.on('show-close-dialog', callback);
  },
  
  // 移除监听器
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// 在页面加载完成后执行一些初始化操作
window.addEventListener('DOMContentLoaded', () => {
  // 可以在这里添加一些页面增强功能
  console.log('Convbased Desktop App loaded');
  
  // 添加一些快捷键支持
  document.addEventListener('keydown', (event) => {
    // Ctrl+R 或 F5 刷新页面
    if ((event.ctrlKey && event.key === 'r') || event.key === 'F5') {
      event.preventDefault();
      window.location.reload();
    }
    
    // Ctrl+Shift+I 打开开发者工具（在主进程中处理）
    if (event.ctrlKey && event.shiftKey && event.key === 'I') {
      event.preventDefault();
      // 这个快捷键由主进程处理
    }
    
    // Esc 键最小化到托盘
    if (event.key === 'Escape') {
      event.preventDefault();
      window.electronAPI.hideWindow();
    }
  });
});