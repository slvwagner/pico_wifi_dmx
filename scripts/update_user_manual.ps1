param(
    [string]$XamppHtdocs = "E:\Software\xampp\htdocs",
    [string]$AppFolder = "dmx",
    [string]$BaseUrl = "http://localhost/dmx/",
    [switch]$SkipInitialSync,
    [switch]$SkipScreenshots,
    [switch]$SkipFinalSync
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$screenshotsDir = Join-Path $repoRoot "docs\screenshots"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"

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
    & $chrome --headless=new --disable-gpu --hide-scrollbars "--window-size=$Width,$Height" "--screenshot=$out" $Url | Out-Null
    if (-not (Test-Path -LiteralPath $out)) {
        throw "Screenshot was not created: $out"
    }
    Write-Host "Captured $out"
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
    if (-not $SkipInitialSync) {
        Invoke-Step "Sync current web app to XAMPP for screenshot source" {
            & (Join-Path $PSScriptRoot "sync_fixture_controller_to_xampp.ps1") -XamppHtdocs $XamppHtdocs -AppFolder $AppFolder
        }
    }

    if (-not $SkipScreenshots) {
        Invoke-Step "Capture deterministic controller screenshots" {
            & (Join-Path $PSScriptRoot "capture_readme_screenshots.ps1") -BaseUrl $BaseUrl -OutDir "docs/screenshots"
        }

        Invoke-Step "Capture page overview screenshots" {
            Save-PageScreenshot "motion-fx.png" ($BaseUrl.TrimEnd('/') + "/dmx_motion.html")
            Save-PageScreenshot "fan-out.png" ($BaseUrl.TrimEnd('/') + "/dmx_fan.html")
            Save-PageScreenshot "gpio-control.png" ($BaseUrl.TrimEnd('/') + "/dmx_gpio.html")
            Save-PageScreenshot "benchmark.png" ($BaseUrl.TrimEnd('/') + "/test/")
        }
    }

    Invoke-Step "Build dark-mode user manual HTML and PDF" {
        & (Join-Path $PSScriptRoot "build_user_manual_pdf.ps1") -MarkdownPath "docs/user-manual.md" -HtmlPath "docs/user-manual.html" -PdfPath "docs/user-manual.pdf"
    }

    Invoke-Step "Refresh companion manual HTML" {
        & (Join-Path $PSScriptRoot "build_user_manual_pdf.ps1") -MarkdownPath "docs/user-manual.md" -HtmlPath "docs/user-manual-print.html" -PdfPath "docs/user-manual.pdf"
    }

    Invoke-Step "Wait for generated PDF to finish writing" {
        Wait-FileStable (Join-Path $repoRoot "docs\user-manual.pdf")
    }

    if (-not $SkipFinalSync) {
        Invoke-Step "Sync rebuilt manual and screenshots to XAMPP" {
            & (Join-Path $PSScriptRoot "sync_fixture_controller_to_xampp.ps1") -XamppHtdocs $XamppHtdocs -AppFolder $AppFolder
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
