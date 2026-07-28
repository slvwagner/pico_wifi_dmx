[CmdletBinding()]
param(
    [switch]$ValidateOnly,
    [switch]$ProbeOnly,
    [switch]$Flash
)

$ErrorActionPreference = "Stop"
trap {
    Write-Output "Error: $($_.Exception.Message)"
    exit 1
}
$installDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$picotool = Join-Path $installDir "tools\picotool\picotool.exe"
$firmwareDir = Join-Path $installDir "firmware"
$manifestPath = Join-Path $firmwareDir "firmware-manifest.json"
$application = Join-Path $firmwareDir "pico_wifi_dmx.uf2"
$wifiFirmware = Join-Path $firmwareDir "pico_wifi_dmx_wifi_firmware.uf2"

function Assert-File([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Label is missing: $Path"
    }
}

function Invoke-Picotool([string[]]$Arguments, [switch]$Capture) {
    if ($Capture) {
        $output = & $picotool @Arguments 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) {
            throw $output.Trim()
        }
        return $output
    }

    Write-Output "picotool $($Arguments -join ' ')"
    & $picotool @Arguments 2>&1 | ForEach-Object { Write-Output $_ }
    if ($LASTEXITCODE -ne 0) {
        throw "picotool failed with exit code $LASTEXITCODE."
    }
}

function Wait-ForBootsel([int]$TimeoutSeconds = 20) {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        & $picotool info *> $null
        if ($LASTEXITCODE -eq 0) {
            return
        }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "The Pico did not return to BOOTSEL mode within $TimeoutSeconds seconds."
}

Assert-File $picotool "Bundled picotool"
Assert-File $manifestPath "Firmware manifest"
Assert-File $application "Application firmware"
Assert-File $wifiFirmware "Wi-Fi firmware"

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$applicationHash = (Get-FileHash -LiteralPath $application -Algorithm SHA256).Hash.ToLowerInvariant()
$wifiHash = (Get-FileHash -LiteralPath $wifiFirmware -Algorithm SHA256).Hash.ToLowerInvariant()
if ($applicationHash -ne [string]$manifest.application.sha256) {
    throw "Application firmware checksum does not match its manifest."
}
if ($wifiHash -ne [string]$manifest.wifiFirmware.sha256) {
    throw "Wi-Fi firmware checksum does not match its manifest."
}

$applicationInfo = Invoke-Picotool @("info", "-a", $application) -Capture
if ($applicationInfo -notmatch "target chip:\s+RP2350" -or
    $applicationInfo -notmatch "block type:\s+partition table" -or
    $applicationInfo -notmatch '"Wi-Fi\s+Firmware"' -or
    $applicationInfo -notmatch "version:\s+$([regex]::Escape([string]$manifest.version))" -or
    $applicationInfo -notmatch "build attributes:\s+Release(?: build)?") {
    throw "The application UF2 is not the expected WiFiPicoDMX $($manifest.version) RP2350 Release image."
}

$wifiInfo = Invoke-Picotool @("info", "-a", $wifiFirmware) -Capture
if ($wifiInfo -notmatch "family\s+ID\s+'cyw43-firmware'" -or
    $wifiInfo -notmatch "target chip:\s+RP2350" -or
    $wifiInfo -notmatch "hash:\s+verified") {
    throw "The Wi-Fi UF2 is not a verified RP2350 CYW43 firmware image."
}

Write-Output "Firmware bundle $($manifest.version) validated."
if ($ValidateOnly) {
    exit 0
}

Write-Output "Checking for the target Pico in BOOTSEL mode..."
$deviceInfo = Invoke-Picotool @("info", "-a") -Capture
if ($deviceInfo -notmatch "target chip:\s+RP2350") {
    throw "The connected BOOTSEL device is not an RP2350 Pico 2 W."
}
Write-Output "An RP2350 Pico is accessible in BOOTSEL mode."
if ($ProbeOnly) {
    exit 0
}

if (-not $Flash) {
    throw "Select one operation: -ValidateOnly, -ProbeOnly, or -Flash."
}

Write-Output "Loading the WiFiPicoDMX application and partition table..."
Invoke-Picotool @("load", "-v", $application)

Write-Output "Rebooting the Pico back into USB BOOTSEL mode..."
Invoke-Picotool @("reboot", "-u")
Wait-ForBootsel

Write-Output "Loading the separate CYW43 Wi-Fi firmware partition..."
Invoke-Picotool @("load", "-u", "-v", "-x", $wifiFirmware)

Write-Output "Application and Wi-Fi firmware installation completed."
