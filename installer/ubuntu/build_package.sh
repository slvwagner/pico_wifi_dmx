#!/usr/bin/env bash
set -euo pipefail

installer_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# Keep this script and Debian maintainer scripts LF-only via .gitattributes so
# the package can be built directly from a Windows checkout mounted into WSL.
repo_root="$(cd -- "$installer_dir/../.." && pwd)"
version="$(tr -d '[:space:]' < "$repo_root/VERSION")"
output_dir="${1:-$repo_root/release/v$version}"
default_build_root="$repo_root/build/ubuntu-installer"
build_root="${PICO_DMX_UBUNTU_BUILD_ROOT:-$default_build_root}"
package_root="$build_root/package"
electron_build_root="$build_root/electron"
download_root="$build_root/downloads"
architecture="$(dpkg --print-architecture)"
package_name="wifi-pico-dmx_${version}_${architecture}.deb"
application_uf2="${PICO_DMX_APPLICATION_UF2:-$repo_root/build/pico_wifi_dmx.uf2}"
wifi_firmware_uf2="${PICO_DMX_WIFI_FIRMWARE_UF2:-$repo_root/build/pico_wifi_dmx_wifi_firmware.uf2}"
picotool_path="${PICO_DMX_PICOTOOL:-}"

case "$version" in
    ''|*[!0-9A-Za-z.+:~-]*)
        printf 'Invalid Debian package version in VERSION: %s\n' "$version" >&2
        exit 1
        ;;
esac

if ! command -v dpkg-deb >/dev/null 2>&1; then
    printf 'dpkg-deb is required. Install it with: sudo apt install dpkg-dev\n' >&2
    exit 1
fi
if [[ -z "$picotool_path" ]]; then
    if command -v picotool >/dev/null 2>&1; then
        picotool_path="$(command -v picotool)"
    else
        picotool_path="$HOME/.pico-sdk/picotool/2.3.0/picotool/picotool"
    fi
fi
for firmware_input in "$application_uf2" "$wifi_firmware_uf2" "$picotool_path"; do
    [[ -f "$firmware_input" ]] || {
        printf 'Required firmware component is missing: %s\n' "$firmware_input" >&2
        exit 1
    }
done
application_info="$("$picotool_path" info -a "$application_uf2" 2>&1)"
[[ "$application_info" =~ target[[:space:]]chip:[[:space:]]+RP2350 ]] &&
    [[ "$application_info" =~ block[[:space:]]type:[[:space:]]+partition[[:space:]]table ]] &&
    [[ "$application_info" =~ \"Wi-Fi[[:space:]]+Firmware\" ]] &&
    [[ "$application_info" =~ version:[[:space:]]+$version ]] &&
    [[ "$application_info" =~ build[[:space:]]attributes:[[:space:]]+Release ]] || {
        printf 'Application UF2 is not the expected WiFiPicoDMX %s RP2350 Release image.\n' "$version" >&2
        exit 1
    }
wifi_info="$("$picotool_path" info -a "$wifi_firmware_uf2" 2>&1)"
[[ "$wifi_info" =~ family[[:space:]]ID[[:space:]]\'cyw43-firmware\' ]] &&
    [[ "$wifi_info" =~ target[[:space:]]chip:[[:space:]]+RP2350 ]] &&
    [[ "$wifi_info" =~ hash:[[:space:]]+verified ]] || {
        printf 'Wi-Fi UF2 is not a verified RP2350 CYW43 firmware image.\n' >&2
        exit 1
    }
for required_command in unzip; do
    if ! command -v "$required_command" >/dev/null 2>&1; then
        printf '%s is required to assemble the bundled application shell.\n' \
            "$required_command" >&2
        exit 1
    fi
done
if command -v curl >/dev/null 2>&1; then
    download_file() {
        curl --fail --location --retry 3 "$1" --output "$2"
    }
elif command -v wget >/dev/null 2>&1; then
    download_file() {
        wget --tries=3 --output-document="$2" "$1"
    }
else
    printf 'curl or wget is required to download the bundled application shell.\n' >&2
    exit 1
fi
case "$architecture" in
    amd64)
        electron_arch_file_variable=ELECTRON_AMD64_FILE
        electron_arch_hash_variable=ELECTRON_AMD64_SHA256
        ;;
    arm64)
        electron_arch_file_variable=ELECTRON_ARM64_FILE
        electron_arch_hash_variable=ELECTRON_ARM64_SHA256
        ;;
    *)
        printf 'The bundled Electron shell does not support architecture: %s\n' \
            "$architecture" >&2
        exit 1
        ;;
esac

# This repository-owned manifest contains only fixed release metadata.
source "$installer_dir/shell/electron-runtime.env"
electron_file="${!electron_arch_file_variable}"
electron_hash="${!electron_arch_hash_variable}"
electron_url="https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/${electron_file}"
electron_archive="$download_root/$electron_file"

case "$ELECTRON_VERSION:$electron_file:$electron_hash" in
    *[!0-9A-Za-z._:+~-]*)
        printf 'Invalid Electron runtime metadata.\n' >&2
        exit 1
        ;;
