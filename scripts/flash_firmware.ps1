[CmdletBinding()]
param(
    [string]$BuildDir = "build",
    [string]$ApplicationUf2 = "",
    [string]$WifiFirmwareUf2 = "",
    [string]$PicotoolPath = "",
    [string]$Serial = "",
    [switch]$ConfigureWifi,
    [string]$WifiSsid = "",
    [switch]$ApplicationOnly,
    [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
. (Join-Path $repoRoot "installer\windows\scripts\wifi_config_uf2.ps1")

function Resolve-InputPath([string]$ExplicitPath, [string]$DefaultName) {
    $candidate = if ($ExplicitPath) {
        $ExplicitPath
    } elseif ([IO.Path]::IsPathRooted($BuildDir)) {
        Join-Path $BuildDir $DefaultName
    } else {
        Join-Path (Join-Path $repoRoot $BuildDir) $DefaultName
    }

    $resolved = Resolve-Path -LiteralPath $candidate -ErrorAction SilentlyContinue
    if (-not $resolved) {
        throw "Required UF2 not found: $candidate"
    }
    return $resolved.Path
}

function Resolve-Picotool {
    if ($PicotoolPath) {
        $resolved = Resolve-Path -LiteralPath $PicotoolPath -ErrorAction SilentlyContinue
        if (-not $resolved) {
            throw "picotool not found: $PicotoolPath"
        }
        return $resolved.Path
    }

    $command = Get-Command picotool -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $userProfile = if ($env:USERPROFILE) {
        $env:USERPROFILE
    } else {
        [Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)
    }
    $candidates = @(
        (Join-Path $userProfile ".pico-sdk/picotool/2.3.0/picotool/picotool.exe"),
        (Join-Path $userProfile ".pico-sdk/picotool/2.3.0/picotool/picotool")
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw "Could not find picotool 2.3.0. Pass -PicotoolPath or add picotool to PATH."
}

function Get-DeviceArgs {
    if ($Serial) {
        return @("--ser", $Serial)
    }
    return @()
}

function Invoke-PicotoolCapture([string[]]$Arguments) {
    $output = & $script:picotool @Arguments 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "picotool $($Arguments -join ' ') failed:`n$output"
    }
    return $output
}

function Invoke-Picotool([string[]]$Arguments) {
    Write-Host "picotool $($Arguments -join ' ')"
    & $script:picotool @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "picotool failed with exit code $LASTEXITCODE."
    }
}

function Test-BootselDevice {
    $deviceInfoArgs = @("info") + (Get-DeviceArgs)
    & $script:picotool @deviceInfoArgs *> $null
    return $LASTEXITCODE -eq 0
}

function Wait-BootselDevice([int]$TimeoutSeconds = 15) {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        if (Test-BootselDevice) {
            return
        }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "The Pico did not reappear in BOOTSEL mode within $TimeoutSeconds seconds."
}

$script:picotool = Resolve-Picotool
$application = Resolve-InputPath $ApplicationUf2 "pico_wifi_dmx.uf2"
$wifiFirmware = if ($ApplicationOnly) { $null } else {
    Resolve-InputPath $WifiFirmwareUf2 "pico_wifi_dmx_wifi_firmware.uf2"
}

Write-Host "Validating application UF2: $application"
$applicationInfo = Invoke-PicotoolCapture @("info", "-a", $application)
if ($applicationInfo -notmatch "target chip:\s+RP2350" -or
    $applicationInfo -notmatch "block type:\s+partition table" -or
    $applicationInfo -notmatch '"Wi-Fi\s+Configuration"' -or
    $applicationInfo -notmatch '"Wi-Fi\s+Firmware"') {
    throw "Application UF2 is not an RP2350 image with the expected Wi-Fi configuration and firmware partitions."
}

if ($wifiFirmware) {
    Write-Host "Validating Wi-Fi firmware UF2: $wifiFirmware"
    $wifiInfo = Invoke-PicotoolCapture @("info", "-a", $wifiFirmware)
    if ($wifiInfo -notmatch "family ID 'cyw43-firmware'" -or
        $wifiInfo -notmatch "target chip:\s+RP2350" -or
        $wifiInfo -notmatch "hash:\s+verified") {
        throw "Wi-Fi UF2 is not a verified RP2350 cyw43-firmware image."
    }
}

Write-Host "UF2 validation passed." -ForegroundColor Green
if ($ValidateOnly) {
    exit 0
}

if (-not (Test-BootselDevice)) {
    Write-Host ""
    Write-Host "Hold BOOTSEL while connecting the Pico 2 W, then press Enter."
    Read-Host | Out-Null
    if (-not (Test-BootselDevice)) {
        throw "No Pico was found in BOOTSEL mode."
    }
}

$deviceArgs = Get-DeviceArgs
if ($ApplicationOnly) {
    if ($ConfigureWifi) {
        throw "-ConfigureWifi cannot be combined with -ApplicationOnly."
    }
    Write-Host "Loading application update..." -ForegroundColor Cyan
    Invoke-Picotool (@("load", "-u", "-v", "-x", $application) + $deviceArgs)
    Write-Host "Application update complete." -ForegroundColor Green
    exit 0
}

Write-Host "Loading application and partition table..." -ForegroundColor Cyan
Invoke-Picotool (@("load", "-v", $application) + $deviceArgs)

Write-Host "Rebooting back into USB BOOTSEL mode..." -ForegroundColor Cyan
Invoke-Picotool (@("reboot", "-u") + $deviceArgs)
Wait-BootselDevice

Write-Host "Loading CYW43 Wi-Fi firmware partition..." -ForegroundColor Cyan
$wifiConfigUf2 = $null
$plainPassword = $null
try {
    if ($ConfigureWifi) {
        if (-not $WifiSsid) {
            $WifiSsid = Read-Host "Wi-Fi network name (SSID)"
        }
        $securePassword = Read-Host "Wi-Fi password" -AsSecureString
        $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
        try {
            $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
        }
        $wifiConfigUf2 = Join-Path ([IO.Path]::GetTempPath()) ("pico-dmx-wifi-{0}.uf2" -f [guid]::NewGuid())
        New-WifiConfigurationUf2 $wifiConfigUf2 $WifiSsid $plainPassword
        $plainPassword = $null
        Write-Host "Loading private Wi-Fi configuration partition..." -ForegroundColor Cyan
        Invoke-Picotool (@("load", "-u", "-v", $wifiConfigUf2) + $deviceArgs)
    }
    Invoke-Picotool (@("load", "-u", "-v", "-x", $wifiFirmware) + $deviceArgs)
} finally {
    $plainPassword = $null
    if ($wifiConfigUf2 -and (Test-Path -LiteralPath $wifiConfigUf2)) {
        Remove-Item -LiteralPath $wifiConfigUf2 -Force
    }
}

Write-Host "Application and Wi-Fi firmware provisioning complete." -ForegroundColor Green
