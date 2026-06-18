<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$dataDir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0775, true);
}
$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'fixture_library.json';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if (!is_file($dataFile)) {
        echo json_encode(['ok' => true, 'exists' => false, 'library' => null]);
        exit;
    }
    $raw = file_get_contents($dataFile);
    $library = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($library)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Saved fixture library file is invalid JSON']);
        exit;
    }
    echo json_encode(['ok' => true, 'exists' => true, 'library' => $library]);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $library = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($library) || !isset($library['fixtures']) || !is_array($library['fixtures'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Request body must be a fixture library JSON object with a "fixtures" array']);
        exit;
    }
    if (!isset($library['fixtureCount'])) {
        $library['fixtureCount'] = count($library['fixtures']);
    }
    $json = json_encode($library, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($dataFile, $json . PHP_EOL, LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not write fixture library file']);
        exit;
    }
    echo json_encode(['ok' => true, 'file' => basename($dataFile)]);
    exit;
}

http_response_code(405);
header('Allow: GET, POST');
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
