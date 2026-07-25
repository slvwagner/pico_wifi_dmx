<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function is_usable_ipv4(string $address): bool
{
    if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) === false) {
        return false;
    }

    $octets = array_map('intval', explode('.', $address));
    if (count($octets) !== 4) {
        return false;
    }

    return $octets[0] !== 0
        && $octets[0] !== 127
        && !($octets[0] === 169 && $octets[1] === 254)
        && $octets[0] < 224;
}

function add_address(array &$addresses, mixed $candidate): void
{
    $address = trim((string)$candidate);
    if (is_usable_ipv4($address)) {
        $addresses[$address] = true;
    }
}

$hostname = trim((string)(gethostname() ?: php_uname('n')));
$addresses = [];

$requestHost = trim((string)($_SERVER['HTTP_HOST'] ?? ''));
$requestHostName = preg_replace('/:\d+$/', '', $requestHost) ?: '';
add_address($addresses, $requestHostName);
add_address($addresses, $_SERVER['SERVER_ADDR'] ?? '');

if ($hostname !== '') {
    $resolved = gethostbynamel($hostname);
    if (is_array($resolved)) {
        foreach ($resolved as $address) {
            add_address($addresses, $address);
        }
    }
}

$https = strtolower((string)($_SERVER['HTTPS'] ?? '')) === 'on'
    || (string)($_SERVER['HTTPS'] ?? '') === '1';
$scheme = $https ? 'https' : 'http';
$port = max(1, min(65535, (int)($_SERVER['SERVER_PORT'] ?? ($https ? 443 : 80))));
$portSuffix = (($https && $port === 443) || (!$https && $port === 80))
    ? ''
    : ':' . $port;

$scriptName = str_replace('\\', '/', (string)($_SERVER['SCRIPT_NAME'] ?? '/host_access.php'));
$basePath = str_replace('\\', '/', dirname($scriptName));
$basePath = $basePath === '/' || $basePath === '.' ? '/' : '/' . trim($basePath, '/') . '/';

$addressList = array_keys($addresses);
sort($addressList, SORT_NATURAL);
$urls = array_map(
    static fn(string $address): string => $scheme . '://' . $address . $portSuffix . $basePath,
    $addressList
);

echo json_encode([
    'ok' => true,
    'hostname' => $hostname,
    'addresses' => $addressList,
    'urls' => $urls,
    'port' => $port,
    'basePath' => $basePath,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
