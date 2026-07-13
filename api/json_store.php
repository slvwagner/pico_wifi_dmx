<?php
declare(strict_types=1);

/** Read a JSON object without observing a writer's truncated/partial state. */
function readJsonFileLocked(string $path): array
{
    $handle = fopen($path, 'rb');
    if ($handle === false) return [];
    $raw = '';
    if (flock($handle, LOCK_SH)) {
        $contents = stream_get_contents($handle);
        if ($contents !== false) $raw = $contents;
        flock($handle, LOCK_UN);
    }
    fclose($handle);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * Atomically update a JSON object while holding one exclusive file lock across
 * the complete read-modify-write transaction.
 */
function updateJsonFileAtomically(string $path, callable $mutate, int $jsonFlags = 0): bool
{
    $handle = fopen($path, 'c+');
    if ($handle === false) return false;

    $ok = false;
    if (flock($handle, LOCK_EX)) {
        rewind($handle);
        $raw = stream_get_contents($handle);
        $current = json_decode($raw === false ? '' : $raw, true);
        if (!is_array($current)) $current = [];

        $updated = $mutate($current);
        $json = is_array($updated) ? json_encode($updated, $jsonFlags) : false;
        if ($json !== false) {
            $contents = $json . PHP_EOL;
            rewind($handle);
            if (ftruncate($handle, 0)) {
                $written = 0;
                $length = strlen($contents);
                while ($written < $length) {
                    $count = fwrite($handle, substr($contents, $written));
                    if ($count === false || $count === 0) break;
                    $written += $count;
                }
                $ok = $written === $length && fflush($handle);
            }
        }
        flock($handle, LOCK_UN);
    }
    fclose($handle);
    return $ok;
}
