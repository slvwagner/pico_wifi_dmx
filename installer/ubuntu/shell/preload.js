'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('picoShell', {
  close: () => ipcRenderer.send('shell:close'),
  exitFullscreen: () => ipcRenderer.send('shell:exit-fullscreen'),
  home: () => ipcRenderer.send('shell:home'),
  openFirmware: () => ipcRenderer.send('shell:firmware'),
  openBrowser: () => ipcRenderer.send('shell:browser'),
  reload: () => ipcRenderer.send('shell:reload'),
  setMenuOpen: (open) => ipcRenderer.send('shell:menu-state', Boolean(open)),
  toggleFullscreen: () => ipcRenderer.send('shell:fullscreen'),
  chooseExit: (choice) => ipcRenderer.send('shell:exit-choice', choice),
  onFullscreenState: (callback) =>
    ipcRenderer.on('shell:fullscreen-state', (_event, value) => callback(value)),
  onStatus: (callback) =>
    ipcRenderer.on('shell:status', (_event, value) => callback(value)),
  onShowExitChoice: (callback) =>
    ipcRenderer.on('shell:show-exit-choice', () => callback()),
});

contextBridge.exposeInMainWorld('picoFirmware', {
  close: () => ipcRenderer.send('firmware:close'),
  discover: () => ipcRenderer.invoke('firmware:discovery'),
  run: (operation) => ipcRenderer.invoke('firmware:run', operation),
  onCloseBlocked: (callback) => ipcRenderer.on('firmware:close-blocked', callback),
  onOutput: (callback) => ipcRenderer.on('firmware:output', (_event, value) => callback(value)),
});
