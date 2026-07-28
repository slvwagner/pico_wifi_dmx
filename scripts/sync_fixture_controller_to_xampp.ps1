param(
    [string]$XamppHtdocs = "",
    [string]$AppFolder = "",
    [string]$BaseUrl = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "local_path_config.ps1")
$localPaths = Get-LocalPathConfig -RepoRoot $repoRoot
if (-not $XamppHtdocs) { $XamppHtdocs = $localPaths.xamppHtdocs }
if (-not $AppFolder) { $AppFolder = $localPaths.appFolder }
if (-not $BaseUrl) { $BaseUrl = $localPaths.baseUrl }

$webDir = Join-Path $repoRoot "web"
$assetsDir = Join-Path $webDir "assets"
$apiDir = Join-Path $repoRoot "api"
$docsDir = Join-Path $repoRoot "docs"
$versionSource = Join-Path $repoRoot "VERSION"

$source = Join-Path $webDir "dmx_fixture_controller.html"
$apiSource = Join-Path $apiDir "fixture_setup.php"
$showSource = Join-Path $webDir "dmx_show.html"
$midiEmulatorSource = Join-Path $webDir "dmx_midi_emulator.html"
$motionSource = Join-Path $webDir "dmx_motion.html"
$chaserSource = Join-Path $webDir "dmx_chaser.html"
$benchSource = Join-Path $webDir "dmx_benchmark.html"
$monitorSource = Join-Path $webDir "dmx_monitor.html"
$gpioSource      = Join-Path $webDir "dmx_gpio.html"
$roomPlaneSource = Join-Path $webDir "dmx_room_plane.html"
$chaserApiSource = Join-Path $apiDir "chaser_setup.php"
$motionApiSource = Join-Path $apiDir "motion_setup.php"
$groupApiSource  = Join-Path $apiDir "group_setup.php"
$sceneApiSource  = Join-Path $apiDir "scene_setup.php"
$paletteApiSource = Join-Path $apiDir "palette_setup.php"
$gpioApiSource    = Join-Path $apiDir "gpio_setup.php"
$roomPlaneApiSource = Join-Path $apiDir "room_plane_setup.php"
$fixtureLibraryApiSource = Join-Path $apiDir "fixture_library.php"
$uiStateSource   = Join-Path $apiDir "ui_state.php"
$appPathsSource  = Join-Path $apiDir "app_paths.php"
$jsonStoreSource = Join-Path $apiDir "json_store.php"
$picoDiscoveryApiSource = Join-Path $apiDir "pico_discovery.php"
$hostAccessApiSource = Join-Path $apiDir "host_access.php"
$manualSource    = Join-Path $docsDir "user-manual.html"
$manualPdfSource = Join-Path $docsDir "user-manual.pdf"
$manualNavigationPdfSource = Join-Path $docsDir "user-manual-navigation.pdf"
$manualScreenshotsSource = Join-Path $docsDir "screenshots"
$targetDir = Join-Path $XamppHtdocs $AppFolder
$assetsTargetDir = Join-Path $targetDir "assets"
$benchTargetDir = Join-Path $targetDir "test"
$dataTargetDir = Join-Path $targetDir "data"
$target = Join-Path $targetDir "index.html"
$apiTarget = Join-Path $targetDir "fixture_setup.php"
$showTarget = Join-Path $targetDir "dmx_show.html"
$midiEmulatorTarget = Join-Path $targetDir "dmx_midi_emulator.html"
$motionTarget = Join-Path $targetDir "dmx_motion.html"
$chaserTarget = Join-Path $targetDir "dmx_chaser.html"
$benchTarget = Join-Path $benchTargetDir "index.html"
$monitorTarget = Join-Path $targetDir "dmx_monitor.html"
$gpioTarget      = Join-Path $targetDir "dmx_gpio.html"
$roomPlaneTarget = Join-Path $targetDir "dmx_room_plane.html"
$chaserApiTarget = Join-Path $targetDir "chaser_setup.php"
$motionApiTarget = Join-Path $targetDir "motion_setup.php"
$groupApiTarget  = Join-Path $targetDir "group_setup.php"
$sceneApiTarget  = Join-Path $targetDir "scene_setup.php"
$paletteApiTarget = Join-Path $targetDir "palette_setup.php"
$gpioApiTarget    = Join-Path $targetDir "gpio_setup.php"
$roomPlaneApiTarget = Join-Path $targetDir "room_plane_setup.php"
$fixtureLibraryApiTarget = Join-Path $targetDir "fixture_library.php"
$uiStateTarget   = Join-Path $targetDir "ui_state.php"
$appPathsTarget  = Join-Path $targetDir "app_paths.php"
$jsonStoreTarget = Join-Path $targetDir "json_store.php"
$picoDiscoveryApiTarget = Join-Path $targetDir "pico_discovery.php"
$hostAccessApiTarget = Join-Path $targetDir "host_access.php"
$manualTarget    = Join-Path $targetDir "user-manual.html"
$manualPdfTarget = Join-Path $targetDir "user-manual.pdf"
$manualNavigationPdfTarget = Join-Path $targetDir "user-manual-navigation.pdf"
$manualScreenshotsTarget = Join-Path $targetDir "screenshots"
$versionTarget = Join-Path $targetDir "VERSION"

