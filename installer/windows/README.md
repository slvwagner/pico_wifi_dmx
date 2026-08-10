# Windows customer installer

This package installs only the components required by WiFiPicoDMX:

- Apache HTTP Server as the `PicoDmxController` Windows service
- x64 Thread Safe PHP for the PHP setup endpoints
- the browser application and user manual
- a self-contained native WebView2 operator window
- version-matched Pico 2 W application and Wi-Fi firmware
- Raspberry Pi `picotool` for guided USB BOOTSEL flashing

It does not install MariaDB, phpMyAdmin, the XAMPP control panel, or development
tools. A new installation places program files below
`%ProgramFiles%\WiFiPicoDMX`; an upgrade can retain the former program
directory so the existing registered installation remains serviceable.
Mutable shows and fixture data are stored separately below
`%ProgramData%\Pico DMX Controller\data` and are preserved by uninstall and
upgrade.

The packaged PHP runtime is sized for the complete converted OFL catalog:
`memory_limit` is 512 MB, request processing is allowed 120 seconds, and fixture
library uploads may be up to 128 MB. These limits are required because PHP's
decoded arrays occupy substantially more memory than the catalog's JSON file;
reducing them can make **Update from OFL** return a non-JSON fatal-error page.

The desktop and Start Menu shortcuts open `WiFiPicoDMX.exe`. It supplies
normal window controls, F11 fullscreen, Escape restore, a fullscreen exit/close
bar, and a tray menu. The supported Windows DWM dark-frame attribute and custom
WinForms color table keep the title bar, menu/dropdowns, status bar, tray menu,
and fullscreen controls aligned with the web application's dark theme. Closing
the shell offers **Exit only**, **Exit and stop server**, and **Cancel**. Exit
only closes the local operator window while leaving the service available to
iPads and other PCs. Exit and stop server explains that operator devices will
be disconnected, requests Windows administrator approval to stop only the
`PicoDmxController` service, and exits after Windows reports that service
stopped. A non-dismissible progress window with an animated bar remains visible
while shutdown is pending, states that Windows can take up to 45 seconds, and
closes only after the shell's final service-state check. Cancelling the dialog
or UAC keeps the application open. If the shortcut is opened while the service is stopped, the shell explains why
administrator approval is needed, starts `PicoDmxController`, waits for it to
run, and then loads the controller. An already-running service does not cause a
UAC prompt. If the
installed Microsoft Edge WebView2 Runtime cannot initialize, the shell opens
the controller in the default browser and explains the fallback.

Setup asks whether the customer wants to open the guided firmware installer
after software installation; no Pico is modified by setup itself. The same
guide remains available from **Application > Firmware update…** and from the
Start Menu. It validates the bundled UF2 checksums and RP2350 metadata, asks
the customer to disconnect other Picos, explains the BOOTSEL connection steps,
checks that a Pico 2 W is accessible, and asks for final confirmation before
writing anything. Full provisioning writes the application/partition table,
reboots back into BOOTSEL, optionally writes a temporary locally generated
Wi-Fi configuration UF2, writes the separate CYW43 Wi-Fi firmware partition,
and verifies each `picotool` load. Credentials are passed to the helper only
through its child-process environment, are never logged or bundled, and the
temporary UF2 is deleted immediately. The configuration partition is required
once for new devices and upgrades from compile-time credentials; it can be
preserved during later firmware updates or replaced when the network changes.
The application does not read legacy `SSID` or `SSID_PW` environment variables.
Its `PICO_DMX_WIFI_*` variables are a private, short-lived interface between the
updater window and its child helper, not a customer configuration mechanism.
The window cannot be closed while a flash is running and explains how to
recover by repeating the BOOTSEL procedure.

At startup, the native shell clears only WebView2's disk cache before
navigating to the controller. The packaged Apache configuration also marks
HTML, CSS, and JavaScript for revalidation. An upgrade therefore cannot keep
rendering an outdated cached layout, while show data, WebView2 local storage,
and cookies remain intact.

## Build

The pinned dependency helper downloads Apache, official x64 Thread Safe PHP,
and the Microsoft Visual C++ x64 Redistributable, then refuses to continue if
any SHA-256 hash differs from `dependencies.json`:

```powershell
.\installer\windows\get_dependencies.ps1
```

Install the .NET 8 SDK and NSIS separately, then build with the verified files.
The locked Microsoft WebView2 package is restored during the build:

```powershell
.\installer\windows\build_installer.ps1
```

The build reports the elapsed time for input validation, build-directory cleanup,
.NET restore and publish, Apache/PHP extraction, staging, NSIS compilation, installer
finalization, and the complete run. Use these measurements to distinguish packaging
and compression bottlenecks from application compilation or file staging.

The Windows build also requires current `build\pico_wifi_dmx.uf2` and
`build\pico_wifi_dmx_wifi_firmware.uf2` artifacts plus Raspberry Pi
`picotool` 2.3.0. The build refuses a stale application version, an unexpected
target chip/partition table, an unverified Wi-Fi image, or missing tooling.
Override their locations with `-ApplicationUf2`, `-WifiFirmwareUf2`, and
`-PicotoolPath` when building outside the standard Pico SDK environment.

Use `-PrepareOnly` to create and inspect the staging tree without compiling the
installer. The resulting installer is written to `release\v<VERSION>\`.
Before a customer release, sign it with an organization-owned code-signing
certificate:

```powershell
.\installer\windows\build_installer.ps1 `
  -SigningCertificateThumbprint YOUR_CERTIFICATE_THUMBPRINT
```

Unsigned builds are suitable for development but can trigger Windows
SmartScreen warnings. Upgrades make a data snapshot below
`%ProgramData%\Pico DMX Controller\backups` before replacing program files.

Never place the signing certificate or private key in the repository. Import
the certificate into the Windows certificate store or a protected CI signing
service and pass only its non-secret thumbprint to the build script. Common
certificate/key formats and `installer/windows/signing/` are blocked by
`.gitignore`; certificate passwords must not be passed as command-line
arguments or stored in project configuration.

The optional installer component **Allow access from iPads and PCs on the
private network** binds the service to all interfaces and creates a
Private-profile Windows Firewall rule for the HTTP port selected during setup.
The port defaults to `8090`, must be from `1024` to `65535`, and is checked for
conflicts before installation. Upgrades preload the currently installed port.
If LAN access is not selected, the service listens only on `127.0.0.1`.

When the selected port belongs to an existing `PicoDmxController` service,
setup identifies it as the installed product and asks permission to close the
operator window and stop the service before continuing on the same port. For an
unrelated desktop process, setup displays its process name and PID and asks
before closing it. Setup never silently terminates a port owner and refuses to
stop an unrelated Windows service; in that case the customer must stop the
service manually or choose another port.
