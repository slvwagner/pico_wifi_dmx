param(
    [string]$XamppHtdocs = "",
    [string]$AppFolder = "",
    [string]$BaseUrl = "",
    [string]$ChromePath = "",
    [string]$ManualDataDir = "docs/manual-data",
    [string]$ScreenshotBaseUrl = "",
    [switch]$SkipInitialSync,
    [switch]$SkipScreenshots,
    [switch]$SkipFinalSync,
    [switch]$LocalOnly
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "local_path_config.ps1")
. (Join-Path $PSScriptRoot "manual_screenshot_helpers.ps1")
$scriptTiming = Start-ManualScriptTiming -Name "build_user_manual.ps1"
$localPaths = Get-LocalPathConfig -RepoRoot $repoRoot
if (-not $XamppHtdocs) { $XamppHtdocs = $localPaths.xamppHtdocs }
if (-not $AppFolder) { $AppFolder = $localPaths.appFolder }
if (-not $BaseUrl) { $BaseUrl = $localPaths.baseUrl }
if (-not $ChromePath) { $ChromePath = $localPaths.chromePath }
if ($LocalOnly) { $SkipFinalSync = $true }

$manualDataPath = Join-Path $repoRoot $ManualDataDir
$xamppDataPath = Join-Path (Join-Path $XamppHtdocs $AppFolder) "data"
$localApiDataPath = Join-Path (Join-Path $repoRoot "api") "data"

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Action
    )
    Write-Host ""
    Write-Host "== $Name ==" -ForegroundColor Cyan
    $stepClock = [Diagnostics.Stopwatch]::StartNew()
    try {
        & $Action
    }
    finally {
        $stepClock.Stop()
        Write-Host ("Step timing: {0} | total {1:N1} ms" -f $Name, $stepClock.Elapsed.TotalMilliseconds) -ForegroundColor DarkCyan
    }
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

