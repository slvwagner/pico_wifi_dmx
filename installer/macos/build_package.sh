#!/usr/bin/env bash
set -euo pipefail

installer_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$installer_dir/../.." && pwd)"
version="$(tr -d '[:space:]' < "$repo_root/VERSION")"
build_root="$repo_root/build/macos-installer"
php_binary="$repo_root/build/macos-php-runtime/output/php"
php_license="$repo_root/build/macos-php-runtime/output/php.LICENSE"
output_dir="$repo_root/release/v$version"
application_identity=""
installer_identity=""
notary_profile=""
architecture="$(uname -m)"

usage() {
    cat <<'EOF'
Usage: build_package.sh [options]

  --php-binary PATH          Standalone macOS PHP CLI runtime
  --php-license PATH         PHP License file shipped beside the runtime
  --output-dir PATH          Package destination (default: release/v<VERSION>)
  --application-identity ID  Developer ID Application signing identity
  --installer-identity ID    Developer ID Installer signing identity
  --notary-profile NAME      notarytool Keychain profile; submits and staples
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --php-binary) php_binary="$2"; shift 2 ;;
        --php-license) php_license="$2"; shift 2 ;;
        --output-dir) output_dir="$2"; shift 2 ;;
        --application-identity) application_identity="$2"; shift 2 ;;
        --installer-identity) installer_identity="$2"; shift 2 ;;
        --notary-profile) notary_profile="$2"; shift 2 ;;
        --help|-h) usage; exit 0 ;;
        *) printf 'Unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
    esac
done

[[ "$(uname -s)" == Darwin ]] || {
    printf 'The macOS package must be built and validated on macOS.\n' >&2
    exit 1
}
[[ "$version" =~ ^[0-9]+(\.[0-9]+){2}([+-][0-9A-Za-z.-]+)?$ ]] || {
    printf 'Invalid application version: %s\n' "$version" >&2
    exit 1
}
[[ -x "$php_binary" ]] || {
    printf 'Standalone PHP runtime not found: %s\nRun build_php_runtime.sh first.\n' "$php_binary" >&2
    exit 1
}
[[ -f "$php_license" ]] || {
    printf 'PHP License file not found: %s\n' "$php_license" >&2
    exit 1
}

for command in xcrun swiftc pkgbuild pkgutil codesign shasum sips iconutil file; do
    command -v "$command" >/dev/null 2>&1 || {
        printf 'Required macOS/Xcode command not found: %s\n' "$command" >&2
        exit 1
    }
done

case "$architecture" in
    arm64|x86_64) ;;
    *) printf 'Unsupported macOS architecture: %s\n' "$architecture" >&2; exit 1 ;;
esac
file "$php_binary" | grep -q "$architecture" || {
    printf 'PHP runtime does not contain the host architecture %s.\n' "$architecture" >&2
    exit 1
}

case "$build_root" in
    "$repo_root"/build/macos-installer) ;;
    *) printf 'Refusing to reset unexpected build directory: %s\n' "$build_root" >&2; exit 1 ;;
esac
rm -rf -- "$build_root"
mkdir -p -- "$build_root/payload/Applications" "$output_dir"

app_bundle="$build_root/payload/Applications/Pico DMX Controller.app"
contents="$app_bundle/Contents"
resources="$contents/Resources"
app_root="$resources/app"
mkdir -p -- \
    "$contents/MacOS" \
    "$resources/runtime" \
    "$resources/support" \
    "$app_root/assets" \
    "$app_root/screenshots" \
    "$app_root/test"

sed "s/@VERSION@/$version/g" "$installer_dir/app/Info.plist.in" > "$contents/Info.plist"
xcrun swiftc \
    -O \
    -target "$architecture-apple-macos12.0" \
    -framework Cocoa \
    -framework WebKit \
    "$installer_dir/app/PicoDmxController.swift" \
    -o "$contents/MacOS/PicoDmxController"

install -m 0755 "$php_binary" "$resources/runtime/php"
install -m 0644 "$php_license" "$resources/runtime/PHP-LICENSE.txt"
install -m 0644 "$installer_dir/support/router.php" "$resources/support/router.php"

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
find "$repo_root/api" -maxdepth 1 -type f -name '*.php' -exec install -m 0644 '{}' "$app_root/" \;
install -m 0644 "$repo_root/docs/user-manual.html" "$app_root/user-manual.html"
install -m 0644 "$repo_root/docs/user-manual.pdf" "$app_root/user-manual.pdf"
cp -a "$repo_root/docs/screenshots/." "$app_root/screenshots/"
install -m 0644 "$repo_root/LICENSE" "$resources/LICENSE"
install -m 0644 "$repo_root/VERSION" "$resources/VERSION"

iconset="$build_root/AppIcon.iconset"
mkdir -p -- "$iconset"
icon_source="$repo_root/web/assets/app-icon-512.png"
for specification in \
    "16 icon_16x16.png" \
    "32 icon_16x16@2x.png" \
    "32 icon_32x32.png" \
    "64 icon_32x32@2x.png" \
    "128 icon_128x128.png" \
    "256 icon_128x128@2x.png" \
    "256 icon_256x256.png" \
    "512 icon_256x256@2x.png" \
    "512 icon_512x512.png" \
    "1024 icon_512x512@2x.png"
do
    size="${specification%% *}"
    name="${specification#* }"
    sips -z "$size" "$size" "$icon_source" --out "$iconset/$name" >/dev/null
done
iconutil -c icns "$iconset" -o "$resources/AppIcon.icns"

if [[ -n "$application_identity" ]]; then
    codesign --force --options runtime --timestamp --sign "$application_identity" "$resources/runtime/php"
    codesign --force --options runtime --timestamp --sign "$application_identity" "$app_bundle"
else
    codesign --force --sign - "$resources/runtime/php"
    codesign --force --sign - "$app_bundle"
    printf 'Warning: using ad-hoc app signing; customer releases require Developer ID.\n' >&2
fi
codesign --verify --deep --strict --verbose=2 "$app_bundle"

unsigned_pkg="$build_root/wifi-pico-dmx-$version-macos-$architecture-unsigned.pkg"
output_pkg="$output_dir/wifi-pico-dmx-$version-macos-$architecture.pkg"
pkgbuild \
    --root "$build_root/payload" \
    --identifier com.picodmx.controller.pkg \
    --version "$version" \
    --install-location / \
    "$unsigned_pkg"

if [[ -n "$installer_identity" ]]; then
    productsign --sign "$installer_identity" --timestamp "$unsigned_pkg" "$output_pkg"
    pkgutil --check-signature "$output_pkg"
else
    mv -- "$unsigned_pkg" "$output_pkg"
    printf 'Warning: the package is unsigned; customer releases require Developer ID Installer signing.\n' >&2
fi

if [[ -n "$notary_profile" ]]; then
    [[ -n "$application_identity" && -n "$installer_identity" ]] || {
        printf 'Notarization requires both application and installer signing identities.\n' >&2
        exit 1
    }
    xcrun notarytool submit "$output_pkg" --keychain-profile "$notary_profile" --wait
    xcrun stapler staple "$output_pkg"
    xcrun stapler validate "$output_pkg"
fi

sha256_file="$output_pkg.sha256"
shasum -a 256 "$output_pkg" > "$sha256_file"
printf 'Built %s\n' "$output_pkg"
printf 'SHA-256 %s\n' "$(awk '{print $1}' "$sha256_file")"
