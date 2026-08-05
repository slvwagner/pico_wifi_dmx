# pico_wifi_dmx

WiFi-controlled DMX512 controller firmware and browser UI for the Raspberry Pi Pico 2 W (RP2350). Each Pico drives one full 512-channel DMX universe, and one show can combine multiple named Picos as separate DMX outputs/universes. Fixtures are assigned to their output, so the same DMX address can be reused in different universes. The browser can be used for setup and live editing, while chases and effects can also run autonomously on the involved Picos so show playback does not depend on browser timing or WiFi latency.

- **Latest stable release:** `1.0.1`
- **Current development version:** `1.1.0`

See [Versioning](#versioning) for the version-number and branch policy and [CHANGELOG.md](CHANGELOG.md) for release notes.

## Getting Started

For a customer PC running 64-bit Windows, download and run the current
**[WiFiPicoDMX 1.0.1 Windows installer](https://github.com/slvwagner/pico_wifi_dmx/releases/download/v1.0.1/wifi-pico-dmx-1.0.1-windows-x64.exe)**.
The installer includes the customer application, local web server, manual, and
guided Pico firmware updater. Because the current installer is unsigned,
Windows can display a SmartScreen publisher warning.

Read the matching
**[WiFiPicoDMX 1.0.1 user manual (PDF)](https://github.com/slvwagner/pico_wifi_dmx/releases/download/v1.0.1/user-manual.pdf)**
for installation, firmware flashing, show setup, and operation instructions.

The [latest GitHub Release](https://github.com/slvwagner/pico_wifi_dmx/releases/latest)
also provides the installer checksum, Pico firmware images, release manifest,
and PDF user manual.

Continue with [Install the Windows customer application](#install-the-windows-customer-application)
for the complete installation, network-access, firmware-update, and startup
instructions.

## Table of Contents

- [Overview](#overview)
- [Critical XAMPP environment safety](#critical-xampp-environment-safety)
- [Customer installation details](#customer-installation-details)
- [Automated Tests](#automated-tests)
- [Project Structure](#project-structure)
- [Versioning](#versioning)
- [Architecture](#architecture)
- [Playback Modes](#playback-modes)
- [HTTP API](#http-api)
- [Web UI](#web-ui)
- [Detailed Source Reference](#detailed-source-reference)
- [Requirements](#requirements)
- [Configure](#configure)
- [Build](#build)
- [Flash](#flash)
- [Resource Usage](#resource-usage)
- [Notes](#notes)

## Overview

The project combines firmware, a XAMPP-hosted web interface, JSON-based setup storage, and automated tests/documentation for a complete small lighting-control workflow.

Core features:

### Show setup and data

- **Fixture Controller** — define fixture profiles, patch one or many fixtures, edit live values, recall Default/Blackout values, create fixture groups, save scenes, and build reusable palettes.
- **Fixture Library** — load fixture profiles from the converted Open Fixture Library catalog with defaults, fine channels, compatible RGB matrices, advanced multi-emitter colors, split-color and filter previews, capability ranges, highlights, and wheel images; merge edited show profiles with reusable library modes in either direction; and export/import the complete catalog as a compressed ZIP.
- **DMX Outputs** — configure multiple named Pico controllers and universes in one show, discover devices on the network, assign every fixture to an output, reuse DMX addresses across universes, and monitor show-wide Pico availability from the shared header.
- **Portable show and library backups** — Fixture Controller provides separate **Export Show**, **Import Show**, **Export Library**, and **Import Library** actions. The show JSON embeds definitions used by its patched fixtures; the compressed library ZIP contains the complete reusable catalog.
- **Server-side JSON data** — setup data is stored under XAMPP `data/*.json`; the complete setup export collects these stores into one portable backup file.

### Programming and visualization

- **Groups and Group Edit** — select fixtures manually or through saved groups, then edit matching controls across mixed fixture types without touching unrelated channels.
- **Scenes and Palettes** — scenes store complete saved looks for their scope; palettes store partial looks such as positions, colors, gobos, dimmer, beam, or fan-out results. Filled tiles can be renamed and styled with a background color plus an optional visual.
- **Fan Out** — shape selected fixtures around snapshotted base values, including Pan/Tilt fan targets, with affected controls highlighted directly in the controller or chaser step editor.
- **Pixel Matrices** — create logical displays up to 64×64 pixels, map each pixel manually or automatically to fixture RGB/RGBW/RGBWA/CMY/CMYK controls or native matrix pixels, and convert uploaded PNG/JPEG/WebP/GIF pictures in the browser with fit and brightness controls. Controller and Show Run recall pictures across the fixtures' assigned DMX Outputs. Chaser can capture pictures as animated steps, preview them on the primary output, and split an autonomous upload into linked Pico payloads.
- **Room Plane** — calibrated room-plane coordinate mapping for moving-light pan/tilt targeting, with saved plane definitions, fixture calibration, group selection, barycentric target interpolation, and shared Scene/Palette recalls for checking the programmed look while positioning fixtures.

### Playback and live operation

- **Show Run operator page** — arrange Groups, Fixtures, Scenes, Palettes, Pixel Matrices, Room Planes, Live Controls, masters, MIDI, and Pico playback in a configurable card matrix. Card and tile layouts are saved to the server, cards can be repeated for separate operator banks, and the adaptive sticky header keeps navigation visible beside wide toolboxes while reporting show-wide Pico output health.
- **Shared Toolboxes sidebar** — scenes, groups, palettes, fan out, chases, chase steps, playback, effects, and room-plane tools live in a shared resizable sidebar. A common Edit mode enables touch-friendly toolbox and tile reordering plus Cols/Rows selectors, while width, order, collapse state, and group selection are restored consistently across pages.
- **Chaser** — create step-based chases, define participating controls, add/capture/duplicate/reorder steps, recall or edit saved Pixel Matrix pictures directly in the toolbox, preview recalled chases or individual steps on DMX, use browser playback with direction and ping-pong modes, and upload chases into Pico slots for standalone playback.
- **Effects** — apply circle, figure-8, pan swing, tilt swing, sine, and pulse effects to compatible fixture controls. Effects are relative to the current base/scene value and can be saved as reusable recipes or uploaded to Pico effect slots.
- **Pico Playback** — run chaser and effect slots directly on the Pico with play/stop, state-aware pause/resume, direction, loop and ping-pong modes, BPM/speed changes, and slot status readback. Browser, chaser, effect, and manual-recall handoffs stop conflicting playback engines before changing DMX output.
- **MIDI control** — connect a Web MIDI controller or use the Launch Control XL emulator, learn mappings for scenes, live controls, masters, and Pico playback actions, and use soft takeover for continuous controls.
- **GPIO Control** — choose a configured DMX Output and keep independent Pico GPIO mappings per universe for actions such as chase/effect play, stop, pause, resume, speed, BPM, and tap tempo. ADC-capable pins support smoothed analog speed/BPM control; the complete per-output setup autosaves to XAMPP and the selected mapping can be pushed to or read from its Pico.

### Firmware, diagnostics, and development

- **DMX Buffer Monitor** — select a named DMX Output/universe, then read and display its current output buffer or base buffer for all 512 DMX channels.
- **Pico Performance Test** — select one DMX Output or all configured Picos, then verify the installed firmware version, firmware timing, DMX frame health, HTTP callback timing, buffer readback, write throughput, and USB or emulated MIDI-to-DMX response time with per-Pico/universe histories.
- **Controller Pico validation** — the shared header checks every Pico used by the show, reports online coverage and the exact expected firmware version separately, and identifies unreachable, mismatched, or version-less firmware by output name and universe.
- **Partitioned Pico firmware updates** — the application and CYW43 Wi-Fi firmware use separate RP2350 flash partitions, so routine application-only UF2 updates are smaller while release packages retain regular and try-before-you-buy Wi-Fi provisioning images.
- **Release tooling** — scripts safely sync the app to XAMPP, regenerate the dark-mode manual/PDF/screenshots from deterministic data, run isolated UI and optional hardware tests, build firmware, flash the required UF2 files in order, and prepare checksummed release packages.
- **Windows, macOS, and Ubuntu customer installers** — package the app, manual, persistent show storage, a managed web service, native/desktop application launchers, optional trusted-LAN access, upgrade snapshots, and data-preserving uninstall behavior—without shipping MariaDB, phpMyAdmin, or the XAMPP development stack.

License: copying, modification, and sharing are allowed for non-commercial use only. Commercial use requires separate written permission. See [LICENSE](LICENSE).

User-facing operating instructions are in [docs/user-manual.md](docs/user-manual.md). A clean portrait PDF is available at [docs/user-manual.pdf](docs/user-manual.pdf), and a landscape PDF with a persistent clickable contents sidebar is available at [docs/user-manual-navigation.pdf](docs/user-manual-navigation.pdf).

---

## Critical XAMPP environment safety

The two XAMPP applications have different owners and must never be treated as interchangeable:

- `http://<xampp-host>/dmx/` (`<xampp-htdocs>\dmx`) represents the user's working environment. Its `data/*.json` files contain user-owned show data.
- `http://<xampp-host>/dmx-test/` (`<xampp-htdocs>\dmx-test`) represents the automated-test playground. Browser tests may overwrite its JSON data.

These rules are mandatory for developers, scripts, and AI agents:

1. **Never run Playwright, `npm`/`npx` test commands, browser automation, screenshot capture, manual generation, or test diagnostics against `/dmx/`.** Many UI tests intentionally save mock groups, palettes, chases, tile positions, and UI state through the PHP endpoints. A test can destroy live show data even when its assertions look read-only.
2. **Never point `DMX_TEST_BASE_URL`, Playwright `baseURL`, `tests/pathconfig.local.json`, or a temporary test override at `/dmx/`.** The only XAMPP target allowed for automation is `/dmx-test/`. The repository-local PHP server with deterministic `docs/manual-data/` is preferred for manuals and screenshots.
3. **Before starting any browser automation, verify that the target URL path is `/dmx-test/` or a repository-local development server. Stop immediately if it resolves to `/dmx/`.** Do not rely on hostname differences such as `localhost` versus the XAMPP computer's LAN address; the URL path determines the environment.
4. **Deploy source changes to `/dmx/` only with `scripts/update_xampp_server.ps1`.** Do not directly copy, edit, delete, or replace files under `<xampp-htdocs>\dmx`. Use the script with `-AppFolder dmx -BaseUrl http://<xampp-host>/dmx/`, then verify the page manually or with read-only HTTP GET requests.
5. **Use `/dmx-test/` for regression testing.** Synchronize it through `scripts/update_xampp_server.ps1 -AppFolder dmx-test -BaseUrl http://<xampp-host>/dmx-test/` before running tests. Test failures caused by test data must be resolved inside this isolated environment, never by switching the suite to `/dmx/`.
6. **Generate manuals and screenshots outside the user's environment.** Use `scripts/update_user_manual.ps1 -LocalOnly` and the repository's deterministic manual data, or an explicitly isolated test app. Never capture them from `/dmx/`.
7. **Treat XAMPP `data/*.json` as irreplaceable user data.** Do not write, restore, migrate, or import it without explicit user authorization. Before an authorized recovery, snapshot the current files and restore only the files the user approved.
8. **For bug fixes, add and run a failing regression test in the isolated environment before changing implementation code.** After the fix, rerun the focused browser tests there. Run real hardware tests only for firmware changes or when the user explicitly requests them.

The deployment wrapper copies application source and verifies HTTP availability; it is not permission to run tests against the deployed user environment.

---

## Customer installation details

### Install the Windows customer application

For a customer PC, use the generated
`wifi-pico-dmx-<VERSION>-windows-x64.exe` instead of installing the full
XAMPP development stack. The installer:

- installs the customer-facing **WiFiPicoDMX** application below
  `%ProgramFiles%\WiFiPicoDMX` on a new installation (an upgrade can retain
  the earlier program directory);
- stores mutable shows and fixture data in the upgrade-compatible location
  `%ProgramData%\Pico DMX Controller\data`;
- starts the `PicoDmxController` Windows service automatically;
- creates Start Menu and desktop shortcuts that open a dedicated native
  application window, with the default browser as fallback;
- lets the customer choose an available HTTP port, defaulting to 8090, and
  remembers that choice during upgrades;
- identifies an already running Pico DMX installation on that port and asks to
  close its window/service so upgrades can retain the same address;
- optionally enables the selected TCP port on the Windows **Private** firewall
  profile so iPads and other trusted LAN devices can connect;
- asks whether to open the guided Pico firmware installer after setup and
  bundles the matching application UF2, Wi-Fi UF2, checksum manifest, and
  Raspberry Pi `picotool`;
- snapshots existing data before an upgrade and preserves all `ProgramData`
  when the software is uninstalled.

Keep the Private-network option disabled when the controller will be used only
on the Windows PC. Enable it when an iPad or another operator device must open
`http://<controller-pc-address>:<selected-port>/`. Do not expose the selected
port to the public internet.

The installer source and reproducible build instructions are in
[`installer/windows/README.md`](installer/windows/README.md). Customer release
builds should be Authenticode-signed; unsigned development builds can trigger a
Windows SmartScreen warning.

Firmware flashing is opt-in and occurs only in the WiFiPicoDMX guide after
installation. Before BOOTSEL, **Check installed firmware** reuses the
Controller's Pico discovery service to find every running Pico on the network
and compare its reported version with the validated bundled firmware. The
guide then explains how to connect exactly one Pico 2 W in BOOTSEL mode,
validates the bundled files and target, asks again before writing, prevents
closing during the flash, and reports recovery steps. It can also be opened
later through **Application > Firmware update…** or the Start Menu **Firmware
Update** shortcut.

The native **WiFiPicoDMX** application window provides normal minimize/maximize/close controls,
F11 fullscreen, Escape to leave fullscreen, and Open/fullscreen/exit actions
from its tray icon. Its Windows title bar/frame, menu and dropdown surfaces,
status bar, tray menu, and fullscreen controls use a matching dark theme.
Fullscreen retains a small bar with **Exit full screen** and **Close
application**, so it never traps the operator in kiosk mode. Closing the GUI
offers **Exit only**, **Exit and stop server**, and **Cancel**. Exit only closes
the local window while keeping the server available to iPads and other PCs.
Exit and stop server requests Windows administrator approval, stops the
`PicoDmxController` service, and then exits. While Windows completes the
shutdown, a non-dismissible progress window remains visible and explains that
the operation can take up to 45 seconds. The shell performs a final service
state check before reporting a failure. Cancelling leaves the application and
server running.
When the shortcut is opened after such a shutdown, the shell explains that
administrator approval is required, starts the stopped service, and then loads
the controller. No approval prompt is shown when the service is already
running. Before loading the interface, the native application clears only its
WebView2 disk cache and the packaged server requires changed HTML, CSS, and
JavaScript to be revalidated. This prevents an upgraded installation from
showing an older layout while preserving show data, browser-local settings,
and cookies.

### Install the macOS customer application

Build the architecture-specific macOS package on macOS 12 or newer:

```bash
./installer/macos/build_php_runtime.sh
./installer/macos/build_package.sh
```

Open the generated
`wifi-pico-dmx-<VERSION>-macos-<ARCH>.pkg`, then start **WiFiPicoDMX** from
Applications. Its native dark WKWebView window supplies
Controller Settings, reload, normal macOS fullscreen, and standard close/quit
actions. First-run setup accepts an available HTTP port from `1024–65535`
(default `8090`) and keeps access local unless the customer explicitly enables
trusted-LAN access.

The app installs its own per-user LaunchAgent. Closing or quitting offers
**Exit only**, **Exit and stop server**, and **Cancel**. Exit only keeps the
server available to operator devices; Exit and stop server unloads only that
LaunchAgent. The upgrade-compatible app bundle and show-data paths remain
under `/Applications/Pico DMX Controller.app` and
`~/Library/Application Support/Pico DMX Controller`. Removing the app therefore
does not silently remove shows.

The package source, pinned standalone-PHP build, Developer ID signing, Apple
notarization, stapling, and customer instructions are documented in
[`installer/macos/README.md`](installer/macos/README.md). Build customer
releases with organization-owned **Developer ID Application** and **Developer
ID Installer** identities and a protected Keychain notarization profile.

### Install the Ubuntu customer application

Build the Ubuntu package on Ubuntu or Debian:

```bash
./installer/ubuntu/build_package.sh
```

Install the generated package from `release/v<VERSION>/` by double-clicking it
in Ubuntu's App Center, or with APT:

```bash
sudo apt install ./wifi-pico-dmx_<VERSION>_amd64.deb
```

The package installs the read-only application below
`/opt/pico-dmx-controller`, stores mutable shows and fixture data below
`/var/lib/pico-dmx-controller/data`, manages its systemd service with the app,
and adds **WiFiPicoDMX** to the Applications menu. The self-contained
application includes its own Chromium engine, dark frame, application and
fullscreen controls, status bar, tray menu, and Web MIDI support. The installer
also creates an executable shortcut on normal users' configured XDG desktops
without replacing unrelated files. The service listens only on
`127.0.0.1:8090` by default. Launching the application starts that service.
Closing offers **Exit only**, **Exit and stop server**, and **Cancel**; Exit
only leaves PHP available to operator devices, while Exit and stop server
stops it after all local WiFiPicoDMX windows have closed.

To allow iPads and other operator devices on a trusted local network, run:

```bash
sudo pico-dmx-config --lan
```

This changes the listener to all network interfaces and adds the packaged TCP
8090 UFW rule when UFW is active. Return to local-only access with
`sudo pico-dmx-config --local`. Do not expose port 8090 to the public internet.
Upgrades snapshot current show data, and removing the package preserves all
data under `/var/lib/pico-dmx-controller`.

Application-managed startup remains the default. Installations that must start
the server automatically at boot can opt in with
`sudo pico-dmx-config --always-on`; restore application-managed startup with
`sudo pico-dmx-config --application-managed`.

The package source, behavior, and build instructions are documented in
[`installer/ubuntu/README.md`](installer/ubuntu/README.md).

### Run the developer XAMPP environment

Install the runtime tools:

- **XAMPP for Windows** with Apache and PHP enabled. The browser UI uses PHP files in `api/` to save JSON setup data.
- A modern browser such as Chrome, Edge, or Safari.
- A Raspberry Pi Pico 2 W flashed with the `pico_wifi_dmx` firmware.

Configure the local paths first. The scripts use `config/local-paths.json` as their default path configuration for your machine:

```powershell
cd <path-to-your-checkout>\pico_wifi_dmx
Copy-Item config\local-paths.example.json config\local-paths.json
```

Edit `config/local-paths.json` so it matches your XAMPP installation, app folder, browser URL, and Chrome path:

```json
{
  "xamppHtdocs": "C:/path/to/xampp/htdocs",
  "appFolder": "dmx",
  "baseUrl": "http://localhost/dmx/",
  "chromePath": "C:/Program Files/Google/Chrome/Application/chrome.exe"
}
```

These values mean the web app will be copied to:

```text
<XAMPP installation directory>\htdocs\<app folder>\
```

`config/local-paths.json` is ignored by Git. Keep your real machine paths there. The sync, manual screenshot/PDF, README screenshot, and release helper scripts read this file automatically. If you pass path parameters directly to a script, those command-line values override the config file for that run.

Copy the web app to XAMPP:

```powershell
.\scripts\sync_fixture_controller_to_xampp.ps1
```

Or use the deployment wrapper, which syncs the app and verifies the deployed pages:

```powershell
.\scripts\update_xampp_server.ps1
```

Open the UI:

```text
http://localhost/dmx/
```

On Ubuntu, you can run the browser UI directly from the repository without XAMPP:

```bash
cd ~/pico_wifi_dmx
php -S 127.0.0.1:8000 scripts/dev-router.php
```

Then open:

```text
http://127.0.0.1:8000/
```

If port `8000` is already in use, choose another port in both commands, for example `8002`.

The built-in PHP server stores setup JSON under `api/data/`. This is local runtime data and is ignored by Git.

`127.0.0.1` is only reachable from the same Ubuntu machine. To use the UI from another device on the network, deploy it into XAMPP instead. On Ubuntu XAMPP installs commonly live under `/opt/lampp`; this project can use the PowerShell deployment wrapper:

```bash
pwsh -NoProfile -ExecutionPolicy Bypass \
  -File scripts/update_xampp_server.ps1 \
  -XamppHtdocs /opt/lampp/htdocs \
  -AppFolder dmx \
  -BaseUrl http://localhost/dmx/
```

If your XAMPP `htdocs` root is not writable by your user, deploy under a writable subfolder, for example:

```bash
pwsh -NoProfile -ExecutionPolicy Bypass \
  -File scripts/update_xampp_server.ps1 \
  -XamppHtdocs /opt/lampp/htdocs/editable \
  -AppFolder dmx \
  -BaseUrl http://localhost/editable/dmx/
```

After `config/local-paths.json` contains the Ubuntu paths, updating this machine's XAMPP copy is just:

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/update_xampp_server.ps1
```

Then open the matching URL from the Ubuntu machine, or replace `localhost` with the Ubuntu machine's LAN IP from another device. The XAMPP URL is only the address of the web interface and server-side show storage; it is independent from the Pico URLs assigned to the show's DMX Outputs.

Configure hardware from **Fixture Controller → DMX Outputs**. Use **Find Picos** to receive every Pico discovery beacon on UDP port `64540`, then add the wanted devices and assign their universes. Each beacon includes the Pico SDK unique-board ID, which the show stores as the output's stable device identity independently of its DHCP address. If the same Pico later advertises a different IP address, **Find Picos** automatically updates only its saved URL. The output ID, universe, name, fixture assignments, and all show programming stay unchanged; click **Done** to autosave the refreshed address. URLs can also be entered manually in that modal. The sticky header on every page checks the outputs used by patched fixtures and shows **online/total Picos online**; click the pill to refresh immediately. Green means every used output answered, amber means only some answered, and red means none answered. On the Fixture Controller, **DMX Outputs** remains anchored at the right edge of the status row while this text refreshes; when horizontal space is constrained, the fleet text is shortened with an ellipsis instead of wrapping or moving the button.

Changing IP numbers are handled in two places:

- **XAMPP/server URL**: configure scripts and tests with `config/local-paths.json`, `tests/pathconfig.local.json`, or `DMX_TEST_BASE_URL`. The browser app itself uses relative URLs for setup files, so once a page is opened from the right XAMPP address it continues to talk to the same server.
- **Pico URLs**: configure show hardware with Controller → **DMX Outputs**. Run **Find Picos** after a DHCP change; a Pico whose saved unique-board ID is recognized receives its current URL automatically. Hardware tests may still override their target with `DMX_PICO_BASE_URL`.

Setup data is saved in XAMPP under `dmx/data/*.json`. Use **Fixture Controller > Show > Export Show** before large changes when you want an extra backup of the complete show setup, including named DMX Outputs/universes, fixture output assignments, and every Pico's GPIO/ADC mappings.

### Install the firmware

Committed firmware releases are stored in:

```text
release/v<VERSION>/pico_wifi_dmx-v<VERSION>.uf2
```

Use that application UF2 when the separate Wi-Fi firmware partition has already been provisioned and you do not need to build from source. To update it:

1. Hold the Pico 2 W **BOOTSEL** button while plugging it into USB.
2. Wait for the `RPI-RP2` drive to appear.
3. Copy `release/v<VERSION>/pico_wifi_dmx-v<VERSION>.uf2` to that drive.
4. The Pico reboots automatically.
5. Open the serial log and note the printed Pico URL.

The matching checksum is stored beside it in:

```text
release/v<VERSION>/pico_wifi_dmx-v<VERSION>.uf2.sha256
```

Release 0.9.10 is the final single-UF2 release. Starting with 0.9.11, the CYW43 Wi-Fi firmware is stored in its own RP2350 flash partition. A new device, or a device upgrading from 0.9.10 or older, must receive both of these files once:

```text
release/v<VERSION>/pico_wifi_dmx-v<VERSION>.uf2
release/v<VERSION>/pico_wifi_dmx-wifi-firmware-v<VERSION>.uf2
```

Flash the application UF2 first so it installs the partition table, enter USB boot mode again, and then flash the Wi-Fi firmware UF2. With picotool:

```powershell
$Picotool = "$env:USERPROFILE/.pico-sdk/picotool/2.3.0/picotool/picotool.exe"
& $Picotool load release/v<VERSION>/pico_wifi_dmx-v<VERSION>.uf2
& $Picotool reboot -u
& $Picotool load -ux release/v<VERSION>/pico_wifi_dmx-wifi-firmware-v<VERSION>.uf2
```

After that one-time provisioning, normal application updates require only `pico_wifi_dmx-v<VERSION>.uf2`. Reflash the separate Wi-Fi firmware only when a release explicitly says that its CYW43 firmware changed. The release also contains a `-tbyb` Wi-Fi UF2 for advanced RP2350 try-before-you-buy updates; it is not needed for a normal initial installation. If no prebuilt UF2 is available, build it from source with the developer steps below.

Windows customer installations can perform the complete two-file procedure
through **Application > Firmware update…** without installing developer tools.

### Build the firmware from source

This project was created around the official Raspberry Pi Pico development environment for Visual Studio Code. The checked-in configuration targets:

| Component | Project configuration |
| --- | --- |
| Board | Raspberry Pi Pico 2 W (`pico2_w`, RP2350) |
| Pico SDK | 2.3.0 |
| ARM GNU Toolchain | 14.2.Rel1 |
| picotool | 2.3.0 |
| CMake | 3.31.5 |
| Ninja | 1.12.1 |
| OpenOCD | 0.12.0+dev |

Install [Visual Studio Code](https://code.visualstudio.com/) and open the repository as a single-folder workspace. VS Code reads [`.vscode/extensions.json`](.vscode/extensions.json) and offers to install the extensions used by this project:

| Marketplace extension | ID | Used here for |
| --- | --- | --- |
| [Raspberry Pi Pico](https://marketplace.visualstudio.com/items?itemName=raspberry-pi.raspberry-pi-pico) | `raspberry-pi.raspberry-pi-pico` | Official Pico SDK/toolchain management, CMake configuration, compilation, target selection, flashing, and debug commands |
| [C/C++](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) | `ms-vscode.cpptools` | C/C++ IntelliSense, code navigation, and `compile_commands.json` integration |
| [C/C++ Extension Pack](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools-extension-pack) | `ms-vscode.cpptools-extension-pack` | Installs the broader Microsoft C/C++ environment, including CMake Tools |
| [Cortex-Debug](https://marketplace.visualstudio.com/items?itemName=marus25.cortex-debug) | `marus25.cortex-debug` | RP2350 GDB debugging through OpenOCD, including the supplied internal and external OpenOCD launch profiles |
| [Serial Monitor](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-serial-monitor) | `ms-vscode.vscode-serial-monitor` | Viewing Pico boot, network, and diagnostic output over USB serial |

The repository configuration supplies the matching environment paths on Windows, Linux, and macOS. It also provides VS Code tasks for **Compile Project**, picotool **Run Project**, OpenOCD **Flash**, **Rescue Reset**, and **RISC-V Reset (RP2350)**. The Raspberry Pi Pico extension is the simplest way to install or locate the pinned SDK, compiler, CMake, Ninja, picotool, and OpenOCD versions; if prompted by CMake Tools, select the supplied **Pico** kit.

Configure WiFi and build:

```powershell
cd <path-to-your-checkout>\pico_wifi_dmx
cmake -S . -B build -G Ninja `
  -DWIFI_SSID="your_ssid" `
  -DWIFI_PASSWORD="your_password"

cmake --build build
```

On Ubuntu, use the same CMake options with shell quoting:

```bash
cd ~/pico_wifi_dmx
cmake -S . -B build -G Ninja \
  -DWIFI_SSID="your_ssid" \
  -DWIFI_PASSWORD="your_password"

cmake --build build
```

If CMake cannot find the Pico SDK, install the Raspberry Pi Pico VS Code extension on Ubuntu or point CMake at an SDK checkout:

```bash
export PICO_SDK_PATH="$HOME/.pico-sdk/sdk/2.3.0"
```

The firmware output is:

```text
build/pico_wifi_dmx.uf2
```

Optional firmware settings:

```powershell
-DDMX_TX_PIN=2 -DDMX_TRIGGER_PIN=3
-DDMX_CHANNELS=512
-DMIDI_ENABLED=1 -DMIDI_RX_PIN=5 -DMIDI_UART_ID=1 -DMIDI_BAUD=31250
```

Default hardware wiring:

```text
Pico GPIO2 -> RS-485/DMX driver DI input
Pico GPIO5 -> MIDI input receiver UART output
Pico GND   -> RS-485/DMX driver GND
Pico 3V3   -> RS-485/DMX driver VCC, if the module supports 3.3 V
Driver D+  -> DMX XLR pin 3
Driver D-  -> DMX XLR pin 2
Shield/GND -> DMX XLR pin 1
```

Do not connect Pico GPIO2 directly to a DMX cable. DMX uses an RS-485 differential line, so the Pico output must go through a suitable RS-485/DMX line driver. GPIO3 is only the optional frame-trigger/debug pin, not a DMX data output. GPIO5 is reserved by default as the DIN/TRS MIDI receive input (`MIDI_RX_PIN=5`, `MIDI_UART_ID=1`). Feed GPIO5 only from a proper MIDI input receiver/opto-isolation circuit; do not wire a MIDI connector directly to the Pico GPIO.

### Rev. A Fusion hardware design

The Rev. A carrier schematic, PCB starting layout, physical net lists, and
design-specific component library are generated as compatible EAGLE XML files
for Fusion Electronics. Regenerate the complete bundle in dependency order:

```powershell
node scripts/generate_fusion_schematic.mjs
node scripts/generate_fusion_used_library.mjs
node scripts/generate_fusion_board.mjs
```

The bundle places these uploadable design files together:

- `hardware/fusion/WiFiPicoDMX_RevA.sch`;
- `hardware/fusion/WiFiPicoDMX_RevA.brd`;
- `hardware/fusion/WiFiPicoDMX_RevA_used.lbr`.

The schematic generator defines component/pad mappings, named signals and
connections once. The board generator preserves the reviewed 95 mm × 100 mm
functional placement, four ground pours, and DMX/MIDI isolation restrictions.
The used-library generator filters the schematic to the exact symbols,
packages, device sets, and available 3D associations present in Rev. A.

The schematic and board use the same `WiFiPicoDMX_RevA_used` library identity
as the standalone `.lbr`. EAGLE/Fusion still embeds the used definitions in
each design file so the pair remains portable; uploading the `.lbr` separately
makes the same components reusable and permits a deliberate **Swap Library**
to a managed Fusion library.

Run the structural hardware regression suite after regeneration:

```powershell
node --test tests/hardware/*.test.mjs
```

The generated design is an engineering prototype and still requires Fusion
ERC/DRC, `RATSNEST` review, manufacturer land-pattern verification, isolation
review, routing, and mechanical checking before PCB fabrication. See
[`hardware/fusion/README.md`](hardware/fusion/README.md) for the complete
generation/import workflow, output ownership, expected counts, and review
requirements.

DMX signal generation and timing:

| Signal part | Value |
|-------------|-------|
| Output method | PIO control state machine + PIO data state machine + DMA |
| Line rate | 250 kbaud DMX, 4 us per bit |
| Break | about 92 us |
| Mark After Break | about 12 us |
| Slot time | about 44 us |
| Frame slots | 513 total: start code + 512 data channels |
| Channel numbering | HTTP/UI channel 1 is the first data slot after the start-code slot |
| Default start code | logical `0x00`, encoded before transmission |
| Default refresh | 43 Hz, limited by full-frame duration |

The DMX byte stream is encoded for the RS-485/DMX driver path used by this project. Channel values and the start-code slot are both encoded before DMA sends the frame to PIO. This keeps the logical DMX start code at `0x00` while matching the working wire-level signal used by the tested Zeitmessung Pico 2 W DMX implementation.

#### DMX frame timer and PIO IRQ handshake

DMX frame starts are owned by an RP2350 hardware-alarm repeating timer, not by
the 100 Hz foreground polling loop. The first frame is started directly during
`dmx_engine_start()`. After that, the timer callback schedules each following
frame relative to the end of the last successful callback. This positive-period
timer behavior deliberately avoids a burst of catch-up callbacks after a late
interrupt.

The word *IRQ* has two distinct meanings in this path:

| Mechanism | Purpose | CPU interrupt handler? |
| --- | --- | --- |
| Hardware alarm / repeating timer | Calls `dmx_frame_timer_callback()` at the next frame deadline | Yes; this is the short timing-critical callback |
| PIO IRQ 0 (`IRQ_FRAME_START`) | CPU-to-control-SM command that releases the next Break/MAB/frame | No; it is a PIO flag consumed by `wait 1 irq 0` |
| PIO IRQ 4 | Control-SM request for the data SM to transmit one slot | No; it is an internal PIO state-machine handshake |
| PIO IRQ 5 | Data-SM acknowledgement that the requested slot is complete | No; it is an internal PIO state-machine handshake |
| PIO IRQ 2 (`IRQ_FRAME_DONE`) | Control-SM notification that all configured slots are complete | No; firmware reads and clears the sticky PIO flag |

One frame uses this sequence:

1. Foreground code accepts channel changes into the logical frame under a
   cross-core mutex. While no frame is active, `dmx_engine_poll()` briefly
   masks Core0 interrupts and copies dirty values into the stable DMA source
   buffer. It acquires the mutex *before* masking interrupts, so waiting for a
   Core1/network writer cannot block the frame timer.
2. At the deadline, the timer callback checks PIO IRQ 2. If the previous frame
   is complete, firmware clears the flag and marks the DMA source available.
   The timer callback is lock-free and never waits for the channel-data mutex.
3. Firmware configures DMA for the complete start-code-plus-channel buffer and
   waits up to 500 us for DMA to place the first byte in the data-SM FIFO.
   Only after that FIFO is primed does the CPU force PIO IRQ 0.
4. The control SM consumes IRQ 0, emits Break and Mark After Break, then sets
   IRQ 4 once per slot. The data SM consumes IRQ 4, shifts one DMA-fed byte at
   250 kbaud, and sets IRQ 5. The control SM consumes IRQ 5 before requesting
   the next slot.
5. After the final slot, the control SM sets sticky IRQ 2. At the next timer
   callback—or during an idle foreground snapshot—firmware clears it and
   records the completed frame.

If the timer fires before IRQ 2 appears, it does not overlap or abandon the
active frame. It records a skipped callback and retries after 50 us. A
successful retry restores the normal frame period, measured from that
successful callback, so one short overrun does not become a doubled gap or a
fixed-phase catch-up burst. If a frame exceeds its calculated wire time plus a
3 ms guard, firmware aborts DMA, reinitializes both PIO state machines, and
counts an automatic resynchronization.

The Performance Test reads the corresponding counters and break-to-break
telemetry from `/perf/status.json`: frame count, skipped/retry callbacks, DMA
prime timeouts, frame timeouts, automatic resynchronizations, expected/last/
minimum/maximum interval, late intervals, and doubled intervals.

The firmware build reads its version from the repository `VERSION` file and
publishes it as `firmware_version` in both `/status.json` and
`/perf/status.json`. The Performance Test reads the deployed application's
`VERSION` and requires an exact match for every tested Pico. Matching versions
pass; a different or missing firmware version fails with the installed and
expected values and a prompt to flash the current application firmware. The
result is also stored in the per-Pico Timing History.

The Controller and other operating pages use the same field in the shared Pico
fleet indicator. The header shows both online coverage and whether every online
Pico runs current firmware. Hover or focus the indicator for per-output details,
including the output name, universe, installed version, expected version, or
connection failure. Clicking it repeats the check. The Performance Test exposes
the same validation as a dedicated **Firmware version** result and records it in
Timing History, so both the everyday Controller view and the detailed diagnostic
run enforce the same installed-versus-expected version contract.

When **Run Full Test** targets multiple configured Picos, it first performs a
bounded `/status.json` availability check for each output. An unavailable Pico
is skipped and reported by name, universe, URL, and failure reason; available
Picos continue through the full test. Pico requests and repeated write errors
are bounded so one offline output cannot leave the button disabled.

MIDI receive diagnostics:

| Item | Value |
| --- | --- |
| Default input | GPIO5 / UART1 RX |
| Serial format | 31,250 baud, 8 data bits, no parity, 1 stop bit |
| Status endpoint | `/midi/status.json` |
| Parsed messages | Channel voice messages with running status, plus realtime byte counting |

The current MIDI firmware step is diagnostic-only. It proves that the Pico receives and parses MIDI bytes without affecting DMX output. Mapping MIDI notes, buttons, faders, and encoders to show actions will be added after the hardware input is confirmed.

Flash with BOOTSEL by copying the UF2, or use picotool/OpenOCD as described in the deeper firmware sections below.

### Getting Started for Developers

Install the development/test tools:

- Git
- Node.js LTS with `npm`
- XAMPP with Apache/PHP
- Chrome or Edge for Playwright screenshots/tests
- PowerShell 7 recommended
- Firmware build tools from the previous section

Install JavaScript test dependencies from the project root:

```powershell
cd <path-to-your-checkout>\pico_wifi_dmx
npm install
npx playwright install chromium
```

Configure script paths if your XAMPP, browser, or served app URL differs:

```powershell
Copy-Item config\local-paths.example.json config\local-paths.json
```

Configure UI test and Pico hardware-test URLs separately:

```powershell
Copy-Item tests\pathconfig.example.json tests\pathconfig.local.json
```

Edit `tests/pathconfig.local.json` for your machine:

```json
{
  "xamppBaseUrl": "http://localhost/dmx-test/",
  "picoBaseUrl": "http://192.168.0.24/",
  "hardwareTests": {
    "enabled": false
  }
}
```

Normal development loop:

```powershell
.\scripts\sync_fixture_controller_to_xampp.ps1
.\scripts\sync_test_app_to_xampp.ps1
npm run test:ui
```

Run real Pico hardware tests only when a Pico is connected and you accept that the configured test channels/slots may be overwritten:

```powershell
npm run test:pico
```

The playback stress checks fill only empty Pico playback slots with temporary demo data and clear those temporary slots afterward.

After UI/manual changes, you can regenerate the deterministic documentation screenshots and dark-mode manual directly:

```powershell
.\scripts\update_user_manual.ps1
```

The release script runs this manual/screenshot step automatically unless `-SkipManual` is passed.

Prepare a release package after versions, tests, and changelog are ready:

```powershell
.\scripts\prepare_release.ps1 -Build
```

On Windows, the same command also builds
`release\v<VERSION>\wifi-pico-dmx-<VERSION>-windows-x64.exe`, writes its
SHA-256 file, and records the installer in `release-manifest.json`. The
installer is unsigned unless a protected certificate-store thumbprint is
supplied:

```powershell
.\scripts\prepare_release.ps1 -Build `
  -WindowsSigningCertificateThumbprint YOUR_CERTIFICATE_THUMBPRINT
```

Use `-SkipWindowsInstaller` only for an intentional firmware-only Windows
package. Non-Windows release runs skip the Windows installer automatically.

Before running Playwright, the release script syncs the current source into the isolated XAMPP test app at `http://localhost/dmx-test/` so the regression suite does not accidentally exercise stale files. Use `-TestAppFolder`, `-TestBaseUrl`, or `-SkipTestAppSync` only when your test target is intentionally different.

To include the real Pico hardware tests in the release run, use:

```powershell
.\scripts\prepare_release.ps1 -Build -RunHardwareTests
```

If `tests\pathconfig.local.json` does not exist, the script creates it from `tests\pathconfig.example.json`. It will not overwrite an existing local config. You can override the Pico address for one run with `-PicoBaseUrl`:

```powershell
.\scripts\prepare_release.ps1 -Build -RunHardwareTests -PicoBaseUrl "http://192.168.0.24/"
```

Important developer checks:

- Keep generated folders such as `build/`, `node_modules/`, and `test-results/` out of Git.
- Add behavior rules to Playwright tests when a UI workflow is fixed or intentionally changed.
- Update `CHANGELOG.md` whenever a user-visible bug fix or workflow change is made.
- Update `VERSION` when preparing a release. CMake uses that file for both the
  compiled `PICO_DMX_VERSION` and the Pico program metadata.

---

## Automated Tests

Regression tests live in [tests](tests/). The UI tests use Playwright against the XAMPP-served app and cover established workflow rules for Controller, Chaser, Effects, browser chase playback timing/fade behavior, and the DMX Buffer Monitor.

First-time setup on Windows:

```powershell
cd <path-to-your-checkout>\pico_wifi_dmx
npm install
npx playwright install chromium
```

Make sure XAMPP is running and the isolated test app is available at the configured URL before running the UI tests. The working `/dmx/` app is protected user data and **must never be used as a Playwright target**. Tests must use `/dmx-test/` or a repository-local server, as required by [Critical XAMPP environment safety](#critical-xampp-environment-safety). If needed, sync the current project files into the test app first:

```powershell
.\scripts\sync_test_app_to_xampp.ps1
```

Run the normal UI regression tests:

```powershell
npm run test:ui
```

On Ubuntu, point the tests at the PHP dev server instead of the default XAMPP URL:

```bash
cd ~/pico_wifi_dmx
php -S 127.0.0.1:8002 scripts/dev-router.php
```

Create `tests/pathconfig.local.json`:

```json
{
  "xamppBaseUrl": "http://127.0.0.1:8002/",
  "picoBaseUrl": "",
  "hardwareTests": {
    "enabled": false
  }
}
```

Then run:

```bash
npm install
npx playwright install chromium
npm run test:ui
```

If every UI test fails immediately with a Chromium launch error such as `sandbox_host_linux.cc` and `Operation not permitted`, run the tests from a normal Ubuntu terminal rather than from a restricted shell/container. The app may be fine; Chromium simply could not start.

The default test URL is `http://localhost/dmx-test/`. It is defined in [tests/pathconfig.json](tests/pathconfig.json), so the same tests can run if the XAMPP installation moves or if another device must reach the test app through the computer's LAN address.

For a local machine-specific setup, copy the example file and edit the copy:

```powershell
Copy-Item tests\pathconfig.example.json tests\pathconfig.local.json
```

`tests/pathconfig.local.json` is ignored by Git. Use it for:

- `xamppBaseUrl`: the isolated served test UI, for example `http://localhost/dmx-test/` on the XAMPP computer or `http://192.168.0.50/dmx-test/` from another LAN device
- `picoBaseUrl`: the real Pico API, for example `http://192.168.0.24/`
- `hardwareTests.enabled`: set to `true` only when the Pico is connected and available
- `hardwareTests.dmxTestChannels`: channels the test may write while checking `/dmx/output.json`
- `hardwareTests.chaserSlot` and `hardwareTests.motionSlot`: slots the test may overwrite while checking upload/play/stop behavior

The hardware tests are opt-in because they write real DMX values and overwrite the configured chaser/motion test slots. The playback stress checks use only empty slots for temporary demo data and clear those slots afterward. Run hardware tests explicitly with:

```powershell
npm run test:pico
```

Environment variables can override the config for one terminal session:

```powershell
$env:DMX_TEST_BASE_URL = "http://localhost/dmx-test/"
$env:DMX_PICO_BASE_URL = "http://192.168.0.24/"
$env:DMX_RUN_HARDWARE_TESTS = "true"
npm run test:pico
```

---

## Project Structure

```text
pico_wifi_dmx/
├─ firmware/                 Pico 2 W firmware sources
│  ├─ main.cpp               WiFi, HTTP API routing, shared DMX state
│  ├─ dmx_engine.*           DMX512 output engine and frame buffers
│  ├─ dmx_native.pio         PIO DMX signal generation program
│  ├─ pico_chaser.*          Pico-side chaser slot playback
│  ├─ pico_motion.*          Pico-side motion/effect slot playback
│  ├─ gpio_control.*         GPIO/ADC mapping and trigger handling
│  ├─ midi_input.*           UART MIDI receive parser and diagnostics
│  └─ lwipopts.h             lwIP configuration for the Pico web API
├─ web/                      Browser UI pages served by XAMPP
│  ├─ dmx_fixture_controller.html  Fixture setup and live control page
│  ├─ dmx_show.html                Operator Show Run page
│  ├─ dmx_midi_emulator.html       Browser Launch Control XL MIDI test surface
│  ├─ dmx_chaser.html              Chaser editor and Pico chaser playback
│  ├─ dmx_motion.html              Effects editor and Pico effects playback
│  ├─ dmx_gpio.html                GPIO/ADC mapping page
│  ├─ dmx_monitor.html             DMX output/base-buffer monitor
│  ├─ dmx_benchmark.html           Pico performance test page
│  ├─ dmx_room_plane.html          Room-plane calibration
│  └─ assets/
│     ├─ dmx-common.js       Shared DMX Output routing, toolbox, playback, visual, and fan helpers
│     ├─ dmx-ui.css          Shared dark UI styling
│     └─ fixture-library.json Built-in converted fixture catalog
├─ api/                      PHP JSON persistence endpoints for XAMPP
│  ├─ data/                  Runtime JSON data when using the local dev router
│  ├─ fixture_setup.php      Fixture profiles, patch, and live values
│  ├─ fixture_library.php    Custom fixture-library import/export endpoint
│  ├─ scene_setup.php        Scene storage
│  ├─ palette_setup.php      Shared palette storage
│  ├─ chaser_setup.php       Chases and mirrored Pico chaser slots
│  ├─ motion_setup.php       Effects presets and mirrored Pico effect slots
│  ├─ group_setup.php        Saved fixture groups
│  ├─ gpio_setup.php         GPIO editor setup
│  ├─ pico_discovery.php     UDP beacon listener for Find Picos
│  └─ ui_state.php           Shared toolbox/sidebar layout state
├─ config/                   Local machine path configuration templates
│  └─ local-paths.example.json
├─ docs/                     User manual, generated PDF, screenshots
│  ├─ hardware/
│  │  ├─ SCHEMATIC_DESIGN.md Rev. A Eagle schematic design specification
│  │  └─ datasheets/         WiFiPicoDMX Rev. A component datasheet index
│  ├─ manual-data/           Deterministic JSON baseline for screenshots
│  ├─ references/            Third-party hardware reference manuals
│  │  └─ launch-control-xl-programmer-s-reference-guide.pdf
│  └─ screenshots/           Generated manual/README screenshots
├─ hardware/
│  └─ fusion/                Generated Rev. A schematic, PCB, used library, and net lists
├─ tools/                    Source material used by repository tooling
│  └─ fixture-library/       Open Fixture Library export used by the converter
│     └─ ofl_export_ofl.zip
├─ scripts/                  XAMPP sync, test, documentation, and release automation
│  ├─ sync_fixture_controller_to_xampp.ps1
│  ├─ sync_test_app_to_xampp.ps1
│  ├─ update_xampp_server.ps1
│  ├─ update_user_manual.ps1
│  ├─ build_fixture_library.ps1
│  ├─ sync_fixture_library_from_xampp.ps1
│  ├─ flash_firmware.ps1
│  ├─ generate_fusion_schematic.mjs
│  ├─ generate_fusion_used_library.mjs
│  ├─ generate_fusion_board.mjs
│  ├─ start_version_branch.ps1
│  ├─ prepare_release.ps1
│  ├─ dev-router.php         PHP built-in-server router for local development
│  ├─ capture_readme_screenshots.ps1
│  ├─ capture_chaser_screenshot.ps1
│  └─ build_user_manual_pdf.ps1
├─ tests/                    Automated regression tests
│  ├─ ui/                    Browser workflow tests against the served UI
│  ├─ unit/                  Pure rule/helper tests
│  ├─ fixtures/              Compact deterministic test data
│  ├─ pathconfig.json        Tracked default test environment config
│  └─ pathconfig.example.json Example local/XAMPP/Pico config
├─ release/                  Committed release packages, UF2 files, docs, checksums
│  └─ v<VERSION>/
├─ package.json              Node/Playwright test scripts
├─ package-lock.json         Locked JavaScript test dependencies
├─ playwright.config.js      Playwright browser test configuration
├─ VERSION                   Current application version shown in the UI
├─ CHANGELOG.md              Human-readable release history
├─ CMakeLists.txt            Pico SDK build configuration
├─ pico_sdk_import.cmake     Pico SDK import helper
├─ LICENSE                   Non-commercial license declaration
└─ todos.md                  Open design notes and follow-up ideas
```

`build/`, `node_modules/`, `test-results/`, `api/data/`, and your real `config/local-paths.json` are local runtime/build outputs and are not source. During development, `scripts/sync_fixture_controller_to_xampp.ps1` copies `web/` and `api/` into the XAMPP `dmx` folder, with `web/dmx_fixture_controller.html` served as `index.html`.

---

## Versioning

The project uses `MAJOR.MINOR.PATCH` versions following Semantic Versioning conventions:

- `MAJOR` is reserved for incompatible public API, stored-show, or hardware workflow changes.
- `MINOR` introduces a new backward-compatible feature set.
- `PATCH` contains compatible fixes and smaller improvements.

The `main` branch represents the latest completed release. Development takes place on a branch named for the next version, such as `1.1.0`, with a matching `Unreleased` section in `CHANGELOG.md`. When that version is ready, the changelog receives its release date, `scripts/prepare_release.ps1` creates `release/v<VERSION>/`, and the completed version branch is merged into `main`. A new version branch is then created for subsequent work.

After merging a release into `main`, preview and create the next version branch with:

```powershell
.\scripts\start_version_branch.ps1 -Version 1.0.2 -DryRun
.\scripts\start_version_branch.ps1 -Version 1.0.2 -Commit
```

The script requires a clean `main` tree by default, refuses an existing or non-increasing version, creates the version-named branch, updates the synchronized sources and browser cache URLs, adds the new `Unreleased` changelog section, and optionally commits the result. It deliberately does not push the branch or deploy it to XAMPP. Use `-FromBranch <name>` only when intentionally starting from a branch other than `main`.

All application-facing version sources must agree:

- `VERSION` is the canonical application version copied to XAMPP and included in release packages.
- `CMakeLists.txt` reads `VERSION` and supplies that value as the firmware compile-time and Pico program version.
- `web/assets/dmx-common.js` reports the application version in stored/exported data and the UI.
- Page and manual query strings use the application version for browser cache invalidation.
- `CHANGELOG.md` records user-visible changes under the matching version.

An asset suffix such as `?v=1.1.0-11` is a browser-cache revision within application version `1.1.0`; `-11` is not an additional release number. Incrementing it forces browsers and iPad Home Screen installations to load changed shared CSS or JavaScript.

Application versions are independent from data-format versions. `schemaVersion` and `setupFormatVersion` change only when a stored JSON format requires a migration or compatibility decision.

Stored/exported JSON files include:

```json
{
  "appVersion": "1.1.0",
  "schemaVersion": 1
}
```

`appVersion` tells you which application wrote the file. `schemaVersion` is for future data-format migrations; current imports stay backward compatible with older JSON files that do not contain these fields. The firmware compile-time and Pico program versions are derived automatically from the canonical `VERSION` file by `CMakeLists.txt`.

Fixture Controller **Export Show** downloads one show-name-specific file such as `pico_dmx_summer-gala_show.json`. It wraps the individual show-side JSON stores into one portable file with `type: "pico_wifi_dmx_full_setup"`, stores the show name, and embeds the richer fixture-library entries and modes referenced by patched fixtures. **Import Show** accepts any `.json` filename—including a renamed file such as `xampp setup.json`—and validates the JSON content rather than deriving identity from the filename. Its confirmation uses the stored name, for example **Import xyz_show?** Older unnamed backups are treated as **Untitled Show**. **Export Library** independently downloads `pico_dmx_fixture_library.zip`, containing the complete reusable catalog as `pico_dmx_fixture_library.json`. **Import Library** accepts that ZIP directly and also accepts legacy uncompressed library JSON files.

Complete setup exports also include a `project` block and `setupFormatVersion`. Import runs the setup through a versioned migration guard before writing anything to the server. Older supported setup formats are upgraded step-by-step to the current format; files with a newer setup format than the running software supports are refused with a clear update-software message.

Release notes belong in `CHANGELOG.md` whenever the version changes.

### Release Checklist

Before tagging or publishing a release:

1. Decide the release version, for example `1.0.1`.
2. Update `VERSION` (normally through `scripts/start_version_branch.ps1`); CMake reads this same value for the firmware automatically.
3. Move the matching section in `CHANGELOG.md` from `Unreleased` to the release date.
4. Build and test the firmware/UI:

```powershell
cmake --build build
npm run test:ui
```

5. Optional, when a Pico is connected and safe test channels/slots are configured:

```powershell
npm run test:pico
```

6. Create the release package. This regenerates the manual, PDF, and deterministic screenshots before packaging. On Windows it also builds the Windows x64 customer installer:

```powershell
.\scripts\prepare_release.ps1 -Build
```

`-Build` explicitly configures `CMAKE_BUILD_TYPE=Release` before compiling.
The Windows installer accepts only a matching RP2350 Release UF2 and receives
the exact artifacts from the selected `-BuildDir`, preventing a stale Debug
image from entering a customer package.

For a signed Windows customer release, pass the non-secret certificate-store
thumbprint:

```powershell
.\scripts\prepare_release.ps1 -Build `
  -WindowsSigningCertificateThumbprint YOUR_CERTIFICATE_THUMBPRINT
```

Use `-SkipWindowsInstaller` only when intentionally preparing a firmware-only
package on Windows. Linux and macOS release runs skip Windows installer
creation automatically.

On Ubuntu with XAMPP, pass the local XAMPP and Chrome paths explicitly:

```bash
pwsh -NoProfile -ExecutionPolicy Bypass \
  -File scripts/prepare_release.ps1 \
  -Build \
  -XamppHtdocs /opt/lampp/htdocs/editable \
  -AppFolder dmx \
  -BaseUrl http://localhost/editable/dmx/ \
  -ChromePath /usr/bin/google-chrome
```

Or store those Ubuntu paths once in ignored local config:

```bash
cp config/local-paths.example.json config/local-paths.json
```

Then edit `config/local-paths.json`:

```json
{
  "xamppHtdocs": "/opt/lampp/htdocs/editable",
  "appFolder": "dmx",
  "baseUrl": "http://localhost/editable/dmx/",
  "chromePath": "/usr/bin/google-chrome"
}
```

With that local config in place, the Ubuntu release command is shorter:

```bash
pwsh -NoProfile -ExecutionPolicy Bypass \
  -File scripts/prepare_release.ps1 \
  -Build
```

For a quick local package that reuses the already-generated manual assets, add `-SkipManual`.

To run the real Pico endpoint and slot tests as part of the release package, add `-RunHardwareTests`. The script creates `tests\pathconfig.local.json` from `tests\pathconfig.example.json` if it is missing, then runs the full Playwright suite with hardware tests enabled.

Example Ubuntu hardware-test release command for this local XAMPP layout:

```bash
pwsh -NoProfile -ExecutionPolicy Bypass \
  -File scripts/prepare_release.ps1 \
  -Build \
  -RunHardwareTests \
  -PicoBaseUrl "http://192.168.0.24/" \
  -XamppHtdocs /opt/lampp/htdocs/editable \
  -AppFolder dmx \
  -BaseUrl http://localhost/editable/dmx/ \
  -ChromePath /usr/bin/google-chrome
```

If `config/local-paths.json` already contains the Ubuntu paths, the same hardware-test release command can be shortened to:

```bash
pwsh -NoProfile -ExecutionPolicy Bypass \
  -File scripts/prepare_release.ps1 \
  -Build \
  -RunHardwareTests \
  -PicoBaseUrl "http://192.168.0.24/"
```

Replace `-PicoBaseUrl` with the URL printed by the Pico serial log. Hardware tests write the configured DMX test channels and overwrite the configured chaser/motion test slots.

The script packages the application, regular Wi-Fi firmware, and try-before-you-buy Wi-Fi firmware UF2s as:

```text
release/v<VERSION>/pico_wifi_dmx-v<VERSION>.uf2
release/v<VERSION>/pico_wifi_dmx-wifi-firmware-v<VERSION>.uf2
release/v<VERSION>/pico_wifi_dmx-wifi-firmware-tbyb-v<VERSION>.uf2
release/v<VERSION>/wifi-pico-dmx-<VERSION>-windows-x64.exe  # Windows host
```

It writes a SHA256 checksum for every UF2 and for the Windows installer when
created. `release-manifest.json` records all three firmware artifacts and the
optional Windows installer—including its size, SHA-256, and whether the build
was Authenticode-signed—together with the version, branch, and commit. Windows
installer executables and checksum files remain ignored so large local builds
and signing outputs are not accidentally committed. The remaining `release/`
content can be committed if desired, although public binary distribution is
usually cleaner through a GitHub Release.

The release package also includes `docs/user-manual.md`, the generated manual HTML/PDF files, and `docs/screenshots/`. The manual opens with a linked table of contents and automatically embeds the canonical `CHANGELOG.md` as its final section so customers can navigate operating instructions first and still review new features and fixes offline. If the automatic manual step changes generated files, review and commit those assets before doing the final clean release run, or use `-AllowDirty` only for a local test package. The first Ubuntu run can legitimately refresh screenshot/PDF binaries because Linux Chrome font rendering differs from Windows; after committing those generated assets, the same Ubuntu release command should leave the tree clean.

After the package passes validation, complete these publication steps:

8. Commit the generated release package, merge the completed version branch
   into `main`, and mark the released version as the latest stable release.
9. Update the README **Getting Started** installer and user-manual labels and
   direct URLs so they contain the released version and exact GitHub Release
   asset names.
10. Create and push the annotated `v<VERSION>` tag from the final `main`
    release commit.
11. Create the public GitHub Release and attach the Windows installer, its
    checksum, all three UF2/checksum pairs, `release-manifest.json`, the HTML
    manual, and both PDF user-manual variants. For example:

```powershell
gh release create v<VERSION> `
  --title "WiFiPicoDMX <VERSION>" `
  --generate-notes --latest `
  release/v<VERSION>/wifi-pico-dmx-<VERSION>-windows-x64.exe `
  release/v<VERSION>/wifi-pico-dmx-<VERSION>-windows-x64.exe.sha256 `
  release/v<VERSION>/pico_wifi_dmx-v<VERSION>.uf2 `
  release/v<VERSION>/pico_wifi_dmx-v<VERSION>.uf2.sha256 `
  release/v<VERSION>/pico_wifi_dmx-wifi-firmware-v<VERSION>.uf2 `
  release/v<VERSION>/pico_wifi_dmx-wifi-firmware-v<VERSION>.uf2.sha256 `
  release/v<VERSION>/pico_wifi_dmx-wifi-firmware-tbyb-v<VERSION>.uf2 `
  release/v<VERSION>/pico_wifi_dmx-wifi-firmware-tbyb-v<VERSION>.uf2.sha256 `
  release/v<VERSION>/release-manifest.json `
  release/v<VERSION>/docs/user-manual.html `
  release/v<VERSION>/docs/user-manual.pdf `
  release/v<VERSION>/docs/user-manual-navigation.pdf
```

12. Open the README installer and user-manual links from GitHub and verify that
    the installer plus HTML and both PDF manuals download without requiring
    repository knowledge or authentication.

---

## Architecture

| Core | Responsibility |
|------|----------------|
| **Core 0** | DMX engine (continuous 250 kbaud frames), chaser sequencer tick, motion FX oscillator tick — runs at 100 Hz |
| **Core 1** | WiFi (CYW43), lwIP TCP/IP stack, lwIP httpd (HTTP/1.0 API server) |

Cross-core data access is protected by `critical_section_t` hardware spinlocks. DMX buffer writes from the HTTP handler (Core 1) and from the playback engines (Core 0) are coordinated so neither blocks the other.

The firmware HTTP layer also isolates overlapping network requests. Each POST upload owns its request body until that connection finishes, and every dynamically generated response is copied into connection-owned storage until lwIP closes the file. This prevents simultaneous browser polling, control writes, and slot uploads from overwriting one another's in-flight data.

---

## Playback Modes

### Browser Playback
The Chaser and Effects browser playback engines connect directly to the show's primary Pico HTTP API. On every tick the browser computes the next DMX values and sends only the **changed channels** in one batch request. Two browser tabs can run simultaneously (for example, Chaser on dimmer channels and Effects on pan/tilt) without interfering because each page tracks its own sent state and never overwrites channels it does not own. Browser playback and the Chaser/Effects live editor previews are currently primary-output workflows; use autonomous linked Pico playback when one chase or effect must span several DMX Outputs.

### Pico Autonomous Playback
Chaser and Effects configurations are uploaded via HTTP POST. A single-output playback uses one Pico; a multi-output playback is split into linked member payloads and uploaded to every involved Pico. After upload, each Pico plays its member entirely on Core 0—no continuous browser traffic is needed. This removes WiFi latency jitter from each controller's DMX output, although starting linked members through separate HTTP requests is not a firmware-level synchronized start.

Starting browser Chase Playback stops Chaser and Effects playback on the primary Pico before previewing there. Starting autonomous Pico playback stops the browser preview on that page. Linked member control is coordinated by the autonomous playback actions, not by the primary-output browser-preview handoff.

Chase Playback is the source of truth for chaser playmode. Choose **Single**, **Loop**, **Loop N**, or **Ping Pong**, then choose forward or reverse direction. The **Loops** value is only used for **Loop N**; normal **Loop** means loop forever. Uploading to a Pico chaser slot uses those same Chase Playback mode, loop count, and direction settings, while Pico speed remains slot-specific.

---

## HTTP API

All endpoints return JSON with `Access-Control-Allow-Origin: *`.

### DMX channel control

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dmx/set/<ch>/<val>` | GET | Set a single channel (ch 1-based, val 0–255) |
| `/dmx/b/<ch>:<val>,<ch>:<val>,…` | GET | Batch set with channel:value pairs in the URL path. Data is path-encoded rather than query-string encoded because lwIP httpd strips query strings before calling `fs_open`. |
| `/dmx/b` | POST | Batch set with comma-separated `channel:value` pairs in the request body; this is the form used by current browser playback and multi-channel UI writes. |
| `/dmx/clear` | GET | Zero all channels and clear the scene base buffer |
| `/dmx/output_clear` | GET | Zero live DMX output channels only; preserve the scene base buffer |
| `/dmx/master` | POST | Set output master scale factors as `ch:scale` pairs, where scale is 0–255. This scales the transmitted DMX output without blocking chaser/effect writes. |
| `/dmx/master/clear` | GET | Clear all output master scale factors |
| `/dmx/output.json` | GET | Read the actual live DMX output frame as `{"ok":true,"channels":N,"frame_count":N,"values":[...]}` |
| `/dmx/base.json` or `/dmx/base` | GET | Read the complete scene/base position buffer used as the center for autonomous effects |
| `/dmx/values/<start>/<count>` | GET | Read up to 64 channel values as JSON array |
| `/dmx/values.json` | GET | Read all channel values |

### Pico chaser

Each Pico provides **32 physical chaser slots** that can be loaded and played simultaneously. Each physical slot has its own step list, playmode, direction, loop count, and speed multiplier. When multiple physical slots on one Pico control the same DMX channel, the **bigger-wins** rule applies (highest raw value written). The browser presents 32 logical chaser slots; a linked multi-output chase reserves one physical slot on every involved Pico, and those physical slot numbers may differ between Picos.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chaser/load/<N>` | POST | Upload chaser config to slot N (0–31) |
| `/chaser/play/<N>` | GET | Start slot N from the beginning |
| `/chaser/pause/<N>` | GET | Pause slot N at the current step/fade position |
| `/chaser/resume/<N>` | GET | Resume paused slot N |
| `/chaser/pause_toggle/<N>` | GET | Pause if running, resume if paused, otherwise start slot N |
| `/chaser/clear/<N>` | GET | Clear/unload slot N without clearing global DMX output |
| `/chaser/stop` | GET | Stop all slots |
| `/chaser/stop/<N>` | GET | Stop slot N only |
| `/chaser/speed/<N>/<mult_x100>` | GET | Set speed multiplier for slot N (100 = 1.0×) |
| `/chaser/status` | GET | `{"ok":true,"active_mask":N,"loaded_mask":N,"step":N,"step_count":N,"elapsed_ms":N}` |
| `/chaser/slots` | GET | `{"ok":true,"slots":[{"slot":N,"loaded":bool,"active":bool,"loop":bool,"step_count":N,"speed_mult":F},…]}` |

`active_mask` and `loaded_mask` are bitmasks — bit *i* set means slot *i* is active/loaded.

Chaser text protocol (POST body):
```
LOOP 1
MODE loop
LOOPS 1
DIR forward
SPEED 1.00
STEP <duration_ms> <fade_percent>
CH <channel> <value>
CH <channel> <value>
END
STEP …
END
```

`MODE` supports `single`, `loop`, `loop_n`, and `ping_pong`. `LOOPS` is used by `loop_n`. `DIR` supports `forward` and `reverse`. `SPEED` is the slot speed multiplier and can still be changed live with `/chaser/speed/<N>/<mult_x100>`.

Each chaser slot supports up to **32 steps** in firmware. The Chaser page enforces the same limit so Chase Playback and Pico playback use the same chase shape.

### Pico Effects

Each Pico provides **64 physical effect slots** that can be loaded and played simultaneously. Each physical slot has its own effect type, BPM, target list, and phase offsets. Targets can be pan/tilt pairs or scalar controls such as dimmer, zoom, iris, prism, or gobo. When multiple physical slots on one Pico control the same DMX channel, the **bigger-wins** rule applies (highest raw value written). The browser presents 64 logical effect slots; a linked multi-output effect reserves one physical slot on every involved Pico, and those physical slot numbers may differ between Picos.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/motion/load` | POST | Upload effect config to slot 0 |
| `/motion/load/<N>` | POST | Upload effect config to slot N (0–63) |
| `/motion/start` | GET | Start slot 0 |
| `/motion/start/<N>` | GET | Start slot N |
| `/motion/clear/<N>` | GET | Clear/unload slot N without clearing global DMX output |
| `/motion/stop` | GET | Stop all slots |
| `/motion/stop/<N>` | GET | Stop slot N only |
| `/motion/bpm/<N>/<bpm_x10>` | GET | Set BPM for slot N live (e.g. `/motion/bpm/0/1200` = 120.0 BPM) |
| `/motion/status` | GET | `{"ok":true,"active_mask":N,"loaded_mask":N,"elapsed_s":F}` |
| `/motion/slots` | GET | Array of per-slot info: `{"ok":true,"slots":[{"slot":N,"loaded":bool,"active":bool,"type":N,"bpm":F,"target_count":N},…]}` |

`active_mask` and `loaded_mask` are bitmasks — bit *i* set means slot *i* is active/loaded.

Effects text protocol (POST body):
```
FX 1
TYPE <0=circle|1=figure8|2=panSwing|3=tiltSwing|4=sine|5=pulse>
BPM <float>
AMP1 <0.0–1.0>
AMP2 <0.0–1.0>
SPREAD <degrees>
TARGET <scalar8|scalar16|pantilt8|pantilt16> <enabled> <ch1> <fine1> <ch2> <fine2> <phase_deg> [reverse1] [reverse2]
END
```

The `TARGET` line contains DMX channel positions only. It does not store fixed center values. Instead, the effect center is read from the **scene base buffer** (`dmx_base_frame`) at tick time — see [Scene Base Buffer](#scene-base-buffer) below. Pan/tilt targets use both axes; scalar targets use `ch1`/`fine1` and ignore `ch2`/`fine2`. The optional `reverse1` and `reverse2` flags are `0` or `1`; they invert the motion offset for target axis 1 and target axis 2 while keeping the current base value as the center. Older slot payloads without these flags remain valid.

---

## Web UI

The UI is served from a separate web server (XAMPP in development). Pages talk directly to Pico HTTP APIs with cross-origin `fetch()` requests for reads, POST batches, uploads, and commands. A few non-blocking GET writes use `new Image().src` where no response body is needed.

Server-side Chaser, Effects, and UI-state updates hold an exclusive lock across the complete JSON read-modify-write operation. Multiple open browsers can therefore update different mirrored Pico slots or UI-state keys without a later request silently restoring an older copy of the file.

| Page | File | Description |
|------|------|-------------|
| Fixture Controller | `web/dmx_fixture_controller.html` (served as `index.html`) | Define fixture profiles, patch fixtures, set individual channels, manage groups, save/recall scenes |
| Show Run | `web/dmx_show.html` | Run a show from saved groups, fixtures, scenes, palettes, saved room planes, live fixture-control faders/knobs/buttons, and Pico chaser/effect playback slots without editing setup data |
| MIDI Emulator | `web/dmx_midi_emulator.html` | Emulate Launch Control XL knobs, faders, and buttons in a second browser tab for Show Run MIDI Learn testing without hardware |
| Chaser | `web/dmx_chaser.html` | Build and play step sequences with crossfade; save reusable chases; split multi-output chases into linked Pico payloads; manage 32 logical autonomous-playback slots |
| Effects | `web/dmx_motion.html` | Configure generic oscillators for pan/tilt pairs or scalar controls; split multi-output effects into linked Pico payloads; manage 64 logical autonomous-playback slots |
| GPIO Control | `web/dmx_gpio.html` | Store and push independent physical GPIO/ADC mappings for each configured DMX Output |
| DMX Monitor | `web/dmx_monitor.html` | Tile monitor for all 512 channels with adjustable refresh interval and rate; toggles between the actual live Pico output frame (`/dmx/output.json`) and the base/position buffer (`/dmx/base.json`) |
| Pico Performance Test | `web/dmx_benchmark.html` | Check Pico connectivity, read firmware `/perf/status.json` telemetry, verify DMX/base buffer readback, measure HTTP latency, and run all-slot playback plus palette-recall stress tests |
| Room Plane | `web/dmx_room_plane.html` | Calibrated 2D room-plane mapper for moving-light pan/tilt targeting; saved calibration fixtures automatically bind by ID to the current Controller profile and DMX patch |

For screenshots and complete operating instructions, see the [user manual](docs/user-manual.md) or the [PDF manual](docs/user-manual.pdf).

### Chaser / Effects — Saved Chases, Presets and Pico Slots

The playback pages separate browser editing from the autonomous Pico slot memory:

- **Chaser Chases toolbox** — stores reusable editable chases on the XAMPP server. Recalling a chase loads its steps, selects Step 1, rebuilds Participating Controls and Edit Step, and a newly opened Chaser page starts with no working steps until a chase is recalled or created.
- **Effects Save Preset / Load Preset** — stores and restores the editable Effects page setup on the XAMPP server JSON file.
- **Pico slot click upload** — click an empty Pico slot to send the current editable chase or Effects preset to that slot and mirror the payload on the XAMPP server. Click a loaded slot once to select it for playback controls; click the selected loaded slot again to replace it after confirmation.
- **Play Slot / Start Slot** — starts the already-loaded physical slot, or every physical member of a linked logical slot.
- **Restore Saved Slots to Pico** — re-sends every mirrored payload after reboot or firmware upload. A linked logical slot restores its member payload to every involved Pico.
- **Delete slot** — loaded slots show a small `×` button in the top-right corner. It deletes the mirrored XAMPP payload and clears every physical Pico slot belonging to that logical slot.

On the Chaser page, each uploaded logical slot also stores its playback mode (`Single`, `Loop`, `Loop N`, or `Ping Pong`), loop count, direction, speed, and fade-in percentage. `Stop` resets all linked members, while `Pause`/`Resume` keeps their current step and fade position. The logical capacity remains 32 chaser slots and 64 effect slots even when fewer Picos are involved; each linked member consumes one physical slot on its own Pico.

### Chaser — Participating Controls

The **Participating Controls** panel defines which fixture+control pairs are written by the current chase. It is not saved as a separate preset anymore. Recalling a chase rebuilds the active participating controls from the selected step, while **All**, **None**, **Only**, and **Add** are working tools for creating or editing the current step.

### Chaser — Capture from Fixture Controller

**Capture + Add** and **Capture from FC** read the current live values from the Fixture Controller:

1. Tries `fixture_setup.php?livevalues` (server-side snapshot written by the FC page whenever any control is moved or a scene is recalled).
2. Falls back to `localStorage` key `dmxFCLiveValues` if the server is unavailable.

This means capture works correctly even when the Chaser and FC pages are open in different browser windows or tabs.

### Fixture Controller — Groups

Fixtures can be organised into named **Saved Groups** (stored server-side via `group_setup.php`).

- Create a group and assign any subset of patched fixtures to it.
- A collapsible **Group Bar** appears above the fixture list; clicking a group instantly selects all its fixtures and scrolls to the first one.
- The **Group Edit** modal can recall **Default** or **Blackout** for every selected fixture at once, using each fixture profile's own stored default/blackout values.
- Groups can be edited with **Edit Tile** for name and visual appearance, or deleted from the Saved Groups panel.
- Groups are included in the complete **Export Show** / **Import Show** backup from the Fixture Controller.

### Fixture Controller — Default and Blackout Values

Each control in a fixture profile can store optional **Default** and **Blackout** values. These are configured in the **Default & Blackout** card while adding or editing a control.

- **None** — disables the stored value for that control. Disabled values are skipped during recall.
- **Pan/Tilt** — stores pan and tilt together; 16-bit controls use `0–65535`, 8-bit controls use `0–255`.
- **Slider / wheel controls** — store one numeric DMX value. 16-bit sliders use `0–65535`; 8-bit sliders and wheels use `0–255`.
- **RGB / RGBW / RGBWA** — use a color picker for RGB. RGBW also stores a manual `W` channel; RGBWA stores manual `W` and `Amber` channels.
- **CMY / CMYK** — use the color picker converted to CMY/CMYK. CMYK also stores a manual `K` channel.

On each patched fixture card, **Default** and **Blackout** buttons are shown when at least one control in that fixture's profile has the corresponding value enabled. Clicking one recalls all enabled values for that fixture, updates the on-screen controls, writes the live-value snapshot used by Chaser capture, and sends the resulting DMX values to that fixture's assigned DMX Output.

OFL-imported profiles can also contain explicit highlight values supplied by the fixture definition. When present, the fixture card shows **Highlight**. Clicking it stops Pico Chaser and Motion playback, remembers the current values, applies only the controls with declared highlight values, and changes the same button to **Restore**. The temporary highlight is not autosaved. Click **Restore** to send the remembered values back and resume normal editing; the restored values are then written to the live-value snapshot.

### Fixture Controller — Scene Toolbox

The **Scene Toolbox** sits in the shared right-side Toolboxes sidebar.

- The toolbox shows a configurable grid of slots (rows × columns adjustable with spinners).
- **Save scene** — snapshots every channel value for every patched fixture into a named slot.
- **Recall scene** — clears the active group/fixture selection, restores all stored controller values, updates the Chaser live-value snapshot, and sends one batch request to each involved fixture output.
- **Delete scene** — each filled slot has a small `×` button (top-right corner); click it to permanently remove that scene after confirmation.
- **Clear all channels** — the red `×` icon asks for confirmation, zeros every controller value, updates the live-value snapshot, and calls `/dmx/clear` on every configured output.
- Slots are stored server-side in `data/scene_setup.json` via `scene_setup.php`; they survive page reloads and browser changes.
- Sidebar width and toolbox order are shared across toolbox pages via `data/ui_state.json`; collapsed state is also persisted.
- Whenever a control is moved or a scene is recalled, the current live values of all controls are written to `data/fixture_live_values.json` via `fixture_setup.php?livevalues`. This keeps the Chaser page's "Capture from FC" up to date even if the Chaser page was opened before the FC page.

### Effects — Scene Center Toolbox

The Effects page has a read-only companion to the Scene Toolbox.

- Loads the same scenes from `scene_setup.php`; renders them as a clickable slot grid.
- Clicking a filled slot reads the pan/tilt channel values stored in that scene and stores them as `basePan`/`baseTilt` in the browser's effect fixture state. The current Effects editor sends that center preview to the primary show output and updates that Pico's `dmx_base_frame`.
- The effect then oscillates **relative to that position** rather than around any fixed stored center. Moving lights to a new position (via a scene) and starting an effect will always orbit where they are now.
- The toolbox lives in the shared sidebar. Enable **Edit** in the Toolboxes header before dragging its colored header to reorder it, then click **Done**; use the sidebar resize line to adjust the shared toolbox width.
- The scene toolbox on the Effects page is **read-only** — it does not save or delete scenes. Scene management (save, delete) is only available on the Fixture Controller.
- The **↺ Reload from Fixture Controller** button re-fetches `fixture_setup.php` (fixture definitions, not live values) to refresh the fixture list in case fixtures were added or changed.

### Effects — Fixture Card Grid

Fixture cards in the Effects page are displayed in a responsive CSS auto-fill grid (minimum card width 220 px) rather than a single vertical list. The fixture panel is capped at 70 vh with internal scrolling — the panel heading and action buttons remain visible outside the scroll area.

---

### Scene Base Buffer

The firmware maintains a dedicated `dmx_base_frame[513]` buffer (indices 1–512 map to DMX channels) that tracks the *position layer* — the last non-FX DMX value for every channel. Effects read their center from this buffer at tick time rather than from a fixed number stored in the slot config.

**What writes to `dmx_base_frame`:**

| Source | Updates base buffer? |
|--------|----------------------|
| `/dmx/set/<ch>/<val>` GET | ✅ yes |
| `/dmx/b/<ch>:<val>,…` GET or POST batch | ✅ yes |
| Chaser tick output (Core 0) | ✅ yes |
| Effects tick output (Core 0) | ❌ no — intentional; prevents drift |

Because motion FX never writes back to the base buffer, the oscillation center stays fixed at whatever position was set last. There is no accumulation error even after hours of continuous playback.

**Practical workflow:**
1. Position the fixture using the Fixture Controller, or recall a scene.
2. On the Effects page, click that same scene in the Scene Toolbox—this updates the Effects center values and previews them on the primary show output, updating that Pico's `dmx_base_frame`.
3. Start motion (browser `▶ Start` or Pico `/motion/start`) — the effect orbits the position set in step 1/2.

When browser motion starts, the page fetches `/dmx/base.json` from the primary show output and seeds the browser-side base from that Pico's scene/base buffer.

### GPIO Control (`web/dmx_gpio.html`)

GPIO Control maps physical Pico GPIO and ADC inputs to common playback and DMX actions. Because the pins belong to individual controllers, the page stores an independent configuration for every configured DMX Output.

- The page loads and autosaves mappings on the XAMPP server through `gpio_setup.php` / `data/gpio_setup.json`, with browser `localStorage` only as a fallback. The active mapping set is pushed to the Pico with `POST /gpio/config`.
- GPIO mappings are included in the complete **Export Show** / **Import Show** backup from the Fixture Controller, including the selected output and every output's enabled state, digital mappings, and ADC mappings.
- Each GPIO pin can only be used by one mapping. The page highlights duplicate pin use, and the firmware rejects duplicate digital/ADC mappings as a final safety check.
- Digital GPIO mapping pins are selected from a dropdown that excludes the configured hardware-reserved pins (`DMX_TX_PIN=2`, `DMX_TRIGGER_PIN=3`, `MIDI_RX_PIN=5` by default) and disables pins already used by another mapping.
- The Pico polls GPIO inputs on Core 0 with debounce and executes actions without needing the browser to stay open.
- Chaser GPIO actions use the playmode stored in the selected Pico chaser slot. The GPIO page reads `/chaser/slots` and shows the slot's Single/Loop/Loop N/Ping Pong mode, direction, loop state, and step count beside chaser mappings.
- The DMX TX pin, frame-trigger pin, and enabled MIDI RX pin are reserved automatically and cannot be mapped.
- Supported pulls: `pullup`, `pulldown`.
- Supported triggers: `falling`, `rising`, `both`.
- Supported digital actions: `dmx_clear`, `dmx_output_clear`, `stop_all`, `chaser_play`, `chaser_stop`, `chaser_toggle`, `chaser_pause`, `chaser_resume`, `chaser_pause_toggle`, `chaser_tap`, `motion_start`, `motion_stop`, `motion_toggle`, `motion_tap`.
- ADC mappings are separate from digital button mappings and are limited to GPIO26, GPIO27, and GPIO28 on Pico 2 W. ADC actions include `chaser_speed`, which maps the ADC value to a chaser speed multiplier range, and `motion_bpm`, which maps the ADC value to an Effects BPM range.

GPIO config is a line-based text protocol:

```text
ENABLE 1
MAP 14 pullup falling dmx_clear 0 30
MAP 15 pullup falling chaser_toggle 0 30
MAP 16 pullup falling motion_tap 0 30 1
MAP 17 pullup falling chaser_tap 0 30 2
ADC 26 chaser_speed 0 10 300
ADC 27 motion_bpm 0 1000 12000
```

Format: `MAP <pin> <pull> <trigger> <action> <slot> <debounce_ms> [beat_div]`.
ADC format: `ADC <pin> <action> <slot> <min_x100> <max_x100>`.
The web editor shows `chaser_speed` ranges as normal speed multipliers, e.g. `0.10` to `6.00`, and `motion_bpm` ranges as BPM, e.g. `10.0` to `120.0`. The generated firmware line stores both as value ×100.
ADC readback and speed/BPM updates use a 10 ms mean filter to reduce ripple from pots and long wires.

Tap actions use the interval between two valid button presses. `motion_tap` writes Effects BPM directly. `chaser_tap` converts the tapped interval into a chaser speed multiplier using the selected slot's current step duration. Optional `beat_div` supports `1`, `2`, `4`, `8`, and `16`, where `2` means a half-beat target, `4` a quarter-beat target, and so on.

Use `dmx_clear` when the button should clear both output and the effect base buffer. Use `dmx_output_clear` when it should black out live output but keep the base buffer intact, so Effects can resume around the same stored center.

Firmware endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/gpio/config` | GET | Return current volatile GPIO config as JSON |
| `/gpio/config` | POST | Replace current GPIO config using the line-based protocol |
| `/gpio/status` | GET | Return input states, ADC raw values/mapped speed, event count, and last fired action |

GPIO mappings do not persist on the Pico after reboot. They remain stored in the server-side show setup, and the configuration for each output can be pushed to its Pico again after flashing or restarting. Use **Export Show** before large changes to keep an additional portable backup.

### MIDI Control

The Show Run **MIDI Controller** card uses the browser Web MIDI API for a USB controller connected to the XAMPP computer. MIDI Learn mappings currently support group selection, scene and palette recall, selectable Pico chaser/effect playback actions, Grand and Group Masters, and Live Controls. Playback actions are start/stop toggle, start, stop, pause/resume toggle, pause, and resume. Continuous messages are coalesced before the existing Show output path is called, and soft takeover waits for a hardware fader or knob to reach the current Show value. The Web MIDI connection is browser-local, while the mappings, including each playback action, are stored in server-side Show Run UI state and are included in setup export/import.

The Show page must run in a Web MIDI-capable browser such as Chrome or Edge in a secure context. `http://localhost/dmx/` works when the controller and browser are on the XAMPP computer. Hardware MIDI access is requested only after **Connect MIDI** is clicked; the emulator needs no Web MIDI permission.

For browser-only testing, open `dmx_midi_emulator.html` from the MIDI Controller card. Show Run and the emulator must use the same address—for example, both under `http://localhost/dmx/`, rather than one using `localhost` and the other using a LAN IP. The emulator sends the same CC and Note On/Off data into Show Run's mapping engine, but it does not register as a Windows MIDI device.

### Pico UART MIDI Input Prototype

The Pico firmware can receive classic DIN/TRS MIDI through a UART input. The default hardware mapping is GPIO5 on UART1 RX at the standard MIDI rate of 31,250 baud. This input is reserved from the GPIO mapper when MIDI is enabled.

The Pico UART implementation remains deliberately a diagnostics layer: it receives bytes, handles channel voice messages and running status, counts realtime bytes, and exposes the last parsed message. It is separate from the computer USB MIDI mapping path and does not trigger show actions yet.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/midi/status.json` | GET | Return MIDI enable/init state, UART/pin settings, byte/message counters, parse errors, and the last parsed message |

The MIDI status object is also included inside `/status.json` beside the DMX status. Use this endpoint first after wiring the receiver circuit: moving a fader or pressing a button on the MIDI controller should increase `byte_count` and usually `message_count`, with `last_channel`, `last_data1`, and `last_data2` showing the decoded control data.

### Server-side Persistence

All persistent data is stored as JSON files in the PHP web server's `data/` folder. No database is required. The sync script migrates existing root-level JSON files into `data/` and writes a `.htaccess` file that denies direct browser access to the folder.

| PHP handler | JSON file | Contents |
|-------------|-----------|----------|
| `fixture_setup.php` | `data/fixture_setup.json` | Show name, DMX Outputs/universes/device identities, fixture profiles, patched fixtures, and Pixel Matrices |
| `fixture_setup.php?livevalues` | `data/fixture_live_values.json` | Snapshot of every control's current live value; written by the Fixture Controller whenever a control is moved or a scene is recalled; read by the Chaser page to capture FC state into steps |
| `scene_setup.php` | `data/scene_setup.json` | Named scene snapshots, slot grid dimensions |
| `palette_setup.php` | `data/palette_setup.json` | Reusable palette overlays and slot grid dimensions |
| `group_setup.php` | `data/group_setup.json` | Fixture group definitions |
| `chaser_setup.php` | `data/chaser_setup.json` | Saved chases, Chaser toolbox grid config, mirrored Pico slot payloads |
| `motion_setup.php` | `data/motion_setup.json` | Effects browser setup, saved effect recipes, and saved Pico slot payloads |
| `gpio_setup.php` | `data/gpio_setup.json` | Selected DMX Output and independent GPIO/ADC mapping configuration for every output |
| `room_plane_setup.php` | `data/room_plane_setup.json` | Room Plane A/B/C points, target/view state, saved planes, fixture mount positions, and fixture calibration |
| `fixture_library.php` | `data/fixture_library.json` | Single active fixture library catalog, initialized and refreshed from the bundled OFL catalog |
| `ui_state.php` | `data/ui_state.json` | UI state such as section collapse flags, toolbox order, shared sidebar width, toolbox collapse state, and Show Run card/tile/live-control/MIDI mapping configuration |

All handlers accept `GET` (read) and `POST` (write). `ui_state.php` merges partial state — posting `{page, state}` only touches the keys provided and leaves the rest intact.

The controller's **Export Show** action reads these same endpoints and writes a show-name-specific JSON file, embedding only the catalog entries and modes the show uses. Importing it restores the stored show name and posts each show subsystem back to its existing endpoint, so the pages continue to use the normal autosave files after restore. **Export Library** downloads the complete catalog as `pico_dmx_fixture_library.zip` with `pico_dmx_fixture_library.json` inside; **Import Library** accepts the ZIP and legacy uncompressed JSON catalogs.

The Controller uses one runtime fixture catalog: `data/fixture_library.json`. On first use, the server initializes that active catalog from `assets/fixture-library.json`. The bundled asset is therefore an installation seed and OFL update source, not a competing library that can be hidden by a custom snapshot. Use **Update from OFL** in the Fixture Library panel to refresh the active catalog. The server creates a timestamped backup under `data/backups/` before changing it, takes current fixture facts and new fixtures from the bundled OFL catalog, and preserves user-added inline wheel/gobo images, modes explicitly saved from a show, and fixtures explicitly created in the Controller. Old unmarked `custom/...` fixtures are not retained by the refresh.

OFL color data is retained as display-ready hex previews. Split-color wheel slots keep their complete `colors` list while the first entry remains available through the legacy `color` field. LEE and Rosco numbers found in OFL capability text are also stored as structured filter references; their hex values remain OFL/manufacturer approximations for the fixture rather than calibrated spectral conversions. RGB fixtures with additional UV, lime, indigo, cyan, magenta, yellow, warm-white, or cold-white channels expose every emitter in one advanced color control, while the normal RGB color picker continues to set the red, green, and blue emitters and leaves the additional emitter sliders independently adjustable.

When **Use show in library** saves a mode, the Controller marks that mode as user-modified so later OFL refreshes keep the complete user version. Newly created Controller fixtures are similarly marked as user fixtures. An imported complete library becomes the active catalog; it does not create a second runtime layer.

To rebuild the complete catalog from the bundled Open Fixture Library export while retaining user-drawn or uploaded wheel images from an existing catalog, pass that catalog explicitly as the preservation source:

```powershell
.\scripts\build_fixture_library.ps1 `
  -PreserveWheelImagesFromPath E:\Software\xampp\htdocs\dmx\data\fixture_library.json
```

The converter keeps current OFL fixture information authoritative and overlays only valid inline `data:image/...` wheel images. Images are matched by fixture key, mode, wheel control, and DMX option identity; unrelated user edits are not copied. The preservation source is read-only, and the generated result is written to `web/assets/fixture-library.json` unless `-OutputPath` selects another destination.

For a timestamped command-line backup, use the read-only backup script:

```powershell
.\scripts\backup_show.ps1 -BaseUrl http://<xampp-host>/dmx/ -AllowProtectedEnvironment
```

The script performs HTTP `GET` requests only; it never posts data or directly accesses the XAMPP `data` directory. It creates a folder below `show-backups/` containing the importable show file, the complete fixture-library file, diagnostic endpoint-response snapshots, a short restore README, and a SHA-256 manifest. The default URL is the isolated `/dmx-test/` environment. The explicit `-AllowProtectedEnvironment` switch is required for `/dmx/` so an agent cannot accidentally read the user's working show when testing the script.

### Development sync

HTML files are developed locally and synced to XAMPP with:

```powershell
.\scripts\sync_fixture_controller_to_xampp.ps1
```

Use `.\scripts\update_xampp_server.ps1` when you also want a quick HTTP verification after the sync. The scripts use the configured XAMPP target `<xampp-htdocs>\dmx\`. Create `config/local-paths.json` from `config/local-paths.example.json`, or pass `-XamppHtdocs`, `-AppFolder`, and `-BaseUrl` directly to the script.

---

## Detailed Source Reference

The root `CMakeLists.txt` is the Pico build entry point and references sources under `firmware/`.

| File | Description |
|------|-------------|
| `firmware/main.cpp` | Core 0/1 entry points, HTTP endpoint handlers, custom lwIP fs callbacks, DMX UI lock, POST callbacks for chaser/motion upload |
| `firmware/dmx_engine.cpp` / `.h` | Continuous DMX512 PIO output engine, channel buffer, start-code encoding, DMA scheduling, thread-safe set/get. Also owns `dmx_base_frame` — the scene base buffer (see below) |
| `firmware/dmx_native.pio` | PIO program for 250 kbaud DMX framing: Break, Mark After Break, slot timing, and bit serialization |
| `firmware/pico_chaser.cpp` / `.h` | Pico-side step sequencer with linear crossfade, 100 Hz tick, hardware spinlock |
| `firmware/pico_motion.cpp` / `.h` | Pico-side generic FX oscillator — **64 physical slots per Pico**, pan/tilt and scalar targets, simultaneous playback with bigger-wins channel merge, target-aware axis writes, 100 Hz tick, hardware spinlock |
| `firmware/gpio_control.cpp` / `.h` | Pico-side GPIO input mapper for debounced physical triggers and playback/DMX actions |
| `firmware/lwipopts.h` | lwIP configuration — enables `LWIP_HTTPD_SUPPORT_POST`, custom file serving, and per-file extension storage for owned responses |
| `firmware/fsdata_custom.c` | lwIP custom filesystem stub (all responses are built dynamically) |
| `pico_sdk_import.cmake` | Pico SDK CMake integration |
| `CMakeLists.txt` | Build target, source files, SDK libraries |
| `api/fixture_setup.php` | REST handler — save/load fixture setup (`data/fixture_setup.json`); `?livevalues` endpoint snapshots/restores the current live control values (`data/fixture_live_values.json`) |
| `api/scene_setup.php` | REST handler — save/load scenes and slot grid config (`data/scene_setup.json`) |
| `api/palette_setup.php` | REST handler — save/load reusable palette overlays (`data/palette_setup.json`) |
| `api/group_setup.php` | REST handler — save/load fixture groups (`data/group_setup.json`) |
| `api/chaser_setup.php` | REST handler — save/load saved Chases toolbox entries and mirrored Pico slot payloads (`data/chaser_setup.json`) |
| `api/motion_setup.php` | REST handler — save/load Effects setup, saved effect recipes, and mirrored Pico slot payloads (`data/motion_setup.json`) |
| `api/json_store.php` | Locked JSON read-modify-write helper used when multiple browser requests can update one setup file |
| `api/room_plane_setup.php` | REST handler — save/load Room Plane calibration setup (`data/room_plane_setup.json`) |
| `api/ui_state.php` | REST handler — per-page UI state persistence (`data/ui_state.json`); merges partial state on POST |
| `scripts/sync_fixture_controller_to_xampp.ps1` | PowerShell script — copies all HTML pages and PHP handlers to the local XAMPP htdocs folder |
| `scripts/update_xampp_server.ps1` | PowerShell script — runs the XAMPP sync and verifies the deployed pages respond |

---

## Requirements

- Raspberry Pi Pico 2 W (`PICO_BOARD=pico2_w`, RP2350)
- Pico SDK 2.3.0
- CMake 3.13+, Ninja, ARM embedded GCC toolchain

---

## Configure

```powershell
cmake -S . -B build -G Ninja `
  -DWIFI_SSID="your_ssid" `
  -DWIFI_PASSWORD="your_password"
```

Optional overrides:

```powershell
# DMX output pin (default 2) and frame-trigger debug pin (default 3)
-DDMX_TX_PIN=2 -DDMX_TRIGGER_PIN=3

# DIN/TRS MIDI input over UART (enabled by default)
-DMIDI_ENABLED=1 -DMIDI_RX_PIN=5 -DMIDI_UART_ID=1 -DMIDI_BAUD=31250

# Universe size — limits channels in firmware and UI (default 512)
-DDMX_CHANNELS=46
```

The default DMX data output is Pico `GPIO2`. Connect that pin to the `DI` or transmit input of an RS-485/DMX driver module. Then connect the driver's differential output to the DMX connector: `D+` to XLR pin 3, `D-` to XLR pin 2, and ground/shield to XLR pin 1. The optional `DMX_TRIGGER_PIN` on GPIO3 is a debug/frame trigger signal only. The default MIDI input is Pico `GPIO5` on UART1 RX; connect it only through a MIDI input receiver circuit and verify incoming messages with `/midi/status.json`.

---

## Build

```powershell
& "$env:USERPROFILE/.pico-sdk/ninja/v1.12.1/ninja.exe" -C build
```

Outputs:

```text
build/pico_wifi_dmx.uf2
build/pico_wifi_dmx_wifi_firmware.uf2
build/pico_wifi_dmx_wifi_firmware_tbyb.uf2
```

---

## Flash

For a new device or the first upgrade from firmware 0.9.10 or older, put the Pico 2 W into BOOTSEL mode and run the validated two-stage flashing script:

```powershell
.\scripts\flash_firmware.ps1
```

The script verifies the RP2350 partition table and CYW43 UF2 family before writing anything. It then loads the application, returns the Pico to BOOTSEL mode, loads the Wi-Fi partition, verifies both writes, and starts the application. To select release-package files instead of `build/` outputs, pass `-ApplicationUf2` and `-WifiFirmwareUf2`.

For subsequent application-only updates, leave the Wi-Fi partition intact:

```powershell
.\scripts\flash_firmware.ps1 -ApplicationOnly
```

The equivalent initial provisioning commands are:

```powershell
$Picotool = "$env:USERPROFILE/.pico-sdk/picotool/2.3.0/picotool/picotool.exe"
& $Picotool load build/pico_wifi_dmx.uf2
& $Picotool reboot -u
& $Picotool load -u -v -x build/pico_wifi_dmx_wifi_firmware.uf2
```

Using OpenOCD + Picoprobe/CMSIS-DAP for subsequent application updates after the Wi-Fi partition has been provisioned:

```powershell
& "$env:USERPROFILE/.pico-sdk/openocd/0.12.0+dev/openocd.exe" `
  -s "$env:USERPROFILE/.pico-sdk/openocd/0.12.0+dev/scripts" `
  -f interface/cmsis-dap.cfg -f target/rp2350.cfg `
  -c "adapter speed 5000; program build/pico_wifi_dmx.elf verify reset exit"
```

---

## Resource Usage

| Resource | Value |
|----------|-------|
| Free RAM (stable, measured at runtime) | **385 024 bytes** (~195 KB) |
| Total SRAM (RP2350) | 520 KB |

## Notes

- The `/dmx/b/` batch endpoint encodes channel data in the **URL path** rather than a query string. lwIP httpd nulls the `?` in the URI before calling `fs_open_custom`, making query-string-based batch endpoints unreliable.
- `dmx_engine_set_channel()` is called from both cores. Reads/writes to the DMX buffer are 8-bit aligned and the PIO reads the buffer independently, so no additional lock is needed for channel writes. The `dmx_ui_lock` critical section protects the secondary UI mirror array only.
- Both `chaser_lock` and `mfx_lock` are module-local spinlocks. DMX writes are performed **outside** these locks (after releasing them) to avoid nested-lock deadlock.
- The motion FX tick uses static scratch buffers for 8-bit and 16-bit values. Each active slot computes its values into the scratch with a *bigger-wins* merge (max raw value per channel). The final merged result is written to the DMX engine in one pass after all slots are evaluated — this ensures simultaneous slots never interfere with each other.
- `panSwing` slots only write pan channels; `tiltSwing` slots only write tilt channels. Mixed-mode pan/tilt slots (circle, figure-8) write both. Scalar slots write only their selected scalar control. This prevents one effect from zeroing unrelated channels.
