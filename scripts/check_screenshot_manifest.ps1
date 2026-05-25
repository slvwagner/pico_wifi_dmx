param(
    [string]$ManifestPath = "docs/screenshot-manifest.json",
    [string]$ScreenshotsDir = "docs/screenshots",
    [switch]$RequireFiles
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$manifestFullPath = Join-Path $repoRoot $ManifestPath
$screenshotsFullPath = Join-Path $repoRoot $ScreenshotsDir

if (-not (Test-Path -LiteralPath $manifestFullPath)) {
    throw "Screenshot manifest not found: $manifestFullPath"
}

$manifest = Get-Content -LiteralPath $manifestFullPath -Raw | ConvertFrom-Json
if (-not $manifest.screenshots -or $manifest.screenshots.Count -eq 0) {
    throw "Screenshot manifest has no screenshots: $manifestFullPath"
}

$entries = @($manifest.screenshots)
$files = @($entries | ForEach-Object { $_.file })
$duplicates = @($files | Group-Object | Where-Object { $_.Count -gt 1 })
if ($duplicates.Count) {
    $message = ($duplicates | ForEach-Object { "{0} ({1} entries)" -f $_.Name, $_.Count }) -join ", "
    throw "Duplicate screenshot manifest entries: $message"
}

foreach ($entry in $entries) {
    if (-not $entry.file -or -not $entry.owner -or -not $entry.purpose) {
        throw "Screenshot manifest entries must include file, owner, and purpose."
    }
}

$knownFiles = @{}
foreach ($file in $files) {
    $knownFiles[$file] = $true
}

function Get-GeneratedScreenshotNames {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return @() }
    $text = Get-Content -LiteralPath $Path -Raw
    $matches = [regex]::Matches($text, '"([^"]+\.png)"')
    return @($matches | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -notmatch "[\\/]" })
}

$generatorFiles = @(
    "scripts/capture_readme_screenshots.ps1",
    "scripts/capture_chaser_screenshot.ps1",
    "scripts/update_user_manual.ps1"
)

$generated = @()
foreach ($relativePath in $generatorFiles) {
    $path = Join-Path $repoRoot $relativePath
    foreach ($name in (Get-GeneratedScreenshotNames -Path $path)) {
        $generated += [pscustomobject]@{
            File = $name
            Owner = $relativePath
        }
    }
}

$generatedDuplicates = @($generated | Group-Object File | Where-Object { $_.Count -gt 1 })
if ($generatedDuplicates.Count) {
    $message = ($generatedDuplicates | ForEach-Object {
        $owners = ($_.Group | ForEach-Object { $_.Owner } | Sort-Object -Unique) -join ", "
        "{0} written by {1}" -f $_.Name, $owners
    }) -join "; "
    throw "Duplicate generated screenshot filenames: $message"
}

$unregisteredGenerated = @($generated | Where-Object { -not $knownFiles.ContainsKey($_.File) })
if ($unregisteredGenerated.Count) {
    $message = ($unregisteredGenerated | ForEach-Object { "{0} ({1})" -f $_.File, $_.Owner }) -join ", "
    throw "Generated screenshots missing from manifest: $message"
}

$generatedLookup = @{}
foreach ($item in $generated) {
    $generatedLookup[$item.File] = $item.Owner
}

$notGenerated = @($entries | Where-Object { -not $generatedLookup.ContainsKey($_.file) })
if ($notGenerated.Count) {
    $message = ($notGenerated | ForEach-Object { $_.file }) -join ", "
    throw "Manifest screenshots are not produced by a known capture script: $message"
}

function Get-ReferencedScreenshotNames {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return @() }
    $text = Get-Content -LiteralPath $Path -Raw
    $matches = [regex]::Matches($text, "(?:docs/)?screenshots/([A-Za-z0-9_.-]+\.png)")
    return @($matches | ForEach-Object { $_.Groups[1].Value })
}

$referenceFiles = @("README.md", "docs/user-manual.md")
$referenced = @()
foreach ($relativePath in $referenceFiles) {
    $path = Join-Path $repoRoot $relativePath
    foreach ($name in (Get-ReferencedScreenshotNames -Path $path)) {
        $referenced += [pscustomobject]@{
            File = $name
            Source = $relativePath
        }
    }
}

$unregisteredRefs = @($referenced | Where-Object { -not $knownFiles.ContainsKey($_.File) })
if ($unregisteredRefs.Count) {
    $message = ($unregisteredRefs | ForEach-Object { "{0} ({1})" -f $_.File, $_.Source }) -join ", "
    throw "Referenced screenshots missing from manifest: $message"
}

if ($RequireFiles) {
    $missingFiles = @($entries | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $screenshotsFullPath $_.file))
    })
    if ($missingFiles.Count) {
        $message = ($missingFiles | ForEach-Object { $_.file }) -join ", "
        throw "Manifest screenshots missing from ${screenshotsFullPath}: $message"
    }
}

Write-Host ("Screenshot manifest OK: {0} unique outputs, {1} references." -f $entries.Count, $referenced.Count)
