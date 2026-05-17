<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$dataDir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0775, true);
}
$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'group_setup.json';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if (!is_file($dataFile)) {
        echo json_encode(['ok' => true, 'exists' => false, 'groups' => []]);
        exit;
    }

    $raw = file_get_contents($dataFile);
    $data = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($data)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Saved groups file is invalid JSON']);
        exit;
    }

    echo json_encode(['ok' => true, 'exists' => true, 'groups' => $data['groups'] ?? [], 'baseUrl' => $data['baseUrl'] ?? null]);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($data) || !isset($data['groups']) || !is_array($data['groups'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Request body must be JSON with a "groups" array']);
        exit;
    }

    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($dataFile, $json . PHP_EOL, LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not write groups file']);
        exit;
    }

    echo json_encode(['ok' => true, 'file' => basename($dataFile)]);
    exit;
}

http_response_code(405);
header('Allow: GET, POST');
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
