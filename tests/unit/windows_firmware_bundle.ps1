[CmdletBinding()]
param(
    [string]$StageDir = "build\windows-installer\stage"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$source = if ([IO.Path]::IsPathRooted($StageDir)) {
    (Resolve-Path -LiteralPath $StageDir).Path
} else {
    (Resolve-Path -LiteralPath (Join-Path $repoRoot $StageDir)).Path
}
$helperSource = Get-Content -LiteralPath (
    Join-Path $repoRoot "installer\windows\scripts\flash_firmware.ps1"
) -Raw
if ($helperSource -notmatch 'family\\s\+ID\\s\+') {
    throw "Firmware helper must accept picotool wrapping 'family ID' across lines."
}
$testRoot = Join-Path ([IO.Path]::GetTempPath()) `
    "WiFi Pico DMX firmware bundle regression installation path with spaces"
$resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$resolvedTest = [IO.Path]::GetFullPath($testRoot)
if (-not $resolvedTest.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to manage a test directory outside $resolvedTemp"
}

try {
    if (Test-Path -LiteralPath $resolvedTest) {
        Remove-Item -LiteralPath $resolvedTest -Recurse -Force
    }
    New-Item -ItemType Directory -Path $resolvedTest -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $source "firmware") -Destination $resolvedTest -Recurse
    Copy-Item -LiteralPath (Join-Path $source "support") -Destination $resolvedTest -Recurse
    Copy-Item -LiteralPath (Join-Path $source "tools") -Destination $resolvedTest -Recurse

    $powershell = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
    $helper = Join-Path $resolvedTest "support\flash_firmware.ps1"
    & $powershell `
        -NoProfile `
        -NonInteractive `
        -ExecutionPolicy Bypass `
        -File $helper `
        -ValidateOnly
    if ($LASTEXITCODE -ne 0) {
        throw "Firmware bundle validation failed from a long path containing spaces."
    }
    Write-Output "Windows firmware bundle validation passed from a path containing spaces."
} finally {
    if (Test-Path -LiteralPath $resolvedTest) {
        Remove-Item -LiteralPath $resolvedTest -Recurse -Force
    }
}