function Start-DataSnapshot {
    param(
        [string]$DestinationDir
    )
    if (-not (Test-Path -LiteralPath $manualDataPath)) {
        throw "Manual data baseline not found: $manualDataPath"
    }
    $backup = Get-PicoDmxTempPath ("pico-dmx-manual-data-backup-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
    New-Item -ItemType Directory -Force -Path $backup | Out-Null
    if (Test-Path -LiteralPath $DestinationDir) {
        Copy-JsonFiles -SourceDir $DestinationDir -DestinationDir $backup
    }
    Copy-JsonFiles -SourceDir $manualDataPath -DestinationDir $DestinationDir
    return $backup
}

function Restore-DataSnapshot {
    param(
        [string]$BackupDir,
        [string]$DestinationDir
    )
    if (-not $DestinationDir) { return }
    if (Test-Path -LiteralPath $DestinationDir) {
        Remove-Item -LiteralPath $DestinationDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    if ($BackupDir -and (Test-Path -LiteralPath $BackupDir)) {
        $backupFiles = @(Get-ChildItem -LiteralPath $BackupDir -File -Filter "*.json" -ErrorAction SilentlyContinue)
        if ($backupFiles.Count) {
            New-Item -ItemType Directory -Force -Path $DestinationDir | Out-Null
            Copy-JsonFiles -SourceDir $BackupDir -DestinationDir $DestinationDir
        }
        Remove-Item -LiteralPath $BackupDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Get-FreeTcpPort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    try {
        $listener.Start()
        return $listener.LocalEndpoint.Port
    }
    finally {
        $listener.Stop()
    }
}

function Start-ScreenshotServer {
    param([string]$Url)
    if ($Url) {
        return [pscustomobject]@{
            BaseUrl = $Url.TrimEnd('/')
            Process = $null
        }
    }

    $php = Get-Command php -ErrorAction SilentlyContinue
    $phpPath = if ($php) { $php.Source } else { "" }
    if (-not $phpPath) {
        $htdocsPath = Resolve-Path -LiteralPath $XamppHtdocs -ErrorAction SilentlyContinue
        if ($htdocsPath) {
            $xamppRoot = Split-Path -Parent $htdocsPath.Path
            $xamppPhp = Join-Path (Join-Path $xamppRoot "php") "php.exe"
            if (Test-Path -LiteralPath $xamppPhp) {
                $phpPath = $xamppPhp
            }
        }
    }
    if (-not $phpPath) {
        throw "PHP was not found on PATH or under the configured XAMPP path. Install PHP or pass -ScreenshotBaseUrl to a local dev-router instance."
    }

    $port = Get-FreeTcpPort
    $base = "http://127.0.0.1:$port"
    $router = Join-Path $PSScriptRoot "dev-router.php"
    $process = Start-PicoDmxProcess -FilePath $phpPath -ArgumentList @("-S", "127.0.0.1:$port", $router) -WorkingDirectory $repoRoot
    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        try {
            $response = Invoke-WebRequest -Uri ($base + "/VERSION") -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch {
            Start-Sleep -Milliseconds 250
        }
    }
    if (-not $ready) {
        if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
        throw "Screenshot PHP server did not start at $base"
    }
    return [pscustomobject]@{
        BaseUrl = $base
        Process = $process
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

    if (-not $SkipScreenshots) {
        $script:manualDataBackup = $null
        $script:screenshotServer = $null
        try {
            Invoke-Step "Use local manual data baseline for screenshots" {
                $script:manualDataBackup = Start-DataSnapshot -DestinationDir $localApiDataPath
                Write-Host "Copied manual data from $manualDataPath to $localApiDataPath"
            }

            Invoke-Step "Start local screenshot server" {
                $script:screenshotServer = Start-ScreenshotServer -Url $ScreenshotBaseUrl
                Write-Host "Capturing manual screenshots from $($script:screenshotServer.BaseUrl)"
            }

            Invoke-Step "Capture deterministic controller screenshots" {
                & (Join-Path $PSScriptRoot "capture_manual_ui_screenshots.ps1") -BaseUrl $script:screenshotServer.BaseUrl -OutDir "docs/screenshots" -ChromePath $ChromePath -Port 0
                & (Join-Path $PSScriptRoot "capture_chaser_manual_screenshots.ps1") -BaseUrl $script:screenshotServer.BaseUrl -OutDir "docs/screenshots" -XamppDataDir $localApiDataPath -ChromePath $ChromePath -Port 0
            }

            Invoke-Step "Capture page overview screenshots" {
                Copy-JsonFiles -SourceDir $manualDataPath -DestinationDir $localApiDataPath
                & (Join-Path $PSScriptRoot "capture_manual_page_overviews.ps1") -BaseUrl $script:screenshotServer.BaseUrl -OutDir "docs/screenshots" -ChromePath $ChromePath
            }
        }
        finally {
            Invoke-Step "Restore local screenshot data" {
                Restore-DataSnapshot -BackupDir $script:manualDataBackup -DestinationDir $localApiDataPath
                if ($script:screenshotServer -and $script:screenshotServer.Process -and -not $script:screenshotServer.Process.HasExited) {
                    Stop-Process -Id $script:screenshotServer.Process.Id -Force
                }
            }
        }

        Invoke-Step "Verify screenshot manifest files" {
            & (Join-Path $PSScriptRoot "check_screenshot_manifest.ps1") -RequireFiles
        }
    }

    Invoke-Step "Build dark-mode user manual HTML and navigable PDF" {
        & (Join-Path $PSScriptRoot "render_user_manual_pdf.ps1") -MarkdownPath "docs/user-manual.md" -HtmlPath "docs/user-manual.html" -PdfPath "docs/user-manual-navigation.pdf" -ChromePath $ChromePath -PdfWithNavigation
    }

    Invoke-Step "Build companion print HTML and clean PDF" {
        & (Join-Path $PSScriptRoot "render_user_manual_pdf.ps1") -MarkdownPath "docs/user-manual.md" -HtmlPath "docs/user-manual-print.html" -PdfPath "docs/user-manual.pdf" -ChromePath $ChromePath
    }

    Invoke-Step "Wait for generated PDFs to finish writing" {
        Wait-FileStable (Join-Path $repoRoot "docs\user-manual.pdf")
        Wait-FileStable (Join-Path $repoRoot "docs\user-manual-navigation.pdf")
    }

    if (-not $SkipFinalSync) {
        Invoke-Step "Sync rebuilt manual and screenshots to XAMPP" {
            & (Join-Path $PSScriptRoot "sync_fixture_controller_to_xampp.ps1") -XamppHtdocs $XamppHtdocs -AppFolder $AppFolder -BaseUrl $BaseUrl
        }

        Invoke-Step "Verify deployed manual" {
            $manual = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd('/') + "/user-manual.html") -UseBasicParsing -TimeoutSec 10
            $pdf = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd('/') + "/user-manual.pdf") -UseBasicParsing -TimeoutSec 10
            $navigationPdf = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd('/') + "/user-manual-navigation.pdf") -UseBasicParsing -TimeoutSec 10
            Write-Host ("Manual HTML: {0}, {1} bytes" -f $manual.StatusCode, $manual.RawContentLength)
            Write-Host ("Clean PDF:   {0}, {1} bytes" -f $pdf.StatusCode, $pdf.RawContentLength)
            Write-Host ("Navigation PDF: {0}, {1} bytes" -f $navigationPdf.StatusCode, $navigationPdf.RawContentLength)
        }
    } else {
        Invoke-Step "Verify local manual files" {
            $manualPath = Join-Path $repoRoot "docs\user-manual.html"
            $pdfPath = Join-Path $repoRoot "docs\user-manual.pdf"
            $navigationPdfPath = Join-Path $repoRoot "docs\user-manual-navigation.pdf"
            Wait-FileStable $manualPath
            Wait-FileStable $pdfPath
            Wait-FileStable $navigationPdfPath
            Write-Host ("Manual HTML: {0} bytes" -f (Get-Item -LiteralPath $manualPath).Length)
            Write-Host ("Clean PDF:   {0} bytes" -f (Get-Item -LiteralPath $pdfPath).Length)
            Write-Host ("Navigation PDF: {0} bytes" -f (Get-Item -LiteralPath $navigationPdfPath).Length)
        }
    }

    Write-Host ""
    Write-Host "User manual update complete." -ForegroundColor Green
}
finally {
    Pop-Location
    Complete-ManualScriptTiming -Timing $scriptTiming
}
