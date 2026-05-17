<?php
header('Content-Type: application/json');
$file = __DIR__ . '/ui_state.json';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) { echo json_encode(['ok'=>false,'error'=>'invalid JSON']); exit; }
    $page  = $body['page']  ?? null;
    $state = $body['state'] ?? null;
    if (!$page || !is_array($state)) { echo json_encode(['ok'=>false,'error'=>'missing page/state']); exit; }
    $data = file_exists($file) ? (json_decode(file_get_contents($file), true) ?: []) : [];
    $data[$page] = array_merge($data[$page] ?? [], $state);
    file_put_contents($file, json_encode($data));
    echo json_encode(['ok'=>true]);
} else {
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true) ?: [];
        echo json_encode(['ok'=>true,'exists'=>true,'state'=>$data]);
    } else {
        echo json_encode(['ok'=>true,'exists'=>false,'state'=>[]]);
    }
}
