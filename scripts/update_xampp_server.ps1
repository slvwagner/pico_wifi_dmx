param(
    [string]$XamppHtdocs = "",
    [string]$AppFolder = "",
    [string]$BaseUrl = "",
    [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "local_path_config.ps1")
$localPaths = Get-LocalPathConfig -RepoRoot $repoRoot
if (-not $XamppHtdocs) { $XamppHtdocs = $localPaths.xamppHtdocs }
if (-not $AppFolder) { $AppFolder = $localPaths.appFolder }
if (-not $BaseUrl) { $BaseUrl = $localPaths.baseUrl }

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Body
    )

    Write-Host ""
    Write-Host "== $Name =="
    & $Body
}

function Join-Url {
    param(
        [string]$Root,
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $Root
    }
    return $Root.TrimEnd("/") + "/" + $Path.TrimStart("/")
}

Invoke-Step "Sync project files to XAMPP" {
    & (Join-Path $PSScriptRoot "sync_fixture_controller_to_xampp.ps1") `
        -XamppHtdocs $XamppHtdocs `
        -AppFolder $AppFolder `
        -BaseUrl $BaseUrl
}

if (-not $SkipVerify) {
    Invoke-Step "Verify deployed pages" {
        $checks = @(
            @{ Label = "Controller"; Path = "" },
            @{ Label = "Chaser"; Path = "dmx_chaser.html" },
            @{ Label = "Motion FX"; Path = "dmx_motion.html" },
            @{ Label = "GPIO"; Path = "dmx_gpio.html" },
            @{ Label = "DMX Monitor"; Path = "dmx_monitor.html" },
            @{ Label = "Performance Test"; Path = "test/" },
            @{ Label = "Version"; Path = "VERSION" }
        )

        foreach ($check in $checks) {
            $url = Join-Url -Root $BaseUrl -Path $check.Path
            try {
                $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 10
                Write-Host "$($check.Label): $($response.StatusCode), $($response.RawContentLength) bytes"
            } catch {
                throw "Could not verify $($check.Label) at $url. Is Apache/XAMPP running? $($_.Exception.Message)"
            }
        }
    }
}

Write-Host ""
Write-Host "XAMPP update complete."
Write-Host "Open $BaseUrl"
