param(
    [string]$XamppHtdocs = "",
    [string]$AppFolder = "",
    [string]$BaseUrl = "",
    [string]$ChromePath = "",
    [string]$ManualDataDir = "docs/manual-data",
    [switch]$SkipInitialSync,
    [switch]$SkipScreenshots,
    [switch]$SkipFinalSync
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "local_path_config.ps1")
. (Join-Path $PSScriptRoot "screenshot_file_helpers.ps1")
$localPaths = Get-LocalPathConfig -RepoRoot $repoRoot
if (-not $XamppHtdocs) { $XamppHtdocs = $localPaths.xamppHtdocs }
if (-not $AppFolder) { $AppFolder = $localPaths.appFolder }
if (-not $BaseUrl) { $BaseUrl = $localPaths.baseUrl }
if (-not $ChromePath) { $ChromePath = $localPaths.chromePath }

$screenshotsDir = Join-Path $repoRoot "docs\screenshots"
$chrome = $ChromePath
$manualDataPath = Join-Path $repoRoot $ManualDataDir
$xamppDataPath = Join-Path (Join-Path $XamppHtdocs $AppFolder) "data"

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Action
    )
    Write-Host ""
    Write-Host "== $Name ==" -ForegroundColor Cyan
    & $Action
}

function Save-PageScreenshot {
    param(
        [string]$Name,
        [string]$Url,
        [int]$Width = 1440,
        [int]$Height = 1100
    )
    if (-not (Test-Path -LiteralPath $chrome)) {
        throw "Chrome not found: $chrome"
    }
    New-Item -ItemType Directory -Force -Path $screenshotsDir | Out-Null
    $out = Join-Path $screenshotsDir $Name
    $tempOut = Join-Path $screenshotsDir (".tmp-" + [IO.Path]::GetFileName($Name))
    & $chrome --headless=new --disable-gpu --hide-scrollbars "--window-size=$Width,$Height" "--screenshot=$tempOut" $Url | Out-Null
    if (-not (Test-Path -LiteralPath $tempOut)) {
        throw "Screenshot was not created: $tempOut"
    }
    $bytes = [IO.File]::ReadAllBytes($tempOut)
    Remove-Item -LiteralPath $tempOut -Force -ErrorAction SilentlyContinue
    Write-PngIfChanged -Path $out -Bytes $bytes
}

function Copy-JsonFiles {
    param(
        [string]$SourceDir,
        [string]$DestinationDir
    )
    if (-not (Test-Path -LiteralPath $SourceDir)) {
        throw "JSON source directory not found: $SourceDir"
    }
    New-Item -ItemType Directory -Force -Path $DestinationDir | Out-Null
    Copy-Item -Path (Join-Path $SourceDir "*.json") -Destination $DestinationDir -Force -ErrorAction SilentlyContinue
}

