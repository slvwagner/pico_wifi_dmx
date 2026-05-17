<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$dataFile = __DIR__ . DIRECTORY_SEPARATOR . 'chaser_setup.json';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function readDataFile(string $path): array {
    if (!is_file($path)) return [];
    $raw = file_get_contents($path);
    $d   = json_decode($raw === false ? '' : $raw, true);
    return is_array($d) ? $d : [];
}

if ($method === 'GET') {
    // ?slots — return saved Pico slot payloads only
    if (isset($_GET['slots'])) {
        $data   = readDataFile($dataFile);
        $slots  = isset($data['pico_slots']) && is_array($data['pico_slots'])
                  ? $data['pico_slots'] : array_fill(0, 8, null);
        $url    = isset($data['pico_url']) ? $data['pico_url'] : null;
        echo json_encode(['ok' => true, 'pico_slots' => $slots, 'pico_url' => $url]);
        exit;
    }

    // ?participating — return just participating controls
    if (isset($_GET['participating'])) {
        if (!is_file($dataFile)) {
            echo json_encode(['ok' => true, 'exists' => false, 'participating' => null]);
            exit;
        }
        $data = readDataFile($dataFile);
        $p = isset($data['participating']) ? $data['participating'] : null;
        echo json_encode(['ok' => true, 'exists' => $p !== null, 'participating' => $p]);
        exit;
    }

    if (!is_file($dataFile)) {
        echo json_encode(['ok' => true, 'exists' => false, 'chaser' => null]);
        exit;
    }

    $data = readDataFile($dataFile);
    if ($data === [] && is_file($dataFile)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Saved chaser file is invalid JSON']);
        exit;
    }

    echo json_encode(['ok' => true, 'exists' => true, 'chaser' => $data]);
    exit;
}

if ($method === 'POST') {
    // ?slot=N — save a single Pico slot payload (text/plain body)
    if (isset($_GET['slot'])) {
        $slotIdx = (int)$_GET['slot'];
        if ($slotIdx < 0 || $slotIdx > 7) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'slot must be 0-7']);
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
            $existing['pico_slots'] = array_fill(0, 8, null);
        }
        $existing['pico_slots'][$slotIdx] = $payload;
        // save the pico_url if provided
        if (isset($_GET['pico_url'])) {
            $url = trim($_GET['pico_url']);
            if ($url !== '') $existing['pico_url'] = $url;
        }
        $json = json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($json === false || file_put_contents($dataFile, $json . PHP_EOL, LOCK_EX) === false) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Could not write chaser file']);
            exit;
        }
        echo json_encode(['ok' => true]);
        exit;
    }

    // ?participating — save just participating controls
    if (isset($_GET['participating'])) {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw === false ? '' : $raw, true);
        if (!is_array($data)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Request body must be a JSON object']);
            exit;
        }
        $existing = readDataFile($dataFile);
        $existing['participating'] = $data;
        $json = json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($json === false || file_put_contents($dataFile, $json . PHP_EOL, LOCK_EX) === false) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Could not write chaser file']);
            exit;
        }
        echo json_encode(['ok' => true]);
        exit;
    }

    // default POST — save browser state (preserve existing pico_slots and participating)
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
    if (isset($existing['participating'])) {
        $data['participating'] = $existing['participating'];
    }
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($dataFile, $json . PHP_EOL, LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not write chaser file']);
        exit;
    }
    echo json_encode(['ok' => true, 'file' => basename($dataFile)]);
    exit;
}

http_response_code(405);
header('Allow: GET, POST');
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
