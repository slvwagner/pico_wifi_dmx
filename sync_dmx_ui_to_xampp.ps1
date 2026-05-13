param(
    [string]$XamppHtdocs = "E:\Software\xampp\htdocs",
    [string]$AppFolder = "dmx"
)

$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "dmx_16bit_prototype.html"
$apiSource = Join-Path $PSScriptRoot "dmx_setup.php"
$targetDir = Join-Path $XamppHtdocs $AppFolder
$target = Join-Path $targetDir "index.html"
$apiTarget = Join-Path $targetDir "dmx_setup.php"

if (-not (Test-Path -LiteralPath $source)) {
    throw "Source file not found: $source"
}

if (-not (Test-Path -LiteralPath $apiSource)) {
    throw "API file not found: $apiSource"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force
Copy-Item -LiteralPath $apiSource -Destination $apiTarget -Force

Write-Host "Copied DMX UI to $target"
Write-Host "Copied setup API to $apiTarget"
Write-Host "Open http://localhost/$AppFolder/"
