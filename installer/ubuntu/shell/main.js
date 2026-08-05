'use strict';

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  WebContentsView,
  ipcMain,
  nativeImage,
  nativeTheme,
  net,
  session,
  shell,
} = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');

const SHELL_TOP_NORMAL = 76;
const SHELL_TOP_FULLSCREEN = 44;
const SHELL_BOTTOM_NORMAL = 28;
const CONTROLLER_FALLBACK = 'http://127.0.0.1:8090/';
const DARK_SURFACE = '#1c212a';
const DARK_BACKGROUND = '#12161d';
const EXIT_KEEP_SERVER = 20;
const EXIT_STOP_SERVER = 21;

let mainWindow = null;
let controllerView = null;
let tray = null;
let controllerUrl = normalizeControllerUrl(readArgument('--url'));
const openFirmwareOnStart = process.argv.includes('--firmware');
let fullscreen = false;
let exitChoiceOpen = false;
let exitChoiceResolver = null;
let firmwareViewOpen = false;
let firmwareBusy = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.commandLine.appendSwitch('class', 'pico-dmx-controller');
app.on('second-instance', () => restoreWindow());
app.setName('WiFiPicoDMX');
nativeTheme.themeSource = 'dark';

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  configureControllerPermissions();
  createWindow();
  createTray();
  registerShellActions();
  await openController();
  if (openFirmwareOnStart) openFirmwareUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
    void openController();
  } else {
    restoreWindow();
  }
});

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');
  mainWindow = new BrowserWindow({
    title: 'WiFiPicoDMX',
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: DARK_BACKGROUND,
    icon: iconPath,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: DARK_SURFACE,
      symbolColor: '#e6ebf2',
      height: 44,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      devTools: false,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  controllerView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      devTools: false,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.contentView.addChildView(controllerView);
  controllerView.webContents.session.clearCache().catch((error) => {
    console.error(`Could not clear the controller disk cache: ${error.message}`);
  });
  mainWindow.loadFile(path.join(__dirname, 'shell.html'));
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('resize', layoutController);
  mainWindow.on('enter-full-screen', () => setFullscreenState(true));
  mainWindow.on('leave-full-screen', () => setFullscreenState(false));
  mainWindow.on('close', (event) => {
    event.preventDefault();
    if (firmwareViewOpen) {
      if (firmwareBusy) {
        mainWindow?.webContents.send('firmware:close-blocked');
      } else {
        restoreControllerShell();
      }
      return;
    }
    void requestExit();
  });
  mainWindow.on('closed', () => {
    if (controllerView && !controllerView.webContents.isDestroyed()) {
      controllerView.webContents.close();
    }
    controllerView = null;
    mainWindow = null;
  });

  for (const webContents of [
    mainWindow.webContents,
    controllerView.webContents,
  ]) {
    webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'F11') {
        event.preventDefault();
        toggleFullscreen();
      } else if (input.key === 'Escape' && fullscreen) {
        event.preventDefault();
        toggleFullscreen();
      }
    });
  }

  controllerView.webContents.on('did-start-loading', () => {
    sendStatus('Loading…');
  });
  controllerView.webContents.on('did-finish-load', () => {
    sendStatus('Ready — when closing, choose whether the server should keep running.');
  });
  controllerView.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return;
      sendStatus(`Page load failed: ${errorDescription}`);
      console.error(`Could not load ${validatedUrl}: ${errorDescription}`);
    },
  );
  controllerView.webContents.setWindowOpenHandler(({ url }) => {
    if (isControllerUrl(url)) {
      controllerView.webContents.loadURL(url);
    } else {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  controllerView.webContents.on('context-menu', (event) => event.preventDefault());
  controllerView.webContents.on('will-navigate', (event, url) => {
    if (isControllerUrl(url)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });

  layoutController();
}

function createTray() {
  const image = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
  tray = new Tray(image.resize({ width: 22, height: 22 }));
  tray.setToolTip('WiFiPicoDMX');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open', click: restoreWindow },
    { label: 'Toggle full screen', click: () => {
      restoreWindow();
      toggleFullscreen();
    } },
    { type: 'separator' },
    { label: 'Exit…', click: () => void requestExit() },
  ]));
  tray.on('double-click', restoreWindow);
}

