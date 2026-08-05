# Ubuntu customer installer

The Ubuntu installer provides the same customer-facing separation as the
Windows installer:

- read-only application files under `/opt/pico-dmx-controller`;
- mutable show and fixture data under `/var/lib/pico-dmx-controller/data`;
- an upgrade-compatible `pico-dmx-controller.service` managed by the application;
- a self-contained desktop application with its own embedded Chromium engine,
  dark frame, application controls, fullscreen bar, status bar, and tray menu;
- Applications-menu and executable desktop launchers for normal desktop users;
- an explicit close choice that either keeps the service available, stops it
  after the final local window closes, or cancels;
- safe localhost-only access by default and an explicit trusted-LAN option;
- a data snapshot before every package upgrade; and
- removal that deliberately preserves shows and upgrade snapshots.

The package bundles its Chromium desktop runtime and uses Ubuntu's PHP runtime
for the background service. It does not install XAMPP, Apache, MariaDB, or
development tools.

The packaged PHP service is sized for the complete OFL fixture catalog:
`memory_limit` is 512 MB, request processing is allowed 120 seconds, and fixture
library request bodies can be up to 128 MB. These limits are local to
WiFiPicoDMX and do not change the computer's global PHP configuration.

## Build

On Ubuntu or Debian, run:

```bash
./installer/ubuntu/build_package.sh
```

The build host needs `dpkg-deb`, `unzip`, and either `curl` or `wget`. Node.js and npm are not
required because the official Electron runtime archive is downloaded directly.

The architecture-specific `.deb` package and its SHA-256 file are written to
`release/v<VERSION>/`. The first build downloads the official Electron archive
pinned in `shell/electron-runtime.env` and refuses it if its SHA-256 differs;
later builds reuse the verified download.
Pass a different output directory as the first argument when needed:

```bash
./installer/ubuntu/build_package.sh /tmp/pico-dmx-release
```

## Install

Double-click the `.deb` file in Ubuntu's App Center, or use APT so dependencies
are installed automatically:

```bash
sudo apt install ./wifi-pico-dmx_<VERSION>_amd64.deb
```

Open **WiFiPicoDMX** from the Applications menu. The controller is
available locally at `http://127.0.0.1:8090/`.

The installer also creates **WiFiPicoDMX** on each normal user's
configured XDG desktop. It never replaces an unrelated file with the same name.
Package removal deletes only shortcuts carrying the package's ownership marker.

The application window provides Controller, Reload, Full screen, and
Open in browser actions. F11 toggles fullscreen, Escape restores the window,
and fullscreen retains visible **Exit full screen** and **Close application**
buttons. Closing presents **Exit only**, **Exit and stop server**, and
**Cancel**. Exit only closes Electron/Chromium while keeping the server
available. Exit and stop server stops it once no other local WiFiPicoDMX window
is using it.

Exit only can keep serving iPads after a normal close. To also start the server
automatically at boot, explicitly enable always-on mode:

```bash
sudo pico-dmx-config --always-on
```

Return to the default behavior with:

```bash
sudo pico-dmx-config --application-managed
```

To let iPads and other operator devices on a trusted local network connect:

```bash
sudo pico-dmx-config --lan
```

If UFW is active, that command adds the packaged TCP 8090 application rule.
It does not enable UFW or alter another firewall. Return to local-only access
with:

```bash
sudo pico-dmx-config --local
```

Show the current mode and service status with:

```bash
pico-dmx-config --status
```

Do not expose port 8090 to the public internet.

## Upgrade and remove

Install a newer `.deb` with the same APT command. Before the upgrade, the
installer copies current show data to:

```text
/var/lib/pico-dmx-controller/backups/before-<VERSION>-<UTC timestamp>/
```

Remove the program with:

```bash
sudo apt remove pico-dmx-controller
```

The package intentionally leaves `/var/lib/pico-dmx-controller` untouched so
customer shows and backups remain recoverable. Delete that directory only when
the owner has separately confirmed that the stored show data is no longer
needed.