esac

case "$build_root" in
    "$default_build_root"|"$HOME"/.cache/pico-dmx-controller/ubuntu-installer) ;;
    *)
        printf 'Refusing to reset unexpected build directory: %s\n' "$build_root" >&2
        exit 1
        ;;
esac

rm -rf -- "$package_root" "$electron_build_root"
install -d "$download_root"
if [[ ! -f "$electron_archive" ]] ||
    ! printf '%s  %s\n' "$electron_hash" "$electron_archive" | sha256sum --check --status
then
    partial_archive="$electron_archive.partial"
    download_file "$electron_url" "$partial_archive"
    printf '%s  %s\n' "$electron_hash" "$partial_archive" |
        sha256sum --check --status
    mv "$partial_archive" "$electron_archive"
fi

install -d \
    "$package_root/DEBIAN" \
    "$package_root/etc/default" \
    "$package_root/etc/ufw/applications.d" \
    "$package_root/etc/udev/rules.d" \
    "$package_root/opt/pico-dmx-controller/app/assets" \
    "$package_root/opt/pico-dmx-controller/app/screenshots" \
    "$package_root/opt/pico-dmx-controller/app/test" \
    "$package_root/opt/pico-dmx-controller/firmware" \
    "$package_root/opt/pico-dmx-controller/shell/resources/app" \
    "$package_root/opt/pico-dmx-controller/support" \
    "$package_root/opt/pico-dmx-controller/tools/picotool" \
    "$package_root/usr/bin" \
    "$package_root/usr/lib/systemd/system" \
    "$package_root/usr/share/polkit-1/rules.d" \
    "$package_root/usr/share/applications" \
    "$package_root/usr/share/doc/pico-dmx-controller" \
    "$package_root/usr/share/icons/hicolor/512x512/apps"

render_template() {
    local source="$1"
    local destination="$2"
    sed \
        -e "s/@VERSION@/$version/g" \
        -e "s/@ARCHITECTURE@/$architecture/g" \
        "$source" > "$destination"
}

render_template "$installer_dir/package/DEBIAN/control.in" "$package_root/DEBIAN/control"
render_template "$installer_dir/package/DEBIAN/preinst.in" "$package_root/DEBIAN/preinst"
install -m 0755 "$installer_dir/package/DEBIAN/postinst" "$package_root/DEBIAN/postinst"
install -m 0755 "$installer_dir/package/DEBIAN/prerm" "$package_root/DEBIAN/prerm"
install -m 0755 "$installer_dir/package/DEBIAN/postrm" "$package_root/DEBIAN/postrm"
install -m 0644 "$installer_dir/package/DEBIAN/conffiles" "$package_root/DEBIAN/conffiles"
chmod 0755 "$package_root/DEBIAN/preinst"

install -m 0644 "$installer_dir/package/pico-dmx-controller.default" \
    "$package_root/etc/default/pico-dmx-controller"
install -m 0644 "$installer_dir/package/pico-dmx-controller.ufw" \
    "$package_root/etc/ufw/applications.d/pico-dmx-controller"
install -m 0644 "$installer_dir/package/pico-dmx-controller.service" \
    "$package_root/usr/lib/systemd/system/pico-dmx-controller.service"
install -m 0644 "$installer_dir/package/pico-dmx-controller-polkit.rules" \
    "$package_root/usr/share/polkit-1/rules.d/00-pico-dmx-controller.rules"
install -m 0644 "$installer_dir/package/60-pico-dmx-controller.rules" \
    "$package_root/etc/udev/rules.d/60-pico-dmx-controller.rules"
install -m 0755 "$installer_dir/package/pico-dmx-controller" \
    "$package_root/usr/bin/pico-dmx-controller"
install -m 0755 "$installer_dir/package/pico-dmx-config" \
    "$package_root/usr/bin/pico-dmx-config"
install -m 0644 "$installer_dir/package/pico-dmx-controller.desktop" \
    "$package_root/usr/share/applications/pico-dmx-controller.desktop"
install -m 0644 "$installer_dir/package/pico-dmx-firmware.desktop" \
    "$package_root/usr/share/applications/pico-dmx-firmware.desktop"
install -m 0644 "$installer_dir/package/router.php" \
    "$package_root/opt/pico-dmx-controller/support/router.php"
install -m 0755 "$installer_dir/package/flash_firmware.sh" \
    "$package_root/opt/pico-dmx-controller/support/flash_firmware.sh"

