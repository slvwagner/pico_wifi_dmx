'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('picoShell', {
  close: () => ipcRenderer.send('shell:close'),
  exitFullscreen: () => ipcRenderer.send('shell:exit-fullscreen'),
  home: () => ipcRenderer.send('shell:home'),
  openBrowser: () => ipcRenderer.send('shell:browser'),
  reload: () => ipcRenderer.send('shell:reload'),
  toggleFullscreen: () => ipcRenderer.send('shell:fullscreen'),
  onFullscreenState: (callback) =>
    ipcRenderer.on('shell:fullscreen-state', (_event, value) => callback(value)),
  onStatus: (callback) =>
    ipcRenderer.on('shell:status', (_event, value) => callback(value)),
});
