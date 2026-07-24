<?php
declare(strict_types=1);
require_once __DIR__ . DIRECTORY_SEPARATOR . 'app_paths.php';

header('Content-Type: application/json; charset=utf-8');

$dataDir = pico_dmx_data_dir();
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0775, true);
}
$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'room_plane_setup.json';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if (!is_file($dataFile)) {
        echo json_encode(['ok' => true, 'exists' => false, 'setup' => null]);
        exit;
    }

    $raw = file_get_contents($dataFile);
    $setup = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($setup)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Saved room plane setup file is invalid JSON']);
        exit;
    }

    echo json_encode(['ok' => true, 'exists' => true, 'setup' => $setup]);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $setup = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($setup)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Request body must be JSON']);
        exit;
    }
    if (!isset($setup['points']) || !is_array($setup['points'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Request body must include a points array']);
        exit;
    }
    if (!isset($setup['fixtures']) || !is_array($setup['fixtures'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Request body must include a fixtures array']);
        exit;
    }

    $json = json_encode($setup, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($dataFile, $json . PHP_EOL, LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not write room plane setup file']);
        exit;
    }

    echo json_encode(['ok' => true, 'file' => basename($dataFile)]);
    exit;
}

http_response_code(405);
header('Allow: GET, POST');
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
