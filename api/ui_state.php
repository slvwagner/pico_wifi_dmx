<?php
declare(strict_types=1);
require_once __DIR__ . DIRECTORY_SEPARATOR . 'app_paths.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'json_store.php';
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
$dataDir = pico_dmx_data_dir();
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0775, true);
}
$file = $dataDir . '/ui_state.json';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) { echo json_encode(['ok'=>false,'error'=>'invalid JSON']); exit; }
    $page  = $body['page']  ?? null;
    $state = $body['state'] ?? null;
    if (!$page || !is_array($state)) { echo json_encode(['ok'=>false,'error'=>'missing page/state']); exit; }
    $saved = updateJsonFileAtomically($file, function (array $data) use ($page, $state): array {
        $data[$page] = array_merge($data[$page] ?? [], $state);
        return $data;
    });
    if (!$saved) {
        http_response_code(500);
        echo json_encode(['ok'=>false,'error'=>'could not write UI state']);
        exit;
    }
    echo json_encode(['ok'=>true]);
} else {
    if (file_exists($file)) {
        $data = readJsonFileLocked($file);
        echo json_encode(['ok'=>true,'exists'=>true,'state'=>$data]);
    } else {
        echo json_encode(['ok'=>true,'exists'=>false,'state'=>(object)[]]);
    }
}
