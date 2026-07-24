# macOS customer installer

The macOS package provides the same customer-facing behavior as the Windows
installer while following native macOS conventions:

- **Pico DMX Controller.app** is installed in `/Applications`;
- a native dark Cocoa/WKWebView window provides normal close, resize, fullscreen,
  reload, and settings controls;
- first-run **Controller Settings** selects an available HTTP port from
  `1024–65535` (default `8090`) and local-only or trusted-LAN access;
- a per-user LaunchAgent keeps the bundled PHP server running after the app
  window closes and starts it again at login;
- shows and fixture data live outside the app at
  `~/Library/Application Support/Pico DMX Controller/data`;
- the first launch of a newer version snapshots existing data under the
  neighboring `backups` directory; and
- deleting the app does not delete customer shows.

This design does not require Homebrew or a system PHP installation on the
customer's Mac. The `.pkg` bundles a purpose-built PHP CLI runtime and its
license. Pico discovery and LAN control use the same application APIs as the
Windows and Ubuntu packages.

## Requirements

Build on macOS 12 or newer with current Xcode command-line tools. Packages are
architecture-specific: build once on Apple Silicon (`arm64`) and, if Intel Macs
must be supported, once on an Intel (`x86_64`) runner.

Build the pinned PHP 8.5.8 runtime:

```bash
./installer/macos/build_php_runtime.sh
```

The helper downloads the pinned static-php-cli 2.8.5 tool for the host
architecture, verifies its published SHA-256, builds PHP, verifies the PHP
version, and retains the PHP License beside the runtime.

Then build an unsigned development package:

```bash
./installer/macos/build_package.sh
```

The package and SHA-256 file are written to `release/v<VERSION>/`.

## Customer signing and notarization

For direct customer distribution, import organization-owned **Developer ID
Application** and **Developer ID Installer** certificates into the protected
macOS Keychain. Store notarization credentials in a Keychain profile:

```bash
xcrun notarytool store-credentials pico-dmx-notary
```

Build, sign, submit, and staple the package:

```bash
./installer/macos/build_package.sh \
  --application-identity "Developer ID Application: Example GmbH (TEAMID)" \
  --installer-identity "Developer ID Installer: Example GmbH (TEAMID)" \
  --notary-profile pico-dmx-notary
```

The script signs the bundled PHP executable and app with hardened runtime,
signs the installer package, waits for Apple notarization, staples the ticket,
validates it, and writes a SHA-256 checksum. Certificates, private keys, and
notarization passwords must never be stored in this repository.

## Customer operation

1. Open the `.pkg` and install **Pico DMX Controller**.
2. Start it from Applications.
3. Keep port `8090` or choose another unused port from `1024–65535`.
4. Enable trusted-LAN access only when iPads or other PCs need to connect.
5. For another device, open
   `http://<mac-address>:<selected-port>/` on the same trusted network.

macOS may ask whether the signed bundled server may accept incoming
connections when LAN access is enabled. Allow it only on the intended private
lighting network. Do not forward the selected port through an internet router.

Use **Pico DMX Controller → Controller Settings…** to change the port or access
mode later. The app rewrites and restarts only its own user LaunchAgent.
Closing or quitting the app leaves that server running; removing the LaunchAgent
at `~/Library/LaunchAgents/com.picodmx.controller.server.plist` stops automatic
startup. Customer data remains under Application Support until its owner
explicitly removes it.
