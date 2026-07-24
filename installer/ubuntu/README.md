# Ubuntu customer installer

The Ubuntu installer provides the same customer-facing separation as the
Windows installer:

- read-only application files under `/opt/pico-dmx-controller`;
- mutable show and fixture data under `/var/lib/pico-dmx-controller/data`;
- an automatically started `pico-dmx-controller.service`;
- an Applications-menu launcher that uses a dedicated Chromium/Chrome app
  profile with a dark native frame when available and otherwise opens the
  default browser;
- safe localhost-only access by default and an explicit trusted-LAN option;
- a data snapshot before every package upgrade; and
- removal that deliberately preserves shows and upgrade snapshots.

The package uses Ubuntu's PHP runtime rather than bundling XAMPP, Apache,
MariaDB, or development tools.

## Build

On Ubuntu or Debian, run:

```bash
./installer/ubuntu/build_package.sh
```

The `.deb` package and its SHA-256 file are written to `release/v<VERSION>/`.
Pass a different output directory as the first argument when needed:

```bash
./installer/ubuntu/build_package.sh /tmp/pico-dmx-release
```

## Install

Double-click the `.deb` file in Ubuntu's App Center, or use APT so dependencies
are installed automatically:

```bash
sudo apt install ./pico-dmx-controller_<VERSION>_all.deb
```

Open **Pico DMX Controller** from the Applications menu. The controller is
available locally at `http://127.0.0.1:8090/`.

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
