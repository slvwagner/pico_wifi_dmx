param(
    [string]$Version = "",
    [string]$BuildDir = "build-release",
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
    [string]$ScreenshotBaseUrl = "",
    [string]$TestAppFolder = "dmx-test",
    [string]$TestBaseUrl = "http://localhost/dmx-test/",
    [switch]$SkipTestAppSync,
    [switch]$SkipWindowsInstaller,
    [switch]$SkipDebianInstaller,
    [string]$WslDistribution = "",
    [string]$WslPicotoolPath = "",
    [string]$WindowsSigningCertificateThumbprint = "",
    [string]$WindowsSignToolPath = "",
    [ValidateSet("Fast", "Small")]
    [string]$WindowsInstallerCompression = "Small"
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

function ConvertTo-ComparableFirmwareEntry($Entry) {
    if (-not $Entry) {
        return $null
    }
    return [ordered]@{
        file = [string]$Entry.file
        sizeBytes = [int64]$Entry.sizeBytes
        sha256 = [string]$Entry.sha256
    }
}

function ConvertTo-ComparableInstallerEntry($Entry) {
    if (-not $Entry) {
        return $null
    }
    return [ordered]@{
        file = [string]$Entry.file
        sizeBytes = [int64]$Entry.sizeBytes
        sha256 = [string]$Entry.sha256
        signed = [bool]$Entry.signed
    }
}

function ConvertTo-ComparablePackageEntry($Entry) {
    if (-not $Entry) {
        return $null
    }
    return [ordered]@{
        file = [string]$Entry.file
        architecture = [string]$Entry.architecture
        sizeBytes = [int64]$Entry.sizeBytes
        sha256 = [string]$Entry.sha256
    }
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
        foreach ($name in @("user-manual.md", "user-manual.html", "user-manual-print.html", "user-manual.pdf", "user-manual-navigation.pdf", "screenshots")) {
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
            } elseif (
                $ManifestObject.docs -is [System.Collections.IDictionary] -and
                $ManifestObject.docs.Contains($name)
            ) {
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
        firmware = ConvertTo-ComparableFirmwareEntry $ManifestObject.firmware
        wifiFirmware = ConvertTo-ComparableFirmwareEntry $ManifestObject.wifiFirmware
        wifiFirmwareTbyb = ConvertTo-ComparableFirmwareEntry $ManifestObject.wifiFirmwareTbyb
        windowsInstaller = ConvertTo-ComparableInstallerEntry $ManifestObject.windowsInstaller
        debianInstaller = ConvertTo-ComparablePackageEntry $ManifestObject.debianInstaller
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
$ninjaExe = Resolve-CommandPath "ninja" @(
    "%USERPROFILE%\.pico-sdk\ninja\v1.12.1\ninja.exe"
)

$versionFile = Join-Path $repoRoot "VERSION"
if (-not (Test-Path -LiteralPath $versionFile)) {
    throw "VERSION file not found. It is the canonical application and firmware version."
}
$repositoryVersion = (Get-Content -LiteralPath $versionFile -Raw).Trim()
if (-not $Version) {
    $Version = $repositoryVersion
} elseif ($Version -ne $repositoryVersion) {
    throw "Version mismatch: -Version is '$Version' but VERSION contains '$repositoryVersion'."
}

if (-not ($Version -match '^\d+\.\d+\.\d+([-.][A-Za-z0-9.]+)?$')) {
    throw "Version '$Version' does not look like SemVer, for example 0.9.0."
}

$cmakePath = Join-Path $repoRoot "CMakeLists.txt"
$cmake = Get-Content -LiteralPath $cmakePath -Raw
if ($cmake -notmatch 'file\s*\(\s*READ\s+"\$\{CMAKE_CURRENT_LIST_DIR\}/VERSION"\s+PICO_DMX_VERSION\s*\)') {
    throw "CMakeLists.txt must read VERSION into PICO_DMX_VERSION."
}
if ($cmake -notmatch 'pico_set_program_version\s*\(\s*pico_wifi_dmx\s+"\$\{PICO_DMX_VERSION\}"\s*\)') {
    throw "CMakeLists.txt must use PICO_DMX_VERSION as the Pico program version."
}
if ($cmake -match 'WIFI_(?:SSID|PASSWORD)') {
    throw "CMakeLists.txt must not contain compile-time Wi-Fi credentials. Provision them through the dedicated data partition."
}
$compileCommandsPath = Join-Path $repoRoot (Join-Path $BuildDir "compile_commands.json")
$cmakeCachePath = Join-Path $repoRoot (Join-Path $BuildDir "CMakeCache.txt")
if ((-not $Build) -and (Test-Path -LiteralPath $cmakeCachePath) -and
    ((Get-Content -LiteralPath $cmakeCachePath -Raw) -match '(?m)^WIFI_(?:SSID|PASSWORD):')) {
    throw "The selected build cache still stores legacy compile-time Wi-Fi credentials. Reconfigure it before preparing a release."
}
if ((-not $Build) -and (Test-Path -LiteralPath $compileCommandsPath) -and
    ((Get-Content -LiteralPath $compileCommandsPath -Raw) -match '(?:-D|/D)WIFI_(?:SSID|PASSWORD)=')) {
    throw "The selected build directory contains compile-time Wi-Fi credentials. Reconfigure it before preparing a release."
}

if (-not $SkipManual) {
    Invoke-Step "Regenerate manual, PDF, and screenshots" {
        # Release preparation must never deploy generated documentation or source
        # files into the user's protected live XAMPP application.
        $manualArgs = @{ LocalOnly = $true }
        if ($XamppHtdocs) { $manualArgs.XamppHtdocs = $XamppHtdocs }
        if ($AppFolder) { $manualArgs.AppFolder = $AppFolder }
        if ($BaseUrl) { $manualArgs.BaseUrl = $BaseUrl }
        if ($ChromePath) { $manualArgs.ChromePath = $ChromePath }
        if ($ScreenshotBaseUrl) { $manualArgs.ScreenshotBaseUrl = $ScreenshotBaseUrl }
        & (Join-Path $PSScriptRoot "build_user_manual.ps1") @manualArgs
    }
}

if (-not $AllowDirty) {
    $dirty = git status --porcelain
    if ($dirty) {
        throw "Working tree has uncommitted changes. Commit/stash them or pass -AllowDirty for a local test package. If the manual step changed generated docs/screenshots, review and commit those release assets first."
    }
}

if ($Build) {
    Invoke-Step "Configure release firmware" {
        Invoke-Native "Firmware release configuration" {
            & $cmakeExe -G "Ninja" "-DCMAKE_MAKE_PROGRAM=$ninjaExe" -U WIFI_SSID -U WIFI_PASSWORD -S $repoRoot -B $BuildDir -DCMAKE_BUILD_TYPE=Release
        }
    }
    if ((Get-Content -LiteralPath $compileCommandsPath -Raw) -match '(?:-D|/D)WIFI_(?:SSID|PASSWORD)=') {
        throw "The configured firmware still contains compile-time Wi-Fi credentials."
    }
    Invoke-Step "Build release firmware" {
        Invoke-Native "Firmware release build" {
            & $cmakeExe --build $BuildDir --config Release
        }
    }
}

if (-not $RunHardwareTests) {
    # A developer may keep hardware tests enabled in pathconfig.local.json or in
    # their shell. Release preparation must remain opt-in so a normal release
    # cannot write DMX channels or playback slots on a connected Pico.
    $env:DMX_RUN_HARDWARE_TESTS = "false"
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

        $config = Get-Content -LiteralPath $localConfig -Raw | ConvertFrom-Json
        $effectivePicoBaseUrl = if ($PicoBaseUrl) { $PicoBaseUrl } else { [string]$config.picoBaseUrl }
        if (-not $effectivePicoBaseUrl) {
            throw "Hardware tests requested, but Pico base URL is empty. Set tests\pathconfig.local.json picoBaseUrl or pass -PicoBaseUrl."
        }
        Write-Host "Hardware tests enabled for $effectivePicoBaseUrl"
    }
}

if (-not $SkipTests) {
    if (-not $SkipTestAppSync) {
        Invoke-Step "Sync isolated test app to XAMPP" {
            $testSyncArgs = @{}
            if ($XamppHtdocs) { $testSyncArgs.XamppHtdocs = $XamppHtdocs }
            if ($TestAppFolder) { $testSyncArgs.AppFolder = $TestAppFolder }
            if ($TestBaseUrl) { $testSyncArgs.BaseUrl = $TestBaseUrl }
            & (Join-Path $PSScriptRoot "sync_test_app_to_xampp.ps1") @testSyncArgs
        }
    }

    Invoke-Step "Run UI regression tests" {
        # Keep real hardware out of the parallel browser suite. Running it in a
        # dedicated serial step prevents unrelated UI workers from disturbing
        # playback state and timing measurements on the physical Pico.
        $env:DMX_RUN_HARDWARE_TESTS = "false"
        # UI specs share the isolated XAMPP JSON stores and intentionally write
        # test setup. Keep the release gate serial so one spec cannot replace
        # another spec's fixtures or Show layout while assertions are running.
        Invoke-Native "UI regression tests" { npm run test:ui -- --workers=1 }
    }

    if ($RunHardwareTests) {
        Invoke-Step "Run real Pico hardware tests" {
            $env:DMX_RUN_HARDWARE_TESTS = "true"
            try {
                Invoke-Native "Pico hardware tests" { npm run test:pico }
            } finally {
                $env:DMX_RUN_HARDWARE_TESTS = "false"
            }
        }
    }
}

$artifactSpecs = @(
    [ordered]@{
        key = "firmware"
        sourceName = "pico_wifi_dmx.uf2"
        releaseName = "pico_wifi_dmx-v$Version.uf2"
    },
    [ordered]@{
        key = "wifiFirmware"
        sourceName = "pico_wifi_dmx_wifi_firmware.uf2"
        releaseName = "pico_wifi_dmx-wifi-firmware-v$Version.uf2"
    },
    [ordered]@{
        key = "wifiFirmwareTbyb"
        sourceName = "pico_wifi_dmx_wifi_firmware_tbyb.uf2"
        releaseName = "pico_wifi_dmx-wifi-firmware-tbyb-v$Version.uf2"
    }
)

foreach ($artifact in $artifactSpecs) {
    $artifact.sourcePath = Resolve-Path -LiteralPath (Join-Path $BuildDir $artifact.sourceName) -ErrorAction SilentlyContinue
    if (-not $artifact.sourcePath) {
        throw "Required UF2 not found at '$BuildDir\$($artifact.sourceName)'. Build the firmware with Pico SDK 2.3.0 first or pass -Build."
    }
}

$releaseDir = Join-Path $OutDir "v$Version"
if (-not (Test-Path -LiteralPath $releaseDir)) {
    New-Item -ItemType Directory -Path $releaseDir | Out-Null
}

$windowsInstaller = $null
$isWindowsHost = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
if ($isWindowsHost -and -not $SkipWindowsInstaller) {
    Invoke-Step "Build Windows customer installer" {
        $installerArgs = @{
            OutputDir = $releaseDir
            ApplicationUf2 = (Join-Path $BuildDir "pico_wifi_dmx.uf2")
            WifiFirmwareUf2 = (Join-Path $BuildDir "pico_wifi_dmx_wifi_firmware.uf2")
            Compression = $WindowsInstallerCompression
        }
        if ($WindowsSigningCertificateThumbprint) {
            $installerArgs.SigningCertificateThumbprint = $WindowsSigningCertificateThumbprint
        }
        if ($WindowsSignToolPath) {
            $installerArgs.SignToolPath = $WindowsSignToolPath
        }
        & (Join-Path $repoRoot "installer\windows\build_installer.ps1") @installerArgs
    }

    $installerName = "wifi-pico-dmx-$Version-windows-x64.exe"
    $installerPath = Join-Path $releaseDir $installerName
    if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) {
        throw "Windows installer build completed without producing '$installerPath'."
    }
    $installerSha256 = Get-FileSha256 $installerPath
    $windowsInstaller = [ordered]@{
        file = $installerName
        sizeBytes = (Get-Item -LiteralPath $installerPath).Length
        sha256 = $installerSha256
        signed = [bool]$WindowsSigningCertificateThumbprint
    }
} elseif ($isWindowsHost) {
    Write-Host "Skipping Windows installer because -SkipWindowsInstaller was supplied."
} else {
    Write-Host "Skipping Windows installer because this release is running on a non-Windows host."
}

$debianInstaller = $null
if ($isWindowsHost -and -not $SkipDebianInstaller) {
    Invoke-Step "Assemble Debian package from Windows-built artifacts" {
        $debianArgs = @{
            OutputDir = $releaseDir
            ApplicationUf2 = (Join-Path $BuildDir "pico_wifi_dmx.uf2")
            WifiFirmwareUf2 = (Join-Path $BuildDir "pico_wifi_dmx_wifi_firmware.uf2")
        }
        if ($WslDistribution) {
            $debianArgs.Distribution = $WslDistribution
        }
        if ($WslPicotoolPath) {
            $debianArgs.WslPicotoolPath = $WslPicotoolPath
        }
        & (Join-Path $repoRoot "installer\ubuntu\build_package_wsl.ps1") @debianArgs
    }

    $debianPackages = @(Get-ChildItem -LiteralPath $releaseDir -File -Filter "wifi-pico-dmx_${Version}_*.deb")
    if ($debianPackages.Count -ne 1) {
        throw "Expected one Debian installer matching wifi-pico-dmx_${Version}_*.deb, found $($debianPackages.Count)."
    }
    $debianPackage = $debianPackages[0]
    if ($debianPackage.Name -notmatch '^wifi-pico-dmx_[^_]+_([^_]+)\.deb$') {
        throw "Could not determine Debian architecture from '$($debianPackage.Name)'."
    }
    $debianInstaller = [ordered]@{
        file = $debianPackage.Name
        architecture = $Matches[1]
        sizeBytes = $debianPackage.Length
        sha256 = Get-FileSha256 $debianPackage.FullName
    }
} elseif ($isWindowsHost) {
    Write-Host "Skipping Debian installer because -SkipDebianInstaller was supplied."
} else {
    Write-Host "Skipping WSL Debian installer because this release is running on a non-Windows host."
}

$releaseArtifacts = [ordered]@{}
foreach ($artifact in $artifactSpecs) {
    $artifactOut = Join-Path $releaseDir $artifact.releaseName
    Copy-Item -LiteralPath $artifact.sourcePath.Path -Destination $artifactOut -Force
    $artifactSha256 = Get-FileSha256 $artifactOut
    "$artifactSha256  $($artifact.releaseName)" | Set-Content -LiteralPath "$artifactOut.sha256" -Encoding ascii
    $artifact.outPath = $artifactOut
    $artifact.sha256 = $artifactSha256
    $releaseArtifacts[$artifact.key] = [ordered]@{
        file = $artifact.releaseName
        sizeBytes = (Get-Item -LiteralPath $artifactOut).Length
        sha256 = $artifactSha256
    }
}

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
    firmware = $releaseArtifacts.firmware
    wifiFirmware = $releaseArtifacts.wifiFirmware
    wifiFirmwareTbyb = $releaseArtifacts.wifiFirmwareTbyb
    windowsInstaller = $windowsInstaller
    debianInstaller = $debianInstaller
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
    "user-manual.pdf",
    "user-manual-navigation.pdf"
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
foreach ($artifact in $artifactSpecs) {
    Write-Host "  $($artifact.outPath)"
    Write-Host "  SHA256 $($artifact.sha256)"
}
if ($windowsInstaller) {
    Write-Host "  $(Join-Path $releaseDir $windowsInstaller.file)"
    Write-Host "  SHA256 $($windowsInstaller.sha256)"
    Write-Host "  Authenticode signed: $($windowsInstaller.signed)"
}
if ($debianInstaller) {
    Write-Host "  $(Join-Path $releaseDir $debianInstaller.file)"
    Write-Host "  SHA256 $($debianInstaller.sha256)"
    Write-Host "  Debian architecture: $($debianInstaller.architecture)"
}