function registerShellActions() {
  ipcMain.on('shell:home', () => {
    void controllerView?.webContents.loadURL(controllerUrl);
  });
  ipcMain.on('shell:reload', () => controllerView?.webContents.reload());
  ipcMain.on('shell:fullscreen', toggleFullscreen);
  ipcMain.on('shell:exit-fullscreen', () => {
    if (fullscreen) toggleFullscreen();
  });
  ipcMain.on('shell:close', () => void requestExit());
  ipcMain.on('shell:browser', () => void shell.openExternal(controllerUrl));
  ipcMain.on('shell:firmware', openFirmwareUpdater);
  ipcMain.on('shell:menu-state', (_event, open) => {
    if (open) {
      controllerView?.setVisible(false);
    } else if (!exitChoiceOpen) {
      controllerView?.setVisible(true);
    }
  });
  ipcMain.on('shell:exit-choice', (_event, choice) => {
    if (!exitChoiceResolver || !['keep', 'stop', 'cancel'].includes(choice)) return;
    const resolve = exitChoiceResolver;
    exitChoiceResolver = null;
    controllerView?.setVisible(true);
    resolve(choice);
  });
  ipcMain.handle('firmware:run', (_event, operation) => runFirmwareHelper(operation));
  ipcMain.on('firmware:close', () => {
    if (!firmwareBusy) restoreControllerShell();
  });
  ipcMain.handle('firmware:discovery', async () => {
    const response = await net.fetch(new URL('pico_discovery.php', controllerUrl), {
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Controller returned HTTP ${response.status}.`);
    return response.json();
  });
}

function openFirmwareUpdater() {
  if (!mainWindow || firmwareViewOpen) return;
  firmwareViewOpen = true;
  controllerView?.setVisible(false);
  void mainWindow.loadFile(path.join(__dirname, 'firmware.html'));
}

function restoreControllerShell() {
  if (!mainWindow || !firmwareViewOpen) return;
  firmwareViewOpen = false;
  void mainWindow.loadFile(path.join(__dirname, 'shell.html')).then(() => {
    controllerView?.setVisible(true);
    layoutController();
    sendStatus('Ready — when closing, choose whether the server should keep running.');
  });
}

function runFirmwareHelper(operation) {
  const argumentsByOperation = {
    validate: '--validate-only',
    probe: '--probe-only',
    flash: '--flash',
  };
  const argument = argumentsByOperation[operation];
  if (!argument) return Promise.reject(new Error('Unknown firmware operation.'));
  if (firmwareBusy) return Promise.reject(new Error('Firmware work is already running.'));
  firmwareBusy = true;
  return new Promise((resolve) => {
    const helper = path.join(process.resourcesPath, '..', '..', 'support', 'flash_firmware.sh');
    const child = spawn(helper, [argument], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const append = (chunk) => {
      const text = chunk.toString();
      output += text;
      mainWindow?.webContents.send('firmware:output', text);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', (error) => append(`Error: ${error.message}\n`));
    child.on('close', (code) => {
      firmwareBusy = false;
      resolve({ exitCode: Number.isInteger(code) ? code : -1, output });
    });
  });
}

async function openController() {
  sendStatus('Starting WiFiPicoDMX…');
  const available = await waitForServer(controllerUrl, 20000);
  if (!available) {
    sendStatus('The local server did not answer; loading it for another retry…');
  }
  await controllerView?.webContents.loadURL(controllerUrl);
}

async function requestExit() {
  if (exitChoiceOpen) return;
  exitChoiceOpen = true;
  try {
    const choice = await showExitChoice();
    if (choice === 'keep') {
      app.exit(EXIT_KEEP_SERVER);
    } else if (choice === 'stop') {
      app.exit(EXIT_STOP_SERVER);
    }
  } finally {
    exitChoiceOpen = false;
  }
}

function showExitChoice() {
  if (!mainWindow || mainWindow.isDestroyed()) return Promise.resolve('cancel');
  restoreWindow();
  return new Promise((resolve) => {
    exitChoiceResolver = resolve;
    controllerView?.setVisible(false);
    mainWindow.webContents.send('shell:show-exit-choice');
  });
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await net.fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(2000),
      });
      if (response.status >= 200 && response.status < 500) return true;
    } catch {
      // The service may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

function configureControllerPermissions() {
  const allowedPermissions = new Set(['midi', 'midiSysex']);
  const isAllowed = (permission, requestingOrigin) =>
    allowedPermissions.has(permission) && isControllerUrl(requestingOrigin);

  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission, requestingOrigin) =>
      isAllowed(permission, requestingOrigin),
  );
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback, details) =>
      callback(isAllowed(permission, details.requestingUrl)),
  );
}

function toggleFullscreen() {
  if (!mainWindow) return;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
}

function setFullscreenState(value) {
  fullscreen = value;
  mainWindow?.webContents.send('shell:fullscreen-state', value);
  layoutController();
}

function layoutController() {
  if (!mainWindow || !controllerView) return;
  const [width, height] = mainWindow.getContentSize();
  const top = fullscreen ? SHELL_TOP_FULLSCREEN : SHELL_TOP_NORMAL;
  const bottom = fullscreen ? 0 : SHELL_BOTTOM_NORMAL;
  controllerView.setBounds({
    x: 0,
    y: top,
    width,
    height: Math.max(1, height - top - bottom),
  });
}

function restoreWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function sendStatus(message) {
  mainWindow?.webContents.send('shell:status', message);
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length
    ? process.argv[index + 1]
    : null;
}

function normalizeControllerUrl(value) {
  try {
    const parsed = new URL(value || CONTROLLER_FALLBACK);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return CONTROLLER_FALLBACK;
    }
    if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
      return CONTROLLER_FALLBACK;
    }
    return parsed.href;
  } catch {
    return CONTROLLER_FALLBACK;
  }
}

function isControllerUrl(value) {
  try {
    return new URL(value).origin === new URL(controllerUrl).origin;
  } catch {
    return false;
  }
}
