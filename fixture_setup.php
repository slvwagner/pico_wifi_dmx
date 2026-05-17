<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$dataFile = __DIR__ . DIRECTORY_SEPARATOR . 'fixture_setup.json';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    // ?livevalues — return the last written live control values
    if (isset($_GET['livevalues'])) {
        $lvFile = __DIR__ . DIRECTORY_SEPARATOR . 'fixture_live_values.json';
        if (!is_file($lvFile)) {
            echo json_encode(['ok' => true, 'exists' => false, 'values' => null]);
            exit;
        }
        $raw = file_get_contents($lvFile);
        $vals = json_decode($raw === false ? '' : $raw, true);
        echo json_encode(['ok' => true, 'exists' => true, 'values' => is_array($vals) ? $vals : []]);
        exit;
    }

    if (!is_file($dataFile)) {
        echo json_encode(['ok' => true, 'exists' => false, 'setup' => null]);
        exit;
    }

    $raw = file_get_contents($dataFile);
    $setup = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($setup)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Saved setup file is invalid JSON']);
        exit;
    }

    echo json_encode(['ok' => true, 'exists' => true, 'setup' => $setup]);
    exit;
}

if ($method === 'POST') {
    // ?livevalues — save the current live control values snapshot
    if (isset($_GET['livevalues'])) {
        $lvFile = __DIR__ . DIRECTORY_SEPARATOR . 'fixture_live_values.json';
        $raw = file_get_contents('php://input');
        $vals = json_decode($raw === false ? '' : $raw, true);
        if (!is_array($vals)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Body must be a JSON object']);
            exit;
        }
        $json = json_encode($vals, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($json === false || file_put_contents($lvFile, $json . PHP_EOL, LOCK_EX) === false) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Could not write values file']);
            exit;
        }
        echo json_encode(['ok' => true]);
        exit;
    }

    $raw = file_get_contents('php://input');
    $setup = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($setup)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Request body must be JSON']);
        exit;
    }

    $json = json_encode($setup, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($dataFile, $json . PHP_EOL, LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not write setup file']);
        exit;
    }

    echo json_encode(['ok' => true, 'file' => basename($dataFile)]);
    exit;
}

http_response_code(405);
header('Allow: GET, POST');
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
