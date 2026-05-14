param(
    [string]$XamppHtdocs = "E:\Software\xampp\htdocs",
    [string]$AppFolder = "dmx-fixtures"
)

$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "dmx_fixture_controller.html"
$apiSource = Join-Path $PSScriptRoot "fixture_setup.php"
$motionSource = Join-Path $PSScriptRoot "dmx_motion.html"
$chaserSource = Join-Path $PSScriptRoot "dmx_chaser.html"
$targetDir = Join-Path $XamppHtdocs $AppFolder
$target = Join-Path $targetDir "index.html"
$apiTarget = Join-Path $targetDir "fixture_setup.php"
$motionTarget = Join-Path $targetDir "dmx_motion.html"
$chaserTarget = Join-Path $targetDir "dmx_chaser.html"

if (-not (Test-Path -LiteralPath $source)) {
    throw "Source file not found: $source"
}

if (-not (Test-Path -LiteralPath $apiSource)) {
    throw "API file not found: $apiSource"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
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

Write-Host "Copied fixture controller to $target"
Write-Host "Copied setup API to $apiTarget"
Write-Host "Open http://localhost/$AppFolder/"
