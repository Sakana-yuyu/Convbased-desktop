const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 获取当前设置
  getSettings: () => ipcRenderer.invoke('get-settings'),
  
  // 保存设置
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // 关闭设置窗口
  closeSettings: () => ipcRenderer.send('close-settings')
});