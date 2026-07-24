# Ubuntu customer installer

The Ubuntu installer provides the same customer-facing separation as the
Windows installer:

- read-only application files under `/opt/pico-dmx-controller`;
- mutable show and fixture data under `/var/lib/pico-dmx-controller/data`;
- an automatically started `pico-dmx-controller.service`;
- a self-contained desktop application with its own embedded Chromium engine,
  dark frame, application controls, fullscreen bar, status bar, and tray menu;
- Applications-menu and executable desktop launchers for normal desktop users;
- safe localhost-only access by default and an explicit trusted-LAN option;
- a data snapshot before every package upgrade; and
- removal that deliberately preserves shows and upgrade snapshots.

The package bundles its Chromium desktop runtime and uses Ubuntu's PHP runtime
for the background service. It does not install XAMPP, Apache, MariaDB, or
development tools.

## Build

On Ubuntu or Debian, run:

```bash
./installer/ubuntu/build_package.sh
```

The build host needs `dpkg-deb`, `curl`, and `unzip`. Node.js and npm are not
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
sudo apt install ./pico-dmx-controller_<VERSION>_amd64.deb
```

Open **Pico DMX Controller** from the Applications menu. The controller is
available locally at `http://127.0.0.1:8090/`.

The installer also creates **Pico DMX Controller** on each normal user's
configured XDG desktop. It never replaces an unrelated file with the same name.
Package removal deletes only shortcuts carrying the package's ownership marker.

The application window provides Controller, Reload, Full screen, and
Open in browser actions. F11 toggles fullscreen, Escape restores the window,
and fullscreen retains visible **Exit full screen** and **Close application**
buttons. Closing the desktop application leaves the system service running for
other operator devices.

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
