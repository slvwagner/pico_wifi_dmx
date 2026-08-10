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
        [int]$Width = 1440
    )

    $timing = Start-ScreenshotTiming -Name $Name
    if (-not (Test-Path -LiteralPath $ChromePath)) {
        throw "Chrome not found: $ChromePath"
    }
    $out = Join-Path $outPath $Name
    $profileDir = Get-PicoDmxTempPath ("pico-dmx-page-shot-" + [System.Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
    $separator = if ($Url.Contains("?")) { "&" } else { "?" }
    $shotUrl = $Url + $separator + "docshot=" + ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
    $debugPort = Get-FreeTcpPort
    $jsonUrl = "http://127.0.0.1:$debugPort/json"
    $chromeProcess = $null
    $socket = $null
    try {
        $chromeProcess = Start-PicoDmxProcess -FilePath $ChromePath -ArgumentList @(
            "--headless=new",
            "--remote-debugging-address=127.0.0.1",
            "--remote-debugging-port=$debugPort",
            "--disable-gpu",
            "--disable-background-networking",
            "--disable-component-update",
            "--disable-default-apps",
            "--disable-extensions",
            "--disable-sync",
            "--disable-features=MediaRouter,OptimizationHints",
            "--hide-scrollbars",
            "--no-sandbox",
            "--no-first-run",
            "--user-data-dir=$profileDir",
            "--window-size=$Width,1100",
            $shotUrl
        )
        $tabs = $null
        for ($i = 0; $i -lt 32; $i++) {
            try {
                $tabs = Invoke-RestMethod -Uri $jsonUrl -UseBasicParsing -TimeoutSec 1
                if ($tabs) { break }
            }
            catch {
                Start-Sleep -Milliseconds 250
            }
        }
        if (-not $tabs) { throw "Chrome debug endpoint did not become ready at $jsonUrl." }
        $wsUrl = ($tabs | Where-Object { $_.type -eq "page" } | Select-Object -First 1).webSocketDebuggerUrl
        if (-not $wsUrl) { throw "Could not find the page tab for $shotUrl." }
        $socket = [System.Net.WebSockets.ClientWebSocket]::new()
        $socket.ConnectAsync([Uri]$wsUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
        $script:overviewCdpId = 0

        function Send-OverviewCdp {
            param([string]$Method, [hashtable]$Params = @{})
            $script:overviewCdpId++
            $payload = @{ id = $script:overviewCdpId; method = $Method; params = $Params } | ConvertTo-Json -Depth 20 -Compress
            $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
            $socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
            $buffer = New-Object byte[] 1048576
            $builder = [Text.StringBuilder]::new()
            while ($true) {
                $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).GetAwaiter().GetResult()
                [void]$builder.Append([Text.Encoding]::UTF8.GetString($buffer, 0, $received.Count))
                if ($received.EndOfMessage) {
                    $message = $builder.ToString() | ConvertFrom-Json
                    if ($message.id -eq $script:overviewCdpId) { return $message }
                    $builder.Clear() | Out-Null
                }
            }
        }

        function Invoke-OverviewPageScript {
            param([string]$Expression)
            $eval = Send-OverviewCdp "Runtime.evaluate" @{
                expression = $Expression
                awaitPromise = $true
                returnByValue = $true
            }
            if ($eval.exceptionDetails) { throw "Page overview JavaScript failed: $($eval.exceptionDetails.text)" }
            return $eval.result.result.value
        }

        Send-OverviewCdp "Page.enable" | Out-Null
        Send-OverviewCdp "Runtime.enable" | Out-Null
        for ($i = 0; $i -lt 40; $i++) {
            $ready = Invoke-OverviewPageScript "document.readyState === 'complete'"
            if ($ready) { break }
            Start-Sleep -Milliseconds 250
        }
        Start-Sleep -Milliseconds 1200
        $overview = Invoke-OverviewPageScript @"
(async()=>{
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const rail=document.querySelector('.toolbox-rail');
  const railToggle=rail?.querySelector('.toolbox-rail-toggle');
  if(rail?.classList.contains('collapsed')&&railToggle)railToggle.click();
  if(rail){
    rail.classList.remove('collapsed');
    rail.style.width='';
    rail.style.overflow='';
    document.body.classList.remove('toolbox-rail-collapsed');
    rail.querySelectorAll('.scene-toolbox,.toolbox-rail-resizer').forEach(el=>el.style.display='');
  }
  document.querySelectorAll('.scene-toolbox').forEach(box=>{
    box.style.display='';
    if(box.classList.contains('collapsed'))box.querySelector('.scene-toolbox__toggle')?.click();
    box.classList.remove('collapsed');
  });
  document.querySelectorAll('.collapsed-panel').forEach(panel=>{
    panel.classList.remove('collapsed-panel');
    const toggle=panel.id?document.querySelector('[data-panel-toggle="'+panel.id+'"]'):null;
    if(toggle)toggle.textContent='−';
  });
  document.querySelectorAll('details').forEach(details=>details.open=true);
  const main=document.querySelector('main');
  const railScroll=rail?.querySelector('.toolbox-rail-scroll')||rail;
  if(main)main.scrollTop=0;
  if(railScroll){railScroll.scrollTop=0;railScroll.scrollLeft=0;}
  window.scrollTo(0,0);
  await wait(350);
  const mainTop=main?Math.max(0,main.getBoundingClientRect().top):0;
  const railTop=rail?Math.max(0,rail.getBoundingClientRect().top):0;
  const mainBottom=mainTop+(main?Math.max(main.clientHeight,main.scrollHeight):0);
  const railBottom=railTop+(railScroll?Math.max(railScroll.clientHeight,railScroll.scrollHeight):0);
  const documentBottom=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);
  const height=Math.min(14000,Math.max(1100,Math.ceil(mainBottom+24),Math.ceil(railBottom+24),documentBottom));
  return JSON.stringify({height});
})()
"@
        if ($overview -is [string]) { $overview = $overview | ConvertFrom-Json }
        $height = [Math]::Max(1100, [int]$overview.height)
        Send-OverviewCdp "Emulation.setDeviceMetricsOverride" @{
            width = $Width
            height = $height
            deviceScaleFactor = 1
            mobile = $false
        } | Out-Null
        Start-Sleep -Milliseconds 250
        $shot = Send-OverviewCdp "Page.captureScreenshot" @{
            format = "png"
            fromSurface = $true
            captureBeyondViewport = $true
            clip = @{ x = 0; y = 0; width = $Width; height = $height; scale = 1 }
        }
        if (-not $shot.result.data) { throw "Chrome returned an empty overview screenshot for $shotUrl." }
        $bytes = [Convert]::FromBase64String($shot.result.data)
    }
    finally {
        if ($socket) { $socket.Dispose() }
        if ($chromeProcess -and -not $chromeProcess.HasExited) { Stop-Process -Id $chromeProcess.Id -Force -ErrorAction SilentlyContinue }
        Stop-PicoDmxChromeProfileProcesses -ProfileDir $profileDir
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
