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

On a Windows release workstation with WSL 2, run the same builder through the
repository wrapper:

```powershell
.\installer\ubuntu\build_package_wsl.ps1 -Distribution Ubuntu-24.04
```

The wrapper converts the checkout, firmware, and output paths with `wslpath`
and passes them as separate arguments to the Linux builder. It never attempts
to package the Windows `picotool.exe`. WSL therefore needs a Linux picotool
2.3.0 binary; the normal Pico SDK location is detected by `build_package.sh`,
or a different Linux path can be supplied with `-WslPicotoolPath`.
Temporary package staging and the Electron download cache stay in WSL's native
Linux filesystem so Debian ownership and permission metadata are preserved;
only the final package and checksum are written to the Windows release folder.

The main Windows release command invokes this wrapper automatically and creates
both the Windows `.exe` and Debian `.deb` in the same release directory. Use
`-SkipDebianInstaller` only when deliberately omitting the Debian artifact.

### Test the package in WSL

Install and launch the package from Windows PowerShell:

```powershell
wsl -d Ubuntu-24.04
sudo apt install /mnt/d/Projects/pico_wifi_dmx/release/v<VERSION>/wifi-pico-dmx_<VERSION>_amd64.deb
pico-dmx-controller
```

The final two commands run inside Ubuntu. Keep the WiFiPicoDMX window open
because the default application-managed lifecycle stops the PHP service after
the final local application window exits. From the Windows host, open
`http://localhost:8090/`; Windows may not route its own LAN address back into
the mirrored WSL interface.

For testing from an iPad or another trusted LAN device, enable LAN mode inside
Ubuntu:

```bash
sudo pico-dmx-config --lan
pico-dmx-config --status
```

On Windows 11, `%USERPROFILE%\.wslconfig` must contain
`networkingMode=mirrored` under `[wsl2]`. After changing that file, run
`wsl --shutdown` from PowerShell and relaunch the distribution. Permit only TCP
8090 with a WSL Hyper-V firewall rule and a Windows Private-network inbound
rule. Other devices then use the physical Windows adapter address printed by
`pico-dmx-config --status`, for example `http://192.168.0.12:8090/`. A
`172.x.x.x` address is WSL NAT space and is not the customer LAN URL.

The build host needs `dpkg-deb`, `unzip`, and either `curl` or `wget`. Node.js and npm are not
required because the official Electron runtime archive is downloaded directly.

The architecture-specific `.deb` package and its SHA-256 file are written to
`release/v<VERSION>/`. The first build downloads the official Electron archive
pinned in `shell/electron-runtime.env` and refuses it if its SHA-256 differs;
later builds reuse the verified download.
The package build also requires current Release-mode
`build/pico_wifi_dmx.uf2` and `build/pico_wifi_dmx_wifi_firmware.uf2` files plus
Raspberry Pi `picotool` 2.3.0. It refuses stale versions and invalid RP2350,
partition-table, or Wi-Fi images. Nonstandard locations can be supplied with
`PICO_DMX_APPLICATION_UF2`, `PICO_DMX_WIFI_FIRMWARE_UF2`, and
`PICO_DMX_PICOTOOL`.
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

The package also installs **WiFiPicoDMX Firmware Update**. The same guided
updater is available from **Application > Firmware update…** in the main
window. It validates the bundled version-matched application and Wi-Fi images,
checks installed Pico versions over the network, guides BOOTSEL connection,
and requires final confirmation before writing firmware. The guide can set or
change Wi-Fi credentials in a dedicated data partition, or preserve that
partition during later updates. Credentials exist only in the updater process
and a permission-restricted temporary UF2 that is deleted after flashing; they
are not part of the packaged application firmware.

Legacy `SSID` and `SSID_PW` environment variables are not imported. The
`PICO_DMX_WIFI_*` variables used between the Electron shell and flashing helper
are internal, short-lived, and cleared before `picotool` runs.

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

Both `--lan` and LAN-mode `--status` detect and print the current DHCP-assigned
IPv4 controller URL, ready to enter in Safari on an iPad connected to the same
trusted network. Running `--status` again after an address change prints the
new URL.

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
