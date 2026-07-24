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
    expect(installer).toContain('$APPDATA\\${PRODUCT_NAME}\\data');
    expect(installer).toContain('$APPDATA\\${PRODUCT_NAME}\\backups');
    expect(installer).toContain('PicoDmxController');
    expect(installer).not.toMatch(/RMDir\s+\/r\s+["']?\$PROGRAMDATA/i);
    expect(builder).not.toContain('api\\data');
    expect(builder).not.toContain('mysql');
    expect(apache).toContain('SetEnv PICO_DMX_DATA_DIR');
    expect(apache).toContain('Options -Indexes');
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
      'release/v*/pico-dmx-controller-*-windows-*.exe',
      'release/v*/pico-dmx-controller-*-windows-*.exe.sha256'
    ]) {
      expect(ignore).toContain(pattern);
    }
    expect(builder).not.toMatch(/CertificatePassword|PfxPassword|SecureString/);
    expect(builder).toContain('SigningCertificateThumbprint');
  });

  test('Windows customer app uses a closeable WebView2 shell without stopping the server', () => {
    const project = read('installer/windows/shell/PicoDmxShell.csproj');
    const form = read('installer/windows/shell/MainForm.cs');
    const builder = read('installer/windows/build_installer.ps1');
    const installer = read('installer/windows/pico-dmx-controller.nsi');

    expect(project).toContain('Microsoft.Web.WebView2');
    expect(form).toContain('new WebView2');
    expect(form).toContain('Keys.F11');
    expect(form).toContain('Keys.Escape');
    expect(form).toContain('NotifyIcon');
    expect(form).toContain('Exit application');
    expect(form).toContain('Environment.SpecialFolder.LocalApplicationData');
    expect(form).toContain('DwmSetWindowAttribute');
    expect(form).toContain('DWMWA_USE_IMMERSIVE_DARK_MODE');
    expect(form).toContain('DarkColorTable');
    expect(form).not.toMatch(/ServiceController\s*\.\s*Stop|Stop-Service|PicoDmxController.*(?:stop|Stop)/);
    expect(builder).toContain('dotnet publish');
    expect(installer).toContain('PicoDmxShell.exe');
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
});
