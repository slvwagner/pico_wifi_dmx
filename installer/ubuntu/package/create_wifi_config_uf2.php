<?php
declare(strict_types=1);

if ($argc !== 2) {
    fwrite(STDERR, "Expected one output path.\n");
    exit(2);
}

$ssid = getenv('PICO_DMX_WIFI_SSID');
$password = getenv('PICO_DMX_WIFI_PASSWORD');
if (!is_string($ssid) || !is_string($password)) {
    fwrite(STDERR, "Wi-Fi credentials were not provided.\n");
    exit(2);
}

$ssidLength = strlen($ssid);
$passwordLength = strlen($password);
if ($ssidLength < 1 || $ssidLength > 32 || str_contains($ssid, "\0")) {
    fwrite(STDERR, "The Wi-Fi network name must contain 1 to 32 UTF-8 bytes.\n");
    exit(2);
}
if ($passwordLength < 8 || $passwordLength > 64 || str_contains($password, "\0")) {
    fwrite(STDERR, "The Wi-Fi password must contain 8 to 64 UTF-8 bytes.\n");
    exit(2);
}
if ($passwordLength === 64 && preg_match('/^[0-9a-fA-F]{64}$/D', $password) !== 1) {
    fwrite(STDERR, "A 64-byte Wi-Fi password must be hexadecimal.\n");
    exit(2);
}

$config = 'PDMXWIFI'
    . pack('V3', 1, $ssidLength, $passwordLength)
    . $ssid . str_repeat("\0", 33 - $ssidLength) . str_repeat("\0", 3)
    . $password . str_repeat("\0", 65 - $passwordLength) . str_repeat("\0", 3);
$config .= pack('V', crc32($config));
$payload = $config . str_repeat("\0", 256 - strlen($config));
$block = pack(
    'V8',
    0x0a324655,
    0x9e5d5157,
    0x00002000,
    0x10000000,
    256,
    0,
    1,
    0xe48bff58
) . $payload . str_repeat("\0", 220) . pack('V', 0x0ab16f30);

if (file_put_contents($argv[1], $block, LOCK_EX) !== 512) {
    fwrite(STDERR, "Could not create the temporary Wi-Fi configuration.\n");
    exit(1);
}
chmod($argv[1], 0600);
