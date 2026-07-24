# Windows customer installer

This package installs only the components required by Pico DMX Controller:

- Apache HTTP Server as the `PicoDmxController` Windows service
- x64 Thread Safe PHP for the PHP setup endpoints
- the browser application and user manual
- a self-contained native WebView2 operator window

It does not install MariaDB, phpMyAdmin, the XAMPP control panel, or development
tools. Program files are installed below `C:\Program Files\Pico DMX Controller`.
Mutable shows and fixture data are stored separately below
`C:\ProgramData\Pico DMX Controller\data` and are preserved by uninstall and
upgrade.

The desktop and Start Menu shortcuts open `PicoDmxShell.exe`. It supplies
normal window controls, F11 fullscreen, Escape restore, a fullscreen exit/close
bar, and a tray menu. The supported Windows DWM dark-frame attribute and custom
WinForms color table keep the title bar, menu/dropdowns, status bar, tray menu,
and fullscreen controls aligned with the web application's dark theme. Closing
the shell does not stop the Windows service, so LAN operator devices remain
connected. If the installed Microsoft Edge WebView2 Runtime cannot initialize,
the shell opens the controller in the default browser and explains the
fallback.

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
`C:\ProgramData\Pico DMX Controller\backups` before replacing program files.

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
