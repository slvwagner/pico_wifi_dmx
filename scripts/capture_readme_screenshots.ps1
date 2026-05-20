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
  window.docShots={
    wait(ms=500){return new Promise(r=>setTimeout(r,ms));},
    setSection(btnId,bodyId,collapsed){
      const btn=document.getElementById(btnId);
      const body=document.getElementById(bodyId);
      if(body) body.style.display=collapsed?'none':'';
      if(btn) btn.textContent=collapsed?'+':'−';
    },
    setSetupSections({profiles=false,patch=false}={}){
      this.setSection('profilesCollapseBtn','profilesBody',profiles);
      this.setSection(null,'addControlBody',profiles);
      this.setSection('patchCollapseBtn','patchBody',patch);
    },
    setSceneBox({visible=true,open=true}={}){
      const box=document.querySelector('#sceneBox');
      const toggle=document.querySelector('#sceneBoxToggle');
      if(!box)return;
      box.style.display=visible?'':'none';
      if(open && box.classList.contains('collapsed') && toggle) toggle.click();
      if(!open && !box.classList.contains('collapsed') && toggle) toggle.click();
    },
    setGroupsBox({visible=true,open=true}={}){
      const box=document.querySelector('#groupsBox');
      const toggle=document.querySelector('#groupsBoxToggle');
      if(!box)return;
      box.style.display=visible?'':'none';
      if(open && box.classList.contains('collapsed') && toggle) toggle.click();
      if(!open && !box.classList.contains('collapsed') && toggle) toggle.click();
    },
    clearGroupFilter(){
      if(typeof clearGroupSelection==='function') clearGroupSelection();
      else {
        if(typeof selectedFixtureIds!=='undefined') selectedFixtureIds.clear();
        if(typeof activeSavedGroupIds!=='undefined') activeSavedGroupIds.clear();
        if(typeof renderSavedGroupsList==='function') renderSavedGroupsList();
        if(typeof drawSurface==='function') drawSurface();
      }
    },
    ensureDemoGroups(){
      const fixtureIds=(Array.isArray(fixtures)?fixtures.slice(0,4).map(f=>f.id):[]);
      if(Array.isArray(savedGroups) && !savedGroups.length && fixtureIds.length){
        savedGroups=[
          {id:'doc_group_front',name:'Front movers',fixtureIds:fixtureIds.slice(0,2),values:{}},
          {id:'doc_group_back',name:'Back movers',fixtureIds:fixtureIds.slice(2,4),values:{}},
          {id:'doc_group_all',name:'All movers',fixtureIds:fixtureIds,values:{}}
        ];
      }
      if(typeof renderSavedGroupsList==='function') renderSavedGroupsList();
    },
    selectDemoGroups(){
      this.ensureDemoGroups();
      if(typeof loadGroup==='function' && Array.isArray(savedGroups) && savedGroups.length){
        if(typeof activeSavedGroupIds!=='undefined') activeSavedGroupIds.clear();
        loadGroup(0);
        if(savedGroups.length>1) loadGroup(1);
      }
    },
    expandFixtureCards(){
      if(typeof collapsedFixtureIds!=='undefined') collapsedFixtureIds.clear();
      if(typeof drawSurface==='function') drawSurface();
      document.querySelectorAll('[data-collapse-fixture]').forEach(btn=>{
        if(btn.textContent.trim()==='▶') btn.click();
      });
    }
  };

  docShots.setSetupSections({profiles:false,patch:false});
  docShots.setGroupsBox({visible:true,open:true});
  ['profiles','patch'].forEach(name=>localStorage.setItem(name+'Collapsed','0'));
  localStorage.setItem('groupsBoxCollapsed','0');
  localStorage.setItem('fixtureCardCollapsed','[]');
  docShots.expandFixtureCards();
  document.querySelector('main')?.scrollTo(0,0);
  await docShots.wait();
})()
"@
    Save-Screenshot "fixture-controller-expanded.png"

    Eval-Js @"
(async()=>{
  docShots.setSetupSections({profiles:false,patch:true});
  docShots.setSceneBox({visible:false});
  docShots.setGroupsBox({visible:false});
  const panel=document.querySelector('#profileList') || document.querySelector('#profileForm') || document.body;
  document.querySelector('main')?.scrollTo(0,70);
  await docShots.wait();
})()
"@
    Save-Screenshot "fixture-controller-profile-controls.png"

    Eval-Js @"
