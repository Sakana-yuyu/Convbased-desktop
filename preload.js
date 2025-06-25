const { contextBridge, ipcRenderer } = require('electron');

// Expose secure APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Get application version
  getVersion: () => ipcRenderer.invoke('app-version'),
  
  // Show window
  showWindow: () => ipcRenderer.invoke('show-window'),
  
  // Hide window
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  
  // Listen to window events
  onWindowEvent: (callback) => {
    ipcRenderer.on('window-event', callback);
  },
  
  // Close dialog related APIs
  sendCloseDialogResult: (result) => {
    ipcRenderer.send('close-dialog-result', result);
  },
  
  onShowCloseDialog: (callback) => {
    ipcRenderer.on('show-close-dialog', callback);
  },
  
  // Network request log related APIs
  getRequestLog: () => ipcRenderer.invoke('get-request-log'),
  
  clearRequestLog: () => ipcRenderer.invoke('clear-request-log'),
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Add global debug functions
contextBridge.exposeInMainWorld('debugAPI', {
  // Show network request log
  showRequestLog: async () => {
    const log = await ipcRenderer.invoke('get-request-log');
    console.group('📋 Network Request Log');
    log.forEach((entry, index) => {
      if (entry.url.includes('.wasm') || entry.url.includes('wasm') || 
          entry.url.includes('audio') || entry.url.includes('noise') || 
          entry.url.includes('denoise')) {
        console.log(`${index + 1}. [${entry.timestamp}] ${entry.method} ${entry.url}`);
      }
    });
    console.groupEnd();
    return log;
  },
  
  // Clear request log
  clearLog: () => ipcRenderer.invoke('clear-request-log'),
  
  // Filter audio-related requests
  getAudioRequests: async () => {
    const log = await ipcRenderer.invoke('get-request-log');
    return log.filter(entry => 
      entry.url.includes('.wasm') || entry.url.includes('wasm') || 
      entry.url.includes('audio') || entry.url.includes('noise') || 
      entry.url.includes('denoise') || entry.resourceType === 'media'
    );
  }
});

// Add error handlers for renderer process
window.addEventListener('error', (event) => {
  console.error('Window Error:', event.error);
  event.preventDefault();
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
  event.preventDefault();
});

// Execute some initialization operations after page loading
window.addEventListener('DOMContentLoaded', () => {
  // Can add some page enhancement features here
  console.log('Convbased Desktop App loaded');
  
  // Add additional error handling for scripts
  const originalConsoleError = console.error;
  console.error = function(...args) {
    // Filter out common Electron warnings that are not critical
    const message = args.join(' ');
    if (message.includes('Script failed to execute') || 
        message.includes('UnhandledPromiseRejectionWarning')) {
      // Log but don't throw for these specific errors
      originalConsoleError.apply(console, ['[Filtered Error]:', ...args]);
      return;
    }
    originalConsoleError.apply(console, args);
  };
  
  // Add some keyboard shortcut support
  document.addEventListener('keydown', (event) => {
    // Ctrl+R or F5 to refresh page
    if ((event.ctrlKey && event.key === 'r') || event.key === 'F5') {
      event.preventDefault();
      window.location.reload();
    }
    
    // Ctrl+Shift+I to open developer tools (handled in main process)
    if (event.ctrlKey && event.shiftKey && event.key === 'I') {
      event.preventDefault();
      // This shortcut is handled by main process
    }
    
    // Esc key to minimize to tray
    if (event.key === 'Escape') {
      event.preventDefault();
      window.electronAPI.hideWindow();
    }
  });
});