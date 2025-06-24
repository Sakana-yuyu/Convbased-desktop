const { contextBridge, ipcRenderer } = require('electron');

// 向关闭对话框渲染进程暴露安全的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 发送关闭对话框结果
  sendCloseDialogResult: (result) => {
    ipcRenderer.send('close-dialog-result', result);
  },
  
  // 监听显示关闭对话框事件
  onShowCloseDialog: (callback) => {
    ipcRenderer.on('show-close-dialog', callback);
  },
  
  // 移除监听器
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// 页面加载完成后的初始化
window.addEventListener('DOMContentLoaded', () => {
  console.log('Close Dialog loaded');
});