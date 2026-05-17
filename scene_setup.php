<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$dataFile = __DIR__ . DIRECTORY_SEPARATOR . 'scene_setup.json';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if (!is_file($dataFile)) {
        echo json_encode(['ok' => true, 'exists' => false, 'scenes' => [], 'slotCols' => 4, 'slotRows' => 4]);
        exit;
    }

    $raw = file_get_contents($dataFile);
    $data = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($data)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Saved scenes file is invalid JSON']);
        exit;
    }

    echo json_encode(['ok' => true, 'exists' => true,
        'scenes'   => $data['scenes']   ?? [],
        'slotCols' => $data['slotCols'] ?? 4,
        'slotRows' => $data['slotRows'] ?? 4,
    ]);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($data) || !isset($data['scenes']) || !is_array($data['scenes'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Request body must be JSON with a "scenes" array']);
        exit;
    }

    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($dataFile, $json . PHP_EOL, LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not write scenes file']);
        exit;
    }

    echo json_encode(['ok' => true, 'file' => basename($dataFile)]);
    exit;
}

http_response_code(405);
header('Allow: GET, POST');
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