function Start-ManualDataSnapshot {
    if (-not (Test-Path -LiteralPath $manualDataPath)) {
        throw "Manual data baseline not found: $manualDataPath"
    }
    if (-not (Test-Path -LiteralPath $xamppDataPath)) {
        throw "XAMPP data directory not found: $xamppDataPath"
    }
    $backup = Join-Path $env:TEMP ("pico-dmx-manual-data-backup-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
    New-Item -ItemType Directory -Force -Path $backup | Out-Null
    Copy-JsonFiles -SourceDir $xamppDataPath -DestinationDir $backup
    Copy-JsonFiles -SourceDir $manualDataPath -DestinationDir $xamppDataPath
    return $backup
}

function Restore-ManualDataSnapshot {
    param([string]$BackupDir)
    if ($BackupDir -and (Test-Path -LiteralPath $BackupDir)) {
        Copy-JsonFiles -SourceDir $BackupDir -DestinationDir $xamppDataPath
        Remove-Item -LiteralPath $BackupDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Wait-FileStable {
    param(
        [string]$Path,
        [int]$TimeoutSeconds = 30
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastLength = -1
    $stableCount = 0
    while ((Get-Date) -lt $deadline) {
        if (Test-Path -LiteralPath $Path) {
            $length = (Get-Item -LiteralPath $Path).Length
            if ($length -gt 0 -and $length -eq $lastLength) {
                $stableCount++
                if ($stableCount -ge 3) { return }
            } else {
                $stableCount = 0
                $lastLength = $length
            }
        }
        Start-Sleep -Milliseconds 300
    }
    throw "File did not become stable: $Path"
}

Push-Location $repoRoot
try {
    Invoke-Step "Validate screenshot manifest" {
        & (Join-Path $PSScriptRoot "check_screenshot_manifest.ps1")
    }

    if (-not $SkipInitialSync) {
        Invoke-Step "Sync current web app to XAMPP for screenshot source" {
            & (Join-Path $PSScriptRoot "sync_fixture_controller_to_xampp.ps1") -XamppHtdocs $XamppHtdocs -AppFolder $AppFolder -BaseUrl $BaseUrl
        }
    }

    if (-not $SkipScreenshots) {
        $script:manualDataBackup = $null
        try {
            Invoke-Step "Use manual data baseline for screenshots" {
                $script:manualDataBackup = Start-ManualDataSnapshot
                Write-Host "Copied manual data from $manualDataPath to $xamppDataPath"
            }

            Invoke-Step "Capture deterministic controller screenshots" {
                & (Join-Path $PSScriptRoot "capture_readme_screenshots.ps1") -BaseUrl $BaseUrl -OutDir "docs/screenshots" -ChromePath $ChromePath
                & (Join-Path $PSScriptRoot "capture_chaser_screenshot.ps1") -BaseUrl $BaseUrl -OutDir "docs/screenshots" -XamppDataDir $xamppDataPath -ChromePath $ChromePath
            }

            Invoke-Step "Capture page overview screenshots" {
                Save-PageScreenshot "motion-fx.png" ($BaseUrl.TrimEnd('/') + "/dmx_motion.html")
                Save-PageScreenshot "gpio-control.png" ($BaseUrl.TrimEnd('/') + "/dmx_gpio.html")
                Save-PageScreenshot "dmx-monitor.png" ($BaseUrl.TrimEnd('/') + "/dmx_monitor.html")
                Save-PageScreenshot "benchmark.png" ($BaseUrl.TrimEnd('/') + "/test/")
            }
        }
        finally {
            Invoke-Step "Restore live XAMPP data after screenshots" {
                Restore-ManualDataSnapshot -BackupDir $script:manualDataBackup
            }
        }

        Invoke-Step "Verify screenshot manifest files" {
            & (Join-Path $PSScriptRoot "check_screenshot_manifest.ps1") -RequireFiles
        }
    }

    Invoke-Step "Build dark-mode user manual HTML and PDF" {
        & (Join-Path $PSScriptRoot "build_user_manual_pdf.ps1") -MarkdownPath "docs/user-manual.md" -HtmlPath "docs/user-manual.html" -PdfPath "docs/user-manual.pdf" -ChromePath $ChromePath
    }

    Invoke-Step "Refresh companion manual HTML" {
        & (Join-Path $PSScriptRoot "build_user_manual_pdf.ps1") -MarkdownPath "docs/user-manual.md" -HtmlPath "docs/user-manual-print.html" -PdfPath "docs/user-manual.pdf" -ChromePath $ChromePath
    }

    Invoke-Step "Wait for generated PDF to finish writing" {
        Wait-FileStable (Join-Path $repoRoot "docs\user-manual.pdf")
    }

    if (-not $SkipFinalSync) {
        Invoke-Step "Sync rebuilt manual and screenshots to XAMPP" {
            & (Join-Path $PSScriptRoot "sync_fixture_controller_to_xampp.ps1") -XamppHtdocs $XamppHtdocs -AppFolder $AppFolder -BaseUrl $BaseUrl
        }
    }

    Invoke-Step "Verify deployed manual" {
        $manual = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd('/') + "/user-manual.html") -UseBasicParsing -TimeoutSec 10
        $pdf = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd('/') + "/user-manual.pdf") -UseBasicParsing -TimeoutSec 10
        Write-Host ("Manual HTML: {0}, {1} bytes" -f $manual.StatusCode, $manual.RawContentLength)
        Write-Host ("Manual PDF:  {0}, {1} bytes" -f $pdf.StatusCode, $pdf.RawContentLength)
    }

    Write-Host ""
    Write-Host "User manual update complete." -ForegroundColor Green
}
finally {
    Pop-Location
}
