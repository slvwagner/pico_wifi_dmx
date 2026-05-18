param(
    [string]$BaseUrl = "http://localhost/dmx/",
    [string]$OutDir = "docs/screenshots",
    [int]$Port = 9224
)

$ErrorActionPreference = "Stop"

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$repoRoot = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $repoRoot $OutDir
$profileDir = Join-Path $env:TEMP "pico-dmx-docshots"

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
    $BaseUrl
)

$chromeProcess = Start-Process -FilePath $chrome -ArgumentList $args -WindowStyle Hidden -PassThru

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

    $wsUrl = ($tabs | Where-Object { $_.url -like "$BaseUrl*" } | Select-Object -First 1).webSocketDebuggerUrl
    if (-not $wsUrl) { $wsUrl = $tabs[0].webSocketDebuggerUrl }

    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $socket.ConnectAsync([Uri]$wsUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $script:cdpId = 0

    function Send-Cdp {
        param(
            [string]$Method,
            [hashtable]$Params = @{}
        )
        $script:cdpId++
        $payload = @{ id = $script:cdpId; method = $Method; params = $Params } | ConvertTo-Json -Depth 20 -Compress
        $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
        $segment = [ArraySegment[byte]]::new($bytes)
        $socket.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

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

    function Eval-Js {
        param([string]$Expression)
        Send-Cdp "Runtime.evaluate" @{
            expression = $Expression
            awaitPromise = $true
            returnByValue = $true
        } | Out-Null
    }

    function Save-Screenshot {
        param([string]$Name)
        $result = Send-Cdp "Page.captureScreenshot" @{ format = "png"; fromSurface = $true }
        $file = Join-Path $outPath $Name
        [IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($result.result.data))
        Write-Host "Captured $file"
    }

    Send-Cdp "Page.enable" | Out-Null
    Send-Cdp "Runtime.enable" | Out-Null
    Start-Sleep -Seconds 2

    Eval-Js @"
(async()=>{
  ['profiles','patch'].forEach(name=>localStorage.setItem(name+'Collapsed','0'));
  ['profilesCollapseBtn','patchCollapseBtn'].forEach(id=>{
    const btn=document.getElementById(id);
    if(btn && btn.textContent.trim()==='+') btn.click();
  });
  const addBody=document.getElementById('addControlBody');
  if(addBody) addBody.style.display='';
  localStorage.setItem('fixtureCardCollapsed','[]');
  document.querySelectorAll('[data-collapse-fixture]').forEach(btn=>{
    if(btn.textContent.trim()==='▶') btn.click();
  });
  document.querySelector('main')?.scrollTo(0,0);
  await new Promise(r=>setTimeout(r,500));
})()
"@
    Save-Screenshot "fixture-controller-expanded.png"

    Eval-Js @"
(async()=>{
  ['profilesCollapseBtn'].forEach(id=>{
    const btn=document.getElementById(id);
    if(btn && btn.textContent.trim()==='+') btn.click();
  });
  const addBody=document.getElementById('addControlBody');
  if(addBody) addBody.style.display='';
  const panel=document.querySelector('#profileList') || document.querySelector('#profileForm') || document.body;
  document.querySelector('main')?.scrollTo(0,70);
  await new Promise(r=>setTimeout(r,500));
})()
"@
    Save-Screenshot "fixture-controller-profile-controls.png"

    Eval-Js @"
(async()=>{
  const fixtureIds=(Array.isArray(fixtures)?fixtures.slice(0,4).map(f=>f.id):[]);
  if(Array.isArray(savedGroups) && !savedGroups.length && fixtureIds.length){
    savedGroups=[
      {id:'doc_group_front',name:'Front movers',fixtureIds:fixtureIds.slice(0,2),values:{}},
      {id:'doc_group_back',name:'Back movers',fixtureIds:fixtureIds.slice(2,4),values:{}},
      {id:'doc_group_all',name:'All movers',fixtureIds:fixtureIds,values:{}}
    ];
  }
  if(typeof loadGroup==='function' && Array.isArray(savedGroups) && savedGroups.length){
    loadGroup(0);
    if(savedGroups.length>1) loadGroup(1);
  }
  if(typeof renderSavedGroupsList==='function') renderSavedGroupsList();
  const saved=document.querySelector('#savedGroupsCollapseBtn');
  if(saved && saved.textContent.trim()==='+') saved.click();
  document.getElementById('savedGroupsBody')?.scrollIntoView({block:'start'});
  await new Promise(r=>setTimeout(r,500));
})()
"@
    Save-Screenshot "fixture-controller-saved-groups.png"

    Eval-Js @"
(async()=>{
  ['profilesCollapseBtn','patchCollapseBtn'].forEach(id=>{
    const btn=document.getElementById(id);
    if(btn && btn.textContent.trim()==='−') btn.click();
  });
  const addBody=document.getElementById('addControlBody');
  if(addBody) addBody.style.display='none';
  const savedGroupsBtn=document.getElementById('savedGroupsCollapseBtn');
  if(savedGroupsBtn && savedGroupsBtn.textContent.trim()==='+') savedGroupsBtn.click();
  if(typeof loadGroup==='function' && Array.isArray(savedGroups) && savedGroups.length){
    if(typeof activeSavedGroupIds!=='undefined') activeSavedGroupIds.clear();
    loadGroup(0);
    if(savedGroups.length>1) loadGroup(1);
  }
  if(typeof collapsedFixtureIds!=='undefined') collapsedFixtureIds.clear();
  if(typeof drawSurface==='function') drawSurface();
  document.getElementById('savedGroupsBody')?.scrollIntoView({block:'start'});
  window.scrollBy(0,-130);
  const sceneBox=document.querySelector('#sceneBox');
  const toggle=document.querySelector('#sceneBoxToggle');
  if(sceneBox) sceneBox.style.display='';
  if(sceneBox && sceneBox.classList.contains('collapsed') && toggle) toggle.click();
  await new Promise(r=>setTimeout(r,500));
})()
"@
    Save-Screenshot "fixture-controller-scene-box.png"

    Eval-Js @"
(async()=>{
  ['profilesCollapseBtn','patchCollapseBtn'].forEach(id=>{
    const btn=document.getElementById(id);
    if(btn && btn.textContent.trim()==='−') btn.click();
  });
  const addBody=document.getElementById('addControlBody');
  if(addBody) addBody.style.display='none';
  if(typeof clearGroupSelection==='function') clearGroupSelection();
  else {
    if(typeof selectedFixtureIds!=='undefined') selectedFixtureIds.clear();
    if(typeof activeSavedGroupIds!=='undefined') activeSavedGroupIds.clear();
    if(typeof renderSavedGroupsList==='function') renderSavedGroupsList();
  }
  const savedGroupsBtn=document.getElementById('savedGroupsCollapseBtn');
  if(savedGroupsBtn && savedGroupsBtn.textContent.trim()==='−') savedGroupsBtn.click();
  const sceneBox=document.querySelector('#sceneBox');
  const sceneToggle=document.querySelector('#sceneBoxToggle');
  if(sceneBox && !sceneBox.classList.contains('collapsed') && sceneToggle) sceneToggle.click();
  if(sceneBox) sceneBox.style.display='none';
  const status=document.getElementById('status');
  if(status) status.textContent='Live fixture control';
  if(typeof collapsedFixtureIds!=='undefined') collapsedFixtureIds.clear();
  if(typeof drawSurface==='function') drawSurface();
  await new Promise(r=>setTimeout(r,300));
  document.querySelectorAll('[data-collapse-fixture]').forEach(btn=>{
    if(btn.textContent.trim()==='▶') btn.click();
  });
  document.querySelector('#controlSurfacePanel')?.scrollIntoView({block:'start'});
  window.scrollBy(0,-80);
  await new Promise(r=>setTimeout(r,500));
})()
"@
    Save-Screenshot "fixture-controller-live-controls.png"

    Eval-Js @"
(async()=>{
  if(typeof loadGroup==='function' && Array.isArray(savedGroups) && savedGroups.length) {
    loadGroup(0);
  } else {
    selectedFixtureIds = new Set(fixtures.slice(0,2).map(f=>f.id));
    groupValues = {};
    drawSurface();
  }
  await new Promise(r=>setTimeout(r,500));
  if(typeof openGroupModal==='function') openGroupModal();
  else document.querySelector('#openGroupEdit')?.click();
  await new Promise(r=>setTimeout(r,600));
})()
"@
    Save-Screenshot "fixture-controller-group-modal.png"
}
finally {
    if ($socket) { $socket.Dispose() }
    if ($chromeProcess -and -not $chromeProcess.HasExited) { Stop-Process -Id $chromeProcess.Id -Force }
}
