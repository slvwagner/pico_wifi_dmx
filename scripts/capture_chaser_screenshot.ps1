param(
    [string]$BaseUrl = "http://localhost/dmx/",
    [string]$OutDir = "docs/screenshots",
    [int]$Port = 9240
)

$ErrorActionPreference = "Stop"

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$repoRoot = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $repoRoot $OutDir
$profileDir = Join-Path $env:TEMP "pico-dmx-chaser-docshot"
$url = $BaseUrl.TrimEnd("/") + "/dmx_chaser.html?docshot=" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

New-Item -ItemType Directory -Force -Path $outPath | Out-Null
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

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
  function openToolbox(id){
    const box=document.getElementById(id);
    const toggle=document.getElementById(id+'Toggle');
    if(!box)return;
    box.style.display='';
    if(box.classList.contains('collapsed')&&toggle)toggle.click();
  }
  ['chaserGroupsBox','chaseBox','stepsBox','browserPlaybackBox'].forEach(openToolbox);
  const stepValues={};
  const part={};
  setup.fixtures.slice(0,6).forEach((f,idx)=>{
    const p=fixtureProfile(f);
    const c=(p?.controls||[]).find(x=>/dimmer/i.test(x.label||''))||(p?.controls||[])[0];
    if(!c)return;
    const key=controlKey(f,c);
    part[key]=true;
    stepValues[key]=idx%2?190:80;
  });
  const docChase={
    baseUrl:document.getElementById('baseUrl')?.value||'',
    playback:{slot:0,speed:1,mode:'loop',loops:2,direction:'forward'},
    browserPlayback:{loop:true,live:false,bpm:120,beats:1,defaultFade:0,updateRate:25},
    participating:part,
    steps:[
      {id:9001,label:'Step 1',duration:500,fade:0,values:stepValues},
      {id:9002,label:'Step 2',duration:500,fade:40,values:Object.fromEntries(Object.entries(stepValues).map(([k,v])=>[k,255-v]))}
    ]
  };
  savedChases=[{id:'doc_chase_1',name:'Doc Chase',slot:0,data:docChase,visual:{type:'visual',color:'#7f2ac8',image:''}}];
  chaseSlotCols=4;
  chaseSlotRows=4;
  renderChaseSlotMatrix();
  applyChaserData(docChase,true);
  await selectStepForEdit(0);
  refreshChaserGroupActions();
  await wait(500);
  return {
    steps:document.querySelectorAll('#stepList [data-step-index]').length,
    editDisabled:document.getElementById('chaserGroupsEdit')?.disabled
  };
})()
'@

    $eval = Send-Cdp "Runtime.evaluate" @{
        expression = $expression
        awaitPromise = $true
        returnByValue = $true
    }
    if ($eval.exceptionDetails) {
        $message = $eval.exceptionDetails.text
        if ($eval.exceptionDetails.exception.description) { $message = $eval.exceptionDetails.exception.description }
        throw "Chaser docshot setup failed: $message"
    }
    $state = $eval.result.result.value
    if (-not $state -or $state.steps -lt 1 -or $state.editDisabled) {
        throw "Chaser docshot did not reach recalled-step state."
    }

    $shot = Send-Cdp "Page.captureScreenshot" @{ format = "png"; fromSurface = $true }
    $file = Join-Path $outPath "chaser.png"
    [IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($shot.result.data))
    Write-Host "Captured $file"
}
finally {
    if ($socket) { $socket.Dispose() }
    if ($chromeProcess -and -not $chromeProcess.HasExited) { Stop-Process -Id $chromeProcess.Id -Force }
}
