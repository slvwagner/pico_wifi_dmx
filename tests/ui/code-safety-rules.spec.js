const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test.describe('Code safety regression rules', () => {
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
    expect(main).toContain("'Exit only'");
    expect(main).toContain("'Exit and stop server'");
    expect(main).toContain('app.exit(EXIT_KEEP_SERVER)');
    expect(main).toContain('app.exit(EXIT_STOP_SERVER)');
    expect(shellPage).toContain('<title>WiFiPicoDMX</title>');
    expect(launcher).toContain('EXIT_KEEP_SERVER=20');
    expect(launcher).toContain('EXIT_STOP_SERVER=21');
    expect(launcher).toContain('systemctl stop pico-dmx-controller.service');
    expect(desktop).toContain('Name=WiFiPicoDMX');
    expect(builder).toContain('wifi-pico-dmx_${version}_${architecture}.deb');
    expect(ignore).toContain('release/v*/wifi-pico-dmx_*_amd64.deb');
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

  test('Windows release preparation builds and records the customer installer', () => {
    const releaseScript = read('scripts/prepare_release.ps1');

    expect(releaseScript).toContain('[switch]$SkipWindowsInstaller');
    expect(releaseScript).toContain('[string]$WindowsSigningCertificateThumbprint');
    expect(releaseScript).toContain('Build Windows customer installer');
    expect(releaseScript).toContain('installer\\windows\\build_installer.ps1');
    expect(releaseScript).toContain('windowsInstaller = $windowsInstaller');
    expect(releaseScript).toContain('Authenticode signed:');
  });

  test('README presents the stable Windows installer before the overview and requires release-link verification', () => {
    const readme = read('README.md');
    const localPathsExample = read('config/local-paths.example.json');
    const stableVersion = readme.match(/\*\*Latest stable release:\*\* `([^`]+)`/)?.[1];

    expect(stableVersion).toBeTruthy();
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
    expect(readme).toContain('gh release create v<VERSION>');
    expect(readme).toContain('release/v<VERSION>/docs/user-manual.html');
    expect(readme).toContain('Open the README installer and user-manual links');
  });

  test('generated user manuals start with linked contents and end with the canonical project changelog', () => {
    const manual = read('docs/user-manual.md');
    const builder = read('scripts/build_user_manual_pdf.ps1');

    expect(manual.indexOf('## Table of Contents')).toBeLessThan(manual.indexOf('## Introduction'));
    expect(manual).toContain('- [1. Fixture Controller](#1-fixture-controller)');
    expect(manual).toContain('- [Change Log](#change-log)');
    expect(manual).toContain('## Change Log');
    expect(manual).toContain('<!-- PICO_DMX_CHANGELOG -->');
    expect(manual.indexOf('## Change Log')).toBeGreaterThan(manual.indexOf('## Troubleshooting'));
    expect(manual.trim().endsWith('<!-- PICO_DMX_CHANGELOG -->')).toBe(true);
    expect(builder).toContain('Join-Path $repoRoot "CHANGELOG.md"');
    expect(builder).toContain('$manualMarkdown.Replace(');
    expect(builder).toContain("'(?m)^##\\s+', '### '");
    expect(builder).toContain('class="manual-nav"');
    expect(builder).toContain('class="manual-nav-toggle"');
    expect(builder).toContain('class="manual-back-to-contents"');
    expect(builder).toContain("pager.className = 'section-pager'");
    expect(builder).toContain('@media print');
    expect(builder).toContain('display: none !important');
  });

  test('manual generation, deployment, installers, and releases keep clean and navigable PDF variants', () => {
    const builder = read('scripts/build_user_manual_pdf.ps1');
    const updater = read('scripts/update_user_manual.ps1');
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
    expect(windowsInstaller).toContain('docs\\user-manual-navigation.pdf');
    expect(macosInstaller).toContain('docs/user-manual-navigation.pdf');
    expect(ubuntuInstaller).toContain('docs/user-manual-navigation.pdf');
    expect(navigationHtml).toContain('<html class="manual-pdf-navigation" lang="en">');
    expect(printHtml).toContain('<html lang="en">');
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

  test('Windows firmware installer checks discovered Pico versions against its bundle', () => {
    const form = read('installer/windows/shell/FirmwareFlashForm.cs');
    const mainForm = read('installer/windows/shell/MainForm.cs');

    expect(mainForm).toContain('new FirmwareFlashForm(Icon, controllerUri)');
    expect(form).toContain('Check installed firmware');
    expect(form).toContain('pico_discovery.php?timeoutMs=');
    expect(form).toContain('firmware-manifest.json');
    expect(form).toContain('device.Version == bundledFirmwareVersion');
    expect(form).toContain('Update needed');
    expect(form).toContain('Firmware current');
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
});
