param(
    [string]$BaseUrl = "",
    [string]$OutDir = "docs/screenshots",
    [string]$ChromePath = "",
    [int]$Port = 9224
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "local_path_config.ps1")
. (Join-Path $PSScriptRoot "screenshot_file_helpers.ps1")
$localPaths = Get-LocalPathConfig -RepoRoot $repoRoot
if (-not $BaseUrl) { $BaseUrl = $localPaths.baseUrl }
if (-not $ChromePath) { $ChromePath = $localPaths.chromePath }

$chrome = $ChromePath
$outPath = Join-Path $repoRoot $OutDir
$profileDir = $null

New-Item -ItemType Directory -Force -Path $outPath | Out-Null

$cacheBust = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$startUrl = $BaseUrl
$startUrl += ($(if ($startUrl.Contains("?")) { "&" } else { "?" }) + "docshot=$cacheBust")

function New-ChromeArgs {
    param([string]$ProfileDir, [int]$DebugPort)
    return @(
        "--headless=new",
        "--remote-debugging-address=127.0.0.1",
        "--remote-debugging-port=$DebugPort",
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
        "--user-data-dir=$ProfileDir",
        "--window-size=1440,1100",
        $startUrl
    )
}

$chromeProcess = $null

try {
    $jsonUrl = ""
    $tabs = $null
    $lastChromeError = ""
    for ($attempt = 1; $attempt -le 3 -and -not $tabs; $attempt++) {
        $jsonUrl = ""
        $profileDir = Get-PicoDmxTempPath ("pico-dmx-docshots-" + [System.Guid]::NewGuid().ToString("N"))
        New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
        $debugPort = if ($Port -gt 0) { $Port } else { Get-FreeTcpPort }
        $jsonUrl = "http://127.0.0.1:$debugPort/json"
        $chromeProcess = Start-PicoDmxProcess -FilePath $chrome -ArgumentList (New-ChromeArgs -ProfileDir $profileDir -DebugPort $debugPort)
        for ($i = 0; $i -lt 24; $i++) {
            if ($chromeProcess -and $chromeProcess.HasExited) {
                $lastChromeError = "Chrome exited before debug endpoint became ready. Exit code: $($chromeProcess.ExitCode)"
            }
            try {
                $tabs = Invoke-RestMethod -Uri $jsonUrl -UseBasicParsing -TimeoutSec 1
                if ($tabs) { break }
            } catch {
                Start-Sleep -Milliseconds 250
            }
        }
        if (-not $tabs) {
            if ($chromeProcess -and -not $chromeProcess.HasExited) { Stop-Process -Id $chromeProcess.Id -Force -ErrorAction SilentlyContinue }
            Stop-PicoDmxChromeProfileProcesses -ProfileDir $profileDir
            if ($profileDir -and (Test-Path -LiteralPath $profileDir)) { Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue }
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not $tabs) {
        if ($lastChromeError) { throw "$lastChromeError Last endpoint: $jsonUrl." }
        throw "Chrome debug endpoint did not become ready at $jsonUrl."
    }

    $wsUrl = ($tabs | Where-Object { $_.url -like "$BaseUrl*" } | Select-Object -First 1).webSocketDebuggerUrl
    if (-not $wsUrl) { $wsUrl = $tabs[0].webSocketDebuggerUrl }

    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $socket.ConnectAsync([Uri]$wsUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
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
        $evalResult = Send-Cdp "Runtime.evaluate" @{
            expression = $Expression
            awaitPromise = $true
            returnByValue = $true
        }
        if ($evalResult.exceptionDetails) {
            $message = $evalResult.exceptionDetails.text
            if ($evalResult.exceptionDetails.exception.description) {
                $message = $evalResult.exceptionDetails.exception.description
            }
            throw "JavaScript evaluation failed: $message"
        }
        return $null
    }

    function Invoke-PageScript {
        param([string]$Expression)
        $evalResult = Send-Cdp "Runtime.evaluate" @{
            expression = $Expression
            awaitPromise = $true
            returnByValue = $true
        }
        if ($evalResult.exceptionDetails) {
            $message = $evalResult.exceptionDetails.text
            if ($evalResult.exceptionDetails.exception.description) {
                $message = $evalResult.exceptionDetails.exception.description
            }
            throw "JavaScript evaluation failed: $message"
        }
        return $evalResult.result.result.value
    }

    function Save-Screenshot {
        param([string]$Name)
        $result = Send-Cdp "Page.captureScreenshot" @{ format = "png"; fromSurface = $true }
        $file = Join-Path $outPath $Name
        Write-PngIfChanged -Path $file -Bytes ([Convert]::FromBase64String($result.result.data))
    }

    function Save-ToolboxEditScreenshot {
        param([string]$Name)
        $rect = Invoke-PageScript @"
(async()=>{
  const rail=document.querySelector('.toolbox-rail');
  const header=rail?.querySelector('.toolbox-rail-header');
  if(!rail||!header)throw new Error('Missing toolbox rail/header for Edit-mode screenshot');
  const scrollHost=rail.querySelector('.toolbox-rail-scroll')||rail;
  scrollHost.scrollTop=0;
  scrollHost.scrollLeft=0;
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const railRect=rail.getBoundingClientRect();
  const editRect=header.querySelector('.toolbox-rail-edit')?.getBoundingClientRect();
  if(!editRect)throw new Error('Missing toolbox rail Edit button for Edit-mode screenshot');
  const pad=8;
  return JSON.stringify({
    x:Math.max(0,Math.floor(editRect.left-pad)),
    y:Math.max(0,Math.floor(editRect.top-pad)),
    width:Math.ceil(editRect.width+pad*2),
    height:Math.max(48,Math.ceil(editRect.height+pad*2))
  });
})()
"@
        if ($rect -is [string]) { $rect = $rect | ConvertFrom-Json }
        $result = Send-Cdp "Page.captureScreenshot" @{
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
        if (-not $result.result.data) { throw "Chrome returned an empty toolbox Edit-mode screenshot" }
        $file = Join-Path $outPath $Name
        Write-PngIfChanged -Path $file -Bytes ([Convert]::FromBase64String($result.result.data))
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
  const scrollHost=rail.querySelector('.toolbox-rail-scroll')||rail;
  const railToggle=rail.querySelector('.toolbox-rail-toggle');
  if(rail.classList.contains('collapsed')&&railToggle)railToggle.click();
  if(el.classList.contains('collapsed')){
    const toggle=el.querySelector('.scene-toolbox__toggle');
    if(toggle)toggle.click();
    el.classList.remove('collapsed');
  }
  const firstBox=scrollHost.querySelector('.scene-toolbox');
  if(firstBox&&firstBox!==el)scrollHost.insertBefore(el,firstBox);
  scrollHost.scrollTop=0;
  await wait(80);
  const railRect=rail.getBoundingClientRect();
  const elRect=el.getBoundingClientRect();
  scrollHost.scrollTop=Math.max(0,scrollHost.scrollTop+(elRect.top-railRect.top)-64);
  scrollHost.scrollLeft=0;
  await wait(300);
  const firstBoxAfter=scrollHost.querySelector('.scene-toolbox');
  if(firstBoxAfter&&firstBoxAfter!==el)scrollHost.insertBefore(el,firstBoxAfter);
  scrollHost.scrollTop=0;
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
    const scrollHost=rail.querySelector('.toolbox-rail-scroll')||rail;
    if(el.classList.contains('collapsed')){
      const toggle=el.querySelector('.scene-toolbox__toggle');
      if(toggle)toggle.click();
      el.classList.remove('collapsed');
    }
    scrollHost.scrollTop=Math.max(0,el.offsetTop-64);
    scrollHost.scrollLeft=0;
    await wait(260);
    const r=rail.getBoundingClientRect();
    return JSON.stringify({
      x:Math.max(0,Math.floor(r.left)),
      y:Math.max(0,Math.floor(r.top)),
      width:Math.ceil(r.width),
      height:Math.ceil(r.height)
    });
  } else {
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
  const scrollX=rail?0:window.scrollX;
  const scrollY=rail?0:window.scrollY;
  const x=Math.max(0,Math.floor(left+scrollX-pad));
  const y=Math.max(0,Math.floor(top+scrollY-topPad));
  const width=Math.ceil(right-left+pad*2);
  const height=Math.ceil(bottom-top+topPad+pad);
  if(width<40||height<40)throw new Error('Screenshot element is too small: '+selector);
  return JSON.stringify({x,y,width,height});
})()
"@
        if ($rect -is [string]) { $rect = $rect | ConvertFrom-Json }
        }
        $result = Send-Cdp "Page.captureScreenshot" @{
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
        if (-not $result.result.data) {
            $rectJson = $rect | ConvertTo-Json -Compress
            throw "Chrome returned an empty screenshot for $Selector with clip $rectJson"
        }
        $file = Join-Path $outPath $Name
        Write-PngIfChanged -Path $file -Bytes ([Convert]::FromBase64String($result.result.data))
    }

    function Save-ExactElementScreenshot {
        param(
            [string]$Selector,
            [string]$Name
        )
        $selectorJson = $Selector | ConvertTo-Json -Compress
        $rect = Invoke-PageScript @"
(async()=>{
  const selector=$selectorJson;
  const el=document.querySelector(selector);
  if(!el)throw new Error('Missing exact screenshot element: '+selector);
  const rail=el.closest('.toolbox-rail');
  if(rail){
    const scrollHost=rail.querySelector('.toolbox-rail-scroll')||rail;
    const firstBox=scrollHost.querySelector('.scene-toolbox');
    if(firstBox&&firstBox!==el)scrollHost.insertBefore(el,firstBox);
    scrollHost.scrollTop=0;
    scrollHost.scrollLeft=0;
  }else{
    el.scrollIntoView({block:'start',inline:'nearest'});
  }
  await new Promise(resolve=>setTimeout(resolve,300));
  const r=el.getBoundingClientRect();
  const pad=8;
  return JSON.stringify({
    x:Math.max(0,Math.floor(r.left-pad)),
    y:Math.max(0,Math.floor(r.top-pad)),
    width:Math.ceil(r.width+pad*2),
    height:Math.ceil(r.height+pad*2)
  });
})()
"@
        if ($rect -is [string]) { $rect = $rect | ConvertFrom-Json }
        $result = Send-Cdp "Page.captureScreenshot" @{
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
        if (-not $result.result.data) { throw "Chrome returned an empty exact screenshot for $Selector" }
        $file = Join-Path $outPath $Name
        Write-PngIfChanged -Path $file -Bytes ([Convert]::FromBase64String($result.result.data))
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
      this.setSection('showCollapseBtn','showBody',false);
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
    setToolboxRail({collapsed=false}={}){
      const rail=document.querySelector('.toolbox-rail');
      if(!rail)return;
      const toggle=rail.querySelector('.toolbox-rail-toggle');
      if(toggle && rail.classList.contains('collapsed')!==collapsed) toggle.click();
      else {
        rail.classList.toggle('collapsed',collapsed);
        document.body.classList.toggle('toolbox-rail-collapsed',collapsed);
      }
      rail.style.width=collapsed?'48px':'';
      rail.style.overflow=collapsed?'hidden':'';
      document.querySelectorAll('.toolbox-rail .scene-toolbox,.toolbox-rail .toolbox-rail-resizer').forEach(el=>{
        el.style.display=collapsed?'none':'';
      });
      document.querySelectorAll('main').forEach(el=>{
        el.style.width=collapsed?'calc(100% - 48px)':'';
      });
      localStorage.setItem('toolboxRailCollapsed',collapsed?'1':'0');
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
  docShots.setToolboxRail({collapsed:true});
  docShots.setGroupsBox({visible:true,open:true});
  ['profiles','patch'].forEach(name=>localStorage.setItem(name+'Collapsed','0'));
  localStorage.setItem('toolboxRailCollapsed','1');
  localStorage.setItem('groupsBoxCollapsed','0');
  localStorage.setItem('fixtureCardCollapsed','[]');
  docShots.expandFixtureCards();
  document.querySelector('main')?.scrollTo(0,0);
  await docShots.wait(300);
  docShots.setToolboxRail({collapsed:true});
  await docShots.wait();
})()
"@
    Save-Screenshot "fixture-controller-expanded.png"
    Save-Screenshot "fixture-controller.png"

    Eval-Js @"
(async()=>{
  dmxOutputs=DmxCommon.normalizeDmxOutputs([{id:'dmx-output-1',name:'Pico 1',universe:1,baseUrl:''}]);
  discoveredPicos=[
    {id:'DOC-PICO-FRONT',name:'Front truss Pico',version:'0.9.14',ip:'192.168.0.21',http:80,url:'http://192.168.0.21/'},
    {id:'DOC-PICO-PIXELS',name:'Pixel matrix Pico',version:'0.9.14',ip:'192.168.0.22',http:80,url:'http://192.168.0.22/'}
  ];
  renderDmxOutputsEditor();
  renderDiscoveredPicos();
  const status=document.getElementById('dmxDiscoveryStatus');
  if(status)status.textContent='Found 2 Pico controllers.';
  DmxCommon.showModal(document.getElementById('dmxOutputsModal'));
  await docShots.wait(350);
})()
"@
    Save-ElementScreenshot "#dmxOutputsModal .modal-card" "fixture-controller-dmx-output-discovery.png"

    Eval-Js @"
(async()=>{
  dmxOutputs=DmxCommon.normalizeDmxOutputs([
    {id:'dmx-output-1',deviceId:'DOC-PICO-FRONT',name:'Front truss Pico',universe:1,baseUrl:'http://192.168.0.21/'},
    {id:'dmx-output-2',deviceId:'DOC-PICO-PIXELS',name:'Pixel matrix Pico',universe:2,baseUrl:'http://192.168.0.22/'}
  ]);
  renderDmxOutputsEditor();
  renderDiscoveredPicos();
  const status=document.getElementById('dmxDiscoveryStatus');
  if(status)status.textContent='Found 2 Pico controllers. Both are assigned.';
  await docShots.wait(250);
})()
"@
    Save-ElementScreenshot "#dmxOutputsModal .modal-card" "fixture-controller-dmx-outputs.png"

    Eval-Js @"
(async()=>{
  DmxCommon.hideModal(document.getElementById('dmxOutputsModal'));
  discoveredPicos=[];
  dmxOutputs=DmxCommon.normalizeDmxOutputs([],baseUrl.value);
  renderPatchOutputOptions();
  await docShots.wait(150);
})()
"@

    Eval-Js @"
(async()=>{
  docShots.setSetupSections({profiles:false,patch:true});
  docShots.setToolboxRail({collapsed:true});
  docShots.setSceneBox({visible:false});
  docShots.setGroupsBox({visible:false});
  if(typeof setSectionCollapsed==='function')setSectionCollapsed('fixtureLibraryCollapseBtn','fixtureLibraryBody','fixtureLibraryCollapsed',true);
  const main=document.querySelector('main');
  const panel=document.getElementById('profilesSection');
  if(main&&panel)main.scrollTo({top:Math.max(0,panel.offsetTop-150),left:0});
  else panel?.scrollIntoView({block:'start'});
  await docShots.wait(300);
  docShots.setToolboxRail({collapsed:true});
  await docShots.wait();
})()
"@
    Save-Screenshot "fixture-controller-profile-controls.png"

    Eval-Js @"
(async()=>{
  docShots.setSetupSections({profiles:true,patch:true});
  docShots.setToolboxRail({collapsed:true});
  docShots.setSceneBox({visible:false});
  docShots.setGroupsBox({visible:false});
  if(typeof setSectionCollapsed==='function')setSectionCollapsed('fixtureLibraryCollapseBtn','fixtureLibraryBody','fixtureLibraryCollapsed',false);
  const status=document.getElementById('status');
  if(status) status.textContent='Fixture Library import';
  await loadFixtureLibrary();
  const search=document.getElementById('fixtureLibrarySearch');
  if(search){
    search.value='fun generation picospot 20 led';
    search.dispatchEvent(new Event('input',{bubbles:true}));
  }
  await docShots.wait(300);
  fixtureLibraryState.selectedKey='fun-generation/picospot-20-led';
  fixtureLibraryState.selectedModeIndex=2;
  renderFixtureLibraryResults();
  await docShots.wait(300);
  document.getElementById('fixtureLibraryPanel')?.scrollIntoView({block:'start'});
  window.scrollBy(0,-80);
  await docShots.wait(300);
  docShots.setToolboxRail({collapsed:true});
  await docShots.wait();
})()
"@
    Save-Screenshot "fixture-controller-fixture-library.png"

    Eval-Js @"
(async()=>{
  docShots.setSetupSections({profiles:true,patch:true});
  docShots.setToolboxRail({collapsed:false});
  docShots.setSceneBox({visible:false});
  docShots.setGroupsBox({visible:true,open:true});
  docShots.selectDemoGroups();
  await docShots.wait(300);
  docShots.setToolboxRail({collapsed:false});
  await docShots.wait();
})()
"@
    Save-Screenshot "fixture-controller-saved-groups.png"

    Eval-Js @"
(async()=>{
  docShots.setSetupSections({profiles:true,patch:true});
  docShots.setToolboxRail({collapsed:false});
  docShots.selectDemoGroups();
  docShots.expandFixtureCards();
  window.scrollBy(0,-130);
  docShots.setSceneBox({visible:true,open:true});
  docShots.setGroupsBox({visible:true,open:true});
  await docShots.wait(300);
  docShots.setToolboxRail({collapsed:false});
  await docShots.wait();
})()
"@
    Save-Screenshot "fixture-controller-scene-box.png"

    Eval-Js @"
(async()=>{
  docShots.setSetupSections({profiles:true,patch:true});
  docShots.setToolboxRail({collapsed:false});
  docShots.ensureDemoGroups();
  docShots.selectDemoGroups();
  docShots.setSceneBox({visible:true,open:true});
  docShots.setGroupsBox({visible:true,open:true});
  function openToolbox(id){
    const box=document.getElementById(id);
    const toggle=document.getElementById(id+'Toggle');
    if(!box)return;
    box.style.display='';
    if(box.classList.contains('collapsed')&&toggle)toggle.click();
  }
  ['paletteBox','fanToolbox'].forEach(openToolbox);
  if(typeof renderSavedGroupsList==='function')renderSavedGroupsList();
  if(typeof renderSceneSlotMatrix==='function')renderSceneSlotMatrix();
  if(typeof renderPaletteSlotMatrix==='function')renderPaletteSlotMatrix();
  if(typeof renderFanToolbox==='function')renderFanToolbox();
  await docShots.wait(600);
})()
"@
    Save-ElementScreenshot "#groupsBox" "fixture-controller-toolbox-groups.png"
    Save-ElementScreenshot "#sceneBox" "fixture-controller-toolbox-scenes.png"
    Save-ElementScreenshot "#paletteBox" "fixture-controller-toolbox-palettes.png"
    Save-ElementScreenshot "#fanToolbox" "fixture-controller-toolbox-fanout.png"

    Eval-Js @"
(async()=>{
  const targets=controllerPixelMatrixTargets().filter(target=>target.fixture.name.startsWith('RGB Spot')).slice(0,12);
  const pixels=[
    '#ff4938','#ff8f3d','#ffd54a','#fff1a6',
    '#62d36f','#30c9b0','#3b8eea','#6559d9',
    '#a85ad4','#df5ca8','#f06c76','#f2a3a3'
  ];
  pixelMatrices=[DmxCommon.normalizePixelMatrix({
    id:'doc-stage-wall',
    name:'Stage Pixel Wall',
    width:4,
    height:3,
    fit:'cover',
    brightness:80,
    imageName:'stage-gradient.png',
    mappings:targets.map(target=>target.key),
    pixels
  })];
  renderPixelMatrixList();
  const box=document.getElementById('pixelMatrixToolbox');
  box.style.display='';
  if(box.classList.contains('collapsed'))document.getElementById('pixelMatrixToolboxToggle')?.click();
  docShots.setToolboxRail({collapsed:false});
  await docShots.wait(400);
})()
"@
    Save-ExactElementScreenshot "#pixelMatrixToolbox" "fixture-controller-toolbox-pixel-matrices.png"

    Eval-Js @"
(async()=>{
  const targets=controllerPixelMatrixTargets().filter(target=>target.fixture.name.startsWith('RGB Spot')).slice(0,12);
  const preview=JSON.parse(JSON.stringify(pixelMatrices[0]));
  preview.mappings=targets.map((target,index)=>index<8?target.key:'');
  openPixelMatrix(preview);
  const target=document.getElementById('pixelMatrixTarget');
  if(target&&targets[8])target.value=targets[8].key;
  await docShots.wait(400);
})()
"@
    Save-ElementScreenshot "#pixelMatrixModal .modal-card" "fixture-controller-pixel-matrix-editor.png"
    Eval-Js @"
(async()=>{
  DmxCommon.hideModal(document.getElementById('pixelMatrixModal'));
  await docShots.wait(100);
})()
"@

    Eval-Js @"
(async()=>{
  docShots.setToolboxRail({collapsed:false});
  const rail=document.querySelector('.toolbox-rail');
  const edit=rail?.querySelector('.toolbox-rail-edit');
  if(rail?.classList.contains('toolbox-reorder-editing')&&edit)edit.click();
  const scrollHost=rail?.querySelector('.toolbox-rail-scroll')||rail;
  if(scrollHost)scrollHost.scrollTop=0;
  await docShots.wait(300);
})()
"@
    Save-ToolboxEditScreenshot "toolbox-reorder-locked.png"
    Eval-Js @"
(async()=>{
  const edit=document.querySelector('.toolbox-rail-edit');
  if(edit&&edit.getAttribute('aria-pressed')!=='true')edit.click();
  await docShots.wait(300);
})()
"@
    Save-ToolboxEditScreenshot "toolbox-reorder-editing.png"
    Eval-Js @"
(async()=>{
  const edit=document.querySelector('.toolbox-rail-edit');
  if(edit&&edit.getAttribute('aria-pressed')==='true')edit.click();
  await docShots.wait(100);
})()
"@

    Eval-Js @"
(async()=>{
  docShots.setToolboxRail({collapsed:false});
  docShots.setSceneBox({visible:false});
  function makeDocTileImage(){
    const c=document.createElement('canvas');
    c.width=120;c.height=120;
    const ctx=c.getContext('2d');
    ctx.clearRect(0,0,120,120);
    const beam=ctx.createLinearGradient(20,18,100,105);
    beam.addColorStop(0,'rgba(255,255,255,.98)');
    beam.addColorStop(.42,'rgba(255,220,90,.82)');
    beam.addColorStop(1,'rgba(255,120,40,.08)');
    ctx.fillStyle=beam;
    ctx.beginPath();
    ctx.moveTo(22,18);
    ctx.lineTo(98,100);
    ctx.lineTo(66,110);
    ctx.lineTo(12,34);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.9)';
    ctx.lineWidth=7;
    ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(24,27);
    ctx.lineTo(67,78);
    ctx.stroke();
    ctx.fillStyle='rgba(255,235,120,.95)';
    ctx.beginPath();
    ctx.arc(78,88,16,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle='rgba(8,18,24,.55)';
    ctx.lineWidth=4;
    ctx.stroke();
    return c.toDataURL('image/png');
  }
  const scope=document.getElementById('paletteScope');
  if(scope)scope.value='color';
  if(!Array.isArray(palettes))palettes=[];
  let p=palettes.find(p=>parseInt(p.slot,10)===0);
  if(!p){
    p={id:'doc_palette_tile',name:'Warm beam',slot:0,scope:'color',values:{},visual:{type:'visual',color:'#7a2e20',image:makeDocTileImage()}};
    palettes.push(p);
  }else{
    p.name='Warm beam';
    p.scope=p.scope||'color';
    p.visual={type:'visual',color:'#7a2e20',image:makeDocTileImage()};
  }
  if(typeof renderPaletteMatrix==='function')renderPaletteMatrix();
  await docShots.wait(200);
  if(typeof openPaletteVisualModal==='function')openPaletteVisualModal(0);
  await docShots.wait(300);
  const name=document.getElementById('paletteVisualName');
  if(name)name.value='Warm beam';
})()
"@
    Save-ElementScreenshot "#paletteVisualModal .modal-card" "fixture-controller-edit-tile.png"
    Eval-Js "document.getElementById('paletteVisualClose2')?.click();"

    Eval-Js @"
(async()=>{
  docShots.setSetupSections({profiles:true,patch:true});
  docShots.setToolboxRail({collapsed:true});
  docShots.clearGroupFilter();
  docShots.setSceneBox({visible:false});
  docShots.setGroupsBox({visible:false});
  const status=document.getElementById('status');
  if(status) status.textContent='Live fixture control';
  docShots.expandFixtureCards();
  await docShots.wait(300);
  document.querySelector('#controlSurfacePanel')?.scrollIntoView({block:'start'});
  window.scrollBy(0,-80);
  await docShots.wait(300);
  docShots.setToolboxRail({collapsed:true});
  await docShots.wait();
})()
"@
    Save-Screenshot "fixture-controller-live-controls.png"

    Eval-Js @"
(async()=>{
  docShots.setSetupSections({profiles:true,patch:true});
  docShots.setToolboxRail({collapsed:true});
  docShots.clearGroupFilter();
  docShots.setSceneBox({visible:false});
  docShots.setGroupsBox({visible:false});
  const status=document.getElementById('status');
  if(status) status.textContent='OFL wheel range control';
  const response=await fetch('assets/fixture-library.json?docshot=$cacheBust',{cache:'no-store'});
  const library=await response.json();
  const fixture=library.fixtures.find(f=>f.key==='fun-generation/picospot-20-led');
  const mode=fixture.modes.find(m=>m.name==='11-channel');
  const profile=JSON.parse(JSON.stringify(mode.profile));
  profile.id=880001;
  profile.name='Fun Generation PicoSpot 20 LED';
  profile.controls.forEach((control,index)=>control.id=880010+index);
  profiles.splice(0,profiles.length,profile);
  fixtures.splice(0,fixtures.length,{id:880101,name:'PicoSpot 20 LED',profileId:profile.id,start:1});
  Object.keys(values).forEach(key=>delete values[key]);
  const gobo=profile.controls.find(control=>control.label==='Gobo Wheel');
  const shake=gobo.options.find(option=>option.kind==='WheelShake'&&option.slotNumber===2);
  values[fixtures[0].id+':'+gobo.id]=130;
  activeProfileId=profile.id;
  selectedFixtureIds.clear();
  collapsedFixtureIds.clear();
  if(typeof loadProfileEditor==='function')loadProfileEditor(profile);
  if(typeof resetControlEditor==='function')resetControlEditor();
  if(typeof draw==='function')draw();
  await docShots.wait(400);
  const goboControl=[...document.querySelectorAll('#surface .control')]
    .find(control=>control.querySelector('h3')?.textContent?.trim()==='Gobo Wheel');
  goboControl?.scrollIntoView({block:'center'});
  window.scrollBy(0,-120);
  await docShots.wait(300);
  docShots.setToolboxRail({collapsed:true});
  await docShots.wait();
})()
"@
    Save-Screenshot "fixture-controller-ofl-wheel-range.png"

    Eval-Js @"
(async()=>{
  docShots.setSetupSections({profiles:true,patch:true});
  docShots.setToolboxRail({collapsed:true});
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
  await docShots.wait(300);
  docShots.setToolboxRail({collapsed:true});
  await docShots.wait(600);
})()
"@
    Save-Screenshot "fixture-controller-group-modal.png"

    $showUrl = $BaseUrl.TrimEnd('/') + "/dmx_show.html?docshot=$cacheBust"
    Send-Cdp "Page.navigate" @{ url = $showUrl } | Out-Null
    Start-Sleep -Seconds 2

    if ($socket) { $socket.Dispose() }
    $tabs = Invoke-RestMethod -Uri $jsonUrl -UseBasicParsing
    $wsUrl = ($tabs | Where-Object { $_.url -like "*dmx_show.html*" } | Select-Object -First 1).webSocketDebuggerUrl
    if (-not $wsUrl) { throw "Could not find Show Run tab after navigation." }
    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $socket.ConnectAsync([Uri]$wsUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
    $script:cdpId = 0
    Send-Cdp "Page.enable" | Out-Null
    Send-Cdp "Runtime.enable" | Out-Null

    for ($i = 0; $i -lt 40; $i++) {
        $navState = Send-Cdp "Runtime.evaluate" @{
            expression = "document.readyState === 'complete'"
            returnByValue = $true
        }
        if ($navState.result.result.value) { break }
        Start-Sleep -Milliseconds 250
    }
    Start-Sleep -Milliseconds 500

    Eval-Js @"
(async()=>{
  const wait=(ms=500)=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<40;i++){
    if(document.getElementById('cardGrid')&&typeof renderCardGrid==='function')break;
    await wait(250);
  }
  profiles.splice(0,profiles.length,{
    id:990001,
    name:'Doc Spot',
    mode:'8ch',
    channels:8,
    controls:[
      {id:990011,type:'slider8',label:'Dimmer',channel:1,blackoutValue:0},
      {id:990012,type:'rgb',label:'Color',a:2,b:3,c:4,blackoutValue:{a:0,b:0,c:0}},
      {id:990013,type:'panTilt16',label:'Pan/Tilt',pan:5,panFine:6,tilt:7,tiltFine:8,blackoutValue:{pan:32768,tilt:32768}}
    ]
  });
  fixtures.splice(0,fixtures.length,
    {id:990101,name:'Front Spot 1',profileId:990001,start:1},
    {id:990102,name:'Front Spot 2',profileId:990001,start:21}
  );
  groups.splice(0,groups.length,
    {id:'doc_front',name:'Front Spots',fixtureIds:[990101,990102],values:{}},
    {id:'doc_single',name:'Solo Spot',fixtureIds:[990101],values:{}}
  );
  scenes.splice(0,scenes.length,
    {id:'doc_scene_1',name:'Warm Look',slot:0,values:{'990101:990011':180,'990102:990011':180},visual:{type:'visual',color:'#8a4f25'}},
    {id:'doc_scene_2',name:'Blue Solo',slot:1,values:{'990101:990012':{a:0,b:30,c:255}},visual:{type:'visual',color:'#1e4d91'}}
  );
  palettes.splice(0,palettes.length,
    {id:'doc_palette_1',name:'Red Beam',slot:0,scope:'Color',values:{'990101:990012':{a:255,b:0,c:0},'990102:990012':{a:160,b:0,c:0}},visual:{type:'visual',color:'#8f2525'}},
    {id:'doc_palette_2',name:'Open Gobo',slot:1,scope:'Gobo',values:{'990101:990010':0},visual:{type:'visual',color:'#225a50'}}
  );
  pixelMatrices.splice(0,pixelMatrices.length,
    DmxCommon.normalizePixelMatrix({id:'doc_matrix_sunset',name:'Sunset Wall',slot:0,width:2,height:1,mappings:['990101:990012','990102:990012'],pixels:['#ff5b35','#ffbd4a']}),
    DmxCommon.normalizePixelMatrix({id:'doc_matrix_ocean',name:'Ocean Wall',slot:1,width:2,height:1,mappings:['990101:990012','990102:990012'],pixels:['#155fbc','#35c9d0']})
  );
  planes.splice(0,planes.length,
    {
      id:'doc_plane_front',
      name:'Front stage plane',
      visual:{type:'visual',color:'#163f66'},
      points:[{id:'A',x:0,y:0,z:0},{id:'B',x:6,y:0,z:0},{id:'C',x:0,y:4,z:0}],
      target:{x:2.8,y:1.5,z:0},
      fixtures:[
        {id:990101,name:'Front Spot 1',x:-1.2,y:-1.6,z:3.2,cal:{A:{pan:20500,tilt:43000,calibrated:true},B:{pan:44200,tilt:42100,calibrated:true},C:{pan:24800,tilt:28600,calibrated:true}}},
        {id:990102,name:'Front Spot 2',x:7.2,y:-1.6,z:3.2,cal:{A:{pan:29200,tilt:43100,calibrated:true},B:{pan:53600,tilt:44200,calibrated:true},C:{pan:35500,tilt:29200,calibrated:true}}}
      ]
    },
    {
      id:'doc_plane_back',
      name:'Back wall plane',
      visual:{type:'visual',color:'#225a50'},
      points:[{id:'A',x:0,y:0,z:0},{id:'B',x:5,y:0,z:0},{id:'C',x:0,y:3,z:0}],
      target:{x:1.6,y:1.2,z:0},
      fixtures:[
        {id:990101,name:'Front Spot 1',x:-1.2,y:-1.6,z:3.2,cal:{A:{pan:22000,tilt:40500,calibrated:true},B:{pan:39500,tilt:40200,calibrated:true},C:{pan:26200,tilt:27800,calibrated:true}}}
      ]
    }
  );
  chaserSlots.splice(0,chaserSlots.length);
  motionSlots.splice(0,motionSlots.length);
  chaserSlots[1]={slot:1,loaded:true,label:'Dimmer Chase',step_count:3,speed_mult:1,mode:1,direction:0,active:true};
  motionSlots[0]={slot:0,loaded:true,label:'Circle Pan/Tilt',bpm:30,active:false};
  Object.keys(values).forEach(key=>delete values[key]);
  values['990101:990011']=128;
  values['990102:990011']=160;
  values['990101:990012']={a:255,b:80,c:24};
  values['990102:990012']={a:120,b:40,c:255};
  targetMasters.splice(0,targetMasters.length,{id:'doc_target_front',name:'Group Master 1',fixtureIds:['990101','990102'],factor:0.75});
  masterFactors.grand=0.85;
  cardCols=3;cardRows=4;
  groupCols=2;groupRows=1;
  fixtureCols=2;fixtureRows=1;
  sceneCols=2;sceneRows=1;
  paletteCols=2;paletteRows=1;
  matrixCols=2;matrixRows=1;
  planeCols=2;planeRows=1;
  chaserCols=2;chaserRows=1;
  motionCols=2;motionRows=1;
  cardOrder=['master','group','fixture','scene','palette','matrix','plane','chaser','motion','live','midi'];
  cardLayouts={};
  liveControls.splice(0,liveControls.length,
    {id:'doc_live_dimmer',fixtureId:990101,controlId:990011,part:'value',widget:'fader',label:'Dimmer'},
    {id:'doc_live_red',fixtureId:990101,controlId:990012,part:'a',widget:'knob',label:'Red'},
    {id:'doc_live_fog',fixtureId:990101,controlId:990011,part:'value',widget:'button',buttonMode:'timer',buttonValue:255,timerOnMs:3000,timerOffMs:30000,label:'Fog Timer'}
  );
  if(typeof selectChaserSlot==='function')selectChaserSlot(1);
  if(typeof selectMotionSlot==='function')selectMotionSlot(0);
  if(typeof setLayoutEditing==='function')setLayoutEditing(false);
  if(typeof renderGroups==='function')renderGroups();
  if(typeof renderFixtures==='function')renderFixtures();
  if(typeof renderScenes==='function')renderScenes();
  if(typeof renderPalettes==='function')renderPalettes();
  if(typeof renderPixelMatrices==='function')renderPixelMatrices();
  if(typeof renderPlanes==='function')renderPlanes();
  if(typeof renderPlaybackSlots==='function')renderPlaybackSlots();
  if(typeof renderLiveControls==='function')renderLiveControls();
  if(typeof renderCardGrid==='function')renderCardGrid();
  if(typeof setStatus==='function')setStatus('Show Run demo ready');
  document.querySelector('main')?.scrollTo(0,0);
  window.scrollTo(0,0);
  await wait(600);
})()
"@
    Save-Screenshot "show-run.png"
    Save-ElementScreenshot "#cardMaster" "show-run-card-master.png"
    Save-ElementScreenshot "#cardGroup" "show-run-card-groups.png"
    Save-ElementScreenshot "#cardFixture" "show-run-card-fixtures.png"
    Save-ElementScreenshot "#cardScene" "show-run-card-scenes.png"
    Save-ElementScreenshot "#cardPalette" "show-run-card-palettes.png"
    Save-ElementScreenshot "#cardMatrix" "show-run-card-pixel-matrices.png"
    Save-ElementScreenshot "#cardPlane" "show-run-card-planes.png"
    Save-ElementScreenshot "#cardChaser" "show-run-card-chaser.png"
    Save-ElementScreenshot "#cardMotion" "show-run-card-effects.png"
    Save-ElementScreenshot "#cardLive" "show-run-card-live-controls.png"
    Save-ElementScreenshot "#cardMidi" "show-run-card-midi.png"

    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  midiMappings.splice(0,midiMappings.length,
    {targetType:'scene',targetId:'doc_scene_1',messageType:'note',channel:1,number:41,deviceId:'launch-control-xl-emulator',deviceName:'Launch Control XL Emulator',mode:'trigger'},
    {targetType:'chaser',targetId:'1',messageType:'note',channel:1,number:73,deviceId:'launch-control-xl-emulator',deviceName:'Launch Control XL Emulator',mode:'trigger',action:'toggle-pause'},
    {targetType:'live',targetId:'doc_live_dimmer',messageType:'cc',channel:1,number:77,deviceId:'launch-control-xl-emulator',deviceName:'Launch Control XL Emulator',mode:'continuous',pickup:true}
  );
  if(typeof setLayoutEditing==='function')setLayoutEditing(true);
  if(typeof openShowTileEditor==='function')openShowTileEditor('scene','doc_scene_1');
  await wait(400);
})()
"@
    Save-ElementScreenshot "#showTileVisualModal .modal-card" "show-run-midi-scene-mapping.png"

    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  document.getElementById('showTileVisualClose2')?.click();
  if(typeof openMidiMappingEditor==='function')openMidiMappingEditor('chaser','1');
  await wait(300);
})()
"@
    Save-ElementScreenshot "#midiMappingModal .modal-card" "show-run-midi-playback-mapping.png"

    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  if(typeof closeMidiMappingEditor==='function')closeMidiMappingEditor();
  if(typeof openMidiMappingEditor==='function')openMidiMappingEditor('live','doc_live_dimmer');
  await wait(300);
})()
"@
    Save-ElementScreenshot "#midiMappingModal .modal-card" "show-run-midi-fader-mapping.png"

    Eval-Js "if(typeof closeMidiMappingEditor==='function')closeMidiMappingEditor();"

    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  hiddenTileModalDismissed=true;
  cardCols=3;cardRows=3;
  paletteCols=2;paletteRows=1;
  sceneCols=2;sceneRows=1;
  chaserCols=2;chaserRows=1;
  motionCols=2;motionRows=1;
  cardOrder=['palette','scene','chaser','palette:doc_second_palette','motion','live',null];
  cardLayouts={
    'palette:doc_second_palette':{type:'palette',cols:1,rows:2,order:['doc_palette_2','doc_palette_1'],hidden:[]}
  };
  if(typeof setLayoutEditing==='function')setLayoutEditing(true);
  if(typeof renderGroups==='function')renderGroups();
  if(typeof renderScenes==='function')renderScenes();
  if(typeof renderPalettes==='function')renderPalettes();
  if(typeof renderPlanes==='function')renderPlanes();
  if(typeof renderPlaybackSlots==='function')renderPlaybackSlots();
  if(typeof renderLiveControls==='function')renderLiveControls();
  if(typeof renderCardGrid==='function')renderCardGrid();
  window.scrollTo(0,0);
  await wait(500);
})()
"@
    Save-Screenshot "show-run-layout-edit.png"

    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  if(typeof openAddCardModal==='function')openAddCardModal(6);
  const select=document.getElementById('addCardType');
  if(select)select.value='plane';
  const button=document.getElementById('addShowCard');
  if(button&&typeof addCardButtonLabel==='function')button.textContent=addCardButtonLabel('plane');
  await wait(300);
})()
"@
    Save-ElementScreenshot "#addCardModal .modal-card" "show-run-add-card.png"

    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  if(typeof closeAddCardModal==='function')closeAddCardModal();
  if(typeof setLayoutEditing==='function')setLayoutEditing(false);
  selectedGroupIds.clear();
  selectedFixtureIds.clear();
  selectedFixtureIds.add('990101');
  selectedFixtureIds.add('990102');
  cardCols=2;cardRows=2;
  planeCols=2;planeRows=1;
  cardOrder=['plane','fixture','master','palette'];
  cardLayouts={};
  if(typeof renderFixtures==='function')renderFixtures();
  if(typeof renderPlanes==='function')renderPlanes();
  if(typeof renderCardGrid==='function')renderCardGrid();
  if(typeof openShowPlaneModal==='function')openShowPlaneModal('doc_plane_front');
  await wait(600);
})()
"@
    Save-ElementScreenshot "#showPlaneModal .modal-card" "show-run-plane-modal.png"

    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  document.getElementById('showPlaneClose2')?.click();
  if(typeof closeAddCardModal==='function')closeAddCardModal();
  cardCols=2;cardRows=2;
  paletteCols=2;paletteRows=1;
  cardOrder=['palette','scene','chaser','motion'];
  cardLayouts={};
  if(typeof setLayoutEditing==='function')setLayoutEditing(true);
  if(typeof renderPalettes==='function')renderPalettes();
  if(typeof renderCardGrid==='function')renderCardGrid();
  const header=document.querySelector('header');
  if(header)header.style.position='static';
  document.getElementById('cardPalette')?.scrollIntoView({block:'start',inline:'nearest'});
  window.scrollBy(0,-20);
  await wait(500);
})()
"@
    Save-ElementScreenshot "#cardPalette" "show-run-tile-actions.png"

    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  if(typeof setLayoutEditing==='function')setLayoutEditing(true);
  await wait(300);
  cardCols=1;cardRows=1;
  cardOrder=['live'];
  if(typeof renderCardGrid==='function')renderCardGrid();
  await wait(120);
  const grid=document.getElementById('cardGrid');
  const live=document.getElementById('cardLive');
  document.querySelectorAll('[data-show-card]').forEach(card=>{
    if(card!==live)card.style.display='none';
  });
  if(grid){
    grid.style.display='block';
    grid.style.gridTemplateColumns='1fr';
  }
  if(live){
    live.style.height='auto';
    live.style.minHeight='0';
    live.style.alignSelf='start';
  }
  const widget=document.getElementById('liveWidgetSelect');
  const mode=document.getElementById('liveButtonMode');
  const value=document.getElementById('liveButtonValue');
  const on=document.getElementById('liveTimerOn');
  const off=document.getElementById('liveTimerOff');
  const hiddenModal=document.getElementById('hiddenTileModal');
  if(hiddenModal)hiddenModal.style.display='none';
  if(typeof hiddenTileModalDismissed!=='undefined')hiddenTileModalDismissed=true;
  if(widget)widget.value='button';
  if(mode)mode.value='hold';
  if(value)value.value='255';
  liveControls.splice(0,liveControls.length,
    {id:'doc_live_hold',fixtureId:990101,controlId:990011,part:'value',widget:'button',buttonMode:'hold',buttonValue:255,label:'Fog Burst'}
  );
  if(typeof renderLiveControls==='function')renderLiveControls();
  if(typeof updateLiveControlSelects==='function')updateLiveControlSelects();
  live?.scrollIntoView({block:'start',inline:'nearest'});
  window.scrollBy(0,-120);
  await wait(400);
})()
"@
    Save-ElementScreenshot "#cardLive" "show-run-live-hold-button.png"

    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  const live=document.getElementById('cardLive');
  const widget=document.getElementById('liveWidgetSelect');
  const mode=document.getElementById('liveButtonMode');
  const value=document.getElementById('liveButtonValue');
  const on=document.getElementById('liveTimerOn');
  const off=document.getElementById('liveTimerOff');
  const hiddenModal=document.getElementById('hiddenTileModal');
  if(hiddenModal)hiddenModal.style.display='none';
  if(typeof hiddenTileModalDismissed!=='undefined')hiddenTileModalDismissed=true;
  if(widget)widget.value='button';
  if(mode)mode.value='timer';
  if(value)value.value='255';
  if(on)on.value='3';
  if(off)off.value='30';
  liveControls.splice(0,liveControls.length,
    {id:'doc_live_timer',fixtureId:990101,controlId:990011,part:'value',widget:'button',buttonMode:'timer',buttonValue:255,timerOnMs:3000,timerOffMs:30000,label:'Fog Timer'}
  );
  if(typeof renderLiveControls==='function')renderLiveControls();
  if(typeof updateLiveControlSelects==='function')updateLiveControlSelects();
  live?.scrollIntoView({block:'start',inline:'nearest'});
  window.scrollBy(0,-120);
  await wait(400);
})()
"@
    Save-ElementScreenshot "#cardLive" "show-run-live-controls.png"
    Save-ElementScreenshot "#cardLive" "show-run-live-timer-button.png"

    $midiEmulatorUrl = $BaseUrl.TrimEnd('/') + "/dmx_midi_emulator.html?docshot=$cacheBust"
    Send-Cdp "Page.navigate" @{ url = $midiEmulatorUrl } | Out-Null
    Start-Sleep -Seconds 2
    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<20;i++){
    if(document.querySelector('.emulator [data-midi-cc]')&&document.querySelector('.emulator [data-midi-note]'))break;
    await wait(200);
  }
  const fader=document.querySelector('[data-midi-cc="77"]');
  if(fader){fader.value='84';fader.dispatchEvent(new Event('input',{bubbles:true}));}
  showLastSeen=Date.now();
  if(typeof renderConnection==='function')renderConnection();
  const header=document.querySelector('header');
  if(header)header.style.display='none';
  const instructions=document.querySelector('.instructions');
  if(instructions)instructions.style.display='none';
  await wait(250);
})()
"@
    Save-ElementScreenshot ".emulator" "midi-emulator.png"

    $roomPlaneUrl = $BaseUrl.TrimEnd('/') + "/dmx_room_plane.html?docshot=$cacheBust"
    Send-Cdp "Page.navigate" @{ url = $roomPlaneUrl } | Out-Null
    Start-Sleep -Seconds 2

    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<30;i++){
    if(document.querySelector('#fixtureRows tr')&&document.querySelector('#roomPlaneBox'))break;
    await wait(250);
  }
  if(typeof points!=='undefined'&&typeof fixtures!=='undefined'){
    activePlaneId='doc_main_stage';
    document.getElementById('planeName').value='Main stage plane';
    document.getElementById('targetX').value='2.4';
    document.getElementById('targetY').value='1.6';
    points.splice(0,points.length,
      {id:'A',x:0,y:0,z:0},
      {id:'B',x:6,y:0,z:0},
      {id:'C',x:0,y:4,z:0}
    );
    fixtures=[
      {id:1779345960283,name:'MAC XENON 1',profileId:1778925611894,start:79,live:true,x:-1.2,y:-1.8,z:3.4,control:{pan:28400,tilt:38200,dimmer:180},cal:{A:{pan:20600,tilt:43000,calibrated:true},B:{pan:43800,tilt:42100,calibrated:true},C:{pan:24600,tilt:28500,calibrated:true}}},
      {id:1779345959308,name:'MAC XENON 2',profileId:1778925611894,start:92,live:true,x:1.4,y:-1.8,z:3.4,control:{pan:32600,tilt:37400,dimmer:180},cal:{A:{pan:23800,tilt:41900,calibrated:true},B:{pan:47200,tilt:43100,calibrated:true},C:{pan:28200,tilt:28100,calibrated:true}}},
      {id:1779345960046,name:'MAC XENON 3',profileId:1778925611894,start:105,live:true,x:4.6,y:-1.8,z:3.4,control:{pan:37100,tilt:36900,dimmer:180},cal:{A:{pan:26600,tilt:42100,calibrated:true},B:{pan:50800,tilt:43600,calibrated:true},C:{pan:32200,tilt:28600,calibrated:true}}},
      {id:1779345959395,name:'MAC XENON 4',profileId:1778925611894,start:118,live:true,x:7.2,y:-1.8,z:3.4,control:{pan:41400,tilt:36500,dimmer:180},cal:{A:{pan:29400,tilt:43100,calibrated:true},B:{pan:54000,tilt:44200,calibrated:true},C:{pan:35400,tilt:29200,calibrated:true}}}
    ];
    planeView={auto:true,centerX:3,centerY:1.1,zoom:1};
    selectedFixtureIds.clear();
    selectedFixtureIds.add(String(fixtures[0].id));
    selectedFixtureIds.add(String(fixtures[1].id));
    planeDefinitions=[capturePlaneDefinition()];
    if(typeof syncTables==='function')syncTables();
    if(typeof renderPlaneSelect==='function')renderPlaneSelect();
    if(typeof setStatus==='function')setStatus('Manual screenshot room plane ready');
  }
  const rail=document.querySelector('.toolbox-rail');
  const railToggle=rail?.querySelector('.toolbox-rail-toggle');
  if(rail&&rail.classList.contains('collapsed')&&railToggle)railToggle.click();
  document.querySelectorAll('.scene-toolbox').forEach(box=>{
    const toggle=box.querySelector('.scene-toolbox__toggle');
    if(box.classList.contains('collapsed')&&toggle)toggle.click();
  });
  window.scrollTo(0,0);
  document.querySelector('main')?.scrollTo?.(0,0);
  await wait(300);
})()
"@
    Save-Screenshot "room-plane.png"
    Save-ElementScreenshot "#roomPlaneBox" "room-plane-toolbox-plane.png"
    Save-ElementScreenshot "#roomPlaneLibraryBox" "room-plane-toolbox-saved-planes.png"
    Save-ElementScreenshot "#roomFixturesBox" "room-plane-toolbox-fixtures.png"
    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  document.querySelector('[data-visual-plane]')?.click();
  await wait(300);
})()
"@
    Save-ElementScreenshot "#planeVisualModal .modal-card" "room-plane-edit-plane-tile.png"
    Eval-Js "document.getElementById('planeVisualClose2')?.click();"
    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  document.querySelector('[data-edit-fixture="0"]')?.click();
  await wait(500);
  const card=document.querySelector('#commonPanTiltDimmerModal .modal-card');
  const body=document.querySelector('#commonPanTiltDimmerModal .modal-body');
  const pad=document.querySelector('#commonPanTiltDimmerModal [data-ptd-xy]');
  if(card){
    card.style.maxHeight='none';
    card.style.width='760px';
  }
  if(body)body.style.gap='8px';
  if(pad)pad.style.height='170px';
})()
"@
    Save-ElementScreenshot "#commonPanTiltDimmerModal .modal-card" "room-plane-fixture-editor.png"

    $chaserUrl = $BaseUrl.TrimEnd('/') + "/dmx_chaser.html?docshot=$cacheBust"
    Send-Cdp "Page.navigate" @{ url = $chaserUrl } | Out-Null
    Start-Sleep -Seconds 2

    if ($socket) { $socket.Dispose() }
    $tabs = Invoke-RestMethod -Uri $jsonUrl -UseBasicParsing
    $wsUrl = ($tabs | Where-Object { $_.url -like "*dmx_chaser.html*" } | Select-Object -First 1).webSocketDebuggerUrl
    if (-not $wsUrl) { throw "Could not find Chaser tab after navigation." }
    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $socket.ConnectAsync([Uri]$wsUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
    $script:cdpId = 0
    Send-Cdp "Page.enable" | Out-Null
    Send-Cdp "Runtime.enable" | Out-Null

    for ($i = 0; $i -lt 40; $i++) {
        $navState = Send-Cdp "Runtime.evaluate" @{
            expression = "document.readyState === 'complete'"
            returnByValue = $true
        }
        if ($navState.result.result.value) { break }
        Start-Sleep -Milliseconds 250
    }
    Start-Sleep -Milliseconds 500

    Eval-Js @"
(async()=>{
  const wait=(ms=500)=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<30;i++){
    if(typeof setup==='object'&&Array.isArray(setup.fixtures)&&setup.fixtures.length)break;
    await wait(250);
  }
  if(!(typeof setup==='object'&&Array.isArray(setup.fixtures)&&setup.fixtures.length)){
    try{
      const fixtureData=await fetch('fixture_setup.php',{cache:'no-store'}).then(r=>r.json());
      if(fixtureData?.ok&&fixtureData?.setup){
        setup=fixtureData.setup;
        if(typeof rebuildParticipation==='function')rebuildParticipation();
      }
    }catch(_){}
  }
  for(let i=0;i<20;i++){
    if(typeof chaserGroupsBox!=='undefined'&&chaserGroupsBox&&Array.isArray(chaserGroupsBox.groups))break;
    await wait(250);
  }
  const rail=document.querySelector('.toolbox-rail');
  const railToggle=rail?.querySelector('.toolbox-rail-toggle');
  if(rail&&rail.classList.contains('collapsed')&&railToggle)railToggle.click();
  localStorage.setItem('toolboxRailCollapsed','0');
  function openToolbox(id){
    const box=document.getElementById(id);
    const toggle=document.getElementById(id+'Toggle');
    if(!box)return;
    box.style.display='';
    if(box.classList.contains('collapsed')&&toggle)toggle.click();
  }
  function expandPanel(id){
    const panel=document.getElementById(id);
    const btn=document.querySelector('[data-panel-toggle="'+id+'"]');
    if(!panel)return;
    panel.classList.remove('collapsed-panel');
    if(btn)btn.textContent='−';
  }

  localStorage.removeItem('chaserCompactState');
  if(window.DmxCommon&&typeof DmxCommon.saveSharedGroupSelection==='function')DmxCommon.saveSharedGroupSelection([]);
  if(typeof chaserGroupsBox!=='undefined'&&chaserGroupsBox?.clearSelection)chaserGroupsBox.clearSelection();
  expandPanel('participationPanel');
  expandPanel('stepEditorSection');
  ['stepsBox','browserPlaybackBox','chaseBox','chaserPaletteBox','chaserPlanesBox'].forEach(openToolbox);
  const chaseBox=document.getElementById('chaseBox');
  const paletteBox=document.getElementById('chaserPaletteBox');
  if(chaseBox&&paletteBox)chaseBox.after(paletteBox);
  const groups=document.getElementById('chaserGroupsBox');
  const groupsToggle=document.getElementById('chaserGroupsToggle');
  if(groups){
    groups.style.display='';
    if(groups.classList.contains('collapsed')&&groupsToggle)groupsToggle.click();
  }
  if(window.DmxCommon&&typeof DmxCommon.initToolboxRail==='function'){
    DmxCommon.initToolboxRail(document.getElementById('chaserToolboxRail'),[
      {box:'chaserGroupsBox',type:'groups'},
      {box:'chaseBox',type:'chases'},
      {box:'stepsBox',type:'steps'},
      {box:'chaserPaletteBox',type:'palettes'},
      {box:'chaserPlanesBox',type:'planes'},
      {box:'fanToolbox',type:'fan'},
      {box:'browserPlaybackBox',type:'browserPlayback'}
    ]);
  }
  if(typeof setup==='object'&&Array.isArray(setup.fixtures)&&typeof fixtureProfile==='function'&&typeof controlKey==='function'){
    if(window.DmxCommon&&typeof DmxCommon.saveSharedGroupSelection==='function')DmxCommon.saveSharedGroupSelection([]);
    if(typeof chaserGroupsBox!=='undefined'&&chaserGroupsBox?.clearSelection)chaserGroupsBox.clearSelection();
    const stepValues={};
    const part={};
    const fixtures=setup.fixtures.slice(0,6);
    fixtures.forEach((f,idx)=>{
      const profile=fixtureProfile(f);
      const control=(profile?.controls||[]).find(c=>/dimmer/i.test(c.label||''))||(profile?.controls||[])[0];
      if(!control)return;
      const key=controlKey(f,control);
      part[key]=true;
      stepValues[key]=idx%2?190:80;
    });
    if(Object.keys(stepValues).length<2){
      const inputs=[...document.querySelectorAll('#participationList input[data-key]')];
      const dimmers=inputs.filter(input=>/dimmer/i.test(input.closest('label')?.textContent||''));
      (dimmers.length?dimmers:inputs).slice(0,6).forEach((input,idx)=>{
        const key=input.dataset.key;
        if(!key)return;
        part[key]=true;
        stepValues[key]=idx%2?190:80;
      });
    }
    if(Object.keys(stepValues).length>=2){
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
      if(typeof savedChases!=='undefined'){
        savedChases=[{id:'doc_chase_1',name:'Doc Chase',slot:0,data:docChase,visual:{type:'visual',color:'#7f2ac8',image:''}}];
        if(typeof chaseSlotCols!=='undefined')chaseSlotCols=4;
        if(typeof chaseSlotRows!=='undefined')chaseSlotRows=4;
        if(typeof renderChaseSlotMatrix==='function')renderChaseSlotMatrix();
      }
      if(typeof applyChaserData==='function')applyChaserData(docChase,true);
      if(typeof selectStepForEdit==='function')await selectStepForEdit(0);
      try{
        steps=docChase.steps.map(s=>({...s,values:{...s.values}}));
        selectedStepIdx=0;
        participating={...part};
        activeStepValueKeys=new Set(Object.keys(stepValues));
        sourceFixtureId=Object.keys(stepValues)[0].split(':')[0];
      }catch(_){}
    }
  }
  if(typeof drawStepList==='function')drawStepList();
  if(typeof drawParticipation==='function')drawParticipation();
  if(typeof drawStepEditor==='function')drawStepEditor();
  if(typeof refreshChaserGroupActions==='function')refreshChaserGroupActions();
  const chaseBox2=document.getElementById('chaseBox');
  const paletteBox2=document.getElementById('chaserPaletteBox');
  if(chaseBox2&&paletteBox2){
    chaseBox2.after(paletteBox2);
    openToolbox('chaserPaletteBox');
  }
  if(window.DmxCommon&&typeof DmxCommon.initToolboxRail==='function'){
    DmxCommon.initToolboxRail(document.getElementById('chaserToolboxRail'),[
      {box:'chaserGroupsBox',type:'groups'},
      {box:'chaseBox',type:'chases'},
      {box:'stepsBox',type:'steps'},
      {box:'chaserPaletteBox',type:'palettes'},
      {box:'chaserPlanesBox',type:'planes'},
      {box:'fanToolbox',type:'fan'},
      {box:'browserPlaybackBox',type:'browserPlayback'}
    ]);
  }
  const overviewRail=document.querySelector('.toolbox-rail');
  const overviewRailToggle=overviewRail?.querySelector('.toolbox-rail-toggle');
  if(overviewRail&&!overviewRail.classList.contains('collapsed')&&overviewRailToggle)overviewRailToggle.click();
  localStorage.setItem('toolboxRailCollapsed','1');
  document.querySelector('main')?.scrollTo(0,0);
  window.scrollTo(0,0);
  window.__docChaserState={
    steps:document.querySelectorAll('#stepList [data-step-index]').length,
    stepCount:document.getElementById('stepCount')?.textContent||'',
    editEnabled:!(document.getElementById('chaserGroupsEdit')?.disabled??true),
    status:document.getElementById('status')?.textContent||''
  };
  await wait(800);
})()
"@
    $chaserState = Send-Cdp "Runtime.evaluate" @{
        expression = "window.__docChaserState || null"
        returnByValue = $true
    }
    if ($chaserState.result.result.value) {
        $state = $chaserState.result.result.value
        Write-Host "Chaser docshot state: steps=$($state.steps), stepCount=$($state.stepCount), editEnabled=$($state.editEnabled), status=$($state.status)"
    }
    Save-Screenshot "chaser-readme.png"
    Save-ElementScreenshot "#chaserPlanesBox" "chaser-toolbox-planes.png"

    $motionUrl = $BaseUrl.TrimEnd('/') + "/dmx_motion.html?docshot=$cacheBust"
    Send-Cdp "Page.navigate" @{ url = $motionUrl } | Out-Null
    Start-Sleep -Seconds 2

    if ($socket) { $socket.Dispose() }
    $tabs = Invoke-RestMethod -Uri $jsonUrl -UseBasicParsing
    $wsUrl = ($tabs | Where-Object { $_.url -like "*dmx_motion.html*" } | Select-Object -First 1).webSocketDebuggerUrl
    if (-not $wsUrl) { throw "Could not find Effects tab after navigation." }
    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $socket.ConnectAsync([Uri]$wsUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
    $script:cdpId = 0
    Send-Cdp "Page.enable" | Out-Null
    Send-Cdp "Runtime.enable" | Out-Null

    for ($i = 0; $i -lt 40; $i++) {
        $navState = Send-Cdp "Runtime.evaluate" @{
            expression = "document.readyState === 'complete'"
            returnByValue = $true
        }
        if ($navState.result.result.value) { break }
        Start-Sleep -Milliseconds 250
    }
    Start-Sleep -Milliseconds 500

    Eval-Js @"
(async()=>{
  const wait=(ms=500)=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<40;i++){
    if(typeof setup==='object'&&Array.isArray(setup.fixtures)&&setup.fixtures.length&&document.getElementById('motionEffectBox'))break;
    await wait(250);
  }
  const rail=document.querySelector('.toolbox-rail');
  const railToggle=rail?.querySelector('.toolbox-rail-toggle');
  if(rail&&rail.classList.contains('collapsed')&&railToggle)railToggle.click();
  localStorage.setItem('toolboxRailCollapsed','0');
  if(window.DmxCommon&&typeof DmxCommon.saveSharedGroupSelection==='function')DmxCommon.saveSharedGroupSelection([]);
  if(typeof motionGroupsBox!=='undefined'&&motionGroupsBox?.clearSelection)motionGroupsBox.clearSelection();
  if(typeof motionGroupsBox!=='undefined'&&motionGroupsBox?.loadGroups)await motionGroupsBox.loadGroups();
  function openToolbox(id){
    const box=document.getElementById(id);
    const toggle=document.getElementById(id+'Toggle');
    if(!box)return;
    box.style.display='';
    if(box.classList.contains('collapsed')&&toggle)toggle.click();
  }
  ['motionGroupsBox','motionEffectBox','motionSavedEffectBox','motionSceneBox','motionPaletteBox','motionPlanesBox'].forEach(openToolbox);
  if(typeof renderMotionEffectSlots==='function')renderMotionEffectSlots();
  if(typeof renderMotionSceneSlots==='function')renderMotionSceneSlots();
  if(typeof renderMotionPaletteSlots==='function')renderMotionPaletteSlots();
  if(typeof renderMotionPreview==='function')renderMotionPreview();
  await wait(800);
})()
"@
    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  const panel=document.getElementById('fxPanel');
  const btn=document.querySelector('[data-panel-toggle="fxPanel"]');
  if(panel&&!panel.classList.contains('collapsed-panel')&&btn)btn.click();
  document.querySelector('main')?.scrollTo(0,0);
  window.scrollTo(0,0);
  await wait();
})()
"@
    Save-ElementScreenshot "#fxPanel" "motion-participating-controls-collapsed.png"
    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  const panel=document.getElementById('fxPanel');
  const btn=document.querySelector('[data-panel-toggle="fxPanel"]');
  if(panel&&panel.classList.contains('collapsed-panel')&&btn)btn.click();
  await wait();
})()
"@
    Save-ElementScreenshot "#motionGroupsBox" "motion-toolbox-groups.png"
    Save-ElementScreenshot "#motionEffectBox" "motion-toolbox-effect-parameters.png"
    Save-ElementScreenshot "#motionSavedEffectBox" "motion-toolbox-effects.png"
    Save-ElementScreenshot "#motionSceneBox" "motion-toolbox-scenes.png"
    Save-ElementScreenshot "#motionPaletteBox" "motion-toolbox-palettes.png"
    Save-ElementScreenshot "#motionPlanesBox" "motion-toolbox-planes.png"

    Eval-Js @"
