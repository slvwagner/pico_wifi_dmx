<?php
declare(strict_types=1);

$configuredRoot = getenv('PICO_DMX_APP_DIR');
$appRoot = is_string($configuredRoot) && $configuredRoot !== ''
    ? rtrim($configuredRoot, '/')
    : dirname(__DIR__) . '/app';
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = rawurldecode($requestPath);

$routes = [
    '/' => 'index.html',
    '/dmx_fixture_controller.html' => 'index.html',
    '/test' => 'test/index.html',
    '/test/' => 'test/index.html',
];

if (isset($routes[$path])) {
    serveInstalledFile($appRoot . '/' . $routes[$path]);
    return true;
}

$relative = ltrim($path, '/');
if ($relative === '' || str_contains($relative, "\0")) {
    notFound();
    return true;
}

$candidate = realpath($appRoot . '/' . $relative);
if ($candidate === false ||
    !str_starts_with($candidate, $appRoot . DIRECTORY_SEPARATOR) ||
    !is_file($candidate)
) {
    notFound();
    return true;
}

if (strtolower(pathinfo($candidate, PATHINFO_EXTENSION)) === 'php') {
    require $candidate;
    return true;
}

serveInstalledFile($candidate);
return true;

function notFound(): void
{
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Not found\n";
}

function serveInstalledFile(string $file): void
{
    if (!is_file($file)) {
        notFound();
        return;
    }

    $types = [
        'css' => 'text/css; charset=utf-8',
        'html' => 'text/html; charset=utf-8',
        'ico' => 'image/x-icon',
        'jpeg' => 'image/jpeg',
        'jpg' => 'image/jpeg',
        'js' => 'text/javascript; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'pdf' => 'application/pdf',
        'png' => 'image/png',
        'svg' => 'image/svg+xml',
        'webmanifest' => 'application/manifest+json',
        'webp' => 'image/webp',
    ];

    $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('X-Frame-Options: SAMEORIGIN');
    header('Content-Type: ' . ($types[$extension] ?? 'application/octet-stream'));
    header('Content-Length: ' . filesize($file));
    readfile($file);
}
