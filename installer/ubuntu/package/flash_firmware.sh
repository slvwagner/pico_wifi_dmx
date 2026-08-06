#!/usr/bin/env bash
set -euo pipefail

install_root="${PICO_DMX_INSTALL_ROOT:-/opt/pico-dmx-controller}"
picotool="$install_root/tools/picotool/picotool"
firmware_dir="$install_root/firmware"
manifest="$firmware_dir/firmware-manifest.json"
application="$firmware_dir/pico_wifi_dmx.uf2"
wifi_firmware="$firmware_dir/pico_wifi_dmx_wifi_firmware.uf2"
wifi_config_generator="$install_root/support/create_wifi_config_uf2.php"

fail() { printf 'Error: %s\n' "$1" >&2; exit 1; }
for file in "$picotool" "$manifest" "$application" "$wifi_firmware"; do
    [[ -f "$file" ]] || fail "Firmware component is missing: $file"
done

manifest_value() {
    php -r '$value=json_decode(file_get_contents($argv[1]),true); foreach(explode(".",$argv[2]) as $key){$value=$value[$key]??null;} if(!is_string($value)||$value==="")exit(1); echo $value;' "$manifest" "$1"
}
version="$(manifest_value version)" || fail 'Firmware manifest has no version.'
application_hash="$(manifest_value application.sha256)" || fail 'Application checksum is missing.'
wifi_hash="$(manifest_value wifiFirmware.sha256)" || fail 'Wi-Fi checksum is missing.'
printf '%s  %s\n' "$application_hash" "$application" | sha256sum --check --status || fail 'Application firmware checksum does not match.'
printf '%s  %s\n' "$wifi_hash" "$wifi_firmware" | sha256sum --check --status || fail 'Wi-Fi firmware checksum does not match.'

application_info="$($picotool info -a "$application" 2>&1)" || fail "$application_info"
[[ "$application_info" =~ target[[:space:]]chip:[[:space:]]+RP2350 ]] || fail "Application firmware does not target RP2350."
[[ "$application_info" =~ block[[:space:]]type:[[:space:]]+partition[[:space:]]table ]] || fail 'Application partition table is missing.'
[[ "$application_info" =~ \"Wi-Fi[[:space:]]+Configuration\" ]] || fail 'Application Wi-Fi configuration partition metadata is missing.'
[[ "$application_info" =~ \"Wi-Fi[[:space:]]+Firmware\" ]] || fail 'Application Wi-Fi partition metadata is missing.'
[[ "$application_info" =~ version:[[:space:]]+$version ]] || fail "Application firmware version is not $version."
[[ "$application_info" =~ build[[:space:]]attributes:[[:space:]]+Release ]] || fail 'Application is not a Release build.'
wifi_info="$($picotool info -a "$wifi_firmware" 2>&1)" || fail "$wifi_info"
[[ "$wifi_info" =~ family[[:space:]]ID[[:space:]]\'cyw43-firmware\' ]] || fail 'Wi-Fi image has the wrong family ID.'
[[ "$wifi_info" =~ target[[:space:]]chip:[[:space:]]+RP2350 ]] || fail 'Wi-Fi image does not target RP2350.'
[[ "$wifi_info" =~ hash:[[:space:]]+verified ]] || fail 'Wi-Fi image hash is not verified.'
printf 'Firmware bundle %s validated.\n' "$version"
[[ "${1:-}" == --validate-only ]] && exit 0

printf 'Checking for the target Pico in BOOTSEL mode…\n'
device_info="$($picotool info -a 2>&1)" || fail "$device_info"
[[ "$device_info" =~ target[[:space:]]chip:[[:space:]]+RP2350 ]] || fail 'The connected BOOTSEL device is not an RP2350 Pico 2 W.'
printf 'One RP2350 Pico is accessible in BOOTSEL mode.\n'
[[ "${1:-}" == --probe-only ]] && exit 0
[[ "${1:-}" == --flash ]] || fail 'Select --validate-only, --probe-only, or --flash.'

printf 'Loading the WiFiPicoDMX application and partition table…\n'
"$picotool" load -v "$application"
printf 'Rebooting the Pico back into USB BOOTSEL mode…\n'
"$picotool" reboot -u
deadline=$((SECONDS + 20))
until "$picotool" info >/dev/null 2>&1; do
    (( SECONDS < deadline )) || fail 'The Pico did not return to BOOTSEL mode within 20 seconds.'
    sleep 1
done
printf 'Loading the separate CYW43 Wi-Fi firmware partition…\n'
wifi_config_uf2=''
cleanup_wifi_config() {
    if [[ -n "$wifi_config_uf2" ]]; then
        rm -f -- "$wifi_config_uf2"
    fi
}
trap cleanup_wifi_config EXIT
if [[ "${PICO_DMX_WIFI_PROVISION:-}" == 1 ]]; then
    [[ -n "${PICO_DMX_WIFI_SSID:-}" && -n "${PICO_DMX_WIFI_PASSWORD:-}" ]] || \
        fail 'Wi-Fi provisioning was requested without both credentials.'
    [[ -f "$wifi_config_generator" ]] || fail 'The Wi-Fi configuration generator is missing.'
    wifi_config_uf2="$(mktemp --tmpdir pico-dmx-wifi-XXXXXX.uf2)"
    php "$wifi_config_generator" "$wifi_config_uf2"
    unset PICO_DMX_WIFI_PROVISION PICO_DMX_WIFI_SSID PICO_DMX_WIFI_PASSWORD
    printf 'Loading the private Wi-Fi configuration partition…\n'
    "$picotool" load -u -v "$wifi_config_uf2"
fi
"$picotool" load -u -v -x "$wifi_firmware"
printf 'Application and Wi-Fi firmware installation completed.\n'
