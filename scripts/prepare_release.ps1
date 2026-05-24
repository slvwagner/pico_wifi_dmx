param(
    [string]$Version = "",
    [string]$BuildDir = "build",
    [string]$OutDir = "release",
    [switch]$Build,
    [switch]$SkipTests,
    [switch]$AllowDirty,
    [switch]$RunHardwareTests,
    [string]$PicoBaseUrl = ""
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

if (-not $AllowDirty) {
    $dirty = git status --porcelain
    if ($dirty) {
        throw "Working tree has uncommitted changes. Commit/stash them or pass -AllowDirty for a local test package."
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
    tests = @{
        hardware = [bool]$RunHardwareTests
    }
    firmware = @{
        file = $firmwareName
        sizeBytes = (Get-Item -LiteralPath $firmwareOut).Length
        sha256 = $sha256
    }
}
$manifestPath = Join-Path $releaseDir "release-manifest.json"
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding utf8

foreach ($name in @("README.md", "CHANGELOG.md", "LICENSE", "VERSION")) {
    $src = Join-Path $repoRoot $name
    if (Test-Path -LiteralPath $src) {
        Copy-Item -LiteralPath $src -Destination (Join-Path $releaseDir $name) -Force
    }
}

Write-Host ""
Write-Host "Release package ready:"
Write-Host "  $releaseDir"
Write-Host "  $firmwareOut"
Write-Host "  SHA256 $sha256"
