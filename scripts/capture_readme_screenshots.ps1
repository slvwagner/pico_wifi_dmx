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
$profileDir = Join-Path $env:TEMP ("pico-dmx-docshots-" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())

New-Item -ItemType Directory -Force -Path $outPath | Out-Null
if (Test-Path -LiteralPath $profileDir) {
    Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

$cacheBust = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$startUrl = $BaseUrl
$startUrl += ($(if ($startUrl.Contains("?")) { "&" } else { "?" }) + "docshot=$cacheBust")

$args = @(
    "--headless=new",
    "--remote-debugging-port=$Port",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--user-data-dir=$profileDir",
    "--window-size=1440,1100",
    $startUrl
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
  docShots.setSetupSections({profiles:false,patch:true});
  docShots.setToolboxRail({collapsed:true});
  docShots.setSceneBox({visible:false});
  docShots.setGroupsBox({visible:false});
  const panel=document.querySelector('#profileList') || document.querySelector('#profileForm') || document.body;
  document.querySelector('main')?.scrollTo(0,70);
  await docShots.wait(300);
  docShots.setToolboxRail({collapsed:true});
  await docShots.wait();
})()
"@
    Save-Screenshot "fixture-controller-profile-controls.png"

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
  docShots.setToolboxRail({collapsed:false});
  docShots.setSceneBox({visible:true,open:true});
  if(!Array.isArray(scenes))scenes=[];
  if(!scenes.some(s=>parseInt(s.slot,10)===0)){
    scenes.push({id:'doc_scene_tile',name:'Warm look',slot:0,values:{},visual:{type:'visual',color:'#305a36',image:''}});
  }else{
    const s=scenes.find(s=>parseInt(s.slot,10)===0);
    s.name=s.name||'Warm look';
    s.visual=s.visual||{type:'visual',color:'#305a36',image:''};
  }
  if(typeof renderSlotMatrix==='function')renderSlotMatrix();
  await docShots.wait(200);
  if(typeof openSceneVisualModal==='function')openSceneVisualModal(0);
  await docShots.wait(300);
  const name=document.getElementById('paletteVisualName');
  if(name)name.value='Warm look';
})()
"@
    Save-ElementScreenshot "#paletteVisualModal .modal" "fixture-controller-edit-tile.png"
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
  ['stepsBox','browserPlaybackBox','chaseBox','chaserPaletteBox'].forEach(openToolbox);
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

    $motionUrl = $BaseUrl.TrimEnd('/') + "/dmx_motion.html?docshot=$cacheBust"
    Send-Cdp "Page.navigate" @{ url = $motionUrl } | Out-Null
    Start-Sleep -Seconds 2

    if ($socket) { $socket.Dispose() }
    $tabs = Invoke-RestMethod -Uri $jsonUrl -UseBasicParsing
    $wsUrl = ($tabs | Where-Object { $_.url -like "*dmx_motion.html*" } | Select-Object -First 1).webSocketDebuggerUrl
    if (-not $wsUrl) { throw "Could not find Motion FX tab after navigation." }
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
  ['motionGroupsBox','motionEffectBox','motionSavedEffectBox','motionSceneBox','motionPaletteBox'].forEach(openToolbox);
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
    Save-ElementScreenshot "#motionEffectVisualModal .modal" "motion-edit-tile.png"
}
finally {
    if ($socket) { $socket.Dispose() }
    if ($chromeProcess -and -not $chromeProcess.HasExited) { Stop-Process -Id $chromeProcess.Id -Force }
}
