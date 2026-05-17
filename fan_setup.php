<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$dataFile = __DIR__ . DIRECTORY_SEPARATOR . 'fan_setup.json';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if (!is_file($dataFile)) {
        echo json_encode(['ok' => true, 'exists' => false, 'groups' => null]);
        exit;
    }

    $raw = file_get_contents($dataFile);
    $data = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($data)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Saved fan groups file is invalid JSON']);
        exit;
    }

    $groups = array_key_exists('groups', $data) && is_array($data['groups']) ? $data['groups'] : $data;
    echo json_encode(['ok' => true, 'exists' => true, 'groups' => $groups, 'baseUrl' => $data['baseUrl'] ?? null]);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Request body must be JSON']);
        exit;
    }
    if (!array_key_exists('groups', $data)) {
        $data = ['baseUrl' => null, 'groups' => $data];
    }
    if (!isset($data['groups']) || !is_array($data['groups'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Request body must include a groups array']);
        exit;
    }

    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($dataFile, $json . PHP_EOL, LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not write fan groups file']);
        exit;
    }

    echo json_encode(['ok' => true, 'file' => basename($dataFile)]);
    exit;
}

http_response_code(405);
header('Allow: GET, POST');
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