(async()=>{
  docShots.setSetupSections({profiles:true,patch:true});
  docShots.setSceneBox({visible:false});
  docShots.setGroupsBox({visible:true,open:true});
  docShots.selectDemoGroups();
  await docShots.wait();
})()
"@
    Save-Screenshot "fixture-controller-saved-groups.png"

    Eval-Js @"
(async()=>{
  docShots.setSetupSections({profiles:true,patch:true});
  docShots.selectDemoGroups();
  docShots.expandFixtureCards();
  window.scrollBy(0,-130);
  docShots.setSceneBox({visible:true,open:true});
  docShots.setGroupsBox({visible:true,open:true});
  await docShots.wait();
})()
"@
    Save-Screenshot "fixture-controller-scene-box.png"

    Eval-Js @"
(async()=>{
  docShots.setSetupSections({profiles:true,patch:true});
  docShots.clearGroupFilter();
  docShots.setSceneBox({visible:false});
  docShots.setGroupsBox({visible:false});
  const status=document.getElementById('status');
  if(status) status.textContent='Live fixture control';
  docShots.expandFixtureCards();
  await docShots.wait(300);
  document.querySelector('#controlSurfacePanel')?.scrollIntoView({block:'start'});
  window.scrollBy(0,-80);
  await docShots.wait();
})()
"@
    Save-Screenshot "fixture-controller-live-controls.png"

    Eval-Js @"
(async()=>{
  docShots.setSetupSections({profiles:true,patch:true});
  docShots.setSceneBox({visible:false});
  docShots.setGroupsBox({visible:false});
  docShots.ensureDemoGroups();
  if(typeof loadGroup==='function' && Array.isArray(savedGroups) && savedGroups.length) loadGroup(0);
  else {
    selectedFixtureIds = new Set(fixtures.slice(0,2).map(f=>f.id));
    groupValues = {};
    drawSurface();
  }
  await docShots.wait();
  if(typeof openGroupModal==='function') openGroupModal();
  else document.querySelector('#openGroupEdit')?.click();
  await docShots.wait(600);
})()
"@
    Save-Screenshot "fixture-controller-group-modal.png"

    $chaserUrl = $BaseUrl.TrimEnd('/') + "/dmx_chaser.html"
    Send-Cdp "Page.navigate" @{ url = $chaserUrl } | Out-Null
    Start-Sleep -Seconds 2

    Eval-Js @"
(async()=>{
  const wait=(ms=500)=>new Promise(r=>setTimeout(r,ms));
  function openToolbox(id){
    const box=document.getElementById(id);
    const toggle=document.getElementById(id+'Toggle');
    if(!box)return;
    box.style.display='';
    if(box.classList.contains('collapsed')&&toggle)toggle.click();
  }
  function position(id,x,y,w,h){
    const box=document.getElementById(id);
    if(!box)return;
    box.style.left=x+'px';
    box.style.top=y+'px';
    box.style.right='auto';
    if(w)box.style.width=w+'px';
    if(h)box.style.height=h+'px';
  }
  function expandPanel(id){
    const panel=document.getElementById(id);
    const btn=document.querySelector('[data-panel-toggle="'+id+'"]');
    if(!panel)return;
    panel.classList.remove('collapsed-panel');
    if(btn)btn.textContent='−';
  }

  expandPanel('participationPanel');
  expandPanel('stepEditorSection');
  ['stepsBox','browserPlaybackBox','chaseBox'].forEach(openToolbox);
  const groups=document.getElementById('chaserGroupsBox');
  const groupsToggle=document.getElementById('chaserGroupsToggle');
  if(groups){
    groups.style.display='';
    if(!groups.classList.contains('collapsed')&&groupsToggle)groupsToggle.click();
    position('chaserGroupsBox',760,20,380);
  }
  position('stepsBox',20,110,380,520);
  position('browserPlaybackBox',625,600,430);
  position('chaseBox',1165,265,255);
  if(typeof drawStepList==='function')drawStepList();
  if(typeof drawParticipation==='function')drawParticipation();
  if(typeof drawStepEditor==='function')drawStepEditor();
  await wait(800);
})()
"@
    Save-Screenshot "chaser.png"
}
finally {
    if ($socket) { $socket.Dispose() }
    if ($chromeProcess -and -not $chromeProcess.HasExited) { Stop-Process -Id $chromeProcess.Id -Force }
}
