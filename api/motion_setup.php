<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$dataDir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0775, true);
}
$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'motion_setup.json';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
const PICO_SLOT_COUNT = 64;

function readDataFile(string $path): array {
    if (!is_file($path)) return [];
    $raw = file_get_contents($path);
    $d   = json_decode($raw === false ? '' : $raw, true);
    return is_array($d) ? $d : [];
}

if ($method === 'GET') {
    // ?slots — return saved Pico slot payloads only
    if (isset($_GET['slots'])) {
        $data  = readDataFile($dataFile);
        $slots = isset($data['pico_slots']) && is_array($data['pico_slots'])
                 ? array_pad($data['pico_slots'], PICO_SLOT_COUNT, null) : array_fill(0, PICO_SLOT_COUNT, null);
        $url   = isset($data['pico_url']) ? $data['pico_url'] : null;
        echo json_encode(['ok' => true, 'pico_slots' => $slots, 'pico_url' => $url]);
        exit;
    }

    if (!is_file($dataFile)) {
        echo json_encode(['ok' => true, 'exists' => false, 'motion' => null]);
        exit;
    }

    $data = readDataFile($dataFile);
    if ($data === [] && is_file($dataFile)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Saved motion file is invalid JSON']);
        exit;
    }

    echo json_encode(['ok' => true, 'exists' => true, 'motion' => $data]);
    exit;
}

if ($method === 'POST') {
    // ?delete_slot=N — delete a saved Pico slot payload
    if (isset($_GET['delete_slot'])) {
        $slotIdx = (int)$_GET['delete_slot'];
        if ($slotIdx < 0 || $slotIdx >= PICO_SLOT_COUNT) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'slot must be 0-' . (PICO_SLOT_COUNT - 1)]);
            exit;
        }
        $existing = readDataFile($dataFile);
        if (!isset($existing['pico_slots']) || !is_array($existing['pico_slots'])) {
            $existing['pico_slots'] = array_fill(0, PICO_SLOT_COUNT, null);
        }
        $existing['pico_slots'] = array_pad($existing['pico_slots'], PICO_SLOT_COUNT, null);
        $existing['pico_slots'][$slotIdx] = null;
        $json = json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($json === false || file_put_contents($dataFile, $json . PHP_EOL, LOCK_EX) === false) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Could not write motion file']);
            exit;
        }
        echo json_encode(['ok' => true]);
        exit;
    }

    // ?slot=N — save a single Pico slot payload (text/plain body)
    if (isset($_GET['slot'])) {
        $slotIdx = (int)$_GET['slot'];
        if ($slotIdx < 0 || $slotIdx >= PICO_SLOT_COUNT) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'slot must be 0-' . (PICO_SLOT_COUNT - 1)]);
            exit;
        }
        $payload = file_get_contents('php://input');
        if ($payload === false || $payload === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Empty body']);
            exit;
        }
        $existing = readDataFile($dataFile);
        if (!isset($existing['pico_slots']) || !is_array($existing['pico_slots'])) {
            $existing['pico_slots'] = array_fill(0, PICO_SLOT_COUNT, null);
        }
        $existing['pico_slots'] = array_pad($existing['pico_slots'], PICO_SLOT_COUNT, null);
        $existing['pico_slots'][$slotIdx] = $payload;
        // save the pico_url if provided
        if (isset($_GET['pico_url'])) {
            $url = trim($_GET['pico_url']);
            if ($url !== '') $existing['pico_url'] = $url;
        }
        $json = json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($json === false || file_put_contents($dataFile, $json . PHP_EOL, LOCK_EX) === false) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Could not write motion file']);
            exit;
        }
        echo json_encode(['ok' => true]);
        exit;
    }

    // default POST — save browser state (preserve existing pico_slots)
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Request body must be a JSON object']);
        exit;
    }
    $existing = readDataFile($dataFile);
    if (isset($existing['pico_slots'])) {
        $data['pico_slots'] = $existing['pico_slots'];
    }
    if (isset($data['baseUrl']) && trim((string)$data['baseUrl']) !== '') {
        $data['pico_url'] = trim((string)$data['baseUrl']);
    } elseif (isset($existing['pico_url'])) {
        $data['pico_url'] = $existing['pico_url'];
    }
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($dataFile, $json . PHP_EOL, LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not write motion file']);
        exit;
    }
    echo json_encode(['ok' => true, 'file' => basename($dataFile)]);
    exit;
}

http_response_code(405);
header('Allow: GET, POST');
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
