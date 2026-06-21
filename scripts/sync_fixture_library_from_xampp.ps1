param(
    [string]$XamppHtdocs = "",
    [string]$AppFolder = "",
    [string]$SourcePath = "",
    [string]$OutputPath = "web/assets/fixture-library.json"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "local_path_config.ps1")
$localPaths = Get-LocalPathConfig -RepoRoot $repoRoot
if (-not $XamppHtdocs) { $XamppHtdocs = $localPaths.xamppHtdocs }
if (-not $AppFolder) { $AppFolder = $localPaths.appFolder }

if (-not $SourcePath) {
    $SourcePath = Join-Path (Join-Path (Join-Path $XamppHtdocs $AppFolder) "data") "fixture_library.json"
}
if (-not [System.IO.Path]::IsPathRooted($SourcePath)) {
    $SourcePath = Join-Path $repoRoot $SourcePath
}
if (-not [System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath = Join-Path $repoRoot $OutputPath
}

if (-not (Test-Path -LiteralPath $SourcePath)) {
    throw "XAMPP fixture library not found: $SourcePath"
}

$raw = Get-Content -LiteralPath $SourcePath -Raw
try {
    $library = $raw | ConvertFrom-Json -Depth 100
} catch {
    throw "Fixture library is not valid JSON: $SourcePath. $($_.Exception.Message)"
}

if ($null -eq $library.schemaVersion) {
    throw "Fixture library is missing schemaVersion."
}
if (-not ($library.fixtures -is [System.Collections.IEnumerable]) -or $library.fixtures -is [string]) {
    throw "Fixture library must contain a fixtures array."
}

$fixtures = @($library.fixtures)
if ($fixtures.Count -lt 1) {
    throw "Fixture library fixtures array is empty."
}
if ($null -eq $library.fixtureCount) {
    throw "Fixture library is missing fixtureCount."
}
if ([int]$library.fixtureCount -ne $fixtures.Count) {
    throw "Fixture library fixtureCount ($($library.fixtureCount)) does not match fixtures array count ($($fixtures.Count))."
}

$keys = @{}
foreach ($fixture in $fixtures) {
    if (-not $fixture.key) {
        throw "Fixture library contains a fixture without key."
    }
    $key = [string]$fixture.key
    if ($keys.ContainsKey($key)) {
        throw "Fixture library contains duplicate fixture key: $key"
    }
    $keys[$key] = $true
    if (-not ($fixture.modes -is [System.Collections.IEnumerable]) -or $fixture.modes -is [string]) {
        throw "Fixture '$key' must contain a modes array."
    }
}

$normalized = [ordered]@{
    schemaVersion = [int]$library.schemaVersion
    source = if ($library.source) { [string]$library.source } else { "Imported fixture library" }
    generatedAt = if ($library.generatedAt) { [string]$library.generatedAt } else { (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ") }
    fixtureCount = $fixtures.Count
    fixtures = $fixtures
}

$outputDir = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

$normalized | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $OutputPath -Encoding utf8

Write-Host "Synced fixture library:"
Write-Host "  From: $SourcePath"
Write-Host "  To:   $OutputPath"
Write-Host "  Fixtures: $($fixtures.Count)"
