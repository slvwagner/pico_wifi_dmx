<?php
declare(strict_types=1);

function pico_dmx_data_dir(): string
{
    $serverValue = $_SERVER['PICO_DMX_DATA_DIR'] ?? null;
    $environmentValue = getenv('PICO_DMX_DATA_DIR');
    $configured = is_string($serverValue) && trim($serverValue) !== ''
        ? trim($serverValue)
        : (is_string($environmentValue) ? trim($environmentValue) : '');
    $dataDir = $configured !== ''
        ? rtrim($configured, "\\/")
        : __DIR__ . DIRECTORY_SEPARATOR . 'data';

    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0775, true);
    }
    return $dataDir;
}
