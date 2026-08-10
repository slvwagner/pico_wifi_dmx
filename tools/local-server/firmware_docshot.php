<?php
declare(strict_types=1);

// Serve the real HTML embedded in firmware/main.cpp with deterministic mock
// responses. This keeps manual screenshots current without contacting a Pico.
$firmwareSourcePath = $root . '/firmware/main.cpp';

if ($path === '/firmware-docshot/' || $path === '/firmware-docshot/index.html') {
    serveFirmwareDocshotPage($firmwareSourcePath, 'build_http_page');
    return;
}

if ($path === '/firmware-docshot/dmx.html') {
    serveFirmwareDocshotPage($firmwareSourcePath, 'build_dmx_page');
    return;
}

if ($path === '/firmware-docshot/logs.txt') {
    $version = trim((string) file_get_contents($root . '/VERSION'));
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    echo "Pico WiFi DMX firmware {$version}\n";
    echo "Wi-Fi connected: 192.168.0.24\n";
    echo "HTTP server started on port 80\n";
    echo "DMX engine running: 512 channels\n";
    echo "MIDI UART1 RX initialized\n";
    echo "Free RAM: 180224 bytes\n";
    echo "Core0 DMX/playback: work mean 224us, peak 610us, late 0\n";
    echo "Core1 network service: work mean 1284us, late 0\n";
    echo "HTTP callbacks: calls 827, work mean 394us, peak 3059us\n";
    echo "DMX frames: 45709, skipped 0, timeouts 0, resyncs 0\n";
    echo "DMX interval: expected 23255us, max 23590us, peak late 335us\n";
    return;
}

if ($path === '/firmware-docshot/status.json') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode([
        'dmx' => [
            'running' => true,
            'channels' => 512,
            'frame_count' => 45709,
        ],
    ], JSON_UNESCAPED_SLASHES);
    return;
}

if (preg_match('~^/firmware-docshot/dmx/values/(\d+)/(\d+)$~', $path, $matches)) {
    $first = max(1, min(512, (int) $matches[1]));
    $count = max(1, min(32, (int) $matches[2]));
    $demo = [0, 0, 128, 255, 32, 64, 96, 160, 192, 224];
    $values = [];
    for ($index = 0; $index < $count && $first + $index <= 512; $index++) {
        $values[] = $demo[$index] ?? 0;
    }
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['first' => $first, 'values' => $values], JSON_UNESCAPED_SLASHES);
    return;
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo "Firmware docshot endpoint not found\n";

function serveFirmwareDocshotPage(string $sourcePath, string $functionName): void
{
    $html = extractFirmwareHtml($sourcePath, $functionName);
    $html = preg_replace_callback(
        '~([\'\"])\/(?!firmware-docshot/)~',
        static fn(array $match): string => $match[1] . '/firmware-docshot/',
        $html
    );
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    echo $html;
}

function extractFirmwareHtml(string $sourcePath, string $functionName): string
{
    $source = file_get_contents($sourcePath);
    if ($source === false) {
        throw new RuntimeException("Unable to read firmware source: {$sourcePath}");
    }

    $marker = "static void {$functionName}()";
    $start = strpos($source, $marker);
    if ($start === false) {
        throw new RuntimeException("Firmware page builder not found: {$functionName}");
    }
    $next = strpos($source, "\nstatic void ", $start + strlen($marker));
    $body = substr($source, $start, $next === false ? null : $next - $start);

    if ($functionName === 'build_dmx_page') {
        if (!preg_match('/#define\s+DMX_CHANNELS\s+(\d+)/', $source, $channelMatch)) {
            throw new RuntimeException('DMX channel count not found in firmware source.');
        }
        $body = str_replace('DMX_CHANNELS_TEXT', '"' . $channelMatch[1] . '"', $body);
    }

    preg_match_all('/"(?:\\\\.|[^"\\\\])*"/s', $body, $matches);
    if (!$matches[0]) {
        throw new RuntimeException("No HTML string literals found in {$functionName}");
    }

    $response = '';
    foreach ($matches[0] as $literal) {
        $response .= stripcslashes(substr($literal, 1, -1));
    }
    $headerEnd = strpos($response, "\r\n\r\n");
    return $headerEnd === false ? $response : substr($response, $headerEnd + 4);
}
