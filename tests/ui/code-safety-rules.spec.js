const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test.describe('Code safety regression rules', () => {
  test('VS Code configures CMake targets after its extension state is reloaded', () => {
    const settings = read('.vscode/settings.json');
    const launch = read('.vscode/launch.json');
    const kits = read('.vscode/cmake-kits.json');

    expect(settings).toMatch(/"cmake\.configureOnOpen"\s*:\s*true/);
    expect(launch).not.toMatch(/^\s*\d+\s+"name":/m);
    expect(launch).toContain('"name": "Pico Debug (Cortex-Debug)"');
    expect(kits).not.toContain('${command:raspberry-pi-pico.');
  });

  test('every Plane canvas redraws aspect-correct fixture guide lines after resizing', () => {
    const common = read('web/assets/dmx-common.js');
    expect(common).toContain('function drawRoomPlaneLine');
    expect(common).toContain("line.style.width=Math.sqrt(dx*dx+dy*dy)+'px'");

    for (const page of [
      ['web/dmx_fixture_controller.html', 'controllerPlanePad', 'queueControllerPlaneRender'],
      ['web/dmx_chaser.html', 'chaserPlanePad', 'queueChaserPlaneRender'],
      ['web/dmx_motion.html', 'motionPlanePad', 'queueMotionPlaneRender'],
      ['web/dmx_show.html', 'showPlanePad', 'queueShowPlaneRender']
    ]) {
      const source = read(page[0]);
      expect(source, page[0]).toContain('DmxCommon.drawRoomPlaneLine');
      expect(source, page[0]).toContain(`DmxCommon.observeElementResize(${page[1]},${page[2]})`);
    }
  });

  test('all application pages use one shared cache version for common JavaScript and CSS assets', async () => {
    const webRoot = path.join(root, 'web');
    const pages = fs.readdirSync(webRoot)
      .filter(name => name.endsWith('.html'))
      .map(name => ({ name, source: fs.readFileSync(path.join(webRoot, name), 'utf8') }))
      .filter(page => page.source.includes('dmx-common.js'));
    const commonVersions = new Set();
    const cssVersions = new Set();
    for (const page of pages) {
      const common = page.source.match(/dmx-common\.js\?v=([^"']+)/);
      const css = page.source.match(/dmx-ui\.css\?v=([^"']+)/);
      expect(common, page.name + ' must cache-version dmx-common.js').toBeTruthy();
      expect(css, page.name + ' must cache-version dmx-ui.css').toBeTruthy();
      commonVersions.add(common[1]);
      cssVersions.add(css[1]);
    }
    expect([...commonVersions]).toHaveLength(1);
    expect([...cssVersions]).toHaveLength(1);
  });

  test('programming-page Group Edit recalls stop affected Pico playback but Show Run does not', () => {
    const common = read('web/assets/dmx-common.js');
    expect(common).toContain('async function stopPlaybackForFixtures');
    expect(common).toContain("['chaser','motion'].forEach");

    for (const page of [
      'web/dmx_fixture_controller.html',
      'web/dmx_chaser.html',
      'web/dmx_motion.html',
      'web/dmx_room_plane.html'
    ]) {
      expect(read(page), page).toContain('await DmxCommon.stopPlaybackForFixtures');
    }
    expect(read('web/dmx_show.html')).not.toContain('DmxCommon.stopPlaybackForFixtures');
  });

  test('firmware owns generated responses and POST bodies per connection', () => {
    const main = read('firmware/main.cpp');
    const lwip = read('firmware/lwipopts.h');

    expect(lwip).toContain('#define LWIP_HTTPD_FILE_EXTENSION 1');
    expect(main).toContain('file_->pextension = copy;');
    expect(main).toContain('free(file->pextension);');
    expect(main).toContain('void *connection;');
    expect(main).toContain('find_post_state(connection)');
    expect(main).toContain('state->length != state->expected_length');
    expect(main).not.toContain('static char    post_buffer[POST_BUFFER_MAX]');
  });

  test('Pico Effects firmware supports finite loops and reports their progress', () => {
    const header = read('firmware/pico_motion.h');
    const motion = read('firmware/pico_motion.cpp');
    const main = read('firmware/main.cpp');

    expect(header).toContain('MFX_MODE_SINGLE');
    expect(header).toContain('MFX_MODE_LOOP_N');
    expect(header).toContain('completed_loops');
    expect(motion).toContain('strncmp(line, "MODE ", 5)');
    expect(motion).toContain('strncmp(line, "LOOPS ", 6)');
    expect(motion).toContain('sd->mode != MFX_MODE_LOOP && completed >= (float)limit');
    expect(motion).toContain('if (!active_touch && previously_touched[ch])');
    expect(motion).toContain('scratch[ch] = dmx_engine_get_base_channel(ch);');
    expect(main).toContain('\\"loop_count\\":%u,\\"completed_loops\\":%u');
  });

  test('JSON read-modify-write updates hold one exclusive transaction lock', () => {
    const store = read('api/json_store.php');
    for (const endpoint of ['api/chaser_setup.php', 'api/motion_setup.php', 'api/ui_state.php']) {
      const source = read(endpoint);
      expect(source).toContain('updateJsonFileAtomically');
      expect(source).toContain('readJsonFileLocked');
    }

    expect(store).toContain('flock($handle, LOCK_SH)');
    const update = store.slice(store.indexOf('function updateJsonFileAtomically'));
    const lock = update.indexOf('flock($handle, LOCK_EX)');
    const readCurrent = update.indexOf('stream_get_contents($handle)');
    const truncate = update.indexOf('ftruncate($handle, 0)');
    const unlock = update.indexOf('flock($handle, LOCK_UN)');
    expect(lock).toBeGreaterThan(-1);
    expect(readCurrent).toBeGreaterThan(lock);
    expect(truncate).toBeGreaterThan(readCurrent);
    expect(unlock).toBeGreaterThan(truncate);
  });

  test('customer data endpoints support an installer-owned external data directory', () => {
    const paths = read('api/app_paths.php');
    expect(paths).toContain("getenv('PICO_DMX_DATA_DIR')");
    expect(paths).toContain("$_SERVER['PICO_DMX_DATA_DIR']");

    for (const endpoint of [
      'api/fixture_setup.php',
      'api/fixture_library.php',
      'api/group_setup.php',
      'api/scene_setup.php',
      'api/palette_setup.php',
      'api/chaser_setup.php',
      'api/motion_setup.php',
      'api/gpio_setup.php',
      'api/room_plane_setup.php',
      'api/ui_state.php'
    ]) {
      const source = read(endpoint);
      expect(source, endpoint).toContain("require_once __DIR__ . DIRECTORY_SEPARATOR . 'app_paths.php'");
      expect(source, endpoint).toContain('pico_dmx_data_dir()');
      expect(source, endpoint).not.toMatch(/__DIR__\s*\.\s*(?:DIRECTORY_SEPARATOR\s*\.\s*)?['"](?:\/)?data['"]/);
    }

    const deployment = read('scripts/sync_fixture_controller_to_xampp.ps1');
    expect(deployment).toContain('$appPathsSource');
    expect(deployment).toContain('$appPathsTarget');
  });

  test('Windows customer installer separates program files from persistent show data', () => {
    const installer = read('installer/windows/pico-dmx-controller.nsi');
    const builder = read('installer/windows/build_installer.ps1');
    const apache = read('installer/windows/runtime/httpd.conf.template');

    expect(installer).toContain('SetShellVarContext all');
    expect(installer).toContain('!define PRODUCT_NAME "WiFiPicoDMX"');
    expect(installer).toContain('!define LEGACY_PRODUCT_NAME "Pico DMX Controller"');
    expect(installer).toContain('$APPDATA\\${LEGACY_PRODUCT_NAME}\\data');
    expect(installer).toContain('$APPDATA\\${LEGACY_PRODUCT_NAME}\\backups');
    expect(installer).toContain('PicoDmxController');
    expect(installer).not.toMatch(/RMDir\s+\/r\s+["']?\$PROGRAMDATA/i);
    expect(builder).not.toContain('api\\data');
    expect(builder).not.toContain('mysql');
    expect(apache).toContain('SetEnv PICO_DMX_DATA_DIR');
    expect(apache).toContain('Options -Indexes');
  });

  test('Windows installer build reports stage and total timings', () => {
    const installer = read('installer/windows/build_installer.ps1');

    expect(installer).toContain('Installer step timing:');
    expect(installer).toContain('Installer build timing:');
    for (const stage of [
      'Validate inputs and firmware',
      'Reset build directories',
      'Restore Windows shell',
      'Publish Windows shell',
      'Extract Apache and PHP',
      'Assemble staging tree',
      'Compile NSIS installer',
      'Finalize installer'
    ]) {
      expect(installer).toContain(stage);
    }
  });

  test('Windows installer uses fast local compression and small release compression', () => {
    const installer = read('installer/windows/pico-dmx-controller.nsi');
    const builder = read('installer/windows/build_installer.ps1');

    expect(installer).toContain('SetCompressor /SOLID zlib');
    expect(installer).toContain('SetCompressor /SOLID lzma');
    expect(builder).toContain('[ValidateSet("Fast", "Small")]');
    expect(builder).toContain('[string]$Compression = "Fast"');
    expect(builder).toContain('/DUSE_LZMA_COMPRESSION=1');
    const release = read('scripts/prepare_release.ps1');
    expect(release).toContain('[string]$WindowsInstallerCompression = "Small"');
    expect(release).toContain('Compression = $WindowsInstallerCompression');
  });

  test('WSL and Linux package builds report stage and total timings', () => {
    const wslBuilder = read('installer/ubuntu/build_package_wsl.ps1');
    const linuxBuilder = read('installer/ubuntu/build_package.sh');

    expect(wslBuilder).toContain('WSL package step timing:');
    expect(wslBuilder).toContain('WSL package build timing:');
    expect(wslBuilder).toContain('Resolve WSL paths');
    expect(wslBuilder).toContain('Run Linux package builder');
    expect(linuxBuilder).toContain('Linux package step timing:');
    expect(linuxBuilder).toContain('Linux package build timing:');
    for (const stage of [
      'Validate inputs and firmware',
      'Reset build directories',
      'Acquire Electron runtime',
      'Assemble package metadata',
      'Extract Electron runtime',
      'Stage firmware',
      'Stage application and documentation',
      'Build Debian package'
    ]) {
      expect(linuxBuilder).toContain(stage);
    }
  });

  test('Windows customer runtime can update and import the full OFL fixture library', () => {
    const php = read('installer/windows/runtime/php.ini.template');
    const setting = name => {
      const match = php.match(new RegExp(`^${name}\\s*=\\s*(\\d+)([KMG]?)`, 'mi'));
      expect(match, `${name} must be configured`).not.toBeNull();
      const multiplier = { '': 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[match[2].toUpperCase()];
      return Number(match[1]) * multiplier;
    };

    expect(setting('memory_limit')).toBeGreaterThanOrEqual(512 * 1024 ** 2);
    expect(setting('max_execution_time')).toBeGreaterThanOrEqual(120);
    expect(setting('post_max_size')).toBeGreaterThanOrEqual(128 * 1024 ** 2);
    expect(setting('upload_max_filesize')).toBeGreaterThanOrEqual(128 * 1024 ** 2);
  });

  test('Windows app revalidates browser UI assets after an installer update', () => {
    const apache = read('installer/windows/runtime/httpd.conf.template');
    const form = read('installer/windows/shell/MainForm.cs');

    expect(apache).toContain('<FilesMatch "\\.(?:html|css|js)$">');
    expect(apache).toContain('Header always set Cache-Control "no-cache, must-revalidate"');
    expect(form).toContain(
      'ClearBrowsingDataAsync(CoreWebView2BrowsingDataKinds.DiskCache)'
    );
  });

  test('Windows signing credentials and local secrets cannot be committed', () => {
    const ignore = read('.gitignore');
    const builder = read('installer/windows/build_installer.ps1');

    for (const pattern of [
      '*.pfx',
      '*.p12',
      '*.pvk',
      '*.snk',
      '*.private.pem',
      '.env',
      '.env.*',
      'installer/windows/signing/',
      '**/bin/',
      '**/obj/',
      'release/v*/wifi-pico-dmx-*-windows-*.exe',
      'release/v*/wifi-pico-dmx-*-windows-*.exe.sha256'
    ]) {
      expect(ignore).toContain(pattern);
    }
    expect(builder).not.toMatch(/CertificatePassword|PfxPassword|SecureString/);
    expect(builder).toContain('SigningCertificateThumbprint');
  });

  test('Windows customer app lets the operator exit with or without stopping its server', () => {
    const project = read('installer/windows/shell/PicoDmxShell.csproj');
    const form = read('installer/windows/shell/MainForm.cs');
    const theme = read('installer/windows/shell/WindowsTheme.cs');
    const builder = read('installer/windows/build_installer.ps1');
    const installer = read('installer/windows/pico-dmx-controller.nsi');

    expect(project).toContain('Microsoft.Web.WebView2');
    expect(form).toContain('new WebView2');
    expect(form).toContain('Keys.F11');
    expect(form).toContain('Keys.Escape');
    expect(form).toContain('NotifyIcon');
    expect(form).toContain('Exit and stop server');
    expect(form).toContain('Exit only');
    expect(form).toContain('Keep the server running for iPads and other operator devices.');
    expect(form).toContain('Environment.SpecialFolder.LocalApplicationData');
    expect(theme).toContain('DwmSetWindowAttribute');
    expect(theme).toContain('DWMWA_USE_IMMERSIVE_DARK_MODE');
    expect(form).toContain('DarkColorTable');
    expect(form).toContain('Stop WiFiPicoDMX and exit?');
    expect(form).toContain('PicoDmxController');
    expect(form).toContain('sc.exe');
    expect(form).toContain('Arguments = "start PicoDmxController"');
    expect(form).toContain('Starting the controller server requires Windows administrator approval.');
    expect(form).toContain('Verb = "runas"');
    expect(form).toContain('eventArgs.Cancel = true');
    expect(form).toContain('Stopping the server disconnects iPads and other operator devices.');
    expect(builder).toContain('dotnet publish');
    expect(installer).toContain('PicoDmxShell.exe');
  });

  test('Windows app waits for a delayed Apache shutdown before reporting stop failure', () => {
    const form = read('installer/windows/shell/MainForm.cs');

    expect(form).toContain(
      'ControllerServiceStopTimeout = TimeSpan.FromSeconds(45)'
    );
    expect(form).toContain('return await IsControllerServiceStoppedAsync();');
    expect(form).toContain('CreateServerShutdownProgressDialog');
    expect(form).toContain('Style = ProgressBarStyle.Marquee');
    expect(form).toContain('Stopping the Pico DMX server…');
    expect(form).toContain('This can take up to 45 seconds.');
    expect(form).toContain('shutdownProgress.Show(this);');
  });

  test('Windows installer supports a validated persistent customer HTTP port', () => {
    const installer = read('installer/windows/pico-dmx-controller.nsi');
    const builder = read('installer/windows/build_installer.ps1');
    const portCheck = read('installer/windows/scripts/test_port.ps1');
    const portOwner = read('installer/windows/scripts/port_owner.ps1');

    expect(installer).toContain('Function PortPageCreate');
    expect(installer).toContain('Function PortPageLeave');
    expect(installer).toContain('ReadRegStr $0 HKLM "Software\\PicoDmxController" "Port"');
    expect(installer).toContain('WriteRegStr HKLM "Software\\PicoDmxController" "Port" "$ProductPort"');
    expect(installer).toContain('-Port $ProductPort');
    expect(installer).toContain('localport=$ProductPort');
    expect(installer).toContain('http://localhost:$ProductPort/');
    expect(installer).not.toContain('${PRODUCT_PORT}');
    expect(builder).toContain('scripts\\test_port.ps1');
    expect(builder).toContain('scripts\\port_owner.ps1');
    expect(portCheck).toContain('[System.Net.Sockets.TcpListener]');
    expect(portOwner).toContain('Get-NetTCPConnection');
    expect(portOwner).toContain('PicoDmxController');
    expect(portOwner).toContain('ExpectedProcessId');
    expect(installer).toContain('WiFiPicoDMX is already running on port $ProductPort');
    expect(installer).toContain('Close it now and continue?');
    expect(installer).toContain('-ExpectedProcessId $PortOwnerPid -Stop');
    expect(installer).toContain('PicoDmxShell.exe');
  });

  test('macOS customer package keeps app code separate from persistent user data', () => {
    const builder = read('installer/macos/build_package.sh');
    const app = read('installer/macos/app/PicoDmxController.swift');
    const router = read('installer/macos/support/router.php');

    expect(builder).toContain('Pico DMX Controller.app');
    expect(builder).toContain('pkgbuild');
    expect(builder).toContain('productsign');
    expect(builder).toContain('notarytool');
    expect(builder).toContain('stapler staple');
    expect(builder).toContain('codesign');
    expect(builder).toContain('sha256');
    expect(builder).not.toMatch(/rm\s+-rf[^\n]*(?:Application Support|pico-dmx-controller\/data)/i);
    expect(app).toContain('Library/Application Support/Pico DMX Controller');
    expect(app).toContain('Library/LaunchAgents');
    expect(app).toContain('com.picodmx.controller.server');
    expect(app).toContain('backups');
    expect(router).toContain("getenv('PICO_DMX_APP_DIR')");
  });

  test('macOS app provides native configurable port, LAN access, and closeable web shell', () => {
    const app = read('installer/macos/app/PicoDmxController.swift');
    const runtimeBuilder = read('installer/macos/build_php_runtime.sh');
    const ignore = read('.gitignore');

    expect(app).toContain('import WebKit');
    expect(app).toContain('WKWebView');
    expect(app).toContain('Controller Settings');
    expect(app).toContain('1024...65535');
    expect(app).toContain('127.0.0.1');
    expect(app).toContain('0.0.0.0');
    expect(app).toContain('launchctl');
    expect(app).toContain('toggleFullScreen');
    expect(app).toContain('private let productName = "WiFiPicoDMX"');
    expect(app).toContain('applicationShouldTerminate');
    expect(app).toContain('Exit only');
    expect(app).toContain('Exit and stop server');
    expect(app).toContain('stopLaunchAgent');
    expect(runtimeBuilder).toContain('static-php-cli');
    expect(runtimeBuilder).toContain('sha256');
    expect(ignore).toContain('release/v*/wifi-pico-dmx-*-macos-*.pkg');
    expect(ignore).toContain('installer/macos/signing/');
  });

  test('Ubuntu app uses WiFiPicoDMX branding and an explicit server exit choice', () => {
    const main = read('installer/ubuntu/shell/main.js');
    const shellPage = read('installer/ubuntu/shell/shell.html');
    const launcher = read('installer/ubuntu/package/pico-dmx-controller');
    const desktop = read('installer/ubuntu/package/pico-dmx-controller.desktop');
    const builder = read('installer/ubuntu/build_package.sh');
    const ignore = read('.gitignore');

    expect(main).toContain("app.setName('WiFiPicoDMX')");
    expect(shellPage).toContain('Exit only');
    expect(shellPage).toContain('Exit and stop server');
    expect(main).toContain('app.exit(EXIT_KEEP_SERVER)');
    expect(main).toContain('app.exit(EXIT_STOP_SERVER)');
    expect(main).toContain("controllerView.webContents.session.clearCache()");
    expect(main).toContain("controllerView.webContents.on('context-menu'");
    expect(shellPage).toContain('<title>WiFiPicoDMX</title>');
    expect(shellPage).toContain('id="application-menu"');
    expect(shellPage).toContain('How should WiFiPicoDMX exit?');
    expect(shellPage).toContain('Exit and stop server');
    expect(main).toContain('controllerView?.setVisible(false)');
    expect(main).toContain('controllerView?.setVisible(true)');
    expect(main).toContain("ipcMain.on('shell:menu-state'");
    expect(shellPage).toContain('window.picoShell.setMenuOpen(opening)');
    expect(launcher).toContain('EXIT_KEEP_SERVER=20');
    expect(launcher).toContain('EXIT_STOP_SERVER=21');
    expect(launcher).toContain('systemctl stop pico-dmx-controller.service');
    expect(desktop).toContain('Name=WiFiPicoDMX');
    expect(builder).toContain('wifi-pico-dmx_${version}_${architecture}.deb');
    expect(builder).toContain('command -v wget');
    expect(read('installer/ubuntu/package/pico-dmx-config')).toContain("config_temp_file=''");
    expect(read('installer/ubuntu/package/pico-dmx-config')).not.toContain("trap 'rm -f -- \"$temp_file\"' EXIT");
    expect(read('installer/ubuntu/package/pico-dmx-config')).toContain('hostname -I');
    expect(read('installer/ubuntu/package/pico-dmx-config')).not.toContain('http://<this-computer-ip>:8090/');
    expect(ignore).toContain('release/v*/wifi-pico-dmx_*_amd64.deb');
  });

  test('Ubuntu customer runtime can update and import the full OFL fixture library', () => {
    const service = read('installer/ubuntu/package/pico-dmx-controller.service');

    expect(service).toContain('-d memory_limit=512M');
    expect(service).toContain('-d max_execution_time=120');
    expect(service).toContain('-d post_max_size=128M');
    expect(service).toContain('-d upload_max_filesize=128M');
  });

  test('Ubuntu customer package includes the guarded guided firmware updater', () => {
    const main = read('installer/ubuntu/shell/main.js');
    const firmwarePage = read('installer/ubuntu/shell/firmware.html');
    const helper = read('installer/ubuntu/package/flash_firmware.sh');
    const builder = read('installer/ubuntu/build_package.sh');
    const udev = read('installer/ubuntu/package/60-pico-dmx-controller.rules');

    expect(main).toContain("'firmware:run'");
    expect(main).toContain('firmwareBusy');
    expect(main).not.toContain('modal: true');
    expect(main).toContain('firmwareViewOpen');
    expect(main).toContain('restoreControllerShell');
    expect(main).not.toContain('firmwareWindow = new BrowserWindow');
    expect(firmwarePage).toContain('Flash application + Wi-Fi firmware');
    expect(firmwarePage).toContain("confirm('Flash the application and Wi-Fi firmware now?");
    expect(helper).toContain('sha256sum --check --status');
    expect(helper).toContain('target[[:space:]]chip:[[:space:]]+RP2350');
    expect(helper).toContain('"$picotool" load -v "$application"');
    expect(helper).toContain('"$picotool" reboot -u');
    expect(helper).toContain('"$picotool" load -u -v -x "$wifi_firmware"');
    expect(builder).toContain('firmware-manifest.json');
    expect(builder).toContain('PICO_DMX_APPLICATION_UF2');
    expect(udev).toContain('TAG+="uaccess"');
  });

  test('motion slot response exposes target count without a duplicate fixture count', () => {
    const main = read('firmware/main.cpp');
    const slotFormat = main.match(/static void build_motion_slots_response\(\)[\s\S]*?static void build_playback_ok_response/);
    expect(slotFormat).not.toBeNull();
    expect(slotFormat[0]).toContain('\\"target_count\\":%u');
    expect(slotFormat[0]).not.toContain('fixture_count');
  });

  test('toolbox expansion prioritizes bottom-edge visibility over anchor restoration', () => {
    const common = read('web/assets/dmx-common.js');
    const clickHandler = common.match(/if\(toggle\)toggle\.addEventListener\('click',[\s\S]*?\n    \}\);/);
    expect(clickHandler).not.toBeNull();
    expect(clickHandler[0]).toContain('setCollapsed(');
    expect(clickHandler[0]).toContain('nearRailBottom');
    expect(clickHandler[0]).toContain('if(expanding&&!nearRailBottom)restoreRailElementAnchor');
  });

  test('release preparation keeps Pico hardware tests explicitly opt-in', () => {
    const releaseScript = read('scripts/prepare_release.ps1');
    expect(releaseScript).toContain('if (-not $RunHardwareTests)');
    expect(releaseScript).toContain('$env:DMX_RUN_HARDWARE_TESTS = "false"');
    expect(releaseScript).toContain('if ($RunHardwareTests -and -not $SkipTests)');
    expect(releaseScript).toContain('$env:DMX_RUN_HARDWARE_TESTS = "true"');
  });

  test('release firmware builds use an isolated explicit Ninja generator', () => {
    const releaseScript = read('scripts/prepare_release.ps1');

    expect(releaseScript).toContain('[string]$BuildDir = "build-release"');
    expect(releaseScript).toContain('$ninjaExe = Resolve-CommandPath "ninja"');
    expect(releaseScript).toContain('-G "Ninja"');
    expect(releaseScript).toContain('"-DCMAKE_MAKE_PROGRAM=$ninjaExe"');
  });

  test('release preparation runs real Pico tests after the isolated UI suite', () => {
    const releaseScript = read('scripts/prepare_release.ps1');
    const uiSuite = releaseScript.indexOf('Invoke-Step "Run UI regression tests"');
    const hardwareSuite = releaseScript.indexOf('Invoke-Step "Run real Pico hardware tests"');

    expect(uiSuite).toBeGreaterThan(-1);
    expect(hardwareSuite).toBeGreaterThan(uiSuite);
    expect(releaseScript.slice(uiSuite, hardwareSuite)).toContain('$env:DMX_RUN_HARDWARE_TESTS = "false"');
    expect(releaseScript.slice(uiSuite, hardwareSuite)).toContain('npm run test:ui -- --workers=1');
    expect(releaseScript.slice(hardwareSuite)).toContain('npm run test:pico');
  });

  test('manual live-control screenshots clear asynchronous MIDI mapping state', () => {
    const captureScript = read('scripts/capture_manual_ui_screenshots.ps1');
    const holdCapture = captureScript.match(/cardOrder=\['live'\];[\s\S]*?show-run-live-hold-button\.png/);

    expect(holdCapture).not.toBeNull();
    expect(holdCapture[0]).toContain('midiMappings=[];');
    expect(holdCapture[0].indexOf('midiMappings=[];')).toBeLessThan(holdCapture[0].indexOf("renderLiveControls();"));
    const postRender = holdCapture[0].slice(holdCapture[0].indexOf("renderLiveControls();"));
    expect(postRender).toContain("widget.dispatchEvent(new Event('change',{bubbles:true}));");
    expect(postRender).toContain("if(mode)mode.value='hold';");
    expect(postRender).toContain("modeWrap.style.display='grid';");
    expect(postRender).toContain("valueWrap.style.display='grid';");
    expect(holdCapture[0]).toContain("live?.querySelector('.live-widget-select')");
    expect(holdCapture[0]).toContain("live?.querySelector('.live-button-mode-wrap')");
    expect(holdCapture[0]).toContain('Final synchronous normalization immediately before capture');
  });

  test('manual Chaser and Effects screenshots show deterministic occupied Pico slots', () => {
    const chaserCapture = read('scripts/capture_chaser_manual_screenshots.ps1');
    const effectsCapture = read('scripts/capture_manual_ui_screenshots.ps1');
    const effectsPage = read('web/dmx_motion.html');
    const manual = read('docs/user-manual.md');

    expect(chaserCapture).toContain('renderChaserSlotStrip(docPicoSlots');
    expect(chaserCapture).toContain('loaded:true');
    expect(chaserCapture).toContain('paused:true');
    expect(effectsCapture).toContain('motion-participating-controls.png');
    expect(effectsCapture).toContain('motion-pico-slots.png');
    expect(effectsCapture).toContain('renderMotionSlotStrip(docPicoSlots');
    expect(effectsPage).toContain('renderMotionSlotStrip(docPicoSlots');
    expect(effectsPage).toContain('docshot_overview');
    expect(effectsPage).toContain('loaded:true');
    expect(effectsPage).toContain('paused:true');
    expect(manual).toContain('![Effects Participating Controls](screenshots/motion-participating-controls.png)');
    expect(manual).toContain('![Occupied Pico Effects slots](screenshots/motion-pico-slots.png)');
  });

  test('manual toolbox screenshots crop one toolbox at the original pixel scale', () => {
    const captureScripts = [
      read('scripts/capture_manual_ui_screenshots.ps1'),
      read('scripts/capture_chaser_manual_screenshots.ps1')
    ];
    const manual = read('docs/user-manual.md');

    captureScripts.forEach(captureScript => {
      expect(captureScript).toContain('const rect=el.getBoundingClientRect();');
      expect(captureScript).not.toContain('$rect = [pscustomobject]@{ x = 800; y = 0; width = 640; height = 1100 }');
      expect(captureScript).toContain('scale = 1');
    });
    expect(manual).toContain('![Controller Scenes toolbox](screenshots/fixture-controller-toolbox-scenes.png)');
    expect(manual).toContain('![Controller Palettes toolbox](screenshots/fixture-controller-toolbox-palettes.png)');
    expect(manual).not.toContain('fixture-controller-toolbox-scenes-palettes.png');
  });

  test('manual page overviews expand controls and capture the required page height', () => {
    const controllerCapture = read('scripts/capture_manual_ui_screenshots.ps1');
    const chaserCapture = read('scripts/capture_chaser_manual_screenshots.ps1');
    const pageCapture = read('scripts/capture_manual_page_overviews.ps1');

    expect(controllerCapture).toContain('function Save-PageOverviewScreenshot');
    expect(controllerCapture).toContain('Save-PageOverviewScreenshot "fixture-controller.png"');
    expect(controllerCapture).toContain('Save-PageOverviewScreenshot "show-run.png"');
    expect(controllerCapture).toContain('Save-PageOverviewScreenshot "room-plane.png"');
    expect(chaserCapture).toContain('function Save-PageOverviewScreenshot');
    expect(chaserCapture).toContain('Save-PageOverviewScreenshot "chaser.png"');
    [controllerCapture, chaserCapture, pageCapture].forEach(captureScript => {
      expect(captureScript).toContain("document.querySelectorAll('.scene-toolbox')");
      expect(captureScript).toContain("document.querySelectorAll('.collapsed-panel')");
      expect(captureScript).toContain('Emulation.setDeviceMetricsOverride');
      expect(captureScript).toContain('captureBeyondViewport = $true');
    });
  });

  test('Show Run overview excludes the hidden-items modal and documents it separately', () => {
    const capture = read('scripts/capture_manual_ui_screenshots.ps1');
    const manual = read('docs/user-manual.md');
    const manifest = read('docs/screenshot-manifest.json');
    const overviewCapture = capture.indexOf('Save-PageOverviewScreenshot "show-run.png"');

    expect(overviewCapture).toBeGreaterThan(-1);
    expect(capture.lastIndexOf('hiddenTileModalDismissed=true;', overviewCapture)).toBeGreaterThan(-1);
    expect(capture.lastIndexOf('closeHiddenTileModal();', overviewCapture)).toBeGreaterThan(-1);
    expect(capture).toContain('Save-ElementScreenshot "#hiddenTileModal .modal-card" "show-run-hidden-items.png"');
    expect(manual).toContain('![Hidden Show Items modal](screenshots/show-run-hidden-items.png)');
    expect(manifest).toContain('"file": "show-run-hidden-items.png"');
  });

  test('Show Run card screenshots preserve the complete card above the sticky header', () => {
    const capture = read('scripts/capture_manual_ui_screenshots.ps1');
    const cardScreenshots = [
      ['#cardMaster', 'show-run-card-master.png'],
      ['#cardGroup', 'show-run-card-groups.png'],
      ['#cardFixture', 'show-run-card-fixtures.png'],
      ['#cardScene', 'show-run-card-scenes.png'],
      ['#cardPalette', 'show-run-card-palettes.png'],
      ['#cardMatrix', 'show-run-card-pixel-matrices.png'],
      ['#cardPlane', 'show-run-card-planes.png'],
      ['#cardChaser', 'show-run-card-chaser.png'],
      ['#cardMotion', 'show-run-card-effects.png'],
      ['#cardLive', 'show-run-card-live-controls.png'],
      ['#cardMidi', 'show-run-card-midi.png']
    ];

    expect(capture).toContain('[switch]$WithoutScrolling');
    expect(capture).toContain('if(!rail&&!$withoutScrollingJs)');
    cardScreenshots.forEach(([selector, filename]) => {
      expect(capture).toContain(`Save-ElementScreenshot "${selector}" "${filename}" -WithoutScrolling`);
    });
  });

  test('generated manual keeps wrapped changelog text inside its bullet', () => {
    const navigationHtml = read('docs/user-manual.html');

    expect(navigationHtml).toMatch(
      /<li>Reworked the first screenshot for every documented application page as a\s+complete overview\. Manual capture now expands toolbox rails/
    );
    expect(navigationHtml).not.toMatch(
      /documented application page as a\s*<\/li>\s*<p>complete overview/
    );
  });

  test('generated Performance Test guidance keeps prose inside complete paragraphs', () => {
    const navigationHtml = read('docs/user-manual.html');

    expect(navigationHtml).not.toContain('</p>\n<p>latency, <strong>Playback + Palette Stress</strong>');
    expect(navigationHtml).not.toContain('</p>\n<p>started and records their Pico URL and slot numbers');
  });

  test('application-page chapters introduce the page before describing its tools', () => {
    const manual = read('docs/user-manual.md');
    const pages = [
      ['Fixture Controller', 'screenshots/fixture-controller.png', 'What You Can Do on Fixture Controller', 'Fixture Controller Tools and Toolboxes'],
      ['Scenes And Palettes', 'screenshots/fixture-controller.png', 'What You Can Do with Scenes and Palettes', 'Scenes and Palettes Tools and Toolboxes'],
      ['Groups', 'screenshots/fixture-controller.png', 'What You Can Do with Groups', 'Groups Tools and Toolboxes'],
      ['Chaser', 'screenshots/chaser.png', 'What You Can Do on Chaser', 'Chaser Tools and Toolboxes'],
      ['Effects', 'screenshots/motion-fx.png', 'What You Can Do on Effects', 'Effects Tools and Toolboxes'],
      ['GPIO Control', 'screenshots/gpio-control.png', 'What You Can Do on GPIO Control', 'GPIO Control Tools and Toolboxes'],
      ['Room Plane', 'screenshots/room-plane.png', 'What You Can Do on Room Plane', 'Room Plane Tools and Toolboxes'],
      ['Show Run', 'screenshots/show-run.png', 'What You Can Do on Show Run', 'Show Run Tools and Toolboxes'],
      ['Pico Performance Test', 'screenshots/benchmark.png', 'What You Can Do on Pico Performance Test', 'Pico Performance Test Tools and Toolboxes'],
      ['DMX Buffer Monitor', 'screenshots/dmx-monitor.png', 'What You Can Do on DMX Buffer Monitor', 'DMX Buffer Monitor Tools and Toolboxes']
    ];

    pages.forEach(([title, screenshot, purposeHeading, toolsHeading]) => {
      const start = manual.indexOf(`### ${title}\n`);
      expect(start, `${title} must have an unnumbered page heading`).toBeGreaterThan(-1);
      const nextPage = manual.indexOf('\n### ', start + 5);
      const chapter = manual.slice(start, nextPage === -1 ? manual.length : nextPage);
      expect(chapter.indexOf(`](${screenshot})`), `${title} overview`).toBeGreaterThan(-1);
      expect(chapter.indexOf(`#### ${purposeHeading}`), `${title} purpose`).toBeGreaterThan(-1);
      expect(chapter.indexOf(`#### ${toolsHeading}`), `${title} tools`).toBeGreaterThan(-1);
      expect(chapter.indexOf(`](${screenshot})`)).toBeLessThan(chapter.indexOf(`#### ${purposeHeading}`));
      expect(chapter.indexOf(`#### ${purposeHeading}`)).toBeLessThan(chapter.indexOf(`#### ${toolsHeading}`));
    });
  });

  test('manual screenshot capture reports per-image timings and slowest-first summaries', () => {
    const helpers = read('scripts/manual_screenshot_helpers.ps1');
    const readmeCapture = read('scripts/capture_manual_ui_screenshots.ps1');
    const chaserCapture = read('scripts/capture_chaser_manual_screenshots.ps1');
    const pageOverviews = read('scripts/capture_manual_page_overviews.ps1');

    expect(helpers).toContain('Screenshot timing:');
    expect(helpers).toContain('pipeline');
    expect(helpers).toContain('capture');
    expect(helpers).toContain('Slowest screenshots');
    for (const script of [readmeCapture, chaserCapture, pageOverviews]) {
      expect(script).toContain('Initialize-ScreenshotTiming');
      expect(script).toContain('Start-ScreenshotTiming');
      expect(script).toContain('Complete-ScreenshotTiming');
      expect(script).toContain('Write-ScreenshotTimingSummary');
    }
  });

  test('every manual generation script reports its total duration', () => {
    const helpers = read('scripts/manual_screenshot_helpers.ps1');
    const scripts = [
      read('scripts/build_user_manual.ps1'),
      read('scripts/capture_manual_ui_screenshots.ps1'),
      read('scripts/capture_chaser_manual_screenshots.ps1'),
      read('scripts/capture_manual_page_overviews.ps1'),
      read('scripts/render_user_manual_pdf.ps1')
    ];

    expect(helpers).toContain('Script timing:');
    for (const script of scripts) {
      expect(script).toContain('Start-ManualScriptTiming');
      expect(script).toContain('Complete-ManualScriptTiming');
    }
    expect(scripts[0]).toContain('Step timing:');
  });

  test('manual documentation capture blocks every hardware request', () => {
    const common = read('web/assets/dmx-common.js');

    expect(common).toContain('nativeDocumentationFetch');
    expect(common).toContain('requestUrl.origin!==location.origin');
    expect(common).toContain('Documentation capture blocked cross-origin request');
    expect(common).toContain('window.fetch=(input,init)');
  });

  test('manual documentation browser never sends a hardware request', async ({ page }) => {
    const hardwareRequests = [];
    page.on('request', request => {
      if (new URL(request.url()).hostname === '192.0.2.1') hardwareRequests.push(request.url());
    });

    await page.goto('dmx_chaser.html?docshot=hardware-isolation');
    const message = await page.evaluate(async () => {
      try {
        await fetch('http://192.0.2.1/status.json');
        return 'request unexpectedly succeeded';
      } catch (error) {
        return error.message;
      }
    });

    expect(message).toContain('Documentation capture blocked cross-origin request');
    expect(hardwareRequests).toEqual([]);
  });

  test('Effects overview capture waits for deterministic data without restoring UI state', () => {
    const motion = read('web/dmx_motion.html');
    const overviewCapture = read('scripts/capture_manual_page_overviews.ps1');

    expect(motion).toContain('window.motionDocshotReady=Promise.allSettled');
    expect(motion).toContain('if(!motionDocshotOverview){\n  (async()=>{');
    expect(motion).not.toContain("participationPanel.classList.add('collapsed-panel')");
    expect(motion).not.toContain('setTimeout(applyMotionDocshotSlots');
    expect(overviewCapture).toContain('if(window.motionDocshotReady)await window.motionDocshotReady;');
  });

  test('manual build scripts use responsibility-based names', () => {
    const expected = [
      'scripts/build_user_manual.ps1',
      'scripts/capture_manual_ui_screenshots.ps1',
      'scripts/capture_chaser_manual_screenshots.ps1',
      'scripts/capture_manual_page_overviews.ps1',
      'scripts/manual_screenshot_helpers.ps1',
      'scripts/render_user_manual_pdf.ps1'
    ];
    const obsolete = [
      'scripts/update_user_manual.ps1',
      'scripts/capture_readme_screenshots.ps1',
      'scripts/capture_chaser_screenshot.ps1',
      'scripts/screenshot_file_helpers.ps1',
      'scripts/build_user_manual_pdf.ps1'
    ];

    expected.forEach(relative => expect(fs.existsSync(path.join(root, relative)), relative).toBe(true));
    obsolete.forEach(relative => expect(fs.existsSync(path.join(root, relative)), relative).toBe(false));
    const builder = read('scripts/build_user_manual.ps1');
    expect(builder).toContain('capture_manual_ui_screenshots.ps1');
    expect(builder).toContain('capture_chaser_manual_screenshots.ps1');
    expect(builder).toContain('capture_manual_page_overviews.ps1');
    expect(builder).toContain('render_user_manual_pdf.ps1');
  });

  test('the local PHP development router is server tooling, not an automation script', () => {
    const router = 'tools/local-server/router.php';

    expect(fs.existsSync(path.join(root, router)), router).toBe(true);
    expect(fs.existsSync(path.join(root, 'scripts/dev-router.php'))).toBe(false);
    expect(read(router)).toContain('$root = dirname(__DIR__, 2);');
    expect(read(router)).toContain("'/room_plane_setup.php' => \"$root/api/room_plane_setup.php\"");
    expect(read('scripts/build_user_manual.ps1')).toContain('tools\\local-server\\router.php');
  });

  test('release documentation generation stays local and never deploys to live XAMPP', () => {
    const releaseScript = read('scripts/prepare_release.ps1');

    expect(releaseScript).toContain('$manualArgs = @{ LocalOnly = $true }');
  });

  test('Windows release preparation builds and records the customer installer', () => {
    const releaseScript = read('scripts/prepare_release.ps1');

    expect(releaseScript).toContain('[switch]$SkipWindowsInstaller');
    expect(releaseScript).toContain('[string]$WindowsSigningCertificateThumbprint');
    expect(releaseScript).toContain('Build Windows customer installer');
    expect(releaseScript).toContain('installer\\windows\\build_installer.ps1');
    expect(releaseScript).toContain('windowsInstaller = $windowsInstaller');
    expect(releaseScript).toContain('Authenticode signed:');
  });

  test('Windows release preparation can build and record the Debian installer through WSL', () => {
    const releaseScript = read('scripts/prepare_release.ps1');
    const wslBuilder = read('installer/ubuntu/build_package_wsl.ps1');

    expect(releaseScript).toContain('[switch]$SkipDebianInstaller');
    expect(releaseScript).toContain('[string]$WslDistribution');
    expect(releaseScript).toContain('Assemble Debian package from Windows-built artifacts');
    expect(releaseScript).toContain('installer\\ubuntu\\build_package_wsl.ps1');
    expect(releaseScript).toContain('debianInstaller = $debianInstaller');
    expect(wslBuilder).toContain('wsl.exe');
    expect(wslBuilder).toContain('wslpath');
    expect(wslBuilder).toContain('PICO_DMX_PICOTOOL');
    expect(wslBuilder).toContain('PICO_DMX_UBUNTU_BUILD_ROOT');
    expect(wslBuilder).toContain('build_package.sh');
  });

  test('GitHub release publication is explicit, verified, and resumable', () => {
    const publisher = read('scripts/publish_github_release.ps1');

    expect(publisher).toContain('[switch]$AllowUnsignedWindowsInstaller');
    expect(publisher).toContain("$branch -ne 'main'");
    expect(publisher).toContain('git status --porcelain');
    expect(publisher).toContain('origin/main');
    expect(publisher).toContain('Get-FileHash -Algorithm SHA256');
    expect(publisher).toContain('$manifest.windowsInstaller');
    expect(publisher).toContain('$manifest.debianInstaller');
    expect(publisher).toContain('gh release create');
    expect(publisher).toContain('gh release upload');
    expect(publisher).toContain('--latest');
  });

  test('README presents the stable Windows installer before the overview and requires release-link verification', () => {
    const readme = read('README.md');
    const publisher = read('scripts/publish_github_release.ps1');
    const versionBranchScript = read('scripts/start_version_branch.ps1');
    const localPathsExample = read('config/local-paths.example.json');
    const stableVersion = readme.match(/\*\*Latest stable release:\*\* `([^`]+)`/)?.[1];

    expect(stableVersion).toBeTruthy();
    expect(readme).not.toContain('**Current development version:**');
    expect(versionBranchScript).not.toContain('Current development version:');
    const gettingStartedIndex = readme.indexOf('## Getting Started');
    const contentsIndex = readme.indexOf('## Table of Contents');
    const overviewIndex = readme.indexOf('## Overview');
    expect(gettingStartedIndex).toBeLessThan(contentsIndex);
    expect(contentsIndex).toBeLessThan(overviewIndex);
    expect(readme).toContain('one show can combine multiple named Picos as separate DMX outputs/universes');
    expect(readme).toContain(
      '[Install the Windows customer application](#install-the-windows-customer-application)'
    );
    expect(readme).toContain('- [Overview](#overview)');
    expect(readme).toContain('- [Versioning](#versioning)');
    expect(readme).toContain('- [Flash](#flash)');
    expect(readme).toContain('`%ProgramFiles%\\WiFiPicoDMX`');
    expect(readme).toContain('`%ProgramData%\\Pico DMX Controller\\data`');
    expect(readme).not.toContain('C:\\Program Files\\WiFiPicoDMX');
    expect(readme).not.toContain('C:\\xampp\\htdocs\\dmx');
    expect(readme).not.toContain('"xamppHtdocs": "C:/xampp/htdocs"');
    expect(localPathsExample).toContain('"xamppHtdocs": "C:/path/to/xampp/htdocs"');
    expect(localPathsExample).not.toContain('E:/Software/xampp/htdocs');
    expect(readme).toContain(
      `https://github.com/slvwagner/pico_wifi_dmx/releases/download/v${stableVersion}/wifi-pico-dmx-${stableVersion}-windows-x64.exe`
    );
    expect(readme).toContain(
      `https://github.com/slvwagner/pico_wifi_dmx/releases/download/v${stableVersion}/user-manual.pdf`
    );
    expect(readme).toContain('Update the README **Getting Started** installer and user-manual labels');
    expect(readme).toContain('.\\scripts\\publish_github_release.ps1');
    expect(readme).toContain('-AllowUnsignedWindowsInstaller');
    expect(readme).toContain('-WhatIf');
    expect(publisher).toContain("@('user-manual.html', 'user-manual.pdf', 'user-manual-navigation.pdf')");
    expect(readme).toContain('Open the README installer and user-manual links');
  });

  test('generated user manuals start with linked contents and end with the canonical project changelog', () => {
    const manual = read('docs/user-manual.md');
    const builder = read('scripts/render_user_manual_pdf.ps1');

    expect(manual.indexOf('## Table of Contents')).toBeLessThan(manual.indexOf('## Introduction'));
    expect(manual).toContain('- [Fixture Controller](#fixture-controller)');
    expect(manual).toContain('- [Pico Performance Test](#pico-performance-test)');
    expect(manual).toContain('- [Room Plane](#room-plane)');
    expect(manual).toContain('- [Run Show](#run-show)');
    expect(manual).toContain('  - [Show Run](#show-run)');
    [
      'Fixture Controller',
      'Scenes and Palettes',
      'Groups',
      'Chaser',
      'Effects',
      'GPIO Control',
      'Room Plane',
      'Show Run',
      'Pico Performance Test',
      'DMX Buffer Monitor'
    ].forEach((pageName) => {
      expect(manual).toContain(`#### ${pageName} Tools and Toolboxes`);
    });
    expect(manual).not.toContain('#### Back Up and Restore Tools and Toolboxes');
    expect(manual).not.toContain('#### Clear Functions Tools and Toolboxes');
    expect(manual).not.toMatch(/^###\s+\d+\.\s+/m);
    expect(manual).not.toMatch(/^####\s+\d+\.\d+\s+/m);
    expect(manual).toContain('- [Change Log](#change-log)');
    expect(manual).toContain('#### Open the Pico Firmware Diagnostics Page');
    expect(manual).toContain('Controller → **DMX Outputs**');
    expect(manual).toContain('**Pico Base URL**');
    expect(manual).toContain('**DMX controls**');
    expect(manual).toContain('**Raw logs**');
    expect(manual).toContain('## Change Log');
    expect(manual).toContain('<!-- PICO_DMX_CHANGELOG -->');
    expect(manual.indexOf('## Change Log')).toBeGreaterThan(manual.indexOf('## Troubleshooting'));
    expect(manual.trim().endsWith('<!-- PICO_DMX_CHANGELOG -->')).toBe(true);
    expect(builder).toContain('Join-Path $repoRoot "CHANGELOG.md"');
    expect(builder).toContain('$manualMarkdown.Replace(');
    expect(builder).toContain("'(?m)^##\\s+', '### '");
    expect(builder).toContain('class="manual-nav"');
    expect(builder).toContain('class="manual-nav-toggle"');
    expect(builder).toContain('class="manual-nav-submenu"');
    expect(builder).toContain('class="manual-nav-topic-list"');
    expect(builder).toContain('id="manual-current-location"');
    expect(builder).toContain("currentLocation.textContent = path.join(' › ')");
    expect(builder).toContain('class="manual-back-to-contents"');
    expect(builder).toContain("pager.className = 'section-pager'");
    expect(builder).toContain('@media print');
    expect(builder).toContain('display: none !important');
  });

  test('manual generation, deployment, installers, and releases keep clean and navigable PDF variants', () => {
    const builder = read('scripts/render_user_manual_pdf.ps1');
    const updater = read('scripts/build_user_manual.ps1');
    const sync = read('scripts/sync_fixture_controller_to_xampp.ps1');
    const release = read('scripts/prepare_release.ps1');
    const windowsInstaller = read('installer/windows/build_installer.ps1');
    const macosInstaller = read('installer/macos/build_package.sh');
    const ubuntuInstaller = read('installer/ubuntu/build_package.sh');
    const navigationHtml = read('docs/user-manual.html');
    const printHtml = read('docs/user-manual-print.html');

    expect(builder).toContain('[switch]$PdfWithNavigation');
    expect(builder).toContain('"A4 landscape"');
    expect(builder).toContain('class="manual-pdf-navigation"');
    expect(builder).toContain('html.manual-pdf-navigation .manual-nav');
    expect(updater).toContain('-PdfPath "docs/user-manual-navigation.pdf"');
    expect(updater).toContain('-PdfWithNavigation');
    expect(updater).toContain('-PdfPath "docs/user-manual.pdf"');
    expect(sync).toContain('user-manual-navigation.pdf');
    expect(release).toContain('"user-manual-navigation.pdf"');
    expect(release).toContain('$ManifestObject.docs -is [System.Collections.IDictionary]');
    expect(windowsInstaller).toContain('docs\\user-manual-navigation.pdf');
    expect(macosInstaller).toContain('docs/user-manual-navigation.pdf');
    expect(ubuntuInstaller).toContain('docs/user-manual-navigation.pdf');
    expect(navigationHtml).toContain('<html class="manual-pdf-navigation" lang="en">');
    expect(printHtml).toContain('<html class="manual-print" lang="en">');
    expect(printHtml).toContain('<li><a href="#getting-started">Getting Started</a>\n<ul>');
    expect(builder).toContain('html.manual-print {');
    expect(builder).toContain('color-scheme: light;');
    expect(builder).toContain('html.manual-print th {');
    expect(builder).toContain('html.manual-pdf-navigation .manual-nav-submenu {\n    display: block !important;');
  });

  test('manual includes deterministic Pico firmware diagnostics screenshots', () => {
    const manual = read('docs/user-manual.md');
    const manifest = read('docs/screenshot-manifest.json');
    const capture = read('scripts/capture_manual_page_overviews.ps1');
    const router = read('tools/local-server/router.php');
    const firmwareDocshot = read('tools/local-server/firmware_docshot.php');

    ['pico-firmware-logs.png', 'pico-firmware-dmx-controls.png'].forEach((filename) => {
      expect(manual).toContain(`screenshots/${filename}`);
      expect(manifest).toContain(`"file": "${filename}"`);
      expect(capture).toContain(filename);
    });
    expect(capture).toContain('/firmware-docshot/');
    expect(capture).toContain('/firmware-docshot/dmx.html');
    expect(router).toContain('firmware_docshot.php');
    expect(firmwareDocshot).toContain("serveFirmwareDocshotPage($firmwareSourcePath, 'build_http_page')");
  });

  test('slot synchronization confirmations use installation-neutral storage wording', () => {
    const chaser = read('web/dmx_chaser.html');
    const effects = read('web/dmx_motion.html');
    const neutralWarning = 'Pico-only slot data is not stored by the controller application and cannot be recovered after synchronization.';

    expect(chaser).toContain(neutralWarning);
    expect(effects).toContain(neutralWarning);
    expect(chaser).not.toContain('recovered from XAMPP');
    expect(effects).not.toContain('recovered from XAMPP');
  });

  test('release packaging keeps partitioned CYW43 firmware with the application', () => {
    const cmake = read('CMakeLists.txt');
    const releaseScript = read('scripts/prepare_release.ps1');
    const flashScript = read('scripts/flash_firmware.ps1');

    expect(cmake).toContain('pico_use_wifi_firmware_partition(pico_wifi_dmx)');
    expect(releaseScript).toContain('pico_wifi_dmx_wifi_firmware.uf2');
    expect(releaseScript).toContain('pico_wifi_dmx_wifi_firmware_tbyb.uf2');
    expect(releaseScript).toContain('wifiFirmware = $releaseArtifacts.wifiFirmware');
    expect(releaseScript).toContain('wifiFirmwareTbyb = $releaseArtifacts.wifiFirmwareTbyb');
    expect(flashScript).toContain("family ID 'cyw43-firmware'");
    expect(flashScript).toContain('block type:\\s+partition table');
    expect(flashScript).toContain('Invoke-Picotool (@("reboot", "-u")');
    expect(flashScript).toContain('Invoke-Picotool (@("load", "-u", "-v", "-x", $wifiFirmware)');
  });

  test('firmware credentials are provisioned separately and survive application updates', () => {
    const cmake = read('CMakeLists.txt');
    const partitionTable = read('firmware/wifi_pt.json');
    const firmware = read('firmware/main.cpp');
    const windowsForm = read('installer/windows/shell/FirmwareFlashForm.cs');
    const windowsHelper = read('installer/windows/scripts/flash_firmware.ps1');
    const windowsGenerator = read('installer/windows/scripts/wifi_config_uf2.ps1');
    const windowsBuilder = read('installer/windows/build_installer.ps1');
    const developerFlasher = read('scripts/flash_firmware.ps1');
    const ubuntuPage = read('installer/ubuntu/shell/firmware.html');
    const ubuntuMain = read('installer/ubuntu/shell/main.js');
    const ubuntuHelper = read('installer/ubuntu/package/flash_firmware.sh');
    const releaseScript = read('scripts/prepare_release.ps1');
    const readme = read('README.md');

    expect(cmake).not.toContain('WIFI_SSID="${WIFI_SSID}"');
    expect(cmake).not.toContain('WIFI_PASSWORD="${WIFI_PASSWORD}"');
    expect(cmake).toContain('pico_embed_pt_in_binary(pico_wifi_dmx');
    expect(partitionTable).toContain('"name": "Wi-Fi Configuration"');
    expect(partitionTable).toContain('"families": ["data"]');
    expect(firmware).toContain('PICO_DMX_WIFI_CONFIG_OFFSET');
    expect(firmware).toContain('load_wifi_credentials');

    expect(windowsForm).toContain('PICO_DMX_WIFI_SSID');
    expect(windowsForm).toContain('PICO_DMX_WIFI_PASSWORD');
    expect(windowsHelper).toContain('New-WifiConfigurationUf2');
    expect(windowsHelper).toContain('$env:PICO_DMX_WIFI_PASSWORD = $null');
    expect(windowsHelper).toContain('Remove-Item -LiteralPath $wifiConfigUf2');
    expect(windowsGenerator).toContain('0xe48bff58u');
    expect(windowsBuilder).toContain('scripts\\wifi_config_uf2.ps1');
    expect(windowsBuilder).toContain('"Wi-Fi\\s+Configuration"');
    expect(developerFlasher).toContain('[switch]$ConfigureWifi');
    expect(developerFlasher).toContain('Read-Host "Wi-Fi password" -AsSecureString');
    expect(ubuntuPage).toContain('Wi-Fi network name (SSID)');
    expect(ubuntuMain).toContain('PICO_DMX_WIFI_SSID');
    expect(ubuntuMain).toContain('PICO_DMX_WIFI_PASSWORD');
    expect(ubuntuHelper).toContain('create_wifi_config_uf2.php');
    expect(ubuntuHelper).toContain('unset PICO_DMX_WIFI_PROVISION PICO_DMX_WIFI_SSID PICO_DMX_WIFI_PASSWORD');
    expect(ubuntuHelper).toContain('rm -f -- "$wifi_config_uf2"');
    expect(read('installer/ubuntu/build_package.sh')).toContain('Wi-Fi[[:space:]]+Configuration');
    expect(releaseScript).toContain('compile-time Wi-Fi credentials');
    expect(readme).toContain('Legacy `SSID` and `SSID_PW` environment variables are ignored');
    expect(readme).toContain('not a supported configuration interface');
  });

  test('Windows firmware installer checks discovered Pico versions against its bundle', () => {
    const checker = read('installer/windows/shell/FirmwareCompatibilityChecker.cs');
    const form = read('installer/windows/shell/FirmwareFlashForm.cs');
    const mainForm = read('installer/windows/shell/MainForm.cs');

    expect(mainForm).toContain('new FirmwareFlashForm(');
    expect(form).toContain('Check installed firmware');
    expect(checker).toContain('pico_discovery.php?timeoutMs=');
    expect(checker).toContain('firmware-manifest.json');
    expect(checker).toContain('device.Version == bundledFirmwareVersion');
    expect(form).toContain('Update needed');
    expect(form).toContain('Firmware current');
  });

  test('Windows application checks firmware compatibility on startup and offers the updater', () => {
    const checker = read('installer/windows/shell/FirmwareCompatibilityChecker.cs');
    const form = read('installer/windows/shell/FirmwareFlashForm.cs');
    const mainForm = read('installer/windows/shell/MainForm.cs');

    expect(mainForm).toContain('await CheckFirmwareCompatibilityOnStartupAsync()');
    expect(mainForm).toContain('Firmware update required');
    expect(mainForm).toContain('OpenFirmwareUpdater(checkInstalledFirmwareOnStart: true)');
    expect(checker).toContain('pico_discovery.php?timeoutMs=');
    expect(checker).toContain('device.Version == bundledFirmwareVersion');
    expect(checker).toContain('UpdateCount');
    expect(form).toContain('checkInstalledFirmwareOnStart');
    expect(form).toContain('await CheckInstalledFirmwareAsync()');
  });

  test('every Windows application form receives the shared dark title bar', () => {
    const theme = read('installer/windows/shell/WindowsTheme.cs');
    const form = read('installer/windows/shell/FirmwareFlashForm.cs');
    const mainForm = read('installer/windows/shell/MainForm.cs');

    expect(theme).toContain('DWMWA_USE_IMMERSIVE_DARK_MODE');
    expect(theme).toContain('form.HandleCreated +=');
    expect(mainForm).toContain('WindowsTheme.ApplyDarkTitleBar(this)');
    expect(mainForm.match(/WindowsTheme\.ApplyDarkTitleBar\(dialog\)/g)).toHaveLength(2);
    expect(form).toContain('WindowsTheme.ApplyDarkTitleBar(this)');
  });

  test('Windows shell uses dark application dialogs instead of native light message boxes', () => {
    const dialog = read('installer/windows/shell/DarkMessageBox.cs');
    const form = read('installer/windows/shell/FirmwareFlashForm.cs');
    const mainForm = read('installer/windows/shell/MainForm.cs');

    expect(dialog).toContain('WindowsTheme.ApplyDarkTitleBar(dialog)');
    expect(dialog).toContain('MessageBoxButtons.YesNo');
    expect(dialog).toContain('MessageBoxButtons.OKCancel');
    expect(form).not.toMatch(/(^|[^A-Za-z])MessageBox\.Show\(/m);
    expect(mainForm).not.toMatch(/(^|[^A-Za-z])MessageBox\.Show\(/m);
    expect(form).toContain('DarkMessageBox.Show(');
    expect(mainForm).toContain('DarkMessageBox.Show(');
  });
});
