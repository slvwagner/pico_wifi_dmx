<?php
declare(strict_types=1);
require_once __DIR__ . DIRECTORY_SEPARATOR . 'app_paths.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'fixture_library_merge.php';
require_once __DIR__ . DIRECTORY_SEPARATOR . 'json_store.php';

header('Content-Type: application/json; charset=utf-8');

function fixtureLibraryRead(string $path): ?array
{
    $value = readJsonFileLocked($path);
    return is_array($value) && isset($value['fixtures']) && is_array($value['fixtures']) ? $value : null;
}

function fixtureLibraryWriteLocked(string $path, array $library): bool
{
    $json = json_encode($library, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) return false;
    $handle = fopen($path, 'c+');
    if ($handle === false) return false;
    $ok = false;
    if (flock($handle, LOCK_EX)) {
        rewind($handle);
        if (ftruncate($handle, 0)) {
            $written = fwrite($handle, $json);
            $newline = $written === strlen($json) ? fwrite($handle, PHP_EOL) : false;
            $ok = $written === strlen($json) && $newline === strlen(PHP_EOL) && fflush($handle);
        }
        flock($handle, LOCK_UN);
    }
    fclose($handle);
    return $ok;
}

$dataDir = pico_dmx_data_dir();
if (!is_dir($dataDir)) mkdir($dataDir, 0775, true);
$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'fixture_library.json';
$standardFile = fixtureLibraryStandardPath();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if (!is_file($dataFile)) {
        $seed = $standardFile === null ? null : fixtureLibraryRead($standardFile);
        if ($seed !== null) {
            $seed['standardGeneratedAt'] = $seed['generatedAt'] ?? null;
            $seed['source'] = 'Active fixture library';
        }
        if ($seed === null || !fixtureLibraryWriteLocked($dataFile, $seed)) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'Could not initialize the active fixture library']);
            exit;
        }
    }
    $library = fixtureLibraryRead($dataFile);
    if ($library === null) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Active fixture library file is invalid JSON']);
        exit;
    }
    echo json_encode(['ok' => true, 'exists' => true, 'library' => $library]);
    exit;
}

if ($method === 'POST' && ($_GET['action'] ?? '') === 'update-standard') {
    $standard = $standardFile === null ? null : fixtureLibraryRead($standardFile);
    $active = is_file($dataFile) ? fixtureLibraryRead($dataFile) : null;
    if ($standard === null) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Bundled OFL fixture library is unavailable or invalid']);
        exit;
    }
    if ($active === null) $active = $standard;
    $backupDir = $dataDir . DIRECTORY_SEPARATOR . 'backups';
    if (!is_dir($backupDir)) mkdir($backupDir, 0775, true);
    $backupFile = $backupDir . DIRECTORY_SEPARATOR . 'fixture-library-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.json';
    if (!fixtureLibraryWriteLocked($backupFile, $active)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not create the fixture library backup; update cancelled']);
        exit;
    }
    $result = mergeFixtureLibraryUserData($standard, $active);
    if (!fixtureLibraryWriteLocked($dataFile, $result['library'])) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Could not write the updated active fixture library']);
        exit;
    }
    echo json_encode([
        'ok' => true,
        'fixtureCount' => $result['library']['fixtureCount'],
        'backup' => 'backups/' . basename($backupFile),
    ] + $result['stats']);
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
    $library['fixtureCount'] = count($library['fixtures']);
    $library['source'] = 'Active fixture library';
    if (!fixtureLibraryWriteLocked($dataFile, $library)) {
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