shell_root="$package_root/opt/pico-dmx-controller/shell"
shell_app_root="$shell_root/resources/app"
install -d "$electron_build_root"
unzip -q "$electron_archive" -d "$electron_build_root"
cp -a "$electron_build_root/." "$shell_root/"
mv "$shell_root/electron" "$shell_root/pico-dmx-controller-shell"
install -m 0644 "$installer_dir/shell/main.js" "$shell_app_root/main.js"
install -m 0644 "$installer_dir/shell/preload.js" "$shell_app_root/preload.js"
install -m 0644 "$installer_dir/shell/firmware.html" "$shell_app_root/firmware.html"
install -m 0644 "$installer_dir/shell/shell.html" "$shell_app_root/shell.html"
install -m 0644 "$repo_root/web/assets/app-icon-512.png" "$shell_app_root/icon.png"
render_template "$installer_dir/shell/package.json" "$shell_app_root/package.json"
chmod 0644 "$shell_app_root/package.json"
chmod 0755 "$shell_root/pico-dmx-controller-shell"
chmod 4755 "$shell_root/chrome-sandbox"

firmware_root="$package_root/opt/pico-dmx-controller/firmware"
picotool_root="$package_root/opt/pico-dmx-controller/tools/picotool"
install -m 0644 "$application_uf2" "$firmware_root/pico_wifi_dmx.uf2"
install -m 0644 "$wifi_firmware_uf2" "$firmware_root/pico_wifi_dmx_wifi_firmware.uf2"
install -m 0755 "$picotool_path" "$picotool_root/picotool"
install -m 0644 "$repo_root/installer/windows/third-party/picotool-LICENSE.txt" \
    "$picotool_root/LICENSE.txt"
application_hash="$(sha256sum "$application_uf2" | awk '{print $1}')"
wifi_firmware_hash="$(sha256sum "$wifi_firmware_uf2" | awk '{print $1}')"
{
    printf '{\n'
    printf '  "version": "%s",\n' "$version"
    printf '  "application": {\n'
    printf '    "file": "pico_wifi_dmx.uf2",\n'
    printf '    "sha256": "%s"\n' "$application_hash"
    printf '  },\n'
    printf '  "wifiFirmware": {\n'
    printf '    "file": "pico_wifi_dmx_wifi_firmware.uf2",\n'
    printf '    "sha256": "%s"\n' "$wifi_firmware_hash"
    printf '  }\n'
    printf '}\n'
} > "$firmware_root/firmware-manifest.json"
chmod 0644 "$firmware_root/firmware-manifest.json"

app_root="$package_root/opt/pico-dmx-controller/app"
install -m 0644 "$repo_root/web/dmx_fixture_controller.html" "$app_root/index.html"
for page in \
    dmx_show.html \
    dmx_midi_emulator.html \
    dmx_chaser.html \
    dmx_motion.html \
    dmx_gpio.html \
    dmx_room_plane.html \
    dmx_monitor.html
do
    install -m 0644 "$repo_root/web/$page" "$app_root/$page"
done
cp -a "$repo_root/web/assets/." "$app_root/assets/"
install -m 0644 "$repo_root/web/dmx_benchmark.html" "$app_root/test/index.html"
find "$repo_root/api" -maxdepth 1 -type f -name '*.php' -exec \
    install -m 0644 '{}' "$app_root/" \;
install -m 0644 "$repo_root/docs/user-manual.html" "$app_root/user-manual.html"
install -m 0644 "$repo_root/docs/user-manual.pdf" "$app_root/user-manual.pdf"
install -m 0644 "$repo_root/docs/user-manual-navigation.pdf" "$app_root/user-manual-navigation.pdf"
cp -a "$repo_root/docs/screenshots/." "$app_root/screenshots/"
install -m 0644 "$repo_root/LICENSE" "$package_root/opt/pico-dmx-controller/LICENSE"
install -m 0644 "$repo_root/VERSION" "$package_root/opt/pico-dmx-controller/VERSION"
install -m 0644 "$repo_root/LICENSE" \
    "$package_root/usr/share/doc/pico-dmx-controller/copyright"
install -m 0644 "$repo_root/web/assets/app-icon-512.png" \
    "$package_root/usr/share/icons/hicolor/512x512/apps/pico-dmx-controller.png"

find "$package_root/opt/pico-dmx-controller" -type d -exec chmod 0755 '{}' +
find "$package_root/opt/pico-dmx-controller/app" -type f -exec chmod 0644 '{}' +

installed_size="$(du -sk "$package_root" | awk '{print $1}')"
printf 'Installed-Size: %s\n' "$installed_size" >> "$package_root/DEBIAN/control"

mkdir -p -- "$output_dir"
output_file="$output_dir/$package_name"
dpkg-deb --root-owner-group --build "$package_root" "$output_file"
(
    cd -- "$output_dir"
    sha256sum "$package_name" > "$package_name.sha256"
)

printf 'Built %s\n' "$output_file"
printf 'SHA-256 %s\n' "$(awk '{print $1}' "$output_file.sha256")"
