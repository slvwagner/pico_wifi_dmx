<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$port = 64540;
$timeoutMs = isset($_GET['timeoutMs']) ? (int)$_GET['timeoutMs'] : 2800;
$timeoutMs = max(250, min(8000, $timeoutMs));
$deadline = microtime(true) + ($timeoutMs / 1000.0);
$devices = [];
$errors = [];

$server = @stream_socket_server(
    "udp://0.0.0.0:$port",
    $errno,
    $errstr,
    STREAM_SERVER_BIND
);

if (!$server) {
    http_response_code(200);
    echo json_encode([
        'ok' => false,
        'error' => "Could not listen for Pico discovery on UDP port $port: $errstr",
        'devices' => [],
    ], JSON_PRETTY_PRINT) . "\n";
    exit;
}

stream_set_blocking($server, false);

while (microtime(true) < $deadline) {
    $peer = '';
    $packet = @stream_socket_recvfrom($server, 2048, 0, $peer);
    if ($packet === false || $packet === '') {
        usleep(25000);
        continue;
    }

    $data = json_decode(trim($packet), true);
    if (!is_array($data) || ($data['type'] ?? '') !== 'pico_wifi_dmx') {
        continue;
    }

    $peerIp = preg_replace('/:\d+$/', '', $peer) ?: '';
    $ip = trim((string)($data['ip'] ?? ''));
    if ($ip === '') {
        $ip = $peerIp;
    }
    if ($ip === '') {
        $errors[] = 'Received Pico beacon without an IP address';
        continue;
    }

    $httpPort = (int)($data['http'] ?? 80);
    $url = 'http://' . $ip . ($httpPort === 80 ? '' : ':' . $httpPort) . '/';
    $id = trim((string)($data['id'] ?? $ip));
    $devices[$id] = [
        'id' => $id,
        'name' => (string)($data['name'] ?? 'pico-wifi-dmx'),
        'version' => (string)($data['version'] ?? ''),
        'ip' => $ip,
        'http' => $httpPort,
        'url' => $url,
        'peer' => $peer,
        'lastSeen' => gmdate('c'),
    ];
}

fclose($server);

echo json_encode([
    'ok' => true,
    'port' => $port,
    'timeoutMs' => $timeoutMs,
    'devices' => array_values($devices),
    'warnings' => $errors,
], JSON_PRETTY_PRINT) . "\n";
