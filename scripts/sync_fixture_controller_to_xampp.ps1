param(
    [string]$XamppHtdocs = "E:\Software\xampp\htdocs",
    [string]$AppFolder = "dmx"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $repoRoot "web"
$apiDir = Join-Path $repoRoot "api"
$docsDir = Join-Path $repoRoot "docs"

$source = Join-Path $webDir "dmx_fixture_controller.html"
$apiSource = Join-Path $apiDir "fixture_setup.php"
$motionSource = Join-Path $webDir "dmx_motion.html"
$chaserSource = Join-Path $webDir "dmx_chaser.html"
$benchSource = Join-Path $webDir "dmx_benchmark.html"
$fanSource       = Join-Path $webDir "dmx_fan.html"
$gpioSource      = Join-Path $webDir "dmx_gpio.html"
$fanApiSource    = Join-Path $apiDir "fan_setup.php"
$chaserApiSource = Join-Path $apiDir "chaser_setup.php"
$motionApiSource = Join-Path $apiDir "motion_setup.php"
$groupApiSource  = Join-Path $apiDir "group_setup.php"
$sceneApiSource  = Join-Path $apiDir "scene_setup.php"
$uiStateSource   = Join-Path $apiDir "ui_state.php"
$manualSource    = Join-Path $docsDir "user-manual.html"
$manualPdfSource = Join-Path $docsDir "user-manual.pdf"
$manualScreenshotsSource = Join-Path $docsDir "screenshots"
$targetDir = Join-Path $XamppHtdocs $AppFolder
$benchTargetDir = Join-Path $targetDir "test"
$dataTargetDir = Join-Path $targetDir "data"
$target = Join-Path $targetDir "index.html"
$apiTarget = Join-Path $targetDir "fixture_setup.php"
$motionTarget = Join-Path $targetDir "dmx_motion.html"
$chaserTarget = Join-Path $targetDir "dmx_chaser.html"
$benchTarget = Join-Path $benchTargetDir "index.html"
$fanTarget       = Join-Path $targetDir "dmx_fan.html"
$gpioTarget      = Join-Path $targetDir "dmx_gpio.html"
$fanApiTarget    = Join-Path $targetDir "fan_setup.php"
$chaserApiTarget = Join-Path $targetDir "chaser_setup.php"
$motionApiTarget = Join-Path $targetDir "motion_setup.php"
$groupApiTarget  = Join-Path $targetDir "group_setup.php"
$sceneApiTarget  = Join-Path $targetDir "scene_setup.php"
$uiStateTarget   = Join-Path $targetDir "ui_state.php"
$manualTarget    = Join-Path $targetDir "user-manual.html"
$manualPdfTarget = Join-Path $targetDir "user-manual.pdf"
$manualScreenshotsTarget = Join-Path $targetDir "screenshots"

if (-not (Test-Path -LiteralPath $source)) {
    throw "Source file not found: $source"
}

if (-not (Test-Path -LiteralPath $apiSource)) {
    throw "API file not found: $apiSource"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
New-Item -ItemType Directory -Force -Path $dataTargetDir | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force
Copy-Item -LiteralPath $apiSource -Destination $apiTarget -Force
if (Test-Path -LiteralPath $motionSource) {
    Copy-Item -LiteralPath $motionSource -Destination $motionTarget -Force
    Write-Host "Copied motion effects to $motionTarget"
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
if (Test-Path -LiteralPath $fanSource) {
    Copy-Item -LiteralPath $fanSource -Destination $fanTarget -Force
    Write-Host "Copied fan out to $fanTarget"
}
if (Test-Path -LiteralPath $gpioSource) {
    Copy-Item -LiteralPath $gpioSource -Destination $gpioTarget -Force
    Write-Host "Copied GPIO control to $gpioTarget"
}
if (Test-Path -LiteralPath $fanApiSource) {
    Copy-Item -LiteralPath $fanApiSource -Destination $fanApiTarget -Force
    Write-Host "Copied fan API to $fanApiTarget"
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
if (Test-Path -LiteralPath $uiStateSource) {
    Copy-Item -LiteralPath $uiStateSource -Destination $uiStateTarget -Force
    Write-Host "Copied UI state API to $uiStateTarget"
}
if (Test-Path -LiteralPath $manualSource) {
    Copy-Item -LiteralPath $manualSource -Destination $manualTarget -Force
    Write-Host "Copied user manual to $manualTarget"
}
if (Test-Path -LiteralPath $manualPdfSource) {
    Copy-Item -LiteralPath $manualPdfSource -Destination $manualPdfTarget -Force
    Write-Host "Copied user manual PDF to $manualPdfTarget"
}
if (Test-Path -LiteralPath $manualScreenshotsSource) {
    New-Item -ItemType Directory -Force -Path $manualScreenshotsTarget | Out-Null
    Copy-Item -Path (Join-Path $manualScreenshotsSource "*") -Destination $manualScreenshotsTarget -Force
    Write-Host "Copied user manual screenshots to $manualScreenshotsTarget"
}

$dataFiles = @(
    "fixture_setup.json",
    "fixture_live_values.json",
    "scene_setup.json",
    "group_setup.json",
    "fan_setup.json",
    "chaser_setup.json",
    "motion_setup.json",
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

$htaccessTarget = Join-Path $dataTargetDir ".htaccess"
Set-Content -LiteralPath $htaccessTarget -Value "Require all denied" -Encoding ASCII

Write-Host "Copied fixture controller to $target"
Write-Host "Copied setup API to $apiTarget"
Write-Host "Open http://localhost/$AppFolder/"
