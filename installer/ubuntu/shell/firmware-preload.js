'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('picoFirmware', {
  discover: () => ipcRenderer.invoke('firmware:discovery'),
  run: (operation) => ipcRenderer.invoke('firmware:run', operation),
  onCloseBlocked: (callback) => ipcRenderer.on('firmware:close-blocked', callback),
  onOutput: (callback) => ipcRenderer.on('firmware:output', (_event, value) => callback(value)),
});
