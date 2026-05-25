<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = rawurldecode($path);

$routes = [
    '/' => "$root/web/dmx_fixture_controller.html",
    '/index.html' => "$root/web/dmx_fixture_controller.html",
    '/dmx_fixture_controller.html' => "$root/web/dmx_fixture_controller.html",
    '/dmx_motion.html' => "$root/web/dmx_motion.html",
    '/dmx_chaser.html' => "$root/web/dmx_chaser.html",
    '/dmx_monitor.html' => "$root/web/dmx_monitor.html",
    '/dmx_gpio.html' => "$root/web/dmx_gpio.html",
    '/test' => "$root/web/dmx_benchmark.html",
    '/test/' => "$root/web/dmx_benchmark.html",
    '/test/index.html' => "$root/web/dmx_benchmark.html",
    '/user-manual.html' => "$root/docs/user-manual.html",
    '/user-manual.pdf' => "$root/docs/user-manual.pdf",
    '/VERSION' => "$root/VERSION",
];

$apiRoutes = [
    '/fixture_setup.php' => "$root/api/fixture_setup.php",
    '/chaser_setup.php' => "$root/api/chaser_setup.php",
    '/motion_setup.php' => "$root/api/motion_setup.php",
    '/group_setup.php' => "$root/api/group_setup.php",
    '/scene_setup.php' => "$root/api/scene_setup.php",
    '/palette_setup.php' => "$root/api/palette_setup.php",
    '/gpio_setup.php' => "$root/api/gpio_setup.php",
    '/ui_state.php' => "$root/api/ui_state.php",
];

if (isset($apiRoutes[$path])) {
    require $apiRoutes[$path];
    return true;
}

if (str_starts_with($path, '/assets/')) {
    serveFile("$root/web$path");
    return true;
}

if (str_starts_with($path, '/screenshots/')) {
    serveFile("$root/docs$path");
    return true;
}

if (isset($routes[$path])) {
    serveFile($routes[$path]);
    return true;
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo "Not found\n";
return true;

function serveFile(string $file): void
{
    if (!is_file($file)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo "Not found\n";
        return;
    }

    $types = [
        'css' => 'text/css; charset=utf-8',
        'html' => 'text/html; charset=utf-8',
        'js' => 'text/javascript; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'pdf' => 'application/pdf',
        'png' => 'image/png',
        'svg' => 'image/svg+xml',
        'txt' => 'text/plain; charset=utf-8',
    ];

    $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    header('Content-Type: ' . ($types[$extension] ?? 'application/octet-stream'));
    header('Content-Length: ' . filesize($file));
    readfile($file);
}
