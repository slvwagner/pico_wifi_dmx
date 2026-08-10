param(
    [string]$OutputDir = "",
    [string]$Distribution = "",
    [string]$ApplicationUf2 = "",
    [string]$WifiFirmwareUf2 = "",
    [string]$WslPicotoolPath = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$wslBuildClock = [Diagnostics.Stopwatch]::StartNew()

function Start-WslPackageStep {
    return [Diagnostics.Stopwatch]::StartNew()
}

function Complete-WslPackageStep {
    param([string]$Name, [Diagnostics.Stopwatch]$Clock)

    $Clock.Stop()
    Write-Host ("WSL package step timing: {0} | total {1:N1} ms" -f $Name, $Clock.Elapsed.TotalMilliseconds) -ForegroundColor DarkCyan
}

function Complete-WslPackageBuildTiming {
    $wslBuildClock.Stop()
    Write-Host ("WSL package build timing: total {0:N1} ms" -f $wslBuildClock.Elapsed.TotalMilliseconds) -ForegroundColor Cyan
}

function Invoke-Wsl([string[]]$Arguments, [string]$Description) {
    $wslArguments = @()
    if ($Distribution) {
        $wslArguments += @("--distribution", $Distribution)
    }
    # --exec bypasses the distribution's shell so Windows paths retain their
    # backslashes when passed to wslpath and every later argument stays atomic.
    $wslArguments += @("--exec")
    $wslArguments += $Arguments

    $output = & wsl.exe @wslArguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
    return $output
}

function ConvertTo-WslPath([string]$Path, [string]$Description) {
    $resolved = Resolve-Path -LiteralPath $Path -ErrorAction SilentlyContinue
    if (-not $resolved) {
        throw "$Description was not found: $Path"
    }
    $converted = Invoke-Wsl @("wslpath", "-a", "-u", $resolved.Path) "Converting $Description to a WSL path"
    return ([string]$converted).Trim()
}

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    throw "WSL is not installed. Install WSL 2 with a Debian or Ubuntu distribution, then retry."
}

if (-not $ApplicationUf2) {
    $ApplicationUf2 = Join-Path $repoRoot "build\pico_wifi_dmx.uf2"
}
if (-not $WifiFirmwareUf2) {
    $WifiFirmwareUf2 = Join-Path $repoRoot "build\pico_wifi_dmx_wifi_firmware.uf2"
}
if (-not $OutputDir) {
    $version = (Get-Content -LiteralPath (Join-Path $repoRoot "VERSION") -Raw).Trim()
    $OutputDir = Join-Path $repoRoot "release\v$version"
}
if (-not (Test-Path -LiteralPath $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$stepClock = Start-WslPackageStep
$linuxBuilder = ConvertTo-WslPath (Join-Path $PSScriptRoot "build_package.sh") "Ubuntu package builder"
$linuxApplicationUf2 = ConvertTo-WslPath $ApplicationUf2 "application UF2"
$linuxWifiFirmwareUf2 = ConvertTo-WslPath $WifiFirmwareUf2 "Wi-Fi firmware UF2"
$linuxOutputDir = ConvertTo-WslPath $OutputDir "release output directory"
$linuxHome = ([string](Invoke-Wsl @("sh", "-c", 'printf %s "$HOME"') "Resolving the WSL home directory")).Trim()
if (-not $linuxHome.StartsWith("/")) {
    throw "WSL returned an invalid home directory: $linuxHome"
}
$linuxBuildRoot = "$linuxHome/.cache/pico-dmx-controller/ubuntu-installer"

$environment = @(
    "PICO_DMX_APPLICATION_UF2=$linuxApplicationUf2",
    "PICO_DMX_WIFI_FIRMWARE_UF2=$linuxWifiFirmwareUf2",
    "PICO_DMX_UBUNTU_BUILD_ROOT=$linuxBuildRoot"
)
if ($WslPicotoolPath) {
    $picotool = $WslPicotoolPath
    if (Test-Path -LiteralPath $WslPicotoolPath) {
        $picotool = ConvertTo-WslPath $WslPicotoolPath "picotool"
    }
    $environment += "PICO_DMX_PICOTOOL=$picotool"
}
Complete-WslPackageStep -Name "Resolve WSL paths" -Clock $stepClock

Write-Host "Building Debian package in WSL$(if ($Distribution) { " ($Distribution)" })..."
$stepClock = Start-WslPackageStep
Invoke-Wsl (@("env") + $environment + @("bash", $linuxBuilder, $linuxOutputDir)) "Debian package build"
Complete-WslPackageStep -Name "Run Linux package builder" -Clock $stepClock
Complete-WslPackageBuildTiming
