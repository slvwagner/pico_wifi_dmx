param(
    [string]$BaseUrl = "http://localhost/dmx/",
    [string]$OutDir = "docs/screenshots",
    [string]$ManualDataDir = "docs/manual-data",
    [string]$XamppDataDir = "E:\Software\xampp\htdocs\dmx\data",
    [int]$Port = 9240
)

$ErrorActionPreference = "Stop"

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$repoRoot = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $repoRoot $OutDir
$manualDataPath = Join-Path $repoRoot $ManualDataDir
$profileDir = Join-Path $env:TEMP "pico-dmx-chaser-docshot"
$backupDataDir = Join-Path $env:TEMP ("pico-dmx-manual-data-backup-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$url = $BaseUrl.TrimEnd("/") + "/dmx_chaser.html?docshot=" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

New-Item -ItemType Directory -Force -Path $outPath | Out-Null
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

if (-not (Test-Path -LiteralPath $manualDataPath)) {
    throw "Manual data baseline not found: $manualDataPath"
}
if (-not (Test-Path -LiteralPath $XamppDataDir)) {
    throw "XAMPP data directory not found: $XamppDataDir"
}

New-Item -ItemType Directory -Force -Path $backupDataDir | Out-Null
Copy-Item -Path (Join-Path $XamppDataDir "*.json") -Destination $backupDataDir -Force -ErrorAction SilentlyContinue
Copy-Item -Path (Join-Path $manualDataPath "*.json") -Destination $XamppDataDir -Force

$args = @(
    "--headless=new",
    "--remote-debugging-port=$Port",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--user-data-dir=$profileDir",
    "--window-size=1440,1100",
    $url
)

$chromeProcess = Start-Process -FilePath $chrome -ArgumentList $args -WindowStyle Hidden -PassThru
$socket = $null

try {
    $jsonUrl = "http://127.0.0.1:$Port/json"
    $tabs = $null
    for ($i = 0; $i -lt 40; $i++) {
        try {
            $tabs = Invoke-RestMethod -Uri $jsonUrl -UseBasicParsing
            if ($tabs) { break }
        } catch {
            Start-Sleep -Milliseconds 250
        }
    }
    if (-not $tabs) { throw "Chrome debug endpoint did not become ready." }

    $wsUrl = ($tabs | Where-Object { $_.url -like "*dmx_chaser.html*" } | Select-Object -First 1).webSocketDebuggerUrl
    if (-not $wsUrl) { throw "Could not find Chaser tab." }

    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $socket.ConnectAsync([Uri]$wsUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
    $script:cdpId = 0

    function Send-Cdp {
        param(
            [string]$Method,
            [hashtable]$Params = @{}
        )
        $script:cdpId++
        $payload = @{ id = $script:cdpId; method = $Method; params = $Params } | ConvertTo-Json -Depth 30 -Compress
        $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
        $socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

        $buffer = New-Object byte[] 1048576
        $builder = [Text.StringBuilder]::new()
        while ($true) {
            $result = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).GetAwaiter().GetResult()
            [void]$builder.Append([Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count))
            if ($result.EndOfMessage) {
                $message = $builder.ToString() | ConvertFrom-Json
                if ($message.id -eq $script:cdpId) { return $message }
                $builder.Clear() | Out-Null
            }
        }
    }

    function Invoke-PageScript {
        param(
            [string]$Expression
        )
        $eval = Send-Cdp "Runtime.evaluate" @{
            expression = $Expression
            awaitPromise = $true
            returnByValue = $true
        }
        if ($eval.exceptionDetails) {
            $message = $eval.exceptionDetails.text
            if ($eval.exceptionDetails.exception.description) { $message = $eval.exceptionDetails.exception.description }
            throw "Page script failed: $message"
        }
        return $eval.result.result.value
    }

    function Save-ElementScreenshot {
        param(
            [string]$Selector,
            [string]$Name
        )
        $selectorJson = $Selector | ConvertTo-Json -Compress
        $rect = Invoke-PageScript @"
(async()=>{
  const selector=$selectorJson;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const el=document.querySelector(selector);
  if(!el)throw new Error('Missing screenshot element: '+selector);
  const rail=el.closest('.toolbox-rail');
  if(rail){
    const header=el.querySelector('.scene-toolbox__header');
    rail.scrollTop=Math.max(0,el.offsetTop-(header?.offsetHeight||0)-12);
    rail.scrollLeft=0;
  }else{
    el.scrollIntoView({block:'start',inline:'nearest'});
  }
  await wait(220);
  const rects=[el.getBoundingClientRect()];
  const header=el.querySelector('.scene-toolbox__header');
  const body=el.querySelector('.scene-toolbox__body');
  if(header)rects.push(header.getBoundingClientRect());
  if(body)rects.push(body.getBoundingClientRect());
  const left=Math.min(...rects.map(r=>r.left));
  const top=Math.min(...rects.map(r=>r.top));
  const right=Math.max(...rects.map(r=>r.right));
  const bottom=Math.max(...rects.map(r=>r.bottom));
  const pad=10;
  const topPad=el.classList.contains('scene-toolbox')?120:pad;
  const x=Math.max(0,Math.floor(left+window.scrollX-pad));
  const y=Math.max(0,Math.floor(top+window.scrollY-topPad));
  const width=Math.ceil(right-left+pad*2);
  const height=Math.ceil(bottom-top+topPad+pad);
  if(width<40||height<40)throw new Error('Screenshot element is too small: '+selector);
  return{x,y,width,height};
})()
"@
        $shot = Send-Cdp "Page.captureScreenshot" @{
            format = "png"
            fromSurface = $true
            captureBeyondViewport = $true
            clip = @{
                x = [double]$rect.x
                y = [double]$rect.y
                width = [double]$rect.width
                height = [double]$rect.height
                scale = 1
            }
        }
        $file = Join-Path $outPath $Name
        [IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($shot.result.data))
        Write-Host "Captured $file"
    }

    Send-Cdp "Page.enable" | Out-Null
    Send-Cdp "Runtime.enable" | Out-Null
    Start-Sleep -Milliseconds 2500

    $expression = @'
(async()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const rail=document.querySelector('.toolbox-rail');
  const railToggle=rail?.querySelector('.toolbox-rail-toggle');
  if(rail&&rail.classList.contains('collapsed')&&railToggle)railToggle.click();
  for(let i=0;i<30;i++){
    if(typeof setup==='object'&&Array.isArray(setup.fixtures)&&setup.fixtures.length)break;
    await wait(250);
  }
  if(window.DmxCommon&&typeof DmxCommon.saveSharedGroupSelection==='function')DmxCommon.saveSharedGroupSelection([]);
  if(typeof chaserGroupsBox!=='undefined'&&chaserGroupsBox?.clearSelection)chaserGroupsBox.clearSelection();
  if(typeof chaserGroupsBox!=='undefined'&&chaserGroupsBox?.loadGroups)await chaserGroupsBox.loadGroups();
  function openToolbox(id){
    const box=document.getElementById(id);
    const toggle=document.getElementById(id+'Toggle');
    if(!box)return;
    box.style.display='';
    if(box.classList.contains('collapsed')&&toggle)toggle.click();
  }
  ['chaserGroupsBox','chaseBox','stepsBox','fanToolbox','browserPlaybackBox'].forEach(openToolbox);
  if(typeof loadChases==='function')await loadChases();
  if(!Array.isArray(savedChases)||!savedChases.length)throw new Error('Manual data has no saved chases');
  chaseSlotCols=4;
  chaseSlotRows=Math.max(3,Math.ceil(savedChases.length/chaseSlotCols));
  renderChaseSlotMatrix();
  const chase=savedChases.find(c=>c?.data?.steps?.length&&Object.values(c.data.steps[0].values||{}).length>=2)||savedChases[0];
  applyChaserData(chase.data,true);
  await selectStepForEdit(0);
  fanState.spread=Math.min(80,fanMaxValue());
  fanState.mode='symmetric';
  fanState.bases={};
  renderFanToolbox();
  refreshChaserGroupActions();
  document.getElementById('picoSlot').value='0';
  document.getElementById('picoChaserMode').value='loop';
  document.getElementById('picoDirection').value='forward';
  document.getElementById('picoSpeed').value='1.0';
  document.getElementById('picoLoopCount').value='2';
  await wait(500);
  return {
    steps:document.querySelectorAll('#stepList [data-step-index]').length,
    editDisabled:document.getElementById('chaserGroupsEdit')?.disabled
  };
})()
'@

    $state = Invoke-PageScript $expression
    if (-not $state -or $state.steps -lt 1 -or $state.editDisabled) {
        throw "Chaser docshot did not reach recalled-step state."
    }

    $shot = Send-Cdp "Page.captureScreenshot" @{ format = "png"; fromSurface = $true }
    $file = Join-Path $outPath "chaser.png"
    [IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($shot.result.data))
    Write-Host "Captured $file"

    Save-ElementScreenshot "#chaserGroupsBox" "chaser-toolbox-groups.png"
    Save-ElementScreenshot "#chaseBox" "chaser-toolbox-chases.png"
    Save-ElementScreenshot "#stepsBox" "chaser-toolbox-steps.png"
    Save-ElementScreenshot "#fanToolbox" "chaser-toolbox-fanout.png"
    Save-ElementScreenshot "#browserPlaybackBox" "chaser-toolbox-browser-playback.png"
    Save-ElementScreenshot "#participationPanel" "chaser-participating-controls.png"
    Save-ElementScreenshot "#stepEditorSection" "chaser-edit-step.png"
    Save-ElementScreenshot "#picoPanel" "chaser-pico-playback.png"
}
finally {
    if ($socket) { $socket.Dispose() }
    if ($chromeProcess -and -not $chromeProcess.HasExited) { Stop-Process -Id $chromeProcess.Id -Force }
    if (Test-Path -LiteralPath $backupDataDir) {
        Copy-Item -Path (Join-Path $backupDataDir "*.json") -Destination $XamppDataDir -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $backupDataDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
