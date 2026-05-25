param(
    [string]$BaseUrl = "",
    [string]$OutDir = "docs/screenshots",
    [string]$ManualDataDir = "docs/manual-data",
    [string]$XamppDataDir = "",
    [string]$ChromePath = "",
    [int]$Port = 9240
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "local_path_config.ps1")
. (Join-Path $PSScriptRoot "screenshot_file_helpers.ps1")
$localPaths = Get-LocalPathConfig -RepoRoot $repoRoot
if (-not $BaseUrl) { $BaseUrl = $localPaths.baseUrl }
if (-not $XamppDataDir) { $XamppDataDir = Join-Path (Join-Path $localPaths.xamppHtdocs $localPaths.appFolder) "data" }
if (-not $ChromePath) { $ChromePath = $localPaths.chromePath }

$chrome = $ChromePath
$outPath = Join-Path $repoRoot $OutDir
$manualDataPath = Join-Path $repoRoot $ManualDataDir
$profileDir = $null
$backupDataDir = Get-PicoDmxTempPath ("pico-dmx-manual-data-backup-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$url = $BaseUrl.TrimEnd("/") + "/dmx_chaser.html?docshot=" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

New-Item -ItemType Directory -Force -Path $outPath | Out-Null

if (-not (Test-Path -LiteralPath $manualDataPath)) {
    throw "Manual data baseline not found: $manualDataPath"
}
if (-not (Test-Path -LiteralPath $XamppDataDir)) {
    throw "XAMPP data directory not found: $XamppDataDir"
}

New-Item -ItemType Directory -Force -Path $backupDataDir | Out-Null
Copy-Item -Path (Join-Path $XamppDataDir "*.json") -Destination $backupDataDir -Force -ErrorAction SilentlyContinue
Copy-Item -Path (Join-Path $manualDataPath "*.json") -Destination $XamppDataDir -Force

function New-ChromeArgs {
    param([string]$ProfileDir)
    return @(
        "--headless=new",
        "--remote-debugging-address=127.0.0.1",
        "--remote-debugging-port=$Port",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--user-data-dir=$ProfileDir",
        "--window-size=1440,1100",
        $url
    )
}

$chromeProcess = $null
$socket = $null

try {
    $jsonUrl = "http://127.0.0.1:$Port/json"
    $tabs = $null
    $lastChromeError = ""
    for ($attempt = 1; $attempt -le 3 -and -not $tabs; $attempt++) {
        $profileDir = Get-PicoDmxTempPath ("pico-dmx-chaser-docshot-" + [System.Guid]::NewGuid().ToString("N"))
        New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
        $chromeProcess = Start-PicoDmxProcess -FilePath $chrome -ArgumentList (New-ChromeArgs -ProfileDir $profileDir)
        for ($i = 0; $i -lt 80; $i++) {
            if ($chromeProcess -and $chromeProcess.HasExited) {
                $lastChromeError = "Chrome exited before debug endpoint became ready. Exit code: $($chromeProcess.ExitCode)"
                break
            }
            try {
                $tabs = Invoke-RestMethod -Uri $jsonUrl -UseBasicParsing -TimeoutSec 2
                if ($tabs) { break }
            } catch {
                Start-Sleep -Milliseconds 250
            }
        }
        if (-not $tabs) {
            if ($chromeProcess -and -not $chromeProcess.HasExited) { Stop-Process -Id $chromeProcess.Id -Force -ErrorAction SilentlyContinue }
            if ($profileDir -and (Test-Path -LiteralPath $profileDir)) { Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue }
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not $tabs) {
        if ($lastChromeError) { throw "$lastChromeError Last endpoint: $jsonUrl." }
        throw "Chrome debug endpoint did not become ready at $jsonUrl."
    }

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
        if ($Selector -match '(Box|Toolbox)$') {
            Invoke-PageScript @"
(async()=>{
  const selector=$selectorJson;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const el=document.querySelector(selector);
  if(!el)throw new Error('Missing screenshot element: '+selector);
  const rail=el.closest('.toolbox-rail')||document.querySelector('.toolbox-rail');
  if(!rail)throw new Error('Missing toolbox rail for '+selector);
  const railToggle=rail.querySelector('.toolbox-rail-toggle');
  if(rail.classList.contains('collapsed')&&railToggle)railToggle.click();
  if(el.classList.contains('collapsed')){
    const toggle=el.querySelector('.scene-toolbox__toggle');
    if(toggle)toggle.click();
    el.classList.remove('collapsed');
  }
  const firstBox=rail.querySelector('.scene-toolbox');
  if(firstBox&&firstBox!==el)rail.insertBefore(el,firstBox);
  rail.scrollTop=0;
  await wait(80);
  const railRect=rail.getBoundingClientRect();
  const elRect=el.getBoundingClientRect();
  rail.scrollTop=Math.max(0,rail.scrollTop+(elRect.top-railRect.top)-64);
  rail.scrollLeft=0;
  await wait(300);
  const firstBoxAfter=rail.querySelector('.scene-toolbox');
  if(firstBoxAfter&&firstBoxAfter!==el)rail.insertBefore(el,firstBoxAfter);
  rail.scrollTop=0;
  return true;
})()
"@ | Out-Null
            $rect = [pscustomobject]@{ x = 800; y = 0; width = 640; height = 1100 }
        } else {
        $rect = Invoke-PageScript @"
(async()=>{
  const selector=$selectorJson;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  let el=document.querySelector(selector);
  if(!el)throw new Error('Missing screenshot element: '+selector);
  const rail=el.closest('.toolbox-rail');
  if(rail){
    if(el.classList.contains('collapsed')){
      const toggle=el.querySelector('.scene-toolbox__toggle');
      if(toggle)toggle.click();
      el.classList.remove('collapsed');
    }
    rail.scrollTop=Math.max(0,el.offsetTop-64);
    rail.scrollLeft=0;
    await wait(260);
    const r=rail.getBoundingClientRect();
    return JSON.stringify({
      x:Math.max(0,Math.floor(r.left)),
      y:Math.max(0,Math.floor(r.top)),
      width:Math.ceil(r.width),
      height:Math.ceil(r.height)
    });
  } else {
    const main=el.closest('main')||document.querySelector('main');
    if(main&&main.scrollHeight>main.clientHeight){
      main.scrollTop=Math.max(0,el.offsetTop-72);
    }else{
      el.scrollIntoView({block:'start',inline:'nearest'});
    }
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
  const x=Math.max(0,Math.floor(left-pad));
  const y=Math.max(0,Math.floor(top-topPad));
  const width=Math.ceil(right-left+pad*2);
  const height=Math.ceil(bottom-top+topPad+pad);
  if(width<40||height<40)throw new Error('Screenshot element is too small: '+selector);
  return JSON.stringify({x,y,width,height});
})()
"@
        if ($rect -is [string]) { $rect = $rect | ConvertFrom-Json }
        }
        $shot = Send-Cdp "Page.captureScreenshot" @{
            format = "png"
            fromSurface = $true
            captureBeyondViewport = $false
            clip = @{
                x = [double]$rect.x
                y = [double]$rect.y
                width = [double]$rect.width
                height = [double]$rect.height
                scale = 1
            }
        }
        if (-not $shot.result.data) {
            $rectJson = $rect | ConvertTo-Json -Compress
            throw "Chrome returned an empty screenshot for $Selector with clip $rectJson"
        }
        $file = Join-Path $outPath $Name
        Write-PngIfChanged -Path $file -Bytes ([Convert]::FromBase64String($shot.result.data))
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
  ['chaserGroupsBox','chaseBox','stepsBox','chaserPaletteBox','fanToolbox','browserPlaybackBox'].forEach(openToolbox);
  const chaseBox=document.getElementById('chaseBox');
  const paletteBox=document.getElementById('chaserPaletteBox');
  if(chaseBox&&paletteBox)chaseBox.after(paletteBox);
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
  const chaseBox2=document.getElementById('chaseBox');
  const paletteBox2=document.getElementById('chaserPaletteBox');
  if(chaseBox2&&paletteBox2){
    chaseBox2.after(paletteBox2);
    openToolbox('chaserPaletteBox');
  }
  document.querySelector('main')?.scrollTo(0,0);
  window.scrollTo(0,0);
  const rail2=document.querySelector('.toolbox-rail');
  if(rail2)rail2.scrollTop=0;
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
    Write-PngIfChanged -Path $file -Bytes ([Convert]::FromBase64String($shot.result.data))

    Save-ElementScreenshot "#chaserGroupsBox" "chaser-toolbox-groups.png"
    Save-ElementScreenshot "#chaseBox" "chaser-toolbox-chases.png"
    Save-ElementScreenshot "#stepsBox" "chaser-toolbox-steps.png"
    Save-ElementScreenshot "#chaserPaletteBox" "chaser-toolbox-palettes.png"
    Save-ElementScreenshot "#fanToolbox" "chaser-toolbox-fanout.png"
    Save-ElementScreenshot "#browserPlaybackBox" "chaser-toolbox-browser-playback.png"
    $expression = @'
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  if(!Array.isArray(savedChases))savedChases=[];
  if(!savedChases.some(c=>parseInt(c.slot,10)===0)){
    const fallbackData={
      baseUrl:document.getElementById('baseUrl')?.value||'',
      playback:{slot:0,speed:1,mode:'loop',loops:2,direction:'forward'},
      browserPlayback:{loop:true,live:false,bpm:120,beats:1,defaultFade:0,updateRate:25},
      participating:{},
      steps:[]
    };
    savedChases.push({id:'doc_chase_tile',name:'Doc Chase',slot:0,data:fallbackData,visual:{type:'visual',color:'#7f2ac8',image:''}});
  }else{
    const chase=savedChases.find(c=>parseInt(c.slot,10)===0);
    chase.name=chase.name||'Doc Chase';
    chase.visual=chase.visual||{type:'visual',color:'#7f2ac8',image:''};
  }
  if(typeof renderChaseSlotMatrix==='function')renderChaseSlotMatrix();
  await wait();
  if(typeof openChaseVisualModal==='function')openChaseVisualModal(0);
  await wait();
  const name=document.getElementById('chaseVisualName');
  if(name)name.value='Doc Chase';
  return true;
})()
'@
    Invoke-PageScript $expression | Out-Null
    Save-ElementScreenshot "#chaseVisualModal .modal" "chaser-edit-tile.png"
    Invoke-PageScript "document.getElementById('chaseVisualClose2')?.click(); true" | Out-Null

    Send-Cdp "Page.navigate" @{ url = ($url + "&mainshots=1") } | Out-Null
    for ($i = 0; $i -lt 40; $i++) {
        $ready = Invoke-PageScript "document.readyState === 'complete'"
        if ($ready) { break }
        Start-Sleep -Milliseconds 250
    }
    Start-Sleep -Milliseconds 800
    $expression = @'
(async()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<30;i++){
    if(typeof setup==='object'&&Array.isArray(setup.fixtures)&&setup.fixtures.length)break;
    await wait(250);
  }
  const rail=document.querySelector('.toolbox-rail');
  const railToggle=rail?.querySelector('.toolbox-rail-toggle');
  if(rail&&!rail.classList.contains('collapsed')&&railToggle)railToggle.click();
  localStorage.setItem('toolboxRailCollapsed','1');
  ['participationPanel','stepEditorSection'].forEach(id=>{
    const panel=document.getElementById(id);
    const btn=document.querySelector('[data-panel-toggle="'+id+'"]');
    if(panel)panel.classList.remove('collapsed-panel');
    if(btn)btn.textContent='−';
  });
  if(typeof loadChases==='function')await loadChases();
  const chase=(Array.isArray(savedChases)?savedChases:[]).find(c=>c?.data?.steps?.length&&Object.keys(c.data.steps[0].values||{}).length>=2)||savedChases?.[0];
  if(chase&&typeof applyChaserData==='function'){
    applyChaserData(chase.data,true);
    if(typeof selectStepForEdit==='function')await selectStepForEdit(0);
  }
  if(typeof drawParticipation==='function')drawParticipation();
  if(typeof drawStepEditor==='function')drawStepEditor();
  if(typeof refreshChaserGroupActions==='function')refreshChaserGroupActions();
  const picoSlot=document.getElementById('picoSlot'); if(picoSlot)picoSlot.value='0';
  const picoMode=document.getElementById('picoChaserMode'); if(picoMode)picoMode.value='loop';
  const picoDirection=document.getElementById('picoDirection'); if(picoDirection)picoDirection.value='forward';
  const picoSpeed=document.getElementById('picoSpeed'); if(picoSpeed)picoSpeed.value='1.0';
  const picoLoopCount=document.getElementById('picoLoopCount'); if(picoLoopCount)picoLoopCount.value='2';
  const main=document.querySelector('main');
  if(main)main.scrollTop=0;
  window.scrollTo(0,0);
  await wait(700);
  return {
    text:(main?.innerText||'').slice(0,80),
    participation:document.getElementById('participationPanel')?.getBoundingClientRect().toJSON?.()
  };
})()
'@
    Invoke-PageScript $expression | Out-Null
    Save-ElementScreenshot "#participationPanel" "chaser-participating-controls.png"
    Save-ElementScreenshot "#stepEditorSection" "chaser-edit-step.png"
    $expression = @'
(async()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const participation=document.getElementById('participationPanel');
  const participationBtn=document.querySelector('[data-panel-toggle="participationPanel"]');
  const editStep=document.getElementById('stepEditorSection');
  const editBtn=document.querySelector('[data-panel-toggle="stepEditorSection"]');
  if(participation&&!participation.classList.contains('collapsed-panel')&&participationBtn)participationBtn.click();
  if(editStep&&editStep.classList.contains('collapsed-panel')&&editBtn)editBtn.click();
  const main=document.querySelector('main');
  if(main)main.scrollTop=0;
  window.scrollTo(0,0);
  await wait(350);
  return true;
})()
'@
    Invoke-PageScript $expression | Out-Null
    Save-ElementScreenshot ".chaser-card-rows" "chaser-collapsed-work-area.png"
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
