#!/usr/bin/env bash
set -euo pipefail

installer_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$installer_dir/../.." && pwd)"
build_root="$repo_root/build/macos-php-runtime"
output_dir="${1:-$build_root/output}"
php_version=8.5.8
spc_version=2.8.5
extensions=filter
architecture="$(uname -m)"

case "$architecture" in
    arm64)
        spc_asset=spc-macos-aarch64.tar.gz
        spc_sha256=acf2f25d56d0cbf8e65aa82e5054fef555f7be7c5c38046c6e0819f266d83225
        ;;
    x86_64)
        spc_asset=spc-macos-x86_64.tar.gz
        spc_sha256=e8b798048f62ca4960764196543b60ae703f7174aa418824cf542aeec1d2cd6a
        ;;
    *)
        printf 'Unsupported macOS architecture: %s\n' "$architecture" >&2
        exit 1
        ;;
esac

[[ "$(uname -s)" == Darwin ]] || {
    printf 'The bundled PHP runtime must be built on macOS.\n' >&2
    exit 1
}

for command in curl shasum tar; do
    command -v "$command" >/dev/null 2>&1 || {
        printf 'Required command not found: %s\n' "$command" >&2
        exit 1
    }
done

case "$build_root" in
    "$repo_root"/build/macos-php-runtime) ;;
    *)
        printf 'Refusing to use unexpected build directory: %s\n' "$build_root" >&2
        exit 1
        ;;
esac

mkdir -p -- "$build_root/downloads" "$build_root/work" "$output_dir"
archive="$build_root/downloads/$spc_asset"
url="https://github.com/crazywhalecc/static-php-cli/releases/download/$spc_version/$spc_asset"

if [[ ! -f "$archive" ]]; then
    curl --fail --location --retry 4 --output "$archive" "$url"
fi

actual_sha256="$(shasum -a 256 "$archive" | awk '{print $1}')"
if [[ "$actual_sha256" != "$spc_sha256" ]]; then
    printf 'StaticPHP archive SHA-256 mismatch.\nExpected: %s\nActual:   %s\n' \
        "$spc_sha256" "$actual_sha256" >&2
    exit 1
fi

rm -rf -- "$build_root/work"
mkdir -p -- "$build_root/work"
tar -xzf "$archive" -C "$build_root/work"
spc="$(find "$build_root/work" -type f -name spc | head -n 1)"
[[ -n "$spc" ]] || {
    printf 'The verified static-php-cli archive did not contain spc.\n' >&2
    exit 1
}
chmod 0755 "$spc"

cd -- "$build_root/work"
"$spc" doctor
"$spc" download \
    --with-php="$php_version" \
    --for-extensions="$extensions" \
    --prefer-pre-built
"$spc" build --build-cli "$extensions"

php_binary="$build_root/work/buildroot/bin/php"
[[ -x "$php_binary" ]] || {
    printf 'StaticPHP did not produce buildroot/bin/php.\n' >&2
    exit 1
}
"$php_binary" -r 'exit(PHP_VERSION === "8.5.8" ? 0 : 1);' || {
    printf 'The built PHP runtime is not the pinned version %s.\n' "$php_version" >&2
    exit 1
}

php_license="$(find "$build_root/work" -path '*/php-src*/LICENSE' -type f | head -n 1)"
[[ -n "$php_license" ]] || {
    printf 'The PHP source license was not found in the verified build tree.\n' >&2
    exit 1
}

install -m 0755 "$php_binary" "$output_dir/php"
install -m 0644 "$php_license" "$output_dir/php.LICENSE"
shasum -a 256 "$output_dir/php" > "$output_dir/php.sha256"

printf 'Built macOS PHP %s runtime for %s: %s\n' \
    "$php_version" "$architecture" "$output_dir/php"
