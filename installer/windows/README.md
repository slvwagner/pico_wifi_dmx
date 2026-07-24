# Windows customer installer

This package installs only the components required by Pico DMX Controller:

- Apache HTTP Server as the `PicoDmxController` Windows service
- x64 Thread Safe PHP for the PHP setup endpoints
- the browser application and user manual

It does not install MariaDB, phpMyAdmin, the XAMPP control panel, or development
tools. Program files are installed below `C:\Program Files\Pico DMX Controller`.
Mutable shows and fixture data are stored separately below
`C:\ProgramData\Pico DMX Controller\data` and are preserved by uninstall and
upgrade.

## Build

The pinned dependency helper downloads Apache, official x64 Thread Safe PHP,
and the Microsoft Visual C++ x64 Redistributable, then refuses to continue if
any SHA-256 hash differs from `dependencies.json`:

```powershell
.\installer\windows\get_dependencies.ps1
```

Install NSIS separately, then build with the verified files:

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
Private-profile Windows Firewall rule for TCP port 8090. If it is not selected,
the service listens only on `127.0.0.1`.