if (-not (Test-Path -LiteralPath $source)) {
    throw "Source file not found: $source"
}

if (-not (Test-Path -LiteralPath $apiSource)) {
    throw "API file not found: $apiSource"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
New-Item -ItemType Directory -Force -Path $assetsTargetDir | Out-Null
New-Item -ItemType Directory -Force -Path $dataTargetDir | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force
Copy-Item -LiteralPath $apiSource -Destination $apiTarget -Force
if (Test-Path -LiteralPath $assetsDir) {
    Copy-Item -Path (Join-Path $assetsDir "*") -Destination $assetsTargetDir -Force
    Write-Host "Copied web assets to $assetsTargetDir"
}
if (Test-Path -LiteralPath $showSource) {
    Copy-Item -LiteralPath $showSource -Destination $showTarget -Force
    Write-Host "Copied show run page to $showTarget"
}
if (Test-Path -LiteralPath $midiEmulatorSource) {
    Copy-Item -LiteralPath $midiEmulatorSource -Destination $midiEmulatorTarget -Force
    Write-Host "Copied MIDI emulator page to $midiEmulatorTarget"
}
if (Test-Path -LiteralPath $motionSource) {
    Copy-Item -LiteralPath $motionSource -Destination $motionTarget -Force
    Write-Host "Copied effects page to $motionTarget"
}
if (Test-Path -LiteralPath $chaserSource) {
    Copy-Item -LiteralPath $chaserSource -Destination $chaserTarget -Force
    Write-Host "Copied chaser to $chaserTarget"
}
if (Test-Path -LiteralPath $benchSource) {
    New-Item -ItemType Directory -Force -Path $benchTargetDir | Out-Null
    Copy-Item -LiteralPath $benchSource -Destination $benchTarget -Force
    Write-Host "Copied benchmark to $benchTarget"
}
if (Test-Path -LiteralPath $monitorSource) {
    Copy-Item -LiteralPath $monitorSource -Destination $monitorTarget -Force
    Write-Host "Copied DMX monitor to $monitorTarget"
}
if (Test-Path -LiteralPath $gpioSource) {
    Copy-Item -LiteralPath $gpioSource -Destination $gpioTarget -Force
    Write-Host "Copied GPIO control to $gpioTarget"
}
if (Test-Path -LiteralPath $roomPlaneSource) {
    Copy-Item -LiteralPath $roomPlaneSource -Destination $roomPlaneTarget -Force
    Write-Host "Copied room plane page to $roomPlaneTarget"
}
if (Test-Path -LiteralPath $chaserApiSource) {
    Copy-Item -LiteralPath $chaserApiSource -Destination $chaserApiTarget -Force
    Write-Host "Copied chaser API to $chaserApiTarget"
}
if (Test-Path -LiteralPath $motionApiSource) {
    Copy-Item -LiteralPath $motionApiSource -Destination $motionApiTarget -Force
    Write-Host "Copied motion API to $motionApiTarget"
}
if (Test-Path -LiteralPath $groupApiSource) {
    Copy-Item -LiteralPath $groupApiSource -Destination $groupApiTarget -Force
    Write-Host "Copied groups API to $groupApiTarget"
}
if (Test-Path -LiteralPath $sceneApiSource) {
    Copy-Item -LiteralPath $sceneApiSource -Destination $sceneApiTarget -Force
    Write-Host "Copied scenes API to $sceneApiTarget"
}
if (Test-Path -LiteralPath $paletteApiSource) {
    Copy-Item -LiteralPath $paletteApiSource -Destination $paletteApiTarget -Force
    Write-Host "Copied palettes API to $paletteApiTarget"
}
if (Test-Path -LiteralPath $gpioApiSource) {
    Copy-Item -LiteralPath $gpioApiSource -Destination $gpioApiTarget -Force
    Write-Host "Copied GPIO API to $gpioApiTarget"
}
if (Test-Path -LiteralPath $roomPlaneApiSource) {
    Copy-Item -LiteralPath $roomPlaneApiSource -Destination $roomPlaneApiTarget -Force
    Write-Host "Copied room plane API to $roomPlaneApiTarget"
}
if (Test-Path -LiteralPath $fixtureLibraryApiSource) {
    Copy-Item -LiteralPath $fixtureLibraryApiSource -Destination $fixtureLibraryApiTarget -Force
    Write-Host "Copied fixture library API to $fixtureLibraryApiTarget"
}
if (Test-Path -LiteralPath $uiStateSource) {
    Copy-Item -LiteralPath $uiStateSource -Destination $uiStateTarget -Force
    Write-Host "Copied UI state API to $uiStateTarget"
}
if (Test-Path -LiteralPath $appPathsSource) {
    Copy-Item -LiteralPath $appPathsSource -Destination $appPathsTarget -Force
    Write-Host "Copied application paths helper to $appPathsTarget"
}
if (Test-Path -LiteralPath $jsonStoreSource) {
    Copy-Item -LiteralPath $jsonStoreSource -Destination $jsonStoreTarget -Force
    Write-Host "Copied atomic JSON store helper to $jsonStoreTarget"
}
if (Test-Path -LiteralPath $picoDiscoveryApiSource) {
    Copy-Item -LiteralPath $picoDiscoveryApiSource -Destination $picoDiscoveryApiTarget -Force
    Write-Host "Copied Pico discovery API to $picoDiscoveryApiTarget"
}
if (Test-Path -LiteralPath $hostAccessApiSource) {
    Copy-Item -LiteralPath $hostAccessApiSource -Destination $hostAccessApiTarget -Force
    Write-Host "Copied host access API to $hostAccessApiTarget"
}
if (Test-Path -LiteralPath $manualSource) {
    Copy-Item -LiteralPath $manualSource -Destination $manualTarget -Force
    Write-Host "Copied user manual to $manualTarget"
}
if (Test-Path -LiteralPath $manualPdfSource) {
    Copy-Item -LiteralPath $manualPdfSource -Destination $manualPdfTarget -Force
    Write-Host "Copied user manual PDF to $manualPdfTarget"
}
if (Test-Path -LiteralPath $manualNavigationPdfSource) {
    Copy-Item -LiteralPath $manualNavigationPdfSource -Destination $manualNavigationPdfTarget -Force
    Write-Host "Copied navigable user manual PDF to $manualNavigationPdfTarget"
}
if (Test-Path -LiteralPath $manualScreenshotsSource) {
    New-Item -ItemType Directory -Force -Path $manualScreenshotsTarget | Out-Null
    Copy-Item -Path (Join-Path $manualScreenshotsSource "*") -Destination $manualScreenshotsTarget -Force
    Write-Host "Copied user manual screenshots to $manualScreenshotsTarget"
}
if (Test-Path -LiteralPath $versionSource) {
    Copy-Item -LiteralPath $versionSource -Destination $versionTarget -Force
    Write-Host "Copied app version to $versionTarget"
}

$dataFiles = @(
    "fixture_setup.json",
    "fixture_live_values.json",
    "scene_setup.json",
    "palette_setup.json",
    "gpio_setup.json",
    "group_setup.json",
    "chaser_setup.json",
    "motion_setup.json",
    "room_plane_setup.json",
    "ui_state.json"
)
foreach ($dataFile in $dataFiles) {
    $oldPath = Join-Path $targetDir $dataFile
    $newPath = Join-Path $dataTargetDir $dataFile
    if (Test-Path -LiteralPath $oldPath) {
        Move-Item -LiteralPath $oldPath -Destination $newPath -Force
        Write-Host "Moved data file to $newPath"
    }
}

$removedFiles = @(
    (Join-Path $targetDir "dmx_fan.html"),
    (Join-Path $targetDir "fan_setup.php"),
    (Join-Path $dataTargetDir "fan_setup.json"),
    (Join-Path $manualScreenshotsTarget "fan-out.png")
)
foreach ($removedFile in $removedFiles) {
    if (Test-Path -LiteralPath $removedFile) {
        Remove-Item -LiteralPath $removedFile -Force
        Write-Host "Removed obsolete Fan Out file $removedFile"
    }
}

$htaccessTarget = Join-Path $dataTargetDir ".htaccess"
Set-Content -LiteralPath $htaccessTarget -Value "Require all denied" -Encoding ASCII

Write-Host "Copied fixture controller to $target"
Write-Host "Copied setup API to $apiTarget"
Write-Host "Open $BaseUrl"
