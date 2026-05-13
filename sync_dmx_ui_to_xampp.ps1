param(
    [string]$XamppHtdocs = "E:\Software\xampp\htdocs",
    [string]$AppFolder = "dmx"
)

$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "dmx_16bit_prototype.html"
$targetDir = Join-Path $XamppHtdocs $AppFolder
$target = Join-Path $targetDir "index.html"

if (-not (Test-Path -LiteralPath $source)) {
    throw "Source file not found: $source"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force

Write-Host "Copied DMX UI to $target"
Write-Host "Open http://localhost/$AppFolder/"
