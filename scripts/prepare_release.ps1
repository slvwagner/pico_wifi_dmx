param(
    [string]$Version = "",
    [string]$BuildDir = "build",
    [string]$OutDir = "release",
    [switch]$Build,
    [switch]$SkipManual,
    [switch]$SkipTests,
    [switch]$AllowDirty,
    [switch]$RunHardwareTests,
    [string]$PicoBaseUrl = "",
    [string]$XamppHtdocs = "",
    [string]$AppFolder = "",
    [string]$BaseUrl = "",
    [string]$ChromePath = "",
    [string]$ScreenshotBaseUrl = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

function Invoke-Step($Name, [scriptblock]$Action) {
    Write-Host ""
    Write-Host "== $Name =="
    & $Action
}

function Invoke-Native([string]$Name, [scriptblock]$Action) {
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE."
    }
}

function Get-FileSha256($Path) {
    (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function ConvertTo-ManifestTimestampString($Value) {
    if ($Value -is [datetime]) {
        return $Value.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
    return [string]$Value
}

function ConvertTo-ComparableReleaseManifest($ManifestObject) {
    $docs = [ordered]@{}
    if ($ManifestObject.docs) {
        foreach ($name in @("user-manual.md", "user-manual.html", "user-manual-print.html", "user-manual.pdf", "screenshots")) {
            if ($ManifestObject.docs.PSObject.Properties.Name -contains $name) {
                $entry = $ManifestObject.docs.$name
                if ($name -eq "screenshots") {
                    $docs[$name] = [ordered]@{ count = [int]$entry.count }
                } else {
                    $docs[$name] = [ordered]@{
                        sizeBytes = [int64]$entry.sizeBytes
                        sha256 = [string]$entry.sha256
                    }
                }
            } elseif ($ManifestObject.docs.Contains($name)) {
                $entry = $ManifestObject.docs[$name]
                if ($name -eq "screenshots") {
                    $docs[$name] = [ordered]@{ count = [int]$entry.count }
                } else {
                    $docs[$name] = [ordered]@{
                        sizeBytes = [int64]$entry.sizeBytes
                        sha256 = [string]$entry.sha256
                    }
                }
            }
        }
    }

    return [ordered]@{
        version = [string]$ManifestObject.version
        branch = [string]$ManifestObject.branch
        tests = [ordered]@{ hardware = [bool]$ManifestObject.tests.hardware }
        docsGenerated = [bool]$ManifestObject.docsGenerated
        firmware = [ordered]@{
            file = [string]$ManifestObject.firmware.file
            sizeBytes = [int64]$ManifestObject.firmware.sizeBytes
            sha256 = [string]$ManifestObject.firmware.sha256
        }
        docs = $docs
    } | ConvertTo-Json -Depth 6 -Compress
}

function Resolve-CommandPath($Name, [string[]]$Fallbacks) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }
    foreach ($candidate in $Fallbacks) {
        $expanded = [Environment]::ExpandEnvironmentVariables($candidate)
        if (Test-Path -LiteralPath $expanded) {
            return $expanded
        }
    }
    throw "Could not find $Name. Add it to PATH or install the Pico/VS Code build tools."
}

$cmakeExe = Resolve-CommandPath "cmake" @(
    "%USERPROFILE%\.pico-sdk\cmake\v3.31.5\bin\cmake.exe",
    "C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe",
    "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
)

if (-not $Version) {
    $versionFile = Join-Path $repoRoot "VERSION"
    if (-not (Test-Path -LiteralPath $versionFile)) {
        throw "VERSION file not found. Pass -Version or create VERSION."
    }
    $Version = (Get-Content -LiteralPath $versionFile -Raw).Trim()
}

if (-not ($Version -match '^\d+\.\d+\.\d+([-.][A-Za-z0-9.]+)?$')) {
    throw "Version '$Version' does not look like SemVer, for example 0.9.0."
}

$cmakePath = Join-Path $repoRoot "CMakeLists.txt"
$cmake = Get-Content -LiteralPath $cmakePath -Raw
if ($cmake -notmatch 'pico_set_program_version\(pico_wifi_dmx\s+"([^"]+)"\)') {
    throw "Could not find pico_set_program_version(...) in CMakeLists.txt."
}
$firmwareVersion = $Matches[1]
if ($firmwareVersion -ne $Version) {
    throw "Version mismatch: VERSION is '$Version' but CMake firmware version is '$firmwareVersion'. Update both before release."
}

if (-not $SkipManual) {
    Invoke-Step "Regenerate manual, PDF, and screenshots" {
        $manualArgs = @{}
        if ($XamppHtdocs) { $manualArgs.XamppHtdocs = $XamppHtdocs }
        if ($AppFolder) { $manualArgs.AppFolder = $AppFolder }
        if ($BaseUrl) { $manualArgs.BaseUrl = $BaseUrl }
        if ($ChromePath) { $manualArgs.ChromePath = $ChromePath }
        if ($ScreenshotBaseUrl) { $manualArgs.ScreenshotBaseUrl = $ScreenshotBaseUrl }
        & (Join-Path $PSScriptRoot "update_user_manual.ps1") @manualArgs
    }
}

if (-not $AllowDirty) {
    $dirty = git status --porcelain
    if ($dirty) {
        throw "Working tree has uncommitted changes. Commit/stash them or pass -AllowDirty for a local test package. If the manual step changed generated docs/screenshots, review and commit those release assets first."
    }
}

if ($Build) {
    Invoke-Step "Build firmware" {
        Invoke-Native "Firmware build" { & $cmakeExe --build $BuildDir }
    }
}

if ($RunHardwareTests -and -not $SkipTests) {
    Invoke-Step "Enable real Pico hardware tests" {
        $localConfig = Join-Path $repoRoot "tests\pathconfig.local.json"
        $exampleConfig = Join-Path $repoRoot "tests\pathconfig.example.json"
        if (-not (Test-Path -LiteralPath $localConfig)) {
            if (-not (Test-Path -LiteralPath $exampleConfig)) {
                throw "Could not find tests\pathconfig.example.json to initialize hardware test config."
            }
            Copy-Item -LiteralPath $exampleConfig -Destination $localConfig
            Write-Host "Created tests\pathconfig.local.json from tests\pathconfig.example.json"
        } else {
            Write-Host "Using existing tests\pathconfig.local.json"
        }

        if ($PicoBaseUrl) {
            $env:DMX_PICO_BASE_URL = $PicoBaseUrl
            Write-Host "Using Pico base URL from -PicoBaseUrl: $PicoBaseUrl"
        }
        $env:DMX_RUN_HARDWARE_TESTS = "true"

        $config = Get-Content -LiteralPath $localConfig -Raw | ConvertFrom-Json
        $effectivePicoBaseUrl = if ($PicoBaseUrl) { $PicoBaseUrl } else { [string]$config.picoBaseUrl }
        if (-not $effectivePicoBaseUrl) {
            throw "Hardware tests requested, but Pico base URL is empty. Set tests\pathconfig.local.json picoBaseUrl or pass -PicoBaseUrl."
        }
        Write-Host "Hardware tests enabled for $effectivePicoBaseUrl"
    }
}

if (-not $SkipTests) {
    Invoke-Step "Run UI regression tests" {
        Invoke-Native "UI regression tests" { npm run test:ui }
    }
}

$uf2Path = Resolve-Path -LiteralPath (Join-Path $BuildDir "pico_wifi_dmx.uf2") -ErrorAction SilentlyContinue
if (-not $uf2Path) {
    throw "Firmware UF2 not found at '$BuildDir\pico_wifi_dmx.uf2'. Build the firmware first or pass -Build."
}

$releaseDir = Join-Path $OutDir "v$Version"
if (-not (Test-Path -LiteralPath $releaseDir)) {
    New-Item -ItemType Directory -Path $releaseDir | Out-Null
}

$firmwareName = "pico_wifi_dmx-v$Version.uf2"
$firmwareOut = Join-Path $releaseDir $firmwareName
Copy-Item -LiteralPath $uf2Path.Path -Destination $firmwareOut -Force

$sha256 = Get-FileSha256 $firmwareOut
$shaPath = "$firmwareOut.sha256"
"$sha256  $firmwareName" | Set-Content -LiteralPath $shaPath -Encoding ascii

$commit = (git rev-parse --short HEAD).Trim()
$branch = (git branch --show-current).Trim()
$manifest = [ordered]@{
    version = $Version
    branch = $branch
    commit = $commit
    createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    tests = [ordered]@{
        hardware = [bool]$RunHardwareTests
    }
    docsGenerated = -not [bool]$SkipManual
    firmware = [ordered]@{
        file = $firmwareName
        sizeBytes = (Get-Item -LiteralPath $firmwareOut).Length
        sha256 = $sha256
    }
    docs = [ordered]@{}
}

foreach ($name in @("README.md", "CHANGELOG.md", "LICENSE", "VERSION")) {
    $src = Join-Path $repoRoot $name
    if (Test-Path -LiteralPath $src) {
        Copy-Item -LiteralPath $src -Destination (Join-Path $releaseDir $name) -Force
    }
}

$docsOutDir = Join-Path $releaseDir "docs"
if (-not (Test-Path -LiteralPath $docsOutDir)) {
    New-Item -ItemType Directory -Path $docsOutDir | Out-Null
}

$manualFiles = @(
    "user-manual.md",
    "user-manual.html",
    "user-manual-print.html",
    "user-manual.pdf"
)
foreach ($name in $manualFiles) {
    $src = Join-Path (Join-Path $repoRoot "docs") $name
    if (Test-Path -LiteralPath $src) {
        $dst = Join-Path $docsOutDir $name
        Copy-Item -LiteralPath $src -Destination $dst -Force
        $manifest.docs[$name] = [ordered]@{
            sizeBytes = (Get-Item -LiteralPath $dst).Length
            sha256 = Get-FileSha256 $dst
        }
    }
}

$screenshotsSrc = Join-Path (Join-Path $repoRoot "docs") "screenshots"
$screenshotsOut = Join-Path $docsOutDir "screenshots"
if (Test-Path -LiteralPath $screenshotsSrc) {
    New-Item -ItemType Directory -Force -Path $screenshotsOut | Out-Null
    Copy-Item -Path (Join-Path $screenshotsSrc "*") -Destination $screenshotsOut -Force
    $screenshotCount = (Get-ChildItem -LiteralPath $screenshotsOut -File | Measure-Object).Count
    $manifest.docs["screenshots"] = [ordered]@{
        count = $screenshotCount
    }
}

$manifestPath = Join-Path $releaseDir "release-manifest.json"
$manifestUnchanged = $false
if (Test-Path -LiteralPath $manifestPath) {
    try {
        $existingManifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        $existingComparable = ConvertTo-ComparableReleaseManifest $existingManifest
        $newComparable = ConvertTo-ComparableReleaseManifest ([pscustomobject]$manifest)
        if ($existingComparable -eq $newComparable) {
            $manifest.commit = [string]$existingManifest.commit
            $manifest.createdAt = ConvertTo-ManifestTimestampString $existingManifest.createdAt
            $manifestUnchanged = $true
        }
    } catch {
        Write-Warning "Could not compare existing release manifest; rewriting it. $($_.Exception.Message)"
    }
}
if ($manifestUnchanged) {
    Write-Host "Release manifest unchanged."
} else {
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding utf8
}

Write-Host ""
Write-Host "Release package ready:"
Write-Host "  $releaseDir"
Write-Host "  $firmwareOut"
Write-Host "  SHA256 $sha256"
