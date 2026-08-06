param(
    [Parameter(Mandatory)]
    [string]$BaseUrl,
    [string]$OutDir = "docs/screenshots",
    [string]$ChromePath = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "local_path_config.ps1")
. (Join-Path $PSScriptRoot "manual_screenshot_helpers.ps1")
$scriptTiming = Start-ManualScriptTiming -Name "capture_manual_page_overviews.ps1"
$localPaths = Get-LocalPathConfig -RepoRoot $repoRoot
if (-not $ChromePath) { $ChromePath = $localPaths.chromePath }

$outPath = Join-Path $repoRoot $OutDir
New-Item -ItemType Directory -Force -Path $outPath | Out-Null
Initialize-ScreenshotTiming -Scope "page overview captures"

function Save-PageScreenshot {
    param(
        [string]$Name,
        [string]$Url,
        [int]$Width = 1440,
        [int]$Height = 1100
    )

    $timing = Start-ScreenshotTiming -Name $Name
    if (-not (Test-Path -LiteralPath $ChromePath)) {
        throw "Chrome not found: $ChromePath"
    }
    $out = Join-Path $outPath $Name
    $tempOut = Join-Path $outPath (".tmp-" + [IO.Path]::GetFileName($Name))
    $profileDir = Get-PicoDmxTempPath ("pico-dmx-page-shot-" + [System.Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
    $separator = if ($Url.Contains("?")) { "&" } else { "?" }
    $shotUrl = $Url + $separator + "docshot=" + ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
    try {
        & $ChromePath --headless=new --disable-gpu --disable-background-networking --disable-component-update --disable-default-apps --disable-extensions --disable-sync "--disable-features=MediaRouter,OptimizationHints" --hide-scrollbars --no-sandbox --no-first-run "--user-data-dir=$profileDir" "--window-size=$Width,$Height" "--screenshot=$tempOut" $shotUrl | Out-Null
        if (-not (Test-Path -LiteralPath $tempOut)) {
            throw "Screenshot was not created: $tempOut"
        }
        $bytes = [IO.File]::ReadAllBytes($tempOut)
    }
    finally {
        Remove-Item -LiteralPath $tempOut -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-PngIfChanged -Path $out -Bytes $bytes
    Complete-ScreenshotTiming -Timing $timing
}

try {
    $rootUrl = $BaseUrl.TrimEnd("/")
    Save-PageScreenshot "motion-fx.png" ($rootUrl + "/dmx_motion.html?docshot_overview=1")
    Save-PageScreenshot "gpio-control.png" ($rootUrl + "/dmx_gpio.html")
    Save-PageScreenshot "dmx-monitor.png" ($rootUrl + "/dmx_monitor.html")
    Save-PageScreenshot "benchmark.png" ($rootUrl + "/test/")
}
finally {
    Write-ScreenshotTimingSummary
    Complete-ManualScriptTiming -Timing $scriptTiming
}