(async()=>{
  const wait=(ms=300)=>new Promise(r=>setTimeout(r,ms));
  if(!Array.isArray(motionEffects))motionEffects=[];
  if(!motionEffects.some(e=>parseInt(e.slot,10)===0)){
    motionEffects.push({id:'doc_motion_effect_tile',name:'Slow circle',slot:0,recipe:{},visual:{type:'visual',color:'#365a40',image:''}});
  }else{
    const e=motionEffects.find(e=>parseInt(e.slot,10)===0);
    e.name=e.name||'Slow circle';
    e.visual=e.visual||{type:'visual',color:'#365a40',image:''};
  }
  if(typeof renderMotionEffectMatrix==='function')renderMotionEffectMatrix();
  await wait();
  if(typeof openMotionEffectVisualModal==='function')openMotionEffectVisualModal(0);
  await wait();
  const name=document.getElementById('motionEffectVisualName');
  if(name)name.value='Slow circle';
})()
"@
    Save-ElementScreenshot "#motionEffectVisualModal .modal-card" "motion-edit-tile.png"
}
finally {
    if ($socket) { $socket.Dispose() }
    if ($chromeProcess -and -not $chromeProcess.HasExited) { Stop-Process -Id $chromeProcess.Id -Force }
    Stop-PicoDmxChromeProfileProcesses -ProfileDir $profileDir
}
