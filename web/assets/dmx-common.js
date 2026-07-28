(function(){
  'use strict';

  const BASE_URL_KEY='dmxPicoBaseUrl';
  const APP_VERSION='1.0.1';
  const DEFAULT_SCHEMA_VERSION=1;

  function isHttp(){
    return location.protocol==='http:'||location.protocol==='https:';
  }

  function escapeHtml(value){
    return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function appVersion(){
    return window.DMX_APP_VERSION||APP_VERSION;
  }

  function versionedPayload(data,schemaVersion){
    return {
      appVersion: appVersion(),
      schemaVersion: schemaVersion||DEFAULT_SCHEMA_VERSION,
      ...(data||{})
    };
  }

  function normalizeDmxOutput(output,index=0){
    const source=output&&typeof output==='object'?output:{};
    const fallbackNumber=index+1;
    const universe=Math.max(1,Math.min(9999,parseInt(source.universe,10)||fallbackNumber));
    return {
      id:String(source.id||('dmx-output-'+fallbackNumber)),
      ...(source.deviceId?{deviceId:String(source.deviceId)}:{}),
      name:String(source.name||('Pico '+fallbackNumber)).trim().slice(0,80)||('Pico '+fallbackNumber),
      universe,
      baseUrl:String(source.baseUrl||source.url||'').trim()
    };
  }

  function normalizeDmxOutputs(outputs,legacyBaseUrl=''){
    const source=Array.isArray(outputs)?outputs.filter(output=>output&&typeof output==='object'):[];
    const normalized=(source.length?source:[{baseUrl:legacyBaseUrl}]).map(normalizeDmxOutput);
    const ids=new Set();
    normalized.forEach((output,index)=>{
      let id=output.id;
      let suffix=2;
      while(ids.has(id))id=output.id+'-'+suffix++;
      output.id=id;
      ids.add(id);
      if(index===0&&legacyBaseUrl&&!output.baseUrl)output.baseUrl=String(legacyBaseUrl).trim();
    });
    return normalized;
  }

  function dmxOutputForFixture(fixture,outputs){
    const list=normalizeDmxOutputs(outputs);
    const requested=String(fixture?.outputId||'');
    return list.find(output=>output.id===requested)||list[0];
  }

  function dmxOutputEndpoint(output){
    return String(output?.baseUrl||'').trim().replace(/\/+$/,'');
  }

  function dmxOutputsForFixtures(fixtures,outputs){
    const list=normalizeDmxOutputs(outputs);
    const selected=new Map();
    (fixtures||[]).forEach(fixture=>{
      const output=dmxOutputForFixture(fixture,list);
      if(output?.id)selected.set(output.id,output);
    });
    return [...selected.values()];
  }

  async function sendFixtureDmxRows(entries,outputs,options={}){
    const list=normalizeDmxOutputs(outputs,options.legacyBaseUrl||'');
    const path=String(options.path||'/dmx/b');
    const batches=new Map();
    (entries||[]).forEach(entry=>{
      const row=entry?.row||entry;
      const channel=Math.round(Number(row?.ch??row?.channel));
      const value=Math.max(0,Math.min(255,Math.round(Number(row?.val??row?.value))));
      if(!Number.isFinite(channel)||channel<1||channel>512||!Number.isFinite(value))return;
      const output=entry?.output||dmxOutputForFixture(entry?.fixture,list);
      const root=dmxOutputEndpoint(output);
      if(!root)throw new Error('Set the Pico URL for '+(output?.name||'DMX output'));
      if(!batches.has(output.id))batches.set(output.id,{output,root,pairs:new Map()});
      batches.get(output.id).pairs.set(String(channel),String(value));
    });
    if(!batches.size)return 0;
    const results=await Promise.allSettled([...batches.values()].map(async batch=>{
      const body=[...batch.pairs.entries()].map(([channel,value])=>channel+':'+value).join(',');
      const response=await fetch(batch.root+path,{
        method:'POST',
        body,
        cache:'no-store',
        keepalive:!!options.keepalive
      });
      if(!response.ok)throw new Error(batch.output.name+': HTTP '+response.status);
      return batch.pairs.size;
    }));
    const errors=results.filter(result=>result.status==='rejected').map(result=>result.reason?.message||String(result.reason));
    if(errors.length)throw new Error(errors.join(' · '));
    return results.reduce((count,result)=>count+(result.status==='fulfilled'?result.value:0),0);
  }

  async function requestDmxOutputs(outputs,path,options={}){
    const unique=new Map();
    normalizeDmxOutputs(outputs,options.legacyBaseUrl||'').forEach(output=>{
      const root=dmxOutputEndpoint(output);
      if(root)unique.set(output.id,{output,root});
    });
    if(!unique.size)return 0;
    const results=await Promise.allSettled([...unique.values()].map(async item=>{
      const response=await fetch(item.root+path,{cache:'no-store',keepalive:!!options.keepalive});
      if(!response.ok)throw new Error(item.output.name+': HTTP '+response.status);
    }));
    const errors=results.filter(result=>result.status==='rejected').map(result=>result.reason?.message||String(result.reason));
    if(errors.length)throw new Error(errors.join(' · '));
    return unique.size;
  }

  function linkedPlaybackMembersForFixtures(fixtures,outputs,payloadForOutput,options={}){
    const list=normalizeDmxOutputs(outputs,options.legacyBaseUrl||'');
    const involved=dmxOutputsForFixtures(fixtures,list);
    const preferredRoot=String(options.preferredBaseUrl||'').trim().replace(/\/+$/,'');
    if(preferredRoot){
      involved.sort((a,b)=>{
        const aPreferred=dmxOutputEndpoint(a)===preferredRoot?0:1;
        const bPreferred=dmxOutputEndpoint(b)===preferredRoot?0:1;
        return aPreferred-bPreferred;
      });
    }
    return involved.map(output=>({
      output,
      payload:String(payloadForOutput(output)||'')
    })).filter(member=>member.payload.trim()!=='');
  }

  async function uploadLinkedPicoPlayback(options){
    const kind=options.kind==='motion'?'motion':'chaser';
    const slotPath=kind==='motion'?'/motion/slots':'/chaser/slots';
    const loadPath=kind==='motion'?'/motion/load/':'/chaser/load/';
    const clearPath=kind==='motion'?'/motion/clear/':'/chaser/clear/';
    const members=(options.members||[]).map(member=>({
      output:member.output,
      payload:String(member.payload||'')
    })).filter(member=>member.output&&member.payload.trim()!=='');
    if(!members.length)throw new Error('No configured DMX Outputs are involved in this playback');
    const preferredSlot=Math.max(0,Math.round(Number(options.preferredSlot)||0));
    const slotCount=Math.max(1,Math.round(Number(options.slotCount)||(kind==='motion'?64:32)));

    const snapshots=await Promise.all(members.map(async(member,index)=>{
      const root=dmxOutputEndpoint(member.output);
      if(!root)throw new Error('Set the Pico URL for '+(member.output.name||'DMX output'));
      const response=await fetch(root+slotPath,{cache:'no-store'});
      if(!response.ok)throw new Error((member.output.name||'DMX output')+': slot check failed (HTTP '+response.status+')');
      const data=await response.json();
      if(!data?.ok||!Array.isArray(data.slots))throw new Error((member.output.name||'DMX output')+': invalid slot response');
      const reportedCount=Math.min(slotCount,data.slots.length||slotCount);
      let slot=-1;
      if(index===0){
        if(preferredSlot>=reportedCount)throw new Error((member.output.name||'DMX output')+' supports only '+reportedCount+' slots');
        const occupied=!!data.slots[preferredSlot]?.loaded;
        if(occupied&&!options.allowCoordinatorOverwrite){
          throw new Error((member.output.name||'DMX output')+' slot '+preferredSlot+' is already occupied');
        }
        slot=preferredSlot;
      }else{
        for(let candidate=0;candidate<reportedCount;candidate++){
          if(!data.slots[candidate]?.loaded){slot=candidate;break;}
        }
        if(slot<0)throw new Error('No empty '+kind+' slot is available on '+(member.output.name||'DMX output'));
      }
      return{...member,root,slot};
    }));

    const uploaded=[];
    try{
      for(const member of snapshots){
        const response=await fetch(member.root+loadPath+member.slot,{
          method:'POST',
          body:member.payload,
          headers:{'Content-Type':'text/plain'}
        });
        const data=await response.json().catch(()=>null);
        if(!response.ok||!data?.ok)throw new Error((member.output.name||'DMX output')+': '+(data?.error||('upload failed (HTTP '+response.status+')')));
        uploaded.push(member);
      }
      const playback={
        id:options.id||('playback_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)),
        kind,
        label:String(options.label||((kind==='motion'?'Effect':'Chase')+' slot '+preferredSlot)),
        createdAt:new Date().toISOString(),
        members:snapshots.map(member=>({
          outputId:String(member.output.id),
          outputName:String(member.output.name||member.output.id),
          universe:Math.max(1,Math.round(Number(member.output.universe)||1)),
          baseUrl:member.root+'/',
          slot:member.slot,
          payload:member.payload
        }))
      };
      if(options.serverEndpoint){
        const saved=await fetch(options.serverEndpoint+'?playback',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(playback)
        });
        const savedData=await saved.json().catch(()=>null);
        if(!saved.ok||!savedData?.ok)throw new Error(savedData?.error||'Could not save linked playback manifest');
      }
      return playback;
    }catch(error){
      await Promise.allSettled(uploaded.map(member=>fetch(member.root+clearPath+member.slot,{cache:'no-store'})));
      throw error;
    }
  }

  async function commandLinkedPicoPlayback(playback,pathForMember,options={}){
    const members=Array.isArray(playback?.members)?playback.members:[];
    if(!members.length)throw new Error('Playback has no linked Pico slots');
    const results=await Promise.allSettled(members.map(async member=>{
      const root=String(member.baseUrl||'').trim().replace(/\/+$/,'');
      if(!root)throw new Error((member.outputName||member.outputId||'DMX output')+': Pico URL is missing');
      const path=pathForMember(member);
      const response=await fetch(root+path,{cache:'no-store',keepalive:!!options.keepalive});
      const data=await response.json().catch(()=>null);
      if(!response.ok||data?.ok===false)throw new Error((member.outputName||member.outputId||'DMX output')+': '+(data?.error||('HTTP '+response.status)));
    }));
    const errors=results.filter(result=>result.status==='rejected').map(result=>result.reason?.message||String(result.reason));
    if(errors.length)throw new Error(errors.join(' · '));
    return members.length;
  }

  function fixtureSetupEndpoint(){
    return /\/test(?:\/|\/index\.html?)?$/i.test(location.pathname)?'../fixture_setup.php':'fixture_setup.php';
  }

  function showUsedDmxOutputs(setup){
    const source=setup&&typeof setup==='object'?setup:{};
    const outputs=normalizeDmxOutputs(source.dmxOutputs,source.baseUrl);
    if(!outputs.some(output=>output.baseUrl))return[];
    const fixtures=Array.isArray(source.fixtures)?source.fixtures:[];
    if(!fixtures.length)return outputs.filter(output=>output.baseUrl);
    const primaryId=outputs[0]?.id||'';
    const usedIds=new Set(fixtures.map(fixture=>String(fixture?.outputId||primaryId)).filter(Boolean));
    const used=outputs.filter(output=>usedIds.has(output.id));
    return used.length?used:outputs.filter(output=>output.baseUrl);
  }

  async function checkPicoFleetOutput(output,timeoutMs=1800){
    const root=dmxOutputEndpoint(output);
    if(!root)return{output,online:false,error:'URL not configured'};
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timeout=setTimeout(()=>controller?.abort(),timeoutMs);
    try{
      const response=await fetch(root+'/status.json',{cache:'no-store',signal:controller?.signal});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const status=await response.json();
      if(!status||!status.dmx)throw new Error('Unexpected status response');
      const installedFirmware=String(status.firmware_version||'').trim();
      const expectedFirmware=appVersion();
      const firmwareState=!installedFirmware?'missing':installedFirmware===expectedFirmware?'current':'mismatch';
      return{output,online:true,status,installedFirmware,expectedFirmware,firmwareState};
    }catch(error){
      return{output,online:false,error:error?.name==='AbortError'?'timeout':(error?.message||String(error))};
    }finally{
      clearTimeout(timeout);
    }
  }

  let picoFleetRefreshPromise=null;
  async function refreshPicoFleetStatus(options={}){
    const indicators=[...document.querySelectorAll('[data-pico-fleet-status]')];
    if(!indicators.length)return null;
    if(picoFleetRefreshPromise&&!options.force)return picoFleetRefreshPromise;
    indicators.forEach(indicator=>{
      indicator.dataset.state='checking';
      indicator.textContent='Checking Picos…';
      indicator.title='Checking every DMX output used by this show';
    });
    picoFleetRefreshPromise=(async()=>{
      try{
        let setup=options.setup;
        if(!setup){
          const response=await fetch(options.setupUrl||fixtureSetupEndpoint(),{cache:'no-store'});
          const result=await response.json();
          if(!response.ok||!result.ok)throw new Error(result.error||('HTTP '+response.status));
          setup=result.exists===false?{}:(result.setup||result);
        }
        const outputs=showUsedDmxOutputs(setup);
        if(!outputs.length){
          indicators.forEach(indicator=>{
            indicator.dataset.state='empty';
            indicator.textContent='No Picos configured';
            indicator.title='Open DMX Outputs on the Controller page to configure show outputs';
          });
          return{outputs:[],results:[],online:0,total:0};
        }
        const headerBaseInput=document.querySelector('header #baseUrl');
        const primaryUrl=String(outputs[0]?.baseUrl||'').trim();
        if(headerBaseInput&&primaryUrl&&headerBaseInput.value!==primaryUrl){
          const descriptor=Object.getOwnPropertyDescriptor(window.HTMLInputElement?.prototype||{},'value');
          if(descriptor?.set)descriptor.set.call(headerBaseInput,primaryUrl);
          else headerBaseInput.value=primaryUrl;
          localStorage.setItem(BASE_URL_KEY,primaryUrl);
        }
        const results=await Promise.all(outputs.map(output=>checkPicoFleetOutput(output,options.timeoutMs)));
        const online=results.filter(result=>result.online).length;
        const total=results.length;
        const firmwareCurrent=results.filter(result=>result.online&&result.firmwareState==='current').length;
        const firmwareIssues=online-firmwareCurrent;
        const state=online!==total?(online?'partial':'offline'):(firmwareIssues?'version':'online');
        const noun=total===1?'Pico':'Picos';
        const details=results.map(result=>{
          const prefix=result.output.name+' · U'+result.output.universe+': ';
          if(!result.online)return prefix+'offline'+(result.error?' ('+result.error+')':'');
          if(result.firmwareState==='current')return prefix+'online · firmware '+result.installedFirmware+' current';
          if(result.firmwareState==='missing')return prefix+'online · firmware version not reported, expected '+result.expectedFirmware;
          return prefix+'online · firmware '+result.installedFirmware+', expected '+result.expectedFirmware;
        }).join('\n');
        indicators.forEach(indicator=>{
          indicator.dataset.state=state;
          const firmwareText=firmwareIssues
            ? firmwareCurrent+'/'+online+' firmware current'
            : 'firmware current';
          indicator.textContent=online+'/'+total+' '+noun+' online'+(online?' · '+firmwareText:'');
          indicator.title=details+'\nClick to check again.';
        });
        return{outputs,results,online,total,firmwareCurrent,firmwareIssues};
      }catch(error){
        indicators.forEach(indicator=>{
          indicator.dataset.state='error';
          indicator.textContent='Pico status unavailable';
          indicator.title='Could not load the show DMX Outputs: '+(error?.message||String(error));
        });
        return{outputs:[],results:[],online:0,total:0,error};
      }finally{
        picoFleetRefreshPromise=null;
      }
    })();
    return picoFleetRefreshPromise;
  }

  function initAdaptiveHeader(){
    const header=document.querySelector('header');
    if(!header||header.dataset.adaptiveHeader==='1')return header;
    header.dataset.adaptiveHeader='1';
    header.classList.add('app-sticky-header');
    const toolbar=header.querySelector('.toolbar');
    const links=[...header.querySelectorAll('a.nav')];
    if(links.length){
      const nav=document.createElement('nav');
      nav.className='app-page-nav';
      nav.setAttribute('aria-label','Application pages');
      links.forEach(link=>nav.appendChild(link));
      header.appendChild(nav);
    }
    const baseInput=header.querySelector('#baseUrl');
    if(baseInput){
      baseInput.closest('label')?.classList.add('pico-header-url-field');
      baseInput.setAttribute('aria-hidden','true');
      baseInput.tabIndex=-1;
    }
    header.querySelectorAll('.pico-discovery-btn').forEach(button=>button.remove());
    if(toolbar&&!toolbar.querySelector('[data-pico-fleet-status]')){
      const indicator=document.createElement('button');
      indicator.type='button';
      indicator.className='pico-fleet-status';
      indicator.dataset.picoFleetStatus='';
      indicator.dataset.state='checking';
      indicator.textContent='Checking Picos…';
      indicator.addEventListener('click',()=>refreshPicoFleetStatus({force:true}));
      toolbar.insertBefore(indicator,toolbar.firstChild);
    }
    refreshPicoFleetStatus();
    const pollMs=10000;
    const poll=()=>setTimeout(()=>{
      if(document.contains(header)){
        refreshPicoFleetStatus().finally(poll);
      }
    },pollMs);
    poll();
    return header;
  }

  function normalizePixelMatrix(matrix,index=0){
    const source=matrix&&typeof matrix==='object'?matrix:{};
    const width=clampInt(source.width||8,1,64);
    const height=clampInt(source.height||8,1,64);
    const count=width*height;
    const mappings=Array.isArray(source.mappings)?source.mappings.slice(0,count).map(value=>String(value||'')):[];
    const pixels=Array.isArray(source.pixels)?source.pixels.slice(0,count).map(value=>/^#[0-9a-f]{6}$/i.test(String(value))?String(value).toLowerCase():'#000000'):[];
    const visual=normalizeSlotVisual(source.visual);
    while(mappings.length<count)mappings.push('');
    while(pixels.length<count)pixels.push('#000000');
    return {
      id:String(source.id||('pixel-matrix-'+(index+1))),
      name:String(source.name||('Pixel Matrix '+(index+1))).trim().slice(0,80)||('Pixel Matrix '+(index+1)),
      slot:Math.max(0,parseInt(source.slot,10)>=0?parseInt(source.slot,10):index),
      width,
      height,
      fit:['contain','cover','stretch'].includes(source.fit)?source.fit:'contain',
      brightness:clampInt(source.brightness??100,1,100),
      imageName:String(source.imageName||'').slice(0,160),
      mappings,
      pixels,
      ...(visual?{visual}:{})
    };
  }

  function normalizePixelMatrices(matrices){
    const used=new Set();
    return (Array.isArray(matrices)?matrices:[]).map((matrix,index)=>{
      const normalized=normalizePixelMatrix(matrix,index);
      while(used.has(normalized.slot))normalized.slot++;
      used.add(normalized.slot);
      return normalized;
    }).sort((a,b)=>a.slot-b.slot);
  }

  async function recallPixelMatrix(matrix,options={}){
    if(!matrix)return false;
    const normalized=normalizePixelMatrix(matrix);
    if(options.stopPlayback)await options.stopPlayback(normalized);
    if(options.resetOutputCache)options.resetOutputCache(normalized);
    if(typeof options.apply!=='function')return false;
    return options.apply(normalized);
  }

  async function imageSourceBitmap(source){
    if(typeof createImageBitmap==='function')return createImageBitmap(source);
    const url=typeof source==='string'?source:URL.createObjectURL(source);
    try{
      return await new Promise((resolve,reject)=>{
        const image=new Image();
        image.onload=()=>resolve(image);
        image.onerror=()=>reject(new Error('Image could not be decoded'));
        image.src=url;
      });
    }finally{
      if(typeof source!=='string')URL.revokeObjectURL(url);
    }
  }

  async function pixelMatrixImageColors(source,width,height,options={}){
    const w=clampInt(width,1,64),h=clampInt(height,1,64);
    const fit=['contain','cover','stretch'].includes(options.fit)?options.fit:'contain';
    const brightness=clampInt(options.brightness??100,1,100)/100;
    const bitmap=await imageSourceBitmap(source);
    const canvas=document.createElement('canvas');
    canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle=options.background||'#000000';
    ctx.fillRect(0,0,w,h);
    const sw=bitmap.width||bitmap.naturalWidth,sh=bitmap.height||bitmap.naturalHeight;
    if(!sw||!sh)throw new Error('Image has no usable dimensions');
    if(fit==='stretch')ctx.drawImage(bitmap,0,0,w,h);
    else{
      const scale=fit==='cover'?Math.max(w/sw,h/sh):Math.min(w/sw,h/sh);
      const dw=sw*scale,dh=sh*scale;
      ctx.drawImage(bitmap,(w-dw)/2,(h-dh)/2,dw,dh);
    }
    bitmap.close?.();
    const data=ctx.getImageData(0,0,w,h).data;
    const colors=[];
    for(let i=0;i<w*h;i++){
      const offset=i*4;
      colors.push('#'+hexByte(data[offset]*brightness)+hexByte(data[offset+1]*brightness)+hexByte(data[offset+2]*brightness));
    }
    return colors;
  }

  function pixelMatrixToolboxHtml(){
    return `<div id="pixelMatrixToolbox" class="scene-toolbox scene-toolbox--pixel-matrix">
<div id="pixelMatrixToolboxHdr" class="scene-toolbox__header"><span style="font-weight:700;font-size:13px">Pixel Matrices</span><button id="pixelMatrixToolboxToggle" class="scene-toolbox__toggle">—</button></div>
<div id="pixelMatrixToolboxBody" class="scene-toolbox__body"><div id="pixelMatrixLayoutControls" class="tile-layout-controls"></div><div id="pixelMatrixGrid" class="scene-slot-matrix"></div></div>
</div>
<div id="pixelMatrixModal" class="modal-overlay form-modal" style="display:none">
<div class="modal-card wide-modal pixel-matrix-modal" role="dialog" aria-modal="true" aria-labelledby="pixelMatrixTitle">
<div class="modal-head"><button id="pixelMatrixClose" type="button" aria-label="Close">x</button><div class="modal-title-stack"><h2 id="pixelMatrixTitle">Pixel Matrix</h2><div class="small">Paint pixel colors, map fixture color controls, convert an image, and send the result to all assigned DMX outputs.</div></div></div>
<div class="modal-body">
<section id="pixelMatrixTileAppearance" class="slot-visual-editor pixel-matrix-tile-appearance" aria-labelledby="pixelMatrixTileAppearanceTitle">
<h3 id="pixelMatrixTileAppearanceTitle">Tile appearance</h3>
<div class="toolbar"><label>Background color<input id="pixelMatrixTileColor" type="color" value="#25323c"></label><button id="pixelMatrixTileResetColor" type="button">Default background</button><label>Upload icon<input id="pixelMatrixTileImage" type="file" accept="image/*"></label></div>
<div class="toolbar"><span class="pixel-matrix-tile-canvas-stack"><canvas id="pixelMatrixTileCanvas" class="gobo-canvas" width="120" height="120" aria-label="Draw Pixel Matrix tile icon"></canvas><canvas id="pixelMatrixTileGrid" class="gobo-canvas pixel-matrix-tile-grid" width="120" height="120" aria-hidden="true"></canvas></span><button id="pixelMatrixTileClearIcon" type="button">No icon</button><button id="pixelMatrixTileToMatrix" type="button" disabled>Use icon as matrix</button></div>
<div class="small">Choose the saved toolbox tile background and optionally draw or upload an icon. The grid preview follows the matrix Width, Height, and Fit without becoming part of the saved icon.</div>
</section>
<div class="toolbar"><label>Name<input id="pixelMatrixName" type="text" maxlength="80"></label><label>Width<input id="pixelMatrixWidth" type="number" min="1" max="64"></label><label>Height<input id="pixelMatrixHeight" type="number" min="1" max="64"></label><label>Fit<select id="pixelMatrixFit"><option value="contain">Contain</option><option value="cover">Cover</option><option value="stretch">Stretch</option></select></label><label>Brightness %<input id="pixelMatrixBrightness" type="number" min="1" max="100"></label></div>
<div class="toolbar"><label>Image<input id="pixelMatrixImage" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label><button id="pixelMatrixClearImage" type="button">Clear Image</button></div>
<div class="toolbar pixel-matrix-edit-toolbar"><button id="pixelMatrixEditMapping" class="pixel-matrix-mode-toggle" type="button" aria-pressed="false">Edit Mapping</button><div id="pixelMatrixColorTools" class="pixel-matrix-inline-tools"><label>Pixel color<input id="pixelMatrixColor" type="color" value="#ffffff"></label><span class="small">Choose a color, then click pixels to paint them.</span></div></div>
<div id="pixelMatrixMappingTools" class="toolbar pixel-matrix-inline-tools" hidden><label>Mapping target<select id="pixelMatrixTarget"></select></label><button id="pixelMatrixAutoMap" type="button">Auto Map</button><button id="pixelMatrixClearMap" type="button">Clear Mapping</button><span class="small">Click pixels to assign the selected fixture target.</span></div>
<div class="small" id="pixelMatrixSummary"></div>
<div id="pixelMatrixEditorGrid" class="pixel-matrix-grid"></div>
</div>
<div class="modal-actions"><button id="pixelMatrixSave" class="primary" type="button">Save</button><button id="pixelMatrixClose2" type="button">Close</button></div>
</div></div>`;
  }

  function mountPixelMatrixToolbox(target){
    const el=typeof target==='string'?document.getElementById(target):target;
    if(!el)return null;
    el.outerHTML=pixelMatrixToolboxHtml();
    return document.getElementById('pixelMatrixToolbox');
  }

  function initPixelMatrixEditor(options={}){
    const getMatrix=()=>options.getMatrix?.()||null;
    const getTargets=()=>options.targets?.()||[];
    let mappingMode=false;
    const tileColorInput=document.getElementById('pixelMatrixTileColor');
    const tileImageInput=document.getElementById('pixelMatrixTileImage');
    const tileCanvas=document.getElementById('pixelMatrixTileCanvas');
    const tileContext=tileCanvas.getContext('2d');
    const tileGrid=document.getElementById('pixelMatrixTileGrid');
    const tileGridContext=tileGrid.getContext('2d');
    const tileToMatrixButton=document.getElementById('pixelMatrixTileToMatrix');
    let tileIcon='';
    let tileDrawing=false;

    function defaultTileColor(matrix){
      const color=String(matrix?.pixels?.[0]||'');
      return /^#[0-9a-f]{6}$/i.test(color)?color:'#25323c';
    }
    function prepareTileBrush(){
      tileContext.strokeStyle=contrastTextForColor(tileColorInput.value);
      tileContext.lineWidth=6;
      tileContext.lineCap='round';
      tileContext.lineJoin='round';
    }
    function tileFitGeometry(matrix){
      const canvasWidth=tileCanvas.width,canvasHeight=tileCanvas.height;
      const width=clampInt(matrix?.width,1,64),height=clampInt(matrix?.height,1,64);
      const fit=['contain','cover','stretch'].includes(matrix?.fit)?matrix.fit:'contain';
      const full={x:0,y:0,width:canvasWidth,height:canvasHeight};
      if(fit==='stretch')return{fit,width,height,source:full,image:full};
      if(fit==='contain'){
        const scale=Math.min(width/canvasWidth,height/canvasHeight);
        const imageWidth=canvasWidth*scale,imageHeight=canvasHeight*scale;
        return{
          fit,width,height,source:full,
          image:{
            x:(width-imageWidth)*canvasWidth/(2*width),
            y:(height-imageHeight)*canvasHeight/(2*height),
            width:imageWidth*canvasWidth/width,
            height:imageHeight*canvasHeight/height
          }
        };
      }
      const scale=Math.max(width/canvasWidth,height/canvasHeight);
      const sourceWidth=width/scale,sourceHeight=height/scale;
      return{
        fit,width,height,image:full,
        source:{
          x:(canvasWidth-sourceWidth)/2,
          y:(canvasHeight-sourceHeight)/2,
          width:sourceWidth,
          height:sourceHeight
        }
      };
    }
    function geometryText(rect){
      return [rect.x,rect.y,rect.width,rect.height].map(value=>String(Math.round(value*1000)/1000)).join(',');
    }
    function renderTileGridOverlay(){
      const matrix=getMatrix();
      tileGridContext.clearRect(0,0,tileGrid.width,tileGrid.height);
      if(!matrix)return;
      const geometry=tileFitGeometry(matrix);
      const source=document.createElement('canvas');
      source.width=tileCanvas.width;
      source.height=tileCanvas.height;
      const sourceContext=source.getContext('2d');
      sourceContext.fillStyle=tileColorInput.value||defaultTileColor(matrix);
      sourceContext.fillRect(0,0,source.width,source.height);
      sourceContext.drawImage(tileCanvas,0,0);
      tileGridContext.fillStyle=tileColorInput.value||defaultTileColor(matrix);
      tileGridContext.fillRect(0,0,tileGrid.width,tileGrid.height);
      const s=geometry.source,d=geometry.image;
      tileGridContext.drawImage(source,s.x,s.y,s.width,s.height,d.x,d.y,d.width,d.height);
      tileGridContext.lineCap='butt';
      for(let column=0;column<=geometry.width;column++){
        const x=column*tileGrid.width/geometry.width;
        tileGridContext.beginPath();
        tileGridContext.moveTo(x,0);
        tileGridContext.lineTo(x,tileGrid.height);
        tileGridContext.strokeStyle='rgba(0,0,0,.8)';
        tileGridContext.lineWidth=3;
        tileGridContext.stroke();
        tileGridContext.strokeStyle='rgba(255,255,255,.82)';
        tileGridContext.lineWidth=1;
        tileGridContext.stroke();
      }
      for(let row=0;row<=geometry.height;row++){
        const y=row*tileGrid.height/geometry.height;
        tileGridContext.beginPath();
        tileGridContext.moveTo(0,y);
        tileGridContext.lineTo(tileGrid.width,y);
        tileGridContext.strokeStyle='rgba(0,0,0,.8)';
        tileGridContext.lineWidth=3;
        tileGridContext.stroke();
        tileGridContext.strokeStyle='rgba(255,255,255,.82)';
        tileGridContext.lineWidth=1;
        tileGridContext.stroke();
      }
      if(geometry.fit==='contain'&&(d.x||d.y)){
        tileGridContext.setLineDash([5,3]);
        tileGridContext.strokeStyle='rgba(1,255,230,.95)';
        tileGridContext.lineWidth=2;
        tileGridContext.strokeRect(d.x,d.y,d.width,d.height);
        tileGridContext.setLineDash([]);
      }
      tileGrid.dataset.fit=geometry.fit;
      tileGrid.dataset.columns=String(geometry.width);
      tileGrid.dataset.rows=String(geometry.height);
      tileGrid.dataset.sourceRect=geometryText(s);
      tileGrid.dataset.imageRect=geometryText(d);
    }
    function clearTileCanvas(){
      tileContext.clearRect(0,0,tileCanvas.width,tileCanvas.height);
      tileCanvas.style.background=tileColorInput.value;
      prepareTileBrush();
      renderTileGridOverlay();
    }
    function drawTileIcon(image){
      clearTileCanvas();
      tileToMatrixButton.disabled=true;
      if(!image)return Promise.resolve(false);
      const icon=new Image();
      return new Promise(resolve=>{
        icon.onload=()=>{
          clearTileCanvas();
          tileContext.drawImage(icon,0,0,tileCanvas.width,tileCanvas.height);
          renderTileGridOverlay();
          tileToMatrixButton.disabled=false;
          resolve(true);
        };
        icon.onerror=()=>{
          report('Tile icon could not be decoded');
          resolve(false);
        };
        icon.src=image;
      });
    }
    function syncTileVisual(){
      const matrix=getMatrix();
      if(!matrix)return;
      matrix.visual={
        type:'visual',
        color:tileColorInput.value||defaultTileColor(matrix),
        image:/^data:image\//.test(tileIcon)?tileIcon:''
      };
    }
    function tilePointerPosition(event){
      const rect=tileCanvas.getBoundingClientRect();
      const destination={
        x:(event.clientX-rect.left)*tileCanvas.width/rect.width,
        y:(event.clientY-rect.top)*tileCanvas.height/rect.height
      };
      const geometry=tileFitGeometry(getMatrix());
      const d=geometry.image,s=geometry.source;
      if(destination.x<d.x||destination.x>d.x+d.width||destination.y<d.y||destination.y>d.y+d.height)return null;
      return{
        x:s.x+(destination.x-d.x)*s.width/d.width,
        y:s.y+(destination.y-d.y)*s.height/d.height
      };
    }

    function report(message,error){
      if(options.onError)options.onError(message,error);
      else console.error(message,error);
    }
    function preview(){
      const matrix=getMatrix();
      if(!matrix||!options.preview)return Promise.resolve(false);
      return Promise.resolve()
        .then(()=>options.preview(matrix))
        .catch(error=>{
          report('Pixel Matrix preview failed: '+(error?.message||error),error);
          return false;
        });
    }
    function sync(){
      return options.sync?.()||getMatrix();
    }
    function nextUnusedTarget(currentKey,matrix,targets){
      if(!currentKey)return'';
      const currentIndex=targets.findIndex(target=>target.key===currentKey);
      const mapped=new Set(matrix.mappings.filter(Boolean));
      for(let offset=1;offset<=targets.length;offset++){
        const candidate=targets[(currentIndex+offset)%targets.length]?.key||'';
        if(candidate&&!mapped.has(candidate))return candidate;
      }
      return'';
    }
    function render(){
      const matrix=getMatrix();
      if(!matrix)return;
      const mappingToggle=document.getElementById('pixelMatrixEditMapping');
      mappingToggle.setAttribute('aria-pressed',String(mappingMode));
      mappingToggle.classList.toggle('active',mappingMode);
      document.getElementById('pixelMatrixColorTools').hidden=mappingMode;
      document.getElementById('pixelMatrixMappingTools').hidden=!mappingMode;
      document.getElementById('pixelMatrixName').value=matrix.name;
      document.getElementById('pixelMatrixWidth').value=matrix.width;
      document.getElementById('pixelMatrixHeight').value=matrix.height;
      document.getElementById('pixelMatrixFit').value=matrix.fit;
      document.getElementById('pixelMatrixBrightness').value=matrix.brightness;
      const targets=getTargets();
      const targetSelect=document.getElementById('pixelMatrixTarget');
      const previous=targetSelect.value;
      targetSelect.innerHTML='<option value="">Unmapped</option>'+targets.map(target=>`<option value="${escapeHtml(target.key)}">${escapeHtml(target.label)}</option>`).join('');
      if(targets.some(target=>target.key===previous))targetSelect.value=previous;
      const labels=new Map(targets.map(target=>[target.key,target.label]));
      const grid=document.getElementById('pixelMatrixEditorGrid');
      const paintColor=document.getElementById('pixelMatrixColor').value;
      grid.style.gridTemplateColumns=`repeat(${matrix.width},minmax(24px,1fr))`;
      grid.innerHTML=matrix.pixels.map((color,index)=>{
        const key=matrix.mappings[index];
        const detail=mappingMode?(key?' · '+escapeHtml(labels.get(key)||key):' · unmapped'):' · '+color+' · paint '+paintColor;
        return `<button type="button" class="pixel-matrix-cell${mappingMode&&!key?' unmapped':''}" data-pixel-matrix-cell="${index}" style="background:${color}" title="Pixel ${index+1}${detail}"><span>${index+1}</span></button>`;
      }).join('');
      const mapped=matrix.mappings.filter(key=>labels.has(key)).length;
      document.getElementById('pixelMatrixSummary').textContent=matrix.width+'×'+matrix.height+' = '+(matrix.width*matrix.height)+' pixels · '+mapped+' mapped · '+targets.length+' compatible fixture color controls available'+(matrix.imageName?' · '+matrix.imageName:'');
      renderTileGridOverlay();
    }
    function reset(){
      const matrix=getMatrix();
      mappingMode=false;
      document.getElementById('pixelMatrixColor').value=matrix?.pixels?.[0]||'#ffffff';
      const visual=normalizeSlotVisual(matrix?.visual);
      tileColorInput.value=visual?.color||defaultTileColor(matrix);
      tileIcon=visual?.image||'';
      tileImageInput.value='';
      drawTileIcon(tileIcon);
      render();
    }

    ['pixelMatrixWidth','pixelMatrixHeight'].forEach(id=>{
      document.getElementById(id).addEventListener('change',()=>{
        if(!getMatrix())return;
        sync();
        render();
        preview();
      });
    });
    ['pixelMatrixFit','pixelMatrixBrightness'].forEach(id=>{
      document.getElementById(id).addEventListener('change',()=>{
        if(!getMatrix())return;
        sync();
        render();
      });
    });
    document.getElementById('pixelMatrixEditorGrid').addEventListener('click',event=>{
      const cell=event.target.closest('[data-pixel-matrix-cell]');
      if(!cell||!getMatrix())return;
      const matrix=sync();
      const index=clampInt(cell.dataset.pixelMatrixCell,0,matrix.pixels.length-1);
      if(!mappingMode){
        matrix.pixels[index]=document.getElementById('pixelMatrixColor').value;
        render();
        preview();
        return;
      }
      const targetKey=document.getElementById('pixelMatrixTarget').value;
      if(targetKey)matrix.mappings=matrix.mappings.map(key=>key===targetKey?'':key);
      matrix.mappings[index]=targetKey;
      const nextTargetKey=nextUnusedTarget(targetKey,matrix,getTargets());
      render();
      document.getElementById('pixelMatrixTarget').value=nextTargetKey;
      preview();
    });
    document.getElementById('pixelMatrixEditMapping').onclick=()=>{
      mappingMode=!mappingMode;
      render();
    };
    document.getElementById('pixelMatrixAutoMap').onclick=()=>{
      if(!getMatrix())return;
      const matrix=sync();
      const targets=getTargets();
      matrix.mappings=matrix.mappings.map((_,index)=>targets[index]?.key||'');
      render();
      preview();
    };
    document.getElementById('pixelMatrixClearMap').onclick=()=>{
      if(!getMatrix())return;
      const matrix=sync();
      matrix.mappings.fill('');
      render();
      preview();
    };
    document.getElementById('pixelMatrixClearImage').onclick=()=>{
      if(!getMatrix())return;
      const matrix=sync();
      matrix.pixels.fill('#000000');
      matrix.imageName='';
      document.getElementById('pixelMatrixImage').value='';
      render();
      preview();
    };
    document.getElementById('pixelMatrixImage').addEventListener('change',async event=>{
      const file=event.target.files?.[0];
      if(!file||!getMatrix())return;
      const matrix=sync();
      event.target.disabled=true;
      try{
        matrix.pixels=await pixelMatrixImageColors(file,matrix.width,matrix.height,{fit:matrix.fit,brightness:matrix.brightness});
        matrix.imageName=file.name;
        render();
        await preview();
        options.onImageConverted?.(file,matrix);
      }catch(error){
        report('Image conversion failed: '+(error?.message||error),error);
      }finally{
        event.target.disabled=false;
      }
    });
    tileColorInput.addEventListener('input',()=>{
      tileCanvas.style.background=tileColorInput.value;
      prepareTileBrush();
      syncTileVisual();
      renderTileGridOverlay();
    });
    document.getElementById('pixelMatrixTileResetColor').onclick=()=>{
      tileColorInput.value=defaultTileColor(getMatrix());
      tileCanvas.style.background=tileColorInput.value;
      prepareTileBrush();
      syncTileVisual();
      renderTileGridOverlay();
    };
    tileImageInput.addEventListener('change',event=>{
      const file=event.target.files?.[0];
      if(!file||!getMatrix())return;
      const reader=new FileReader();
      reader.onload=()=>{
        tileIcon=String(reader.result||'');
        syncTileVisual();
        drawTileIcon(tileIcon);
      };
      reader.onerror=()=>report('Tile icon could not be read',reader.error);
      reader.readAsDataURL(file);
    });
    document.getElementById('pixelMatrixTileClearIcon').onclick=()=>{
      tileIcon='';
      tileImageInput.value='';
      clearTileCanvas();
      tileToMatrixButton.disabled=true;
      syncTileVisual();
    };
    tileCanvas.addEventListener('pointerdown',event=>{
      if(!getMatrix())return;
      event.preventDefault();
      const point=tilePointerPosition(event);
      if(!point)return;
      tileCanvas.setPointerCapture?.(event.pointerId);
      tileToMatrixButton.disabled=true;
      prepareTileBrush();
      tileContext.beginPath();
      tileContext.moveTo(point.x,point.y);
      tileDrawing=true;
    });
    tileCanvas.addEventListener('pointermove',event=>{
      if(!tileDrawing)return;
      const point=tilePointerPosition(event);
      if(!point)return;
      tileContext.lineTo(point.x,point.y);
      tileContext.stroke();
      tileContext.beginPath();
      tileContext.moveTo(point.x,point.y);
      renderTileGridOverlay();
    });
    const finishTileDrawing=event=>{
      if(!tileDrawing)return;
      tileDrawing=false;
      tileCanvas.releasePointerCapture?.(event.pointerId);
      tileIcon=tileCanvas.toDataURL('image/png');
      syncTileVisual();
      tileToMatrixButton.disabled=false;
      renderTileGridOverlay();
    };
    tileCanvas.addEventListener('pointerup',finishTileDrawing);
    tileCanvas.addEventListener('pointercancel',finishTileDrawing);
    tileToMatrixButton.onclick=async()=>{
      if(!tileIcon||!getMatrix())return;
      const matrix=sync();
      const composite=document.createElement('canvas');
      composite.width=tileCanvas.width;
      composite.height=tileCanvas.height;
      const context=composite.getContext('2d');
      context.fillStyle=tileColorInput.value||defaultTileColor(matrix);
      context.fillRect(0,0,composite.width,composite.height);
      context.drawImage(tileCanvas,0,0);
      tileToMatrixButton.disabled=true;
      try{
        matrix.pixels=await pixelMatrixImageColors(composite,matrix.width,matrix.height,{fit:matrix.fit,brightness:matrix.brightness});
        matrix.imageName='Tile icon';
        render();
        await preview();
        options.onTileIconConverted?.(matrix);
      }catch(error){
        report('Tile icon conversion failed: '+(error?.message||error),error);
      }finally{
        tileToMatrixButton.disabled=!tileIcon;
      }
    };

    return {render,reset,preview,isMappingMode:()=>mappingMode};
  }

  function downloadJson(filename,data){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  let zipCrcTable=null;
  function crc32(bytes){
    if(!zipCrcTable){
      zipCrcTable=Array.from({length:256},(_,value)=>{
        let crc=value;
        for(let bit=0;bit<8;bit++)crc=(crc&1)?(0xedb88320^(crc>>>1)):(crc>>>1);
        return crc>>>0;
      });
    }
    let crc=0xffffffff;
    for(const byte of bytes)crc=zipCrcTable[(crc^byte)&0xff]^(crc>>>8);
    return (crc^0xffffffff)>>>0;
  }

  function joinBytes(parts){
    const size=parts.reduce((total,part)=>total+part.length,0);
    const result=new Uint8Array(size);
    let offset=0;
    parts.forEach(part=>{result.set(part,offset);offset+=part.length;});
    return result;
  }

  async function transformBytes(bytes,format,decompress=false){
    const StreamType=decompress?window.DecompressionStream:window.CompressionStream;
    if(typeof StreamType!=='function')throw new Error((decompress?'Decompression':'Compression')+' is not supported by this browser');
    const stream=new Blob([bytes]).stream().pipeThrough(new StreamType(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function zipHeader(size){
    const bytes=new Uint8Array(size);
    return {bytes,view:new DataView(bytes.buffer)};
  }

  async function zipJsonBytes(entryName,data){
    const nameBytes=new TextEncoder().encode(entryName||'pico_dmx_fixture_library.json');
    const jsonBytes=new TextEncoder().encode(JSON.stringify(data));
    let method=0;
    let compressed=jsonBytes;
    try{
      compressed=await transformBytes(jsonBytes,'deflate-raw');
      method=8;
    }catch(_){
      compressed=jsonBytes;
      method=0;
    }
    const crc=crc32(jsonBytes);
    const local=zipHeader(30);
    local.view.setUint32(0,0x04034b50,true);
    local.view.setUint16(4,20,true);
    local.view.setUint16(6,0x0800,true);
    local.view.setUint16(8,method,true);
    local.view.setUint32(14,crc,true);
    local.view.setUint32(18,compressed.length,true);
    local.view.setUint32(22,jsonBytes.length,true);
    local.view.setUint16(26,nameBytes.length,true);
    const centralOffset=local.bytes.length+nameBytes.length+compressed.length;
    const central=zipHeader(46);
    central.view.setUint32(0,0x02014b50,true);
    central.view.setUint16(4,20,true);
    central.view.setUint16(6,20,true);
    central.view.setUint16(8,0x0800,true);
    central.view.setUint16(10,method,true);
    central.view.setUint32(16,crc,true);
    central.view.setUint32(20,compressed.length,true);
    central.view.setUint32(24,jsonBytes.length,true);
    central.view.setUint16(28,nameBytes.length,true);
    const end=zipHeader(22);
    end.view.setUint32(0,0x06054b50,true);
    end.view.setUint16(8,1,true);
    end.view.setUint16(10,1,true);
    end.view.setUint32(12,central.bytes.length+nameBytes.length,true);
    end.view.setUint32(16,centralOffset,true);
    return joinBytes([local.bytes,nameBytes,compressed,central.bytes,nameBytes,end.bytes]);
  }

  async function unzipJsonBytes(input){
    const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    let endOffset=-1;
    for(let offset=Math.max(0,bytes.length-22);offset>=Math.max(0,bytes.length-65557);offset--){
      if(view.getUint32(offset,true)===0x06054b50){endOffset=offset;break;}
    }
    if(endOffset<0)throw new Error('ZIP end record was not found');
    const entries=view.getUint16(endOffset+10,true);
    let centralOffset=view.getUint32(endOffset+16,true);
    let selected=null;
    for(let index=0;index<entries;index++){
      if(view.getUint32(centralOffset,true)!==0x02014b50)throw new Error('ZIP directory is invalid');
      const flags=view.getUint16(centralOffset+8,true);
      const method=view.getUint16(centralOffset+10,true);
      const crc=view.getUint32(centralOffset+16,true);
      const compressedSize=view.getUint32(centralOffset+20,true);
      const uncompressedSize=view.getUint32(centralOffset+24,true);
      const nameLength=view.getUint16(centralOffset+28,true);
      const extraLength=view.getUint16(centralOffset+30,true);
      const commentLength=view.getUint16(centralOffset+32,true);
      const localOffset=view.getUint32(centralOffset+42,true);
      const name=new TextDecoder().decode(bytes.slice(centralOffset+46,centralOffset+46+nameLength));
      if(!selected&&name.toLowerCase().endsWith('.json'))selected={name,flags,method,crc,compressedSize,uncompressedSize,localOffset};
      centralOffset+=46+nameLength+extraLength+commentLength;
    }
    if(!selected)throw new Error('ZIP does not contain a JSON fixture library');
    if(selected.flags&1)throw new Error('Encrypted ZIP files are not supported');
    if(view.getUint32(selected.localOffset,true)!==0x04034b50)throw new Error('ZIP entry header is invalid');
    const localNameLength=view.getUint16(selected.localOffset+26,true);
    const localExtraLength=view.getUint16(selected.localOffset+28,true);
    const dataOffset=selected.localOffset+30+localNameLength+localExtraLength;
    const compressed=bytes.slice(dataOffset,dataOffset+selected.compressedSize);
    let jsonBytes;
    if(selected.method===0)jsonBytes=compressed;
    else if(selected.method===8)jsonBytes=await transformBytes(compressed,'deflate-raw',true);
    else throw new Error('ZIP compression method '+selected.method+' is not supported');
    if(jsonBytes.length!==selected.uncompressedSize)throw new Error('ZIP entry size does not match');
    if(crc32(jsonBytes)!==selected.crc)throw new Error('ZIP entry checksum failed');
    return JSON.parse(new TextDecoder().decode(jsonBytes));
  }

  async function downloadZipJson(filename,entryName,data){
    const bytes=await zipJsonBytes(entryName,data);
    const blob=new Blob([bytes],{type:'application/zip'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function fetchFixtureLiveValues(){
    if(!isHttp())return null;
    const r=await fetch('fixture_setup.php?livevalues',{cache:'no-store'});
    const j=await r.json();
    if(!r.ok||!j.ok||!j.exists||!j.values||typeof j.values!=='object')return null;
    return j.values;
  }

  async function mergeFixtureLiveValues(patch){
    if(!isHttp()||!patch||typeof patch!=='object'||Array.isArray(patch))return false;
    let values={};
    try{
      values=await fetchFixtureLiveValues()||{};
    }catch(_){
      values={};
    }
    Object.assign(values,patch);
    const r=await fetch('fixture_setup.php?livevalues',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(values)
    });
    const j=await r.json().catch(()=>({}));
    return r.ok&&j.ok;
  }

  function feedbackButton(button,state,label='',options={}){
    if(!button)return;
    const restoreAfter=options.restoreAfter===undefined?1100:options.restoreAfter;
    const token=String(Date.now()+Math.random());
    if(!button.dataset.feedbackOriginalHtml){
      button.dataset.feedbackOriginalHtml=button.innerHTML;
      button.dataset.feedbackOriginalDisabled=button.disabled?'1':'';
    }
    clearTimeout(button._dmxFeedbackTimer);
    button.dataset.feedbackToken=token;
    button.classList.remove('button-feedback--busy','button-feedback--success','button-feedback--error');
    button.classList.add('button-feedback');
    if(state)button.classList.add('button-feedback--'+state);
    if(label)button.textContent=label;
    button.disabled=state==='busy'||options.disabled===true;
    button.setAttribute('aria-busy',state==='busy'?'true':'false');
    if(state!=='busy'&&restoreAfter!==null){
      button._dmxFeedbackTimer=setTimeout(()=>restoreButtonFeedback(button,token),restoreAfter);
    }
  }

  function restoreButtonFeedback(button,token=''){
    if(!button)return;
    if(token&&button.dataset.feedbackToken!==token)return;
    clearTimeout(button._dmxFeedbackTimer);
    button.classList.remove('button-feedback','button-feedback--busy','button-feedback--success','button-feedback--error');
    button.removeAttribute('aria-busy');
    if(button.dataset.feedbackOriginalHtml!==undefined){
      button.innerHTML=button.dataset.feedbackOriginalHtml;
      button.disabled=button.dataset.feedbackOriginalDisabled==='1';
      delete button.dataset.feedbackOriginalHtml;
      delete button.dataset.feedbackOriginalDisabled;
      delete button.dataset.feedbackToken;
    }
  }

  async function withButtonFeedback(button,labels,action,options={}){
    const btn=typeof button==='string'?document.getElementById(button):button;
    const text=labels||{};
    feedbackButton(btn,'busy',text.busy||'Working...',options);
    try{
      const result=await action();
      feedbackButton(btn,'success',text.success||'Done',options);
      return result;
    }catch(err){
      feedbackButton(btn,'error',text.error||'Failed',options);
      throw err;
    }
  }

  function selectableCardClass(base='',selected=false,selectedClass='active'){
    return [base,'selectable-card',selected?selectedClass:''].filter(Boolean).join(' ');
  }

  function savedTileClass(base='',selected=false,selectedClass='active'){
    return selectableCardClass([base,'saved-tile'].filter(Boolean).join(' '),selected,selectedClass);
  }

  function setSelectableState(element,selected=false,selectedClass='active'){
    if(!element)return;
    element.classList.add('selectable-card');
    element.classList.toggle(selectedClass,!!selected);
  }

  function initVersionBadge(){
    const apply=version=>{
      const v=String(version||appVersion()).trim();
      if(!v)return;
      document.querySelectorAll('header h1').forEach(h1=>{
        if(h1.querySelector('.app-version'))return;
        const badge=document.createElement('span');
        badge.className='app-version';
        badge.textContent='v'+v;
        h1.appendChild(badge);
      });
    };
    fetch('VERSION',{cache:'no-store'})
      .then(r=>r.ok?r.text():appVersion())
      .then(apply)
      .catch(()=>apply(appVersion()));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initVersionBadge);
  else initVersionBadge();

  function clampInt(value,min,max){
    const n=parseInt(value||0,10);
    return Math.max(min,Math.min(max,isNaN(n)?min:n));
  }

  function clampFloat(value,min,max){
    const n=parseFloat(value);
    return Math.max(min,Math.min(max,isNaN(n)?min:n));
  }

  function fanOrderedFixtures(fixtures,inverted=false){
    const ordered=Array.isArray(fixtures)?fixtures.filter(Boolean).slice():[];
    return inverted?ordered.reverse():ordered;
  }

  function fanOutToolboxHtml(options={}){
    const hint=escapeHtml(options.hint||'Select a group to fan fixtures.');
    return `<div id="fanToolbox" class="scene-toolbox scene-toolbox--fan">
<div id="fanToolboxHdr" class="scene-toolbox__header">
<span style="font-weight:700;font-size:13px">Fan Out</span>
<button id="fanToolboxToggle" class="scene-toolbox__toggle">—</button>
</div>
<div id="fanToolboxBody" class="scene-toolbox__body">
<div style="display:grid;gap:10px">
<div class="small" id="fanScopeHint">${hint}</div>
<label>Control<select id="fanControlSelect"></select></label>
<label>Mode<select id="fanMode"><option value="symmetric">Symmetric spread</option><option value="range">Start to end</option></select></label>
<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end">
<label id="fanSpreadWrap">Spread<input id="fanSpread" type="range" min="-255" max="255" step="1" value="0"><span class="small" id="fanSpreadReadout">0</span></label>
</div>
<div id="fanSpreadNudgeWrap" class="fan-nudge-control">
<button id="fanSpreadDown" type="button" title="Decrease Fan Out spread by the step size">−</button>
<label>Spread step<input id="fanSpreadStep" type="number" min="1" max="255" step="1" value="1"></label>
<button id="fanSpreadUp" type="button" title="Increase Fan Out spread by the step size">+</button>
</div>
<div id="fanRangeWrap" style="display:none;gap:8px">
<label>From<input id="fanFrom" type="number" value="0"></label>
<label>To<input id="fanTo" type="number" value="0"></label>
</div>
<div class="buttons">
<button id="fanSave">Save</button>
<button id="fanRecall">Recall</button>
<button id="fanSnapshot">Snapshot</button>
<button class="primary" id="fanApply">Apply</button>
<button id="fanClear">Clear</button>
</div>
<div id="fanPreview" class="fan-preview"></div>
</div>
</div>
</div>`;
  }

  function mountFanOutToolbox(target,options={}){
    const el=typeof target==='string'?document.getElementById(target):target;
    if(!el)return null;
    el.outerHTML=fanOutToolboxHtml(options);
    return document.getElementById('fanToolbox');
  }

  function createFanOutController(config){
    const state=config.state||{controlKey:'',mode:'symmetric',spread:0,fromOffset:0,toOffset:0,inverted:false,bases:{}};
    const clampValue=(value,min,max)=>Math.max(min,Math.min(max,Math.round(parseFloat(value)||0)));
    const controlsFor=fixture=>config.controlsFor?.(fixture)||[];
    const controlId=control=>String(config.controlId?.(control)??control?.id??'');
    const controlRef=control=>String(config.compatibilityKey?.(control)??controlId(control));
    const controlLabel=control=>String(config.controlLabel?.(control)??control?.label??'Control');
    const controlType=control=>String(config.controlType?.(control)??control?.type??'');
    const hasChannel=control=>!!config.hasChannel?.(control);
    const getValue=(fixture,control,def)=>config.getValue?.(fixture,control,def);
    const setValue=(fixture,control,value)=>config.setValue?.(fixture,control,value);

    function axisDefault(control,axis){
      const max=controlType(control)==='panTilt8'?255:65535;
      return axis==='pan'||axis==='tilt'?{pan:Math.round(max/2),tilt:Math.round(max/2)}:0;
    }
    function isFanControl(control,axis){
      const type=controlType(control);
      if((axis==='pan'||axis==='tilt')&&(type==='panTilt16'||type==='panTilt8'))return true;
      if(axis==='value'&&(type==='slider16'||hasChannel(control)))return true;
      return false;
    }
    function findControl(fixture,ref,axis){
      const text=String(ref||'');
      const control=/^\d+$/.test(text)
        ? controlsFor(fixture).find(ctrl=>controlId(ctrl)===text)
        : controlsFor(fixture).find(ctrl=>controlRef(ctrl)===text);
      return control&&isFanControl(control,axis)?control:null;
    }
    function parseControlKey(key=state.controlKey){
      const text=String(key||'');
      const idx=text.lastIndexOf(':');
      if(idx<0)return{controlId:text,axis:'value'};
      return{controlId:text.slice(0,idx),axis:text.slice(idx+1)||'value'};
    }
    function controlOptions(fixtures){
      const ordered=Array.isArray(fixtures)?fixtures.filter(Boolean):[];
      if(typeof config.optionEntries==='function'){
        const byKey=new Map();
        const entries=config.optionEntries(ordered)||[];
        const minFixtures=Math.max(1,config.minOptionFixtures??ordered.length);
        entries.forEach(entry=>{
          const fixture=entry?.fixture;
          const control=entry?.control;
          if(!fixture||!control||controlType(control)==='matrixRgb')return;
          const ref=controlRef(control);
          const add=(axis,label,max)=>{
            if(!isFanControl(control,axis))return;
            const key=ref+':'+axis;
            const option=byKey.get(key)||{key,label,max,fixtureIds:new Set()};
            option.fixtureIds.add(String(config.fixtureId?.(fixture)??fixture?.id??''));
            byKey.set(key,option);
          };
          const type=controlType(control);
          if(type==='panTilt16'){add('pan',controlLabel(control)+' Pan',65535);add('tilt',controlLabel(control)+' Tilt',65535);}
          else if(type==='panTilt8'){add('pan',controlLabel(control)+' Pan',255);add('tilt',controlLabel(control)+' Tilt',255);}
          else if(type==='slider16')add('value',controlLabel(control),65535);
          else if(hasChannel(control))add('value',controlLabel(control),255);
        });
        return Array.from(byKey.values()).filter(option=>option.fixtureIds.size>=minFixtures).map(({fixtureIds,...option})=>option);
      }
      const first=ordered[0];
      if(!first)return[];
      const opts=[];
      controlsFor(first).forEach(control=>{
        if(controlType(control)==='matrixRgb')return;
        const ref=controlRef(control);
        const add=(axis,label,max)=>{
          if(ordered.every(fixture=>findControl(fixture,ref,axis)))opts.push({key:ref+':'+axis,label,max});
        };
        const type=controlType(control);
        if(type==='panTilt16'){add('pan',controlLabel(control)+' Pan',65535);add('tilt',controlLabel(control)+' Tilt',65535);}
        else if(type==='panTilt8'){add('pan',controlLabel(control)+' Pan',255);add('tilt',controlLabel(control)+' Tilt',255);}
        else if(type==='slider16')add('value',controlLabel(control),65535);
        else if(hasChannel(control))add('value',controlLabel(control),255);
      });
      return opts;
    }
    function maxValue(fixtures){
      const opt=controlOptions(fixtures).find(o=>o.key===state.controlKey);
      return opt?.max||255;
    }
    function controlValue(fixture,control,axis){
      const value=getValue(fixture,control,axisDefault(control,axis));
      return (axis==='pan'||axis==='tilt')?(value&&value[axis]!==undefined?value[axis]:axisDefault(control,axis)[axis]):value;
    }
    function baseKey(fixture,control,axis){
      return String(config.fixtureId?.(fixture)??fixture?.id??'')+':'+controlId(control)+':'+axis;
    }
    function setControlValue(fixture,control,axis,value,fixtures){
      const next=clampValue(value,0,maxValue(fixtures));
      if(axis==='pan'||axis==='tilt'){
        const cur={...(getValue(fixture,control,axisDefault(control,axis))||axisDefault(control,axis))};
        cur[axis]=next;
        setValue(fixture,control,cur);
      }else{
        setValue(fixture,control,next);
      }
    }
    function resetOffsets(){
      state.spread=0;
      state.fromOffset=0;
      state.toOffset=0;
    }
    function snapshotBases(fixtures){
      const ordered=Array.isArray(fixtures)?fixtures.filter(Boolean):[];
      const {controlId:ref,axis}=parseControlKey();
      state.bases={};
      ordered.forEach(fixture=>{
        const control=findControl(fixture,ref,axis);
        if(control)state.bases[baseKey(fixture,control,axis)]=controlValue(fixture,control,axis);
      });
    }
    function ensureBases(fixtures){
      const ordered=Array.isArray(fixtures)?fixtures.filter(Boolean):[];
      const {controlId:ref,axis}=parseControlKey();
      ordered.forEach(fixture=>{
        const control=findControl(fixture,ref,axis);
        if(!control)return;
        const key=baseKey(fixture,control,axis);
        if(state.bases[key]!==undefined)return;
        state.bases[key]=controlValue(fixture,control,axis);
      });
    }
    function computedValues(fixtures){
      const ordered=fanOrderedFixtures(fixtures,false);
      const max=maxValue(fixtures);
      const {controlId:ref,axis}=parseControlKey();
      const count=ordered.length;
      const from=state.mode==='range'?parseFloat(state.fromOffset)||0:-(parseFloat(state.spread)||0)/2;
      const to=state.mode==='range'?parseFloat(state.toOffset)||0:(parseFloat(state.spread)||0)/2;
      return ordered.map((fixture,i)=>{
        const control=findControl(fixture,ref,axis);
        const t=count>1?i/(count-1):0;
        const base=control?(state.bases[baseKey(fixture,control,axis)]??controlValue(fixture,control,axis)):Math.round(max/2);
        const offset=from+(to-from)*t;
        return{fixture,control,axis,base,offset,finalVal:clampValue(base+offset,0,max)};
      });
    }
    function apply(fixtures){
      ensureBases(fixtures);
      const affected=[];
      computedValues(fixtures).forEach(({fixture,control,axis,finalVal})=>{
        if(!control)return;
        setControlValue(fixture,control,axis,finalVal,fixtures);
        affected.push({fixture,control,axis,finalVal});
      });
      return affected;
    }

    return{state,controlOptions,findControl,parseControlKey,maxValue,controlValue,baseKey,setControlValue,resetOffsets,snapshotBases,ensureBases,computedValues,apply};
  }

  function wheelOptionRange(option){
    const range=option&&option.range;
    if(Array.isArray(range)&&range.length>=2){
      const start=clampInt(range[0],0,255);
      const end=clampInt(range[1],0,255);
      return [Math.min(start,end),Math.max(start,end)];
    }
    return null;
  }

  function hexByte(value){
    return clampInt(value,0,255).toString(16).padStart(2,'0');
  }

  function rgbHex(value){
    const v=value||{};
    return '#'+hexByte(v.a)+hexByte(v.b)+hexByte(v.c);
  }

  function cmyHex(value){
    const v=value||{};
    return '#'+hexByte(255-(Number(v.a)||0))+hexByte(255-(Number(v.b)||0))+hexByte(255-(Number(v.c)||0));
  }

  function cmykHex(value){
    const v=value||{};
    const k=Number(v.k)||0;
    return '#'+hexByte(Math.round(255*(1-(Number(v.a)||0)/255)*(1-k/255)))+
      hexByte(Math.round(255*(1-(Number(v.b)||0)/255)*(1-k/255)))+
      hexByte(Math.round(255*(1-(Number(v.c)||0)/255)*(1-k/255)));
  }

  function hexToRgb(hex){
    const match=String(hex||'#000000').match(/^#?([0-9a-f]{6})$/i);
    const n=parseInt(match?match[1]:'000000',16);
    return {a:(n>>16)&255,b:(n>>8)&255,c:n&255};
  }

  function rgbToCmy(hex){
    const rgb=hexToRgb(hex);
    return {a:255-rgb.a,b:255-rgb.b,c:255-rgb.c};
  }

  function rgbToCmyk(hex){
    const rgb=hexToRgb(hex);
    const r=rgb.a/255,g=rgb.b/255,b=rgb.c/255;
    const k=1-Math.max(r,g,b);
    if(k>=1)return {a:0,b:0,c:0,k:255};
    return {
      a:Math.round((1-r-k)/(1-k)*255),
      b:Math.round((1-g-k)/(1-k)*255),
      c:Math.round((1-b-k)/(1-k)*255),
      k:Math.round(k*255)
    };
  }

  function wheelOptionIconHtml(option,escape=escapeHtml){
    if(!option)return '';
    const image=option.image||option.icon||option.resource;
    const color=option.color||(Array.isArray(option.colors)?option.colors[0]:null);
    const style=[];
    if(color)style.push('background-color:'+escape(color));
    if(image)style.push("background-image:url('"+escape(String(image).replace(/'/g,'%27'))+"')");
    return style.length?'<span class="option-icon" style="'+style.join(';')+'"></span>':'';
  }

  function wheelOptionValue(option){
    const range=wheelOptionRange(option);
    if(range)return Math.round((range[0]+range[1])/2);
    return clampInt(option&&option.value,0,255);
  }

  function wheelOptionMatches(option,value){
    const v=clampInt(value,0,255);
    const range=wheelOptionRange(option);
    return range?v>=range[0]&&v<=range[1]:wheelOptionValue(option)===v;
  }

  function selectedWheelOption(control,value){
    return ((control&&control.options)||[]).find(option=>wheelOptionMatches(option,value))||null;
  }

  function wheelOptionTitle(option){
    const range=wheelOptionRange(option);
    const details=[range?'DMX '+range[0]+'-'+range[1]:'DMX '+wheelOptionValue(option)];
    if(option&&option.kind)details.push(option.kind);
    return details.join(' · ');
  }

  function wheelOptionIsAdjustable(option){
    const range=wheelOptionRange(option);
    if(!range||range[0]===range[1])return false;
    const kind=String(option&&option.kind||'');
    return kind==='WheelShake'||kind==='WheelRotation'||kind==='WheelSlotRotation'||
      !!(option&&(option.speedStart||option.speedEnd||option.shakeSpeedStart||option.shakeSpeedEnd));
  }

  function wheelOptionRangeLabel(option){
    const kind=String(option&&option.kind||'');
    if(kind==='WheelShake')return 'Shake speed';
    if(kind==='WheelRotation')return 'Rotation speed';
    if(kind==='WheelSlotRotation')return 'Slot rotation';
    if(kind==='ShutterStrobe'||kind==='Strobe')return 'Strobe speed';
    return 'Range value';
  }

  function wheelOptionRangeText(option){
    const start=option&&(option.shakeSpeedStart||option.speedStart);
    const end=option&&(option.shakeSpeedEnd||option.speedEnd);
    if(start&&end)return String(start)+' to '+String(end);
    if(start)return String(start);
    if(end)return String(end);
    const range=wheelOptionRange(option);
    return range?'DMX '+range[0]+'-'+range[1]:'';
  }

  function wheelRangeSliderHtml(option,value,attrs='',escape=escapeHtml){
    if(!wheelOptionIsAdjustable(option))return '';
    const range=wheelOptionRange(option);
    const v=clampInt(value,range[0],range[1]);
    const label=escape(wheelOptionRangeLabel(option));
    const text=escape(wheelOptionRangeText(option));
    return `<div class="wheel-range-control" data-wheel-range-panel="1">
      <label>${label} <span class="bytes" data-wheel-range-readout="1">${v}</span>
        <input type="range" min="${range[0]}" max="${range[1]}" step="1" value="${v}" ${attrs}>
      </label>
      <div class="small">${text}</div>
    </div>`;
  }

  function fixtureGroupEditParts(control){
    const type=control&&control.type;
    if(type==='panTilt16')return[{part:'pan',label:'Pan',max:65535},{part:'tilt',label:'Tilt',max:65535}];
    if(type==='panTilt8')return[{part:'pan',label:'Pan',max:255},{part:'tilt',label:'Tilt',max:255}];
    if(type==='slider16')return[{part:'value',label:'Value',max:65535}];
    if(type==='rgb'||type==='cmy')return[{part:'a',label:type==='cmy'?'Cyan':'Red',max:255},{part:'b',label:type==='cmy'?'Magenta':'Green',max:255},{part:'c',label:type==='cmy'?'Yellow':'Blue',max:255}];
    if(type==='rgbw')return[{part:'a',label:'Red',max:255},{part:'b',label:'Green',max:255},{part:'c',label:'Blue',max:255},{part:'w',label:'White',max:255}];
    if(type==='rgbwa')return[{part:'a',label:'Red',max:255},{part:'b',label:'Green',max:255},{part:'c',label:'Blue',max:255},{part:'w',label:'White',max:255},{part:'amber',label:'Amber',max:255}];
    if(type==='cmyk')return[{part:'a',label:'Cyan',max:255},{part:'b',label:'Magenta',max:255},{part:'c',label:'Yellow',max:255},{part:'k',label:'Key',max:255}];
    return[{part:'value',label:'Value',max:255}];
  }

  function fixtureGroupEditBytes16(value){
    const n=clampInt(value,0,65535);
    return{coarse:(n>>8)&255,fine:n&255};
  }

  function createGroupEditRelativeStepStore(options={}){
    const page=String(options.page||'').trim();
    const stateKey=String(options.stateKey||'groupEditRelativeSteps');
    const localStorageKey=String(options.localStorageKey||((page?page+'.':'')+stateKey));
    const debounceMs=clampInt(options.debounceMs??350,0,5000);
    let values={};
    let saveTimer=null;
    const stepKey=(controlKey,part,kind)=>String(controlKey||'')+'|'+String(part||'value')+'|'+String(kind||'default');
    const writeLocal=()=>{
      try{localStorage.setItem(localStorageKey,JSON.stringify(values));}catch(_){}
    };
    const load=source=>{
      let next=source;
      if(next===undefined){
        try{next=localStorage.getItem(localStorageKey);}catch(_){next=null;}
      }
      try{
        const parsed=next&&typeof next==='object'&&!Array.isArray(next)?next:JSON.parse(next||'{}')||{};
        values=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?{...parsed}:{};
      }catch(_){values={};}
      writeLocal();
      return api;
    };
    const value=(controlKey,part,kind,defaultStep,max)=>clampInt(values[stepKey(controlKey,part,kind)]??defaultStep,1,max);
    const saveSoon=()=>{
      writeLocal();
      clearTimeout(saveTimer);
      saveTimer=setTimeout(()=>{
        if(page)saveUiState(page,stateKey,{...values});
      },debounceMs);
    };
    const remember=(controlKey,part,kind,next,max=65535)=>{
      const key=stepKey(controlKey,part,kind);
      values[key]=clampInt(next,1,clampInt(max,1,65535));
      saveSoon();
      return values[key];
    };
    const rememberInput=input=>{
      if(!input)return null;
      const controlKey=input.dataset.groupEditStepKey;
      if(!controlKey)return null;
      const next=remember(controlKey,input.dataset.groupEditStepPart||'value',input.dataset.groupEditStepKind||'default',input.value,input.max||65535);
      input.value=next;
      return next;
    };
    const api={load,value,remember,rememberInput,snapshot:()=>({...values}),stepKey,stateKey,localStorageKey};
    load();
    return api;
  }

  function fixtureGroupEditControlHtml(options={}){
    const control=options.control||{};
    const type=control.type||'slider8';
    const value=options.value;
    const escape=options.escape||escapeHtml;
    const attributes=typeof options.attributes==='function'?options.attributes:()=>'';
    const attrs=(role,detail={})=>{
      const result=String(attributes(role,detail)||'').trim();
      return result?' '+result:'';
    };
    const scope=options.scopeText?'<span class="bytes">'+escape(options.scopeText)+'</span>':'';
    const label=escape(options.label||control.label||control.scope||control.name||type||'Control');
    const relative=(part,kind,max,step,text)=>{
      const configured=typeof options.relativeStepValue==='function'?options.relativeStepValue(part,kind,step,max):step;
      const current=clampInt(configured,1,max);
      const sharedStepAttrs=' data-group-edit-step-key="'+escape(options.key||'')+'" data-group-edit-step-part="'+escape(part)+'" data-group-edit-step-kind="'+escape(kind)+'"';
      return '<div class="relative-control">'+
      '<button type="button"'+attrs('relative',{part,kind,dir:-1,max,step})+' title="Decrease relative to each fixture current value">−</button>'+
      '<label>'+escape(text)+'<input type="number" min="1" max="'+max+'" step="'+step+'" value="'+current+'"'+sharedStepAttrs+attrs('relativeStep',{part,kind,max,step})+'></label>'+
      '<button type="button"'+attrs('relative',{part,kind,dir:1,max,step})+' title="Increase relative to each fixture current value">+</button>'+
      '</div>';
    };

    if(type==='panTilt16'||type==='panTilt8'){
      const max=type==='panTilt8'?255:65535;
      const center=Math.round(max/2);
      const pan=clampInt(value&&value.pan!=null?value.pan:center,0,max);
      const tilt=clampInt(value&&value.tilt!=null?value.tilt:center,0,max);
      const rows=type==='panTilt16'
        ? relative('pan','coarse',max,256,'Pan coarse relative')+relative('pan','fine',max,1,'Pan fine relative')+relative('tilt','coarse',max,256,'Tilt coarse relative')+relative('tilt','fine',max,1,'Tilt fine relative')
        : relative('pan','default',max,1,'Pan relative')+relative('tilt','default',max,1,'Tilt relative');
      return '<div class="control"'+attrs('control')+'><div class="control-head"><h3>'+label+'</h3><span class="bytes">Pan/Tilt '+(max===255?'8':'16')+'-bit</span>'+scope+'</div>'+
        '<div class="xy-pad"'+attrs('xy')+'><div class="xy-dot" style="left:'+(pan/max*100)+'%;top:'+(100-tilt/max*100)+'%"></div></div>'+
        '<div class="row"><span class="readout"'+attrs('readout',{part:'panTilt'})+'>Pan '+pan+' · Tilt '+tilt+'</span><button type="button"'+attrs('center')+'>Center</button></div>'+rows+'</div>';
    }

    if(['rgb','rgbw','rgbwa','cmy','cmyk'].includes(type)){
      const parts=fixtureGroupEditParts(control);
      const current=value&&typeof value==='object'?value:{};
      const color=type.startsWith('rgb')?rgbHex(current):(type==='cmy'?cmyHex(current):cmykHex(current));
      return '<div class="control"'+attrs('control')+'><div class="control-head"><h3>'+label+'</h3><span class="bytes">'+escape(type.toUpperCase())+'</span>'+scope+'</div>'+
        '<label>Color picker<input type="color" value="'+color+'"'+attrs('colorPicker')+'></label>'+
        parts.map(part=>'<label>'+escape(part.label)+' <span'+attrs('partReadout',{part:part.part})+'>'+clampInt(current[part.part],0,255)+'</span><input type="range" min="0" max="255" step="1" value="'+clampInt(current[part.part],0,255)+'"'+attrs('input',{part:part.part,kind:'range'})+'></label>'+relative(part.part,'default',255,1,part.label+' relative')).join('')+
        '<div class="swatches"><button type="button" class="swatch" style="background:#fff"'+attrs('color',{color:'#ffffff'})+'></button><button type="button" class="swatch" style="background:#f00"'+attrs('color',{color:'#ff0000'})+'></button><button type="button" class="swatch" style="background:#0f0"'+attrs('color',{color:'#00ff00'})+'></button><button type="button" class="swatch" style="background:#00f"'+attrs('color',{color:'#0000ff'})+'></button></div></div>';
    }

    if(type==='wheel'){
      const current=clampInt(value,0,255);
      const active=selectedWheelOption(control,current);
      const activeName=active?' · '+escape(active.name||''):'';
      return '<div class="control"'+attrs('control')+'><div class="control-head"><h3>'+label+'</h3><span class="bytes"'+attrs('readout',{part:'value'})+'>Wheel · '+current+activeName+'</span>'+scope+'</div>'+
        '<div class="tabs">'+(control.options||[]).map((option,index)=>'<button type="button" class="tab '+(wheelOptionMatches(option,current)?'active':'')+'" title="'+escape(wheelOptionTitle(option))+'"'+attrs('wheel',{option,index,value:wheelOptionValue(option)})+'>'+wheelOptionIconHtml(option,escape)+escape(option.name||('Option '+(index+1)))+'</button>').join('')+'</div>'+
        '<div'+attrs('wheelHost')+'>'+wheelRangeSliderHtml(active,current,attributes('input',{part:'value',kind:'range',range:true})||'',escape)+'</div>'+
        '<div class="value-row"><input type="range" min="0" max="255" step="1" value="'+current+'"'+attrs('input',{part:'value',kind:'range'})+'><input type="number" min="0" max="255" step="1" value="'+current+'"'+attrs('input',{part:'value',kind:'number'})+'></div>'+relative('value','default',255,1,'Relative')+'</div>';
    }

    const max=type==='slider16'?65535:255;
    const current=clampInt(value,0,max);
    const bytes=fixtureGroupEditBytes16(current);
    const rows=type==='slider16'
      ? relative('value','coarse',max,256,'Coarse relative')+relative('value','fine',max,1,'Fine relative')
      : relative('value','default',max,1,'Relative');
    const byteSliders=type==='slider16'?'<div class="byte-sliders"><label>Coarse <span'+attrs('byteReadout',{part:'coarse'})+'>'+bytes.coarse+'</span><input type="range" min="0" max="255" step="1" value="'+bytes.coarse+'"'+attrs('byteInput',{part:'coarse'})+'></label><label>Fine <span'+attrs('byteReadout',{part:'fine'})+'>'+bytes.fine+'</span><input type="range" min="0" max="255" step="1" value="'+bytes.fine+'"'+attrs('byteInput',{part:'fine'})+'></label></div>':'';
    const scalarAction=options.scalarActionLabel?'<button type="button"'+attrs('scalarAction')+'>'+escape(options.scalarActionLabel)+'</button>':'';
    return '<div class="control"'+attrs('control')+'><div class="control-head"><h3>'+label+'</h3><span class="readout"'+attrs('readout',{part:'value'})+'>'+current+'</span><span class="bytes">'+escape(type)+'</span>'+scope+'</div>'+
      (scalarAction?'<div class="row">'+scalarAction+'</div>':'')+'<input type="range" min="0" max="'+max+'" step="1" value="'+current+'"'+attrs('input',{part:'value',kind:'range'})+'>'+rows+byteSliders+'</div>';
  }

  function updateFixtureGroupEditWheelRangeHost(host,option,value,attrs='',escape=escapeHtml){
    if(!host)return;
    const range=wheelOptionRange(option);
    if(wheelOptionIsAdjustable(option)&&range){
      host.style.display='';
      const input=host.querySelector('input[type="range"]');
      const sameRange=input&&Number(input.min)===range[0]&&Number(input.max)===range[1];
      if(sameRange){
        const next=clampInt(value,range[0],range[1]);
        if(document.activeElement!==input&&Number(input.value)!==next)input.value=next;
        host.querySelectorAll('[data-wheel-range-readout]').forEach(el=>{el.textContent=next;});
        return;
      }
      host.innerHTML=wheelRangeSliderHtml(option,value,attrs,escape);
      return;
    }
    host.innerHTML='';
    host.style.display='none';
  }

  function applyBaseUrl(input,fallback=''){
    if(!input)return '';
    input.value=localStorage.getItem(BASE_URL_KEY)||fallback||'';
    return input.value;
  }

  function setPicoUrlStatus(input,status,message=''){
    if(!input)return;
    ['pico-url-empty','pico-url-checking','pico-url-connected','pico-url-disconnected'].forEach(cls=>input.classList.remove(cls));
    const normalized=status||'empty';
    input.dataset.picoStatus=normalized;
    input.classList.add('pico-url-'+normalized);
    input.title=message||(
      normalized==='connected'?'Pico connected':
      normalized==='disconnected'?'Pico not reachable':
      normalized==='checking'?'Checking Pico connection':
      'Enter Pico base URL'
    );
  }

  async function checkPicoConnection(input,options={}){
    if(!input)return 'empty';
    const raw=String(input.value||'').trim();
    if(!raw){
      setPicoUrlStatus(input,'empty');
      return 'empty';
    }
    let root='';
    const normalizedRoot=()=>{
      const current=String(input.value||'').trim();
      if(!/^https?:\/\//i.test(current))return '';
      try{return new URL(current,location.href).href.replace(/\/+$/,'');}
      catch(_){return '';}
    };
    try{
      if(!/^https?:\/\//i.test(raw))throw new Error('Use http:// or https://');
      root=new URL(raw,location.href).href.replace(/\/+$/,'');
    }catch(e){
      setPicoUrlStatus(input,'disconnected','Invalid Pico URL - use http:// or https://');
      return 'invalid';
    }

    const token=String(Date.now())+Math.random();
    input.dataset.picoCheckToken=token;
    if(options.showChecking!==false)setPicoUrlStatus(input,'checking','Checking Pico connection...');
    const timeoutMs=Number.isFinite(options.timeoutMs)?options.timeoutMs:1500;
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timeout=setTimeout(()=>controller?.abort(),timeoutMs);
    try{
      const r=await fetch(root+'/status.json',{cache:'no-store',signal:controller?.signal});
      if(input.dataset.picoCheckToken!==token)return 'stale';
      if(normalizedRoot()!==root)return 'stale';
      if(!r.ok)throw new Error('HTTP '+r.status);
      const j=await r.json();
      if(!j||!j.dmx)throw new Error('Unexpected Pico status response');
      const channels=j.dmx.channels||'?';
      const frame=j.dmx.frame_count??'?';
      setPicoUrlStatus(input,'connected','Pico connected - '+channels+' channels - frame '+frame);
      return 'connected';
    }catch(e){
      if(input.dataset.picoCheckToken===token&&normalizedRoot()===root){
        setPicoUrlStatus(input,'disconnected','Pico not reachable: '+(e.name==='AbortError'?'timeout':e.message));
      }
      return 'disconnected';
    }finally{
      clearTimeout(timeout);
    }
  }

  async function discoverPicoBaseUrl(input,button){
    if(!input)return null;
    if(button){
      button.disabled=true;
      button.dataset.originalText=button.dataset.originalText||button.textContent;
      button.textContent='Finding...';
    }
    try{
      const devices=await discoverPicoDevices();
      const device=devices[0];
      const url=String(device.url||('http://'+device.ip+'/'));
      input.value=url;
      localStorage.setItem(BASE_URL_KEY,url);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      setPicoUrlStatus(input,'checking','Found '+(device.name||'Pico')+' at '+url);
      return device;
    }catch(e){
      setPicoUrlStatus(input,'disconnected','Pico discovery failed: '+e.message);
      throw e;
    }finally{
      if(button){
        button.disabled=false;
        button.textContent=button.dataset.originalText||'Find Pico';
      }
    }
  }

  async function discoverPicoDevices(options={}){
    const timeoutMs=Math.max(250,Math.min(10000,parseInt(options.timeoutMs,10)||3200));
    const r=await fetch('pico_discovery.php?timeoutMs='+timeoutMs,{cache:'no-store'});
    const j=await r.json();
    if(!r.ok||!j.ok)throw new Error(j.error||('HTTP '+r.status));
    const devices=Array.isArray(j.devices)?j.devices.filter(device=>device&&typeof device==='object'):[];
    if(!devices.length)throw new Error('No Pico beacon received');
    return devices;
  }

  function attachPicoDiscoveryButton(input){
    if(!input||input.dataset.picoDiscoveryAttached==='1')return null;
    input.dataset.picoDiscoveryAttached='1';
    const button=document.createElement('button');
    button.type='button';
    button.className='pico-discovery-btn';
    button.textContent='Find Pico';
    button.title='Listen for Pico WiFi DMX discovery beacons';
    button.style.minHeight='38px';
    button.style.padding='7px 10px';
    button.addEventListener('click',()=>discoverPicoBaseUrl(input,button).catch(()=>{}));
    const label=input.closest('label');
    if(label&&label.parentNode){
      label.insertAdjacentElement('afterend',button);
    }else{
      input.insertAdjacentElement('afterend',button);
    }
    return button;
  }

  function observeInputValue(input,onChange){
    const proto=Object.getPrototypeOf(input);
    const desc=proto&&Object.getOwnPropertyDescriptor(proto,'value');
    if(!desc||typeof desc.get!=='function'||typeof desc.set!=='function')return;
    Object.defineProperty(input,'value',{
      configurable:true,
      get(){return desc.get.call(this);},
      set(value){
        const before=desc.get.call(this);
        desc.set.call(this,value);
        if(value!==before)onChange();
      }
    });
  }

  function bindBaseUrl(input,options={}){
    if(!input)return;
    if(options&&options.nodeType===1)options={};
    if(input.closest('header'))options={...options,discovery:false};
    applyBaseUrl(input,options.fallback);
    if(options.discovery!==false)attachPicoDiscoveryButton(input);
    let timer=0;
    let checkTimer=0;
    let pollTimer=0;
    let checking=false;
    let pendingCheck=false;
    const connectedPollMs=Number.isFinite(options.connectedPollMs)?options.connectedPollMs:10000;
    const disconnectedPollMs=Number.isFinite(options.disconnectedPollMs)?options.disconnectedPollMs:3000;
    const clearPoll=()=>clearTimeout(pollTimer);
    const schedulePoll=status=>{
      clearPoll();
      if(!input.value.trim()||status==='empty'||status==='invalid')return;
      const wait=status==='connected'?connectedPollMs:disconnectedPollMs;
      pollTimer=setTimeout(()=>runCheck(false),wait);
    };
    const runCheck=async(showChecking=true)=>{
      if(checking){
        pendingCheck=true;
        return;
      }
      checking=true;
      try{
        const status=await checkPicoConnection(input,{...options,showChecking});
        if(status!=='stale')schedulePoll(status);
      }finally{
        checking=false;
        if(pendingCheck){
          pendingCheck=false;
          runCheck(true);
        }
      }
    };
    const scheduleCheck=()=>{
      clearTimeout(checkTimer);
      clearPoll();
      const wait=Number.isFinite(options.checkDebounceMs)?options.checkDebounceMs:650;
      checkTimer=setTimeout(()=>runCheck(true),wait);
    };
    observeInputValue(input,scheduleCheck);
    const handleInput=()=>{
      localStorage.setItem(BASE_URL_KEY,input.value);
      scheduleCheck();
      if(typeof options.onInput!=='function')return;
      clearTimeout(timer);
      const wait=Number.isFinite(options.debounceMs)?options.debounceMs:0;
      timer=setTimeout(()=>options.onInput(input.value),wait);
    };
    input.addEventListener('input',handleInput);
    input.addEventListener('change',scheduleCheck);
    input.addEventListener('blur',()=>runCheck(true));
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible')scheduleCheck();
      else clearPoll();
    });
    scheduleCheck();
  }

  function preferStoredBaseUrl(input,fallback=''){
    if(!input)return '';
    input.value=localStorage.getItem(BASE_URL_KEY)||fallback||'';
    return input.value;
  }

  function saveUiState(page,key,val){
    if(!isHttp())return;
    fetch('ui_state.php',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
      body:JSON.stringify({page,state:{[key]:val}})}).catch(()=>{});
  }

  async function loadUiState(page){
    if(!isHttp())return {};
    try{
      const r=await fetch('ui_state.php',{cache:'no-store'});
      const j=await r.json();
      if(!j.ok||!j.exists)return {};
      return (j.state&&j.state[page])||{};
    }catch(_){
      return {};
    }
  }

  const TOOLBOX_ORDER_KEY='toolboxRailOrder';
  const TOOLBOX_WIDTH_KEY='toolboxRailWidth';
  const TOOLBOX_COLLAPSED_KEY='toolboxRailCollapsed';
  const GROUP_SELECTION_KEY='selectedGroupIds';
  const DEFAULT_TOOLBOX_ORDER=['groups','scenes','palettes','chases','steps','fan','browserPlayback','motionEffect','effects'];

  function normalizeToolboxOrder(order,types){
    const known=Array.isArray(order)?order:[];
    const allTypes=Array.from(new Set([...(known||[]),...DEFAULT_TOOLBOX_ORDER,...types]));
    return allTypes.filter(t=>types.includes(t));
  }

  function savedToolboxOrder(types){
    let local=null;
    try{local=JSON.parse(localStorage.getItem(TOOLBOX_ORDER_KEY)||'null');}catch(_){}
    return normalizeToolboxOrder(local,types);
  }

  async function applySharedToolboxOrder(rail){
    if(!rail)return;
    const host=rail.querySelector('.toolbox-rail-scroll')||rail;
    const boxes=Array.from(rail.querySelectorAll('.scene-toolbox[data-toolbox-type]'));
    const types=boxes.map(box=>box.dataset.toolboxType).filter(Boolean);
    let order=savedToolboxOrder(types);
    const shared=await loadUiState('toolboxes');
    if(Array.isArray(shared[TOOLBOX_ORDER_KEY])){
      order=normalizeToolboxOrder(shared[TOOLBOX_ORDER_KEY],types);
      localStorage.setItem(TOOLBOX_ORDER_KEY,JSON.stringify(shared[TOOLBOX_ORDER_KEY]));
    }
    order.forEach(type=>{
      const box=boxes.find(b=>b.dataset.toolboxType===type);
      if(box)host.appendChild(box);
    });
  }

  function saveSharedToolboxOrder(rail){
    if(!rail)return;
    const order=Array.from(rail.querySelectorAll('.scene-toolbox[data-toolbox-type]'))
      .map(box=>box.dataset.toolboxType)
      .filter(Boolean);
    let previous=[];
    try{previous=JSON.parse(localStorage.getItem(TOOLBOX_ORDER_KEY)||'[]');}catch(_){previous=[];}
    if(!Array.isArray(previous)||!previous.length)previous=DEFAULT_TOOLBOX_ORDER;
    const currentSet=new Set(order);
    const firstSharedIndex=previous.findIndex(type=>currentSet.has(type));
    const insertAt=firstSharedIndex<0?previous.length:firstSharedIndex;
    const before=previous.slice(0,insertAt).filter(type=>!currentSet.has(type));
    const after=previous.slice(insertAt).filter(type=>!currentSet.has(type));
    const merged=Array.from(new Set([...before,...order,...after,...DEFAULT_TOOLBOX_ORDER]));
    localStorage.setItem(TOOLBOX_ORDER_KEY,JSON.stringify(merged));
    saveUiState('toolboxes',TOOLBOX_ORDER_KEY,merged);
  }

  function normalizeGroupSelection(ids){
    return Array.isArray(ids)?[...new Set(ids.filter(Boolean).map(String))]:[];
  }

  function saveSharedGroupSelection(ids){
    const selected=normalizeGroupSelection(ids);
    localStorage.setItem(GROUP_SELECTION_KEY,JSON.stringify(selected));
    saveUiState('toolboxes',GROUP_SELECTION_KEY,selected);
  }

  async function loadSharedGroupSelection(){
    let selected=[];
    try{selected=normalizeGroupSelection(JSON.parse(localStorage.getItem(GROUP_SELECTION_KEY)||'[]'));}catch(_){}
    const shared=await loadUiState('toolboxes');
    if(Array.isArray(shared[GROUP_SELECTION_KEY])){
      selected=normalizeGroupSelection(shared[GROUP_SELECTION_KEY]);
      localStorage.setItem(GROUP_SELECTION_KEY,JSON.stringify(selected));
    }
    return selected;
  }

  function toolboxRailMinMainWidth(){
    const rail=document.querySelector('.toolbox-rail');
    const configured=parseInt(rail?.dataset?.minMainWidth||'',10);
    return configured>0?configured:360;
  }

  function clampToolboxRailWidth(value){
    const min=300;
    const max=Math.max(min,Math.min(Math.round(window.innerWidth*2/3),window.innerWidth-toolboxRailMinMainWidth()));
    return Math.max(min,Math.min(max,parseInt(value,10)||0));
  }

  function setToolboxRailWidth(value,{save=false}={}){
    if(window.matchMedia&&window.matchMedia('(max-width:900px)').matches)return;
    const width=clampToolboxRailWidth(value);
    document.documentElement.style.setProperty('--toolbox-rail-width',width+'px');
    window.dispatchEvent(new CustomEvent('toolboxrailresize',{detail:{width}}));
    if(save){
      localStorage.setItem(TOOLBOX_WIDTH_KEY,String(width));
      saveUiState('toolboxes',TOOLBOX_WIDTH_KEY,width);
    }
  }

  async function applySharedToolboxRailWidth(){
    const local=parseInt(localStorage.getItem(TOOLBOX_WIDTH_KEY)||'',10);
    if(local)setToolboxRailWidth(local);
    const shared=await loadUiState('toolboxes');
    if(shared[TOOLBOX_WIDTH_KEY]){
      localStorage.setItem(TOOLBOX_WIDTH_KEY,String(shared[TOOLBOX_WIDTH_KEY]));
      setToolboxRailWidth(shared[TOOLBOX_WIDTH_KEY]);
    }
  }

  function setToolboxRailCollapsed(rail,collapsed,{save=false}={}){
    if(!rail)return;
    const next=!!collapsed;
    if(next)setToolboxRailEditing(rail,false);
    rail.classList.toggle('collapsed',next);
    document.body.classList.toggle('toolbox-rail-collapsed',next);
    const toggle=rail.querySelector('.toolbox-rail-toggle');
    if(toggle){
      toggle.textContent=next?'‹':'›';
      toggle.title=next?'Show toolboxes':'Hide toolboxes';
      toggle.setAttribute('aria-expanded',next?'false':'true');
    }
    if(save){
      localStorage.setItem(TOOLBOX_COLLAPSED_KEY,next?'1':'0');
      saveUiState('toolboxes',TOOLBOX_COLLAPSED_KEY,next);
    }
  }

  async function applySharedToolboxRailCollapsed(rail){
    let collapsed=localStorage.getItem(TOOLBOX_COLLAPSED_KEY)==='1';
    const shared=await loadUiState('toolboxes');
    if(shared[TOOLBOX_COLLAPSED_KEY]!==undefined){
      collapsed=!!shared[TOOLBOX_COLLAPSED_KEY];
      localStorage.setItem(TOOLBOX_COLLAPSED_KEY,collapsed?'1':'0');
    }
    setToolboxRailCollapsed(rail,collapsed);
  }

  function toolboxRailEditing(rail){
    return !!rail?.classList.contains('toolbox-reorder-editing');
  }

  function setToolboxTileLayoutControlsVisible(rail,visible){
    if(!rail)return;
    const active=!!visible;
    rail.querySelectorAll('.tile-layout-controls .tile-move-btn').forEach(button=>{
      const moveActive=button.classList.contains('active')||button.getAttribute('aria-pressed')==='true';
      if(moveActive!==active)button.click();
      button.hidden=true;
      button.setAttribute('aria-hidden','true');
      button.tabIndex=-1;
    });
    rail.querySelectorAll('.tile-layout-controls').forEach(controls=>{
      controls.hidden=!active;
      controls.style.display=active?'':'none';
    });
  }

  function setToolboxRailEditing(rail,editing){
    if(!rail)return;
    const active=!!editing;
    rail.classList.toggle('toolbox-reorder-editing',active);
    rail.dataset.toolboxReorderEditing=active?'1':'0';
    const button=rail.querySelector('.toolbox-rail-edit');
    if(button){
      button.textContent=active?'Done':'Edit';
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
      button.title=active?'Finish reordering toolboxes':'Enable toolbox reordering';
    }
    rail.querySelectorAll('.scene-toolbox__header[data-toolbox-drag-handle="1"]').forEach(header=>{
      header.title=active?'Drag to reorder toolbox':'Enable Toolboxes Edit to reorder';
    });
    setToolboxTileLayoutControlsVisible(rail,active);
  }

  function initToolboxRailHeader(rail){
    if(!rail||rail.querySelector('.toolbox-rail-header'))return;
    const header=document.createElement('div');
    header.className='toolbox-rail-header';
    header.innerHTML='<span class="toolbox-rail-title">Toolboxes</span><div class="toolbox-rail-actions"><button class="toolbox-rail-edit" type="button" title="Enable toolbox reordering" aria-pressed="false">Edit</button><button class="toolbox-rail-toggle" type="button" title="Hide toolboxes" aria-expanded="true">›</button></div>';
    rail.prepend(header);
    header.querySelector('.toolbox-rail-edit').addEventListener('click',()=>{
      setToolboxRailEditing(rail,!toolboxRailEditing(rail));
    });
    header.querySelector('.toolbox-rail-toggle').addEventListener('click',()=>{
      setToolboxRailCollapsed(rail,!rail.classList.contains('collapsed'),{save:true});
    });
    setToolboxRailEditing(rail,false);
  }

  function initToolboxRailResize(rail){
    if(!rail||rail.querySelector('.toolbox-rail-resizer'))return;
    const handle=document.createElement('div');
    handle.className='toolbox-rail-resizer';
    handle.title='Drag to resize toolboxes';
    rail.prepend(handle);
    let active=false;
    const onMove=e=>{
      if(!active)return;
      setToolboxRailWidth(window.innerWidth-e.clientX);
    };
    const onUp=e=>{
      if(!active)return;
      active=false;
      document.body.classList.remove('toolbox-rail-resizing');
      try{handle.releasePointerCapture?.(e.pointerId);}catch(_){}
      setToolboxRailWidth(window.innerWidth-e.clientX,{save:true});
      window.removeEventListener('pointermove',onMove);
      window.removeEventListener('pointerup',onUp);
      window.removeEventListener('pointercancel',onUp);
    };
    handle.addEventListener('pointerdown',e=>{
      if(window.matchMedia&&window.matchMedia('(max-width:900px)').matches)return;
      active=true;
      document.body.classList.add('toolbox-rail-resizing');
      try{handle.setPointerCapture?.(e.pointerId);}catch(_){}
      e.preventDefault();
      window.addEventListener('pointermove',onMove);
      window.addEventListener('pointerup',onUp);
      window.addEventListener('pointercancel',onUp);
    });
    handle.addEventListener('dblclick',()=>{
      localStorage.removeItem(TOOLBOX_WIDTH_KEY);
      document.documentElement.style.removeProperty('--toolbox-rail-width');
      saveUiState('toolboxes',TOOLBOX_WIDTH_KEY,null);
    });
  }

  function initToolboxRailScrollHost(rail){
    if(!rail)return null;
    let host=rail.querySelector(':scope > .toolbox-rail-scroll');
    if(host)return host;
    host=document.createElement('div');
    host.className='toolbox-rail-scroll';
    Array.from(rail.children).filter(child=>child.classList.contains('scene-toolbox')).forEach(box=>host.appendChild(box));
    rail.appendChild(host);
    return host;
  }

  function configureToolboxRailDragHandle(box){
    if(!box)return;
    box.draggable=false;
    const header=box.querySelector('.scene-toolbox__header');
    if(!header)return;
    header.draggable=false;
    header.dataset.toolboxDragHandle='1';
    const rail=box.closest('.toolbox-rail');
    header.title=toolboxRailEditing(rail)?'Drag to reorder toolbox':'Enable Toolboxes Edit to reorder';
  }

  function findVerticalScroller(target,limit){
    let el=target;
    while(el&&el!==document&&el!==document.body){
      if(limit&&!limit.contains(el))break;
      const style=getComputedStyle(el);
      const overflow=style.overflowY;
      if((overflow==='auto'||overflow==='scroll')&&el.scrollHeight>el.clientHeight+1)return el;
      if(el===limit)break;
      el=el.parentElement;
    }
    return limit;
  }

  function initToolboxRailScrollGuard(rail){
    if(!rail||rail.dataset.toolboxScrollGuard==='1')return;
    rail.dataset.toolboxScrollGuard='1';
    let touch={y:0,scroller:null};
    const canScroll=(el,dy)=>{
      if(!el)return false;
      if(el.scrollHeight<=el.clientHeight+1)return false;
      if(dy<0)return el.scrollTop>0;
      if(dy>0)return el.scrollTop+el.clientHeight<el.scrollHeight-1;
      return false;
    };
    rail.addEventListener('wheel',e=>{
      const scroller=findVerticalScroller(e.target,rail);
      e.stopPropagation();
      if(!canScroll(scroller,e.deltaY))e.preventDefault();
    },{passive:false});
    rail.addEventListener('touchstart',e=>{
      touch.y=e.touches[0]?.clientY||0;
      touch.scroller=findVerticalScroller(e.target,rail);
    },{passive:true});
    rail.addEventListener('touchmove',e=>{
      const y=e.touches[0]?.clientY||touch.y;
      const dy=touch.y-y;
      touch.y=y;
      e.stopPropagation();
      if(!canScroll(touch.scroller,dy))e.preventDefault();
    },{passive:false});
  }

  function initToolboxRail(rail,entries){
    if(!rail)return;
    initToolboxRailHeader(rail);
    initToolboxRailResize(rail);
    const scrollHost=initToolboxRailScrollHost(rail);
    initToolboxRailScrollGuard(rail);
    applySharedToolboxRailWidth().catch(()=>{});
    applySharedToolboxRailCollapsed(rail).catch(()=>{});
    (entries||[]).forEach(entry=>{
      const box=typeof entry.box==='string'?document.getElementById(entry.box):entry.box;
      if(!box)return;
      box.dataset.toolboxType=entry.type||box.id;
      configureToolboxRailDragHandle(box);
      scrollHost.appendChild(box);
    });
    rail.querySelectorAll('.scene-toolbox[data-toolbox-type]').forEach(configureToolboxRailDragHandle);
    setToolboxTileLayoutControlsVisible(rail,toolboxRailEditing(rail));
    applySharedToolboxOrder(rail).catch(()=>{});
    if(rail.dataset.toolboxRailInit==='1')return {
      applyOrder:()=>applySharedToolboxOrder(rail),
      saveOrder:()=>saveSharedToolboxOrder(rail),
      isEditing:()=>toolboxRailEditing(rail),
      setEditing:editing=>setToolboxRailEditing(rail,editing)
    };
    rail.dataset.toolboxRailInit='1';

    let reorderDrag=null;
    const clearDropMarks=()=>rail.querySelectorAll('.toolbox-drop-before,.toolbox-drop-after').forEach(el=>el.classList.remove('toolbox-drop-before','toolbox-drop-after'));
    const finishReorderDrag=()=>{
      if(!reorderDrag)return;
      reorderDrag.box.classList.remove('toolbox-dragging');
      try{reorderDrag.handle.releasePointerCapture?.(reorderDrag.pointerId);}catch(_){}
      reorderDrag=null;
      clearDropMarks();
      saveSharedToolboxOrder(rail);
    };
    const moveReorderDrag=e=>{
      if(!reorderDrag||e.pointerId!==reorderDrag.pointerId)return;
      e.preventDefault();
      const dragging=reorderDrag.box;
      const target=Array.from(rail.querySelectorAll('.scene-toolbox[data-toolbox-type]'))
        .filter(box=>box!==dragging)
        .find(box=>{
          const rect=box.getBoundingClientRect();
          return e.clientY>=rect.top&&e.clientY<=rect.bottom;
        });
      if(!target)return;
      clearDropMarks();
      const rect=target.getBoundingClientRect();
      const before=e.clientY<rect.top+rect.height/2;
      target.classList.toggle('toolbox-drop-before',before);
      target.classList.toggle('toolbox-drop-after',!before);
      if(before)scrollHost.insertBefore(dragging,target);
      else scrollHost.insertBefore(dragging,target.nextSibling);
    };
    rail.addEventListener('pointerdown',e=>{
      if(!toolboxRailEditing(rail))return;
      const handle=e.target.closest('.scene-toolbox__header[data-toolbox-drag-handle="1"]');
      const box=handle?.closest('.scene-toolbox[data-toolbox-type]');
      if(!box||e.target.closest('button,input,select,textarea,a'))return;
      reorderDrag={box,handle,pointerId:e.pointerId};
      box.classList.add('toolbox-dragging');
      try{handle.setPointerCapture?.(e.pointerId);}catch(_){}
      e.preventDefault();
    });
    rail.addEventListener('pointermove',moveReorderDrag);
    rail.addEventListener('pointerup',e=>{
      if(reorderDrag&&e.pointerId===reorderDrag.pointerId)finishReorderDrag();
    });
    rail.addEventListener('pointercancel',e=>{
      if(reorderDrag&&e.pointerId===reorderDrag.pointerId)finishReorderDrag();
    });
    rail.addEventListener('dragstart',e=>{
      e.preventDefault();
    });
    return {
      applyOrder:()=>applySharedToolboxOrder(rail),
      saveOrder:()=>saveSharedToolboxOrder(rail),
      isEditing:()=>toolboxRailEditing(rail),
      setEditing:editing=>setToolboxRailEditing(rail,editing)
    };
  }

  function restoreRailElementAnchor(element){
    const rail=element?.closest?.('.toolbox-rail');
    if(!rail)return;
    const scrollHost=rail.querySelector('.toolbox-rail-scroll')||rail;
    const before=element.getBoundingClientRect().top;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(!element.isConnected)return;
      scrollHost.scrollTop+=element.getBoundingClientRect().top-before;
    }));
  }

  function initFloatingToolbox(options){
    const box=document.getElementById(options.boxId);
    const header=document.getElementById(options.headerId);
    const toggle=document.getElementById(options.toggleId);
    const posKey=options.posStorageKey;
    const collapsedKey=options.collapsedStorageKey;
    const sizeKey=options.sizeStorageKey;
    const uiPosKey=options.uiStatePosKey||'sceneBoxPos';
    const uiCollapsedKey=options.uiStateCollapsedKey||'sceneBoxCollapsed';
    const uiSizeKey=options.uiStateSizeKey||'sceneBoxSize';
    const page=options.uiStatePage;
    const resizable=!!options.resizable;
    const minWidth=parseInt(options.minWidth)||200;
    const minHeight=parseInt(options.minHeight)||80;
    let dragOffset={x:0,y:0};
    let sizeSaveTimer=0;
    let observedOnce=false;
    let resizeDrag=null;
    function inToolboxRail(){
      return !!box?.closest('.toolbox-rail');
    }

    function clampBox(){
      if(!box)return;
      if(inToolboxRail()){
        box.style.left='';
        box.style.top='';
        box.style.right='';
        box.style.bottom='';
        return;
      }
      if(resizable){
        const w=Math.max(minWidth,Math.min(window.innerWidth,parseInt(box.style.width)||box.offsetWidth||minWidth));
        const h=Math.max(minHeight,Math.min(window.innerHeight,parseInt(box.style.height)||box.offsetHeight||minHeight));
        box.style.width=w+'px';
        if(!box.classList.contains('collapsed'))box.style.height=h+'px';
      }
      const x=Math.max(0,Math.min(window.innerWidth-box.offsetWidth,parseInt(box.style.left)||box.offsetLeft||0));
      const y=Math.max(0,Math.min(window.innerHeight-box.offsetHeight,parseInt(box.style.top)||box.offsetTop||0));
      box.style.left=x+'px';
      box.style.top=y+'px';
      box.style.right='auto';
      box.style.bottom='auto';
    }

    function applyPosition(pos){
      if(!box||!pos)return;
      if(inToolboxRail())return;
      box.style.left=(parseInt(pos.x)||0)+'px';
      box.style.top=(parseInt(pos.y)||0)+'px';
      box.style.right='auto';
      clampBox();
    }

    function applySize(size){
      if(!box||!size)return;
      const w=parseInt(size.w||size.width);
      const h=parseInt(size.h||size.height);
      if(w&&!inToolboxRail())box.style.width=Math.max(minWidth,w)+'px';
      if(h&&!box.classList.contains('collapsed'))box.style.height=Math.max(minHeight,h)+'px';
      clampBox();
    }

    function currentSize(){
      if(!box)return null;
      const w=Math.round(box.offsetWidth);
      const h=Math.round(box.offsetHeight);
      if(w<minWidth||h<minHeight)return null;
      return {w,h};
    }

    function saveSizeSoon(){
      if(!resizable||!box||box.classList.contains('collapsed'))return;
      clearTimeout(sizeSaveTimer);
      sizeSaveTimer=setTimeout(()=>{
        const size=currentSize();
        if(!size)return;
        if(sizeKey)localStorage.setItem(sizeKey,JSON.stringify(size));
        if(page)saveUiState(page,uiSizeKey,size);
      },250);
    }

    function saveSizeNow(){
      if(!resizable||!box||box.classList.contains('collapsed'))return;
      const size=currentSize();
      if(!size)return;
      if(sizeKey)localStorage.setItem(sizeKey,JSON.stringify(size));
      if(page)saveUiState(page,uiSizeKey,size);
    }

    function ensureResizeHandle(){
      if(!resizable||!box||box.querySelector('.scene-toolbox__resize'))return;
      box.classList.add('resizable');
      const handle=document.createElement('div');
      handle.className='scene-toolbox__resize';
      handle.title='Drag to resize toolbox height';
      box.appendChild(handle);
      const onMove=e=>{
        if(!resizeDrag)return;
        const dy=e.clientY-resizeDrag.y;
        const maxHeight=Math.max(minHeight,Math.round(window.innerHeight-20));
        const next=Math.max(minHeight,Math.min(maxHeight,resizeDrag.h+dy));
        box.style.height=next+'px';
        e.preventDefault();
      };
      const onUp=e=>{
        if(!resizeDrag)return;
        resizeDrag=null;
        box.classList.remove('resizing');
        try{handle.releasePointerCapture?.(e.pointerId);}catch(_){}
        saveSizeNow();
        window.removeEventListener('pointermove',onMove);
        window.removeEventListener('pointerup',onUp);
        window.removeEventListener('pointercancel',onUp);
      };
      handle.addEventListener('pointerdown',e=>{
        if(box.classList.contains('collapsed'))return;
        resizeDrag={y:e.clientY,h:box.offsetHeight||minHeight};
        box.classList.add('resizing');
        try{handle.setPointerCapture?.(e.pointerId);}catch(_){}
        e.preventDefault();
        window.addEventListener('pointermove',onMove);
        window.addEventListener('pointerup',onUp);
        window.addEventListener('pointercancel',onUp);
      });
    }

    function setCollapsed(collapsed,save){
      if(!box)return;
      const c=!!collapsed;
      if(c&&!box.classList.contains('collapsed')&&!inToolboxRail()){
        box.style.width=(box.offsetWidth||parseInt(box.style.width)||minWidth)+'px';
      }
      if(resizable){
        if(c&&!box.classList.contains('collapsed')){
          const size=currentSize();
          if(size){
            if(sizeKey)localStorage.setItem(sizeKey,JSON.stringify(size));
            if(save&&page)saveUiState(page,uiSizeKey,size);
          }
          box.dataset.expandedHeight=box.style.height||box.offsetHeight+'px';
          box.style.height='auto';
          box.style.resize='none';
        }else if(!c){
          box.classList.remove('collapsed');
          box.style.resize=inToolboxRail()?'none':'both';
          let size=null;
          if(sizeKey){
            try{size=JSON.parse(localStorage.getItem(sizeKey)||'null');}catch(_){}
          }
          if(size)applySize(size);
          else if(box.dataset.expandedHeight)box.style.height=box.dataset.expandedHeight;
        }
      }
      box.classList.toggle('collapsed',c);
      if(toggle)toggle.textContent=c?'+':'\u2014';
      if(collapsedKey)localStorage.setItem(collapsedKey,c?'1':'');
      if(save&&page)saveUiState(page,uiCollapsedKey,c);
      clampBox();
      if(!c&&inToolboxRail()){
        requestAnimationFrame(()=>{
          const rail=box.closest('.toolbox-rail');
          if(!rail)return;
          const scrollHost=rail.querySelector('.toolbox-rail-scroll')||rail;
          const top=Math.max(0,box.offsetTop-12);
          scrollHost.scrollTo({top,behavior:'auto'});
        });
      }
    }

    if(box&&posKey&&!inToolboxRail()){
      try{applyPosition(JSON.parse(localStorage.getItem(posKey)||'null'));}catch(_){}
    }
    if(box&&sizeKey){
      try{applySize(JSON.parse(localStorage.getItem(sizeKey)||'null'));}catch(_){}
    }
    ensureResizeHandle();
    if(collapsedKey&&localStorage.getItem(collapsedKey)==='1')setCollapsed(true,false);

    if(box&&header){
      header.addEventListener('pointerdown',e=>{
        if(box.closest('.toolbox-rail'))return;
        if(e.target.closest('button'))return;
        header.setPointerCapture(e.pointerId);
        const r=box.getBoundingClientRect();
        dragOffset={x:e.clientX-r.left,y:e.clientY-r.top};
        header.style.cursor='grabbing';
      });
      header.addEventListener('pointermove',e=>{
        if(box.closest('.toolbox-rail'))return;
        if(!header.hasPointerCapture(e.pointerId))return;
        let x=e.clientX-dragOffset.x;
        let y=e.clientY-dragOffset.y;
        x=Math.max(0,Math.min(window.innerWidth-box.offsetWidth,x));
        y=Math.max(0,Math.min(window.innerHeight-box.offsetHeight,y));
        box.style.left=x+'px';
        box.style.top=y+'px';
        box.style.right='auto';
        if(posKey)localStorage.setItem(posKey,JSON.stringify({x,y}));
      });
      header.addEventListener('pointerup',()=>{
        if(box.closest('.toolbox-rail'))return;
        header.style.cursor='grab';
        const pos={x:parseInt(box.style.left)||0,y:parseInt(box.style.top)||0};
        if(page)saveUiState(page,uiPosKey,pos);
      });
      window.addEventListener('resize',clampBox);
    }

    if(resizable&&box&&window.ResizeObserver){
      const ro=new ResizeObserver(()=>{
        if(!observedOnce){
          observedOnce=true;
          return;
        }
        saveSizeSoon();
        clampBox();
      });
      ro.observe(box);
    }

    if(toggle)toggle.addEventListener('click',event=>{
      const expanding=box?.classList.contains('collapsed');
      const rail=box?.closest('.toolbox-rail');
      const buttonTop=event.currentTarget.getBoundingClientRect().top;
      const nearRailBottom=rail&&buttonTop>rail.getBoundingClientRect().bottom-120;
      setCollapsed(!box.classList.contains('collapsed'),true);
      if(expanding&&!nearRailBottom)restoreRailElementAnchor(event.currentTarget);
    });

    return {box,header,toggle,clamp:clampBox,applyPosition,applySize,setCollapsed};
  }

  function initToolboxCollapseGroup(options){
    const group=options?.group||'';
    const items=(options?.items||[]).map(item=>({
      id:item.id,
      toolbox:item.toolbox,
      box:item.box||document.getElementById(item.id)
    }));
    const selector=options?.selector||('[data-collapse-group="'+group+'"]');
    const toggleIds=options?.toggleIds||items.map(item=>item.toolbox?.toggle?.id).filter(Boolean);
    const expandedText=options?.expandedText||'-- all';
    const collapsedText=options?.collapsedText||'+ all';
    const collapseTitle=options?.collapseTitle||'Collapse all toolboxes';
    const expandTitle=options?.expandTitle||'Uncollapse all toolboxes';
    const beforeToggle=typeof options?.beforeToggle==='function'?options.beforeToggle:null;

    function boxes(){
      return items.map(item=>item.box||document.getElementById(item.id)).filter(Boolean);
    }
    function update(){
      const currentBoxes=boxes();
      const allCollapsed=currentBoxes.length&&currentBoxes.every(box=>box.classList.contains('collapsed'));
      document.querySelectorAll(selector).forEach(btn=>{
        btn.textContent=allCollapsed?collapsedText:expandedText;
        btn.title=allCollapsed?expandTitle:collapseTitle;
      });
      return allCollapsed;
    }
    function setGroupCollapsed(collapse,save=true){
      items.forEach(item=>item.toolbox?.setCollapsed?.(collapse,save));
      update();
    }
    function toggle(event){
      const button=event?.currentTarget||null;
      const collapse=boxes().some(box=>!box.classList.contains('collapsed'));
      if(beforeToggle)beforeToggle({collapse,items});
      setGroupCollapsed(collapse,true);
      restoreRailElementAnchor(button);
    }

    document.querySelectorAll(selector).forEach(btn=>{
      if(btn.dataset.toolboxCollapseGroupInit===group)return;
      btn.dataset.toolboxCollapseGroupInit=group;
      btn.addEventListener('click',toggle);
    });
    toggleIds.forEach(id=>{
      const btn=document.getElementById(id);
      if(!btn||btn.dataset.toolboxCollapseUpdateInit===group)return;
      btn.dataset.toolboxCollapseUpdateInit=group;
      btn.addEventListener('click',()=>setTimeout(update,0));
    });
    update();
    setTimeout(update,500);
    return {update,toggle,setCollapsed:setGroupCollapsed};
  }

  let sharedGroupVisualEditor=null;
  function ensureSharedGroupVisualEditor(){
    if(sharedGroupVisualEditor)return sharedGroupVisualEditor;
    if(!document.getElementById('sharedGroupVisualModal')){
      const wrap=document.createElement('div');
      wrap.id='sharedGroupVisualModal';
      wrap.className='modal-overlay visual-editor-modal';
      wrap.style.display='none';
      wrap.innerHTML=`
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="sharedGroupVisualTitle">
          <div class="modal-head">
            <button id="sharedGroupVisualClose" type="button" aria-label="Close">x</button>
            <h2 id="sharedGroupVisualTitle">Edit Group Tile</h2>
          </div>
          <div class="modal-body">
            <label>Target<select id="sharedGroupVisualTarget"></select></label>
            <label>Name<input id="sharedGroupVisualName" type="text"></label>
            <div id="sharedGroupColorVisualWrap">
              <label>Background color<input id="sharedGroupVisualColor" type="color" value="#225a50"></label>
              <button id="sharedGroupVisualResetColor" type="button">Default background</button>
            </div>
            <div id="sharedGroupImageVisualWrap" class="wheel-editor">
              <label>Upload visual<input id="sharedGroupVisualImage" type="file" accept="image/*"></label>
              <canvas id="sharedGroupVisualCanvas" class="gobo-canvas" width="120" height="120"></canvas>
              <div class="buttons"><button id="sharedGroupVisualClear" type="button">No icon</button></div>
            </div>
            <div id="sharedGroupVisualHint" class="small"></div>
          </div>
          <div class="modal-actions">
            <button id="sharedGroupVisualSave" type="button" class="primary">Save tile</button>
            <button id="sharedGroupVisualClose2" type="button">Close</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
    }
    sharedGroupVisualEditor=initSlotVisualEditor({
      modalId:'sharedGroupVisualModal',
      targetId:'sharedGroupVisualTarget',
      nameInputId:'sharedGroupVisualName',
      colorWrapId:'sharedGroupColorVisualWrap',
      imageWrapId:'sharedGroupImageVisualWrap',
      colorInputId:'sharedGroupVisualColor',
      resetColorBtnId:'sharedGroupVisualResetColor',
      canvasId:'sharedGroupVisualCanvas',
      imageInputId:'sharedGroupVisualImage',
      clearBtnId:'sharedGroupVisualClear',
      hintId:'sharedGroupVisualHint',
      saveBtnId:'sharedGroupVisualSave',
      closeIds:['sharedGroupVisualClose','sharedGroupVisualClose2'],
      defaultColor:'#1b5e5a'
    });
    return sharedGroupVisualEditor;
  }

  function mountTileLayoutControls(host,options={}){
    const el=typeof host==='string'?document.getElementById(host):host;
    if(!el)return null;
    const colsId=String(options.colsId||'').trim();
    const rowsId=String(options.rowsId||'').trim();
    if(!colsId||!rowsId)return null;
    const minCols=clampInt(options.minCols??1,1,999);
    const minRows=clampInt(options.minRows??1,1,999);
    const maxCols=Math.max(minCols,clampInt(options.maxCols??32,minCols,999));
    const maxRows=Math.max(minRows,clampInt(options.maxRows??32,minRows,999));
    const cols=clampInt(options.cols??4,minCols,maxCols);
    const rows=clampInt(options.rows??4,minRows,maxRows);
    const moveId=String(options.moveId||'').trim();
    const dimensionOptions=(min,max,selected)=>Array.from({length:max-min+1},(_,index)=>{
      const value=min+index;
      return `<option value="${value}"${value===selected?' selected':''}>${value}</option>`;
    }).join('');
    el.classList.add('tile-layout-controls');
    el.innerHTML=`<label class="tile-layout-field"><span class="tile-layout-name">Cols</span><select id="${escapeHtml(colsId)}" class="tile-layout-select" aria-label="Tile columns">${dimensionOptions(minCols,maxCols,cols)}</select></label>`+
      `<label class="tile-layout-field"><span class="tile-layout-name">Rows</span><select id="${escapeHtml(rowsId)}" class="tile-layout-select" aria-label="Tile rows">${dimensionOptions(minRows,maxRows,rows)}</select></label>`+
      (moveId?`<button id="${escapeHtml(moveId)}" class="tile-move-btn" title="${escapeHtml(options.moveTitle||'Move tiles by dragging them to another slot')}" hidden aria-hidden="true" tabindex="-1">Move</button>`:'');
    const colsSelect=document.getElementById(colsId);
    const rowsSelect=document.getElementById(rowsId);
    const configureRange=(select,initialMin,initialMax)=>{
      let effectiveMin=initialMin;
      let effectiveMax=initialMax;
      const sync=()=>Array.from(select.options).forEach(option=>{
        const value=parseInt(option.value,10);
        option.disabled=value<effectiveMin||value>effectiveMax;
      });
      Object.defineProperty(select,'min',{configurable:true,get:()=>String(effectiveMin),set:value=>{effectiveMin=clampInt(value,initialMin,initialMax);sync();}});
      Object.defineProperty(select,'max',{configurable:true,get:()=>String(effectiveMax),set:value=>{effectiveMax=clampInt(value,initialMin,initialMax);sync();}});
      sync();
    };
    configureRange(colsSelect,minCols,maxCols);
    configureRange(rowsSelect,minRows,maxRows);
    const rail=el.closest('.toolbox-rail');
    if(rail)setToolboxTileLayoutControlsVisible(rail,toolboxRailEditing(rail));
    return{host:el,cols:colsSelect,rows:rowsSelect,move:moveId?document.getElementById(moveId):null};
  }

  function initGroupsToolbox(options){
    const page=options.page||'groups';
    const idPrefix=options.idPrefix||page+'Groups';
    const title=options.title||'Groups';
    const showEdit=!!options.showEdit;
    const host=options.host||document.body;
    const boxId=idPrefix+'Box';
    const headerId=idPrefix+'Hdr';
    const toggleId=idPrefix+'Toggle';
    const listId=idPrefix+'List';
    const colsId=idPrefix+'Cols';
    const rowsId=idPrefix+'Rows';
    const moveId=idPrefix+'Move';
    const statePrefix=idPrefix;
    const layoutPrefix=options.layoutStoragePrefix||'groupsBox';
    let groups=[];
    let groupsLoaded=false;
    let selectedIds=new Set();
    let cols=parseInt(localStorage.getItem(layoutPrefix+'Cols')||localStorage.getItem(statePrefix+'Cols'))||2;
    let rows=parseInt(localStorage.getItem(layoutPrefix+'Rows')||localStorage.getItem(statePrefix+'Rows'))||4;
    let moveMode=false;
    let moveSelectedSlot=null;

    const box=document.createElement('div');
    box.id=boxId;
    box.className='scene-toolbox scene-toolbox--groups';
    box.dataset.toolboxType=options.toolboxType||'groups';
    box.innerHTML=`
      <div id="${headerId}" class="scene-toolbox__header">
        <span style="font-weight:700;font-size:13px">${escapeHtml(title)}</span>
        <button id="${toggleId}" class="scene-toolbox__toggle">—</button>
      </div>
      <div class="scene-toolbox__body">
        <div class="groups-toolbar">
          ${showEdit?`<button id="${idPrefix}Edit" class="primary groups-edit-btn" title="Edit selected groups">Group<br>Edit</button>`:''}
          <div id="${idPrefix}LayoutControls" class="groups-layout-controls"></div>
        </div>
        <div id="${listId}" class="list groups-matrix"><div class="small">No saved groups yet.</div></div>
      </div>`;
    host.appendChild(box);
    mountTileLayoutControls(idPrefix+'LayoutControls',{colsId,rowsId,moveId,cols:2,rows:4,maxCols:8,maxRows:12,moveTitle:'Move group tiles by dragging them to another slot'});
    if(host.classList?.contains('toolbox-rail')){
      initToolboxRail(host,[]);
    }

    const toolbox=initFloatingToolbox({
      boxId,headerId,toggleId,
      posStorageKey:statePrefix+'Pos',
      collapsedStorageKey:statePrefix+'Collapsed',
      uiStatePage:page,
      uiStatePosKey:statePrefix+'Pos',
      uiStateCollapsedKey:statePrefix+'Collapsed'
    });

    function key(g,i){return g.id||('idx_'+i);}
    function groupSlot(g,i){
      const slot=parseInt(g?.slot,10);
      return Number.isFinite(slot)&&slot>=0?slot:i;
    }
    function groupIndexAtSlot(slot){
      return groups.findIndex((g,i)=>groupSlot(g,i)===slot);
    }
    function normalizeGroups(nextGroups){
      return (Array.isArray(nextGroups)?nextGroups:[]).map((g,i)=>({
        ...g,
        id:g.id||('grp_'+Date.now()+'_'+i),
        fixtureIds:Array.isArray(g.fixtureIds)?g.fixtureIds:[],
        values:g.values||{},
        visual:normalizeSlotVisual(g.visual)||g.visual
      }));
    }
    function selectedGroups(){return groups.filter((g,i)=>selectedIds.has(key(g,i)));}
    function selectedGroupIds(){return selectedGroups().map(g=>g.id).filter(Boolean);}
    function applySharedSelection(ids){
      const wanted=new Set(normalizeGroupSelection(ids));
      selectedIds.clear();
      groups.forEach((g,i)=>{if(wanted.has(String(g.id)))selectedIds.add(key(g,i));});
    }
    function clampLayout(priority='cols'){
      const maxSlot=groups.reduce((max,g,i)=>Math.max(max,groupSlot(g,i)),-1);
      const count=Math.max(groups.length,maxSlot+1);
      cols=Math.max(1,Math.min(8,parseInt(cols)||2));
      rows=Math.max(1,Math.min(12,parseInt(rows)||4));
      if(count&&cols*rows<count){
        if(priority==='rows'){
          cols=Math.max(cols,Math.ceil(count/rows));
          if(cols>8){cols=8;rows=Math.ceil(count/cols);}
        }else{
          rows=Math.max(rows,Math.ceil(count/cols));
          if(rows>12){rows=12;cols=Math.ceil(count/rows);}
        }
      }
    }
    function applyLayout(priority='cols'){
      clampLayout(priority);
      const list=document.getElementById(listId);
      const inRail=!!box?.closest('.toolbox-rail');
      if(list)list.style.gridTemplateColumns='repeat('+cols+','+(inRail?'minmax(0,1fr)':'minmax(170px,1fr)')+')';
      if(box&&!inRail){
        const width=Math.max(280,cols*178+24);
        box.style.width=Math.min(Math.max(280,window.innerWidth-24),width)+'px';
      }
      const colsInput=document.getElementById(colsId);
      const rowsInput=document.getElementById(rowsId);
      if(colsInput){
        const maxSlot=groups.reduce((max,g,i)=>Math.max(max,groupSlot(g,i)),-1);
        const needed=Math.max(groups.length,maxSlot+1);
        colsInput.min=Math.max(1,Math.ceil(Math.max(needed,1)/rows));
        colsInput.value=cols;
      }
      if(rowsInput){
        const maxSlot=groups.reduce((max,g,i)=>Math.max(max,groupSlot(g,i)),-1);
        const needed=Math.max(groups.length,maxSlot+1);
        rowsInput.min=Math.max(1,Math.ceil(Math.max(needed,1)/cols));
        rowsInput.value=rows;
      }
    }
    function saveLayout(priority='cols'){
      clampLayout(priority);
      localStorage.setItem(layoutPrefix+'Cols',cols);
      localStorage.setItem(layoutPrefix+'Rows',rows);
      saveUiState('toolboxes',layoutPrefix+'Cols',cols);
      saveUiState('toolboxes',layoutPrefix+'Rows',rows);
    }
    function updateActions(){
      const selected=selectedGroups();
      const edit=document.getElementById(idPrefix+'Edit');
      if(edit){
        const requiresSelection=options.editRequiresSelection!==false;
        edit.disabled=(requiresSelection&&selected.length===0)||!options.canEdit?.(selected);
      }
    }
    function notify(){
      options.onSelectionChange?.(selectedGroups(),groups);
      updateActions();
    }
    function moveGroupSlot(fromSlot,toSlot){
      const fromIndex=groupIndexAtSlot(fromSlot);
      if(fromIndex<0||fromSlot===toSlot)return false;
      const toIndex=groupIndexAtSlot(toSlot);
      groups[fromIndex].slot=toSlot;
      if(toIndex>=0)groups[toIndex].slot=fromSlot;
      moveSelectedSlot=null;
      render('cols');
      saveGroups();
      options.onStatus?.('Moved group to slot '+(toSlot+1));
      return true;
    }
    function handleGroupMoveClick(slot){
      const index=groupIndexAtSlot(slot);
      const group=index>=0?groups[index]:null;
      if(moveSelectedSlot===null){
        if(!group)return;
        moveSelectedSlot=slot;
        render('cols');
        options.onStatus?.('Select a destination slot for '+(group.name||'Group'));
        return;
      }
      if(moveGroupSlot(moveSelectedSlot,slot))return;
      moveSelectedSlot=null;
      render('cols');
    }
    function render(priority='cols'){
      const list=document.getElementById(listId);
      if(!list)return;
      applyLayout(priority);
      const moveButton=document.getElementById(moveId);
      if(moveButton){
        moveButton.classList.toggle('active',moveMode);
        moveButton.setAttribute('aria-pressed',moveMode?'true':'false');
      }
      list.classList.toggle('tile-move-mode',moveMode);
      if(!groups.length){
        list.innerHTML='<div class="small">No saved groups yet.</div>';
        updateActions();
        return;
      }
      const total=cols*rows;
      let html='';
      for(let i=0;i<total;i++){
        const groupIndex=groupIndexAtSlot(i);
        const g=groupIndex>=0?groups[groupIndex]:null;
        if(!g){html+='<div class="group-empty" data-group-slot="'+i+'" title="'+(moveMode?'Drop a group here':'Empty group slot')+'">'+(i+1)+'</div>';continue;}
        const active=selectedIds.has(key(g,groupIndex))||moveSelectedSlot===i;
        html+=`<div class="${savedTileClass('item group-tile',active)}" data-group-slot="${i}" data-group-index="${groupIndex}" title="${moveMode?'Move group':'Select or deselect group'}" style="${slotVisualStyle(g)}">
          ${slotVisualButtonHtml('data-edit-group-tile',groupIndex,'Edit group tile')}
          <button class="slot-del" data-delete-group-tile="${groupIndex}" title="Delete group">×</button>
          <div class="group-tile-content">${slotVisualHtml(g)}<span class="group-tile-name">${escapeHtml(g.name||('Group '+(groupIndex+1)))}</span><span class="group-tile-meta">${(g.fixtureIds||[]).length} fixture${(g.fixtureIds||[]).length!==1?'s':''}</span></div>
        </div>`;
      }
      list.innerHTML=html;
      initTileMoveGrid({
        grid:list,
        button:moveButton,
        active:moveMode,
        itemSelector:'[data-group-slot]',
        getIndex:el=>parseInt(el.dataset.groupSlot,10),
        canDrag:(idx,el)=>el.hasAttribute('data-group-index'),
        onMove:moveGroupSlot
      });
      updateActions();
    }
    async function saveGroups(){
      if(!groupsLoaded){
        options.onStatus?.('Groups not saved: saved groups have not loaded from the server yet.',true);
        return false;
      }
      try{
        const r=await fetch('group_setup.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(versionedPayload({baseUrl:options.baseUrlInput?.value||'',groups}))});
        const j=await r.json();
        if(!j.ok)options.onStatus?.('Groups save failed: '+j.error,true);
        return !!j.ok;
      }catch(err){options.onStatus?.('Groups save error: '+err.message,true);return false;}
    }
    async function loadGroups(){
      let loaded=false;
      try{
        const r=await fetch('group_setup.php',{cache:'no-store'});
        if(!r.ok)throw new Error('HTTP '+r.status);
        const d=await r.json();
        if(d.ok===false)throw new Error(d.error||'Groups load failed');
        if(d.baseUrl&&options.baseUrlInput&&!localStorage.getItem(BASE_URL_KEY))options.baseUrlInput.value=d.baseUrl;
        groups=normalizeGroups(d.groups);
        groupsLoaded=true;
        loaded=true;
      }catch(err){
        options.onStatus?.('Groups load failed; keeping the last known group list. '+err.message,true);
      }
      applySharedSelection(await loadSharedGroupSelection());
      render();
      notify();
      return loaded;
    }
    function exportGroups(){
      downloadJson('dmx_groups.json',versionedPayload({baseUrl:options.baseUrlInput?.value||'',groups}));
    }
    function importGroups(file){
      const fr=new FileReader();
      fr.onload=e=>{
        try{
          const data=JSON.parse(e.target.result);
          if(!Array.isArray(data.groups))throw new Error('Expected {groups:[...]}');
          if(data.baseUrl&&options.baseUrlInput&&!localStorage.getItem(BASE_URL_KEY))options.baseUrlInput.value=data.baseUrl;
          groups=normalizeGroups(data.groups);
          groupsLoaded=true;
          selectedIds.clear();saveSharedGroupSelection([]);render('cols');notify();saveGroups();
          options.onStatus?.('Imported '+groups.length+' group(s)');
        }catch(err){options.onStatus?.('Import failed: '+err.message,true);}
      };
      fr.readAsText(file);
    }

    document.getElementById(listId).addEventListener('click',e=>{
      const editTile=e.target.closest('[data-edit-group-tile]');
      if(editTile){
        e.stopPropagation();
        openGroupTileEditor(parseInt(editTile.dataset.editGroupTile,10));
        return;
      }
      const deleteTile=e.target.closest('[data-delete-group-tile]');
      if(deleteTile){
        e.stopPropagation();
        deleteGroupAtIndex(parseInt(deleteTile.dataset.deleteGroupTile,10));
        return;
      }
      const item=e.target.closest('[data-group-slot]');
      if(!item)return;
      const slot=parseInt(item.dataset.groupSlot,10);
      if(moveMode){handleGroupMoveClick(slot);return;}
      const i=parseInt(item.dataset.groupIndex,10);
      const g=groups[i];if(!g)return;
      const k=key(g,i);
      if(selectedIds.has(k))selectedIds.delete(k);else selectedIds.add(k);
      saveSharedGroupSelection(selectedGroupIds());
      render('cols');notify();
    });
    if(document.getElementById(idPrefix+'Export'))document.getElementById(idPrefix+'Export').onclick=exportGroups;
    if(document.getElementById(idPrefix+'Import'))document.getElementById(idPrefix+'Import').onclick=()=>document.getElementById(idPrefix+'ImportFile')?.click();
    if(document.getElementById(idPrefix+'ImportFile'))document.getElementById(idPrefix+'ImportFile').onchange=e=>{if(e.target.files[0])importGroups(e.target.files[0]);e.target.value='';};
    function openGroupTileEditor(index){
      const group=groups[index];if(!group)return;
      const editor=ensureSharedGroupVisualEditor();
      if(!editor)return;
      editor.open({
        targetLabel:'group tile',
        defaultColor:'#1b5e5a',
        selectedKey:String(index),
        targets:[{key:String(index),label:group.name||('Group '+(index+1)),item:group}],
        hint:'Rename the group tile, choose a background color, and optionally draw or upload an icon.',
        onSaveTarget:(target,visual)=>{
          target.visual=normalizeSlotVisual(visual)||{type:'visual',color:'#1b5e5a',image:''};
          render('cols');
          saveGroups();
          options.onStatus?.('Updated group tile: '+(target.name||'Group'));
        }
      });
    }
    function deleteGroupAtIndex(index){
      const group=groups[index];if(!group)return;
      if(!confirm('Delete group "'+(group.name||('Group '+(index+1)))+'"?'))return;
      const remainingSelection=selectedGroupIds().filter(id=>String(id)!==String(group.id));
      groups.splice(index,1);
      applySharedSelection(remainingSelection);
      saveSharedGroupSelection(remainingSelection);
      render('cols');
      notify();
      saveGroups();
      options.onStatus?.('Deleted group: '+(group.name||('Group '+(index+1))));
    }
    const edit=document.getElementById(idPrefix+'Edit');
    if(edit)edit.onclick=()=>{
      const selected=selectedGroups();
      if(selected.length||options.editRequiresSelection===false)options.onEdit?.(selected);
    };
    document.getElementById(colsId).addEventListener('input',e=>{cols=e.target.value;applyLayout('cols');render('cols');saveLayout('cols');});
    document.getElementById(rowsId).addEventListener('input',e=>{rows=e.target.value;applyLayout('rows');render('rows');saveLayout('rows');});
    document.getElementById(moveId).addEventListener('click',()=>{
      moveMode=!moveMode;
      moveSelectedSlot=null;
      render('cols');
      options.onStatus?.(moveMode?'Group move mode enabled':'Group move mode disabled');
    });
    Promise.all([loadUiState(page),loadUiState('toolboxes')]).then(([st,shared])=>{
      if(st[statePrefix+'Collapsed']!==undefined)toolbox.setCollapsed(!!st[statePrefix+'Collapsed'],false);
      if(st[statePrefix+'Pos'])toolbox.applyPosition(st[statePrefix+'Pos']);
      if(shared[layoutPrefix+'Cols']!==undefined)cols=shared[layoutPrefix+'Cols'];
      else if(st[statePrefix+'Cols']!==undefined)cols=st[statePrefix+'Cols'];
      if(shared[layoutPrefix+'Rows']!==undefined)rows=shared[layoutPrefix+'Rows'];
      else if(st[statePrefix+'Rows']!==undefined)rows=st[statePrefix+'Rows'];
      render();
    }).catch(()=>{});
    loadGroups();
    window.addEventListener('storage',e=>{
      if(e.key!==GROUP_SELECTION_KEY)return;
      try{applySharedSelection(JSON.parse(e.newValue||'[]'));render();notify();}catch(_){}
    });
    function clearSelection(){
      if(!selectedIds.size)return;
      selectedIds.clear();
      saveSharedGroupSelection([]);
      render();
      notify();
    }
    function selectGroups(ids){
      applySharedSelection(ids);
      saveSharedGroupSelection(selectedGroupIds());
      render();
      notify();
    }
    function setGroups(nextGroups){
      groups=normalizeGroups(nextGroups);
      groupsLoaded=true;
      applySharedSelection(Array.from(selectedIds));
      render();
      notify();
    }
    return {box,toolbox,loadGroups,render,refreshActions:updateActions,selectedGroups,selectGroups,clearSelection,setGroups,get groups(){return groups;}};
  }

  function normalizeSlotVisual(visual){
    if(!visual||typeof visual!=='object')return null;
    const type=String(visual.type||'');
    const color=String(visual.color||'');
    const image=String(visual.image||'');
    const hasColor=/^#[0-9a-f]{6}$/i.test(color);
    const hasImage=/^data:image\//.test(image);
    if(type==='color'&&hasColor)return{type:'visual',color,image:''};
    if((type==='image'||type==='drawing')&&(hasImage||image===''))return{type:'visual',color:hasColor?color:'#225a50',image};
    if((type==='visual'||type==='slot')&&(hasColor||hasImage))return{type:'visual',color:hasColor?color:'#225a50',image:hasImage?image:''};
    return null;
  }

  function normalizeSlotVisualDefault(visual,fallbackColor){
    const normalized=normalizeSlotVisual(visual);
    return {
      type:'visual',
      color:(normalized&&normalized.color)||fallbackColor||'#225a50',
      image:''
    };
  }

  function contrastTextForColor(hex){
    const value=String(hex||'').replace('#','');
    if(!/^[0-9a-f]{6}$/i.test(value))return '#ffffff';
    const r=parseInt(value.slice(0,2),16)/255;
    const g=parseInt(value.slice(2,4),16)/255;
    const b=parseInt(value.slice(4,6),16)/255;
    const linear=v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);
    const luminance=0.2126*linear(r)+0.7152*linear(g)+0.0722*linear(b);
    const contrastWhite=(1.05)/(luminance+0.05);
    const contrastBlack=(luminance+0.05)/0.05;
    return contrastBlack>=contrastWhite?'#06110e':'#ffffff';
  }

  function luminanceForColor(hex){
    const value=String(hex||'').replace('#','');
    if(!/^[0-9a-f]{6}$/i.test(value))return 0;
    const r=parseInt(value.slice(0,2),16)/255;
    const g=parseInt(value.slice(2,4),16)/255;
    const b=parseInt(value.slice(4,6),16)/255;
    const linear=v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);
    return 0.2126*linear(r)+0.7152*linear(g)+0.0722*linear(b);
  }

  function slotVisualStyle(item){
    const visual=normalizeSlotVisual(item&&item.visual);
    if(!visual||!visual.color)return '';
    const text=contrastTextForColor(visual.color);
    const useDarkContrast=text==='#06110e';
    const overlay=useDarkContrast?'rgba(0,0,0,.28)':'rgba(255,255,255,.18)';
    const ring=useDarkContrast?'rgba(0,0,0,.5)':'rgba(1,255,230,.45)';
    const actionColor=useDarkContrast?'#06110e':'#01ffe6';
    const actionHover=useDarkContrast?'rgba(0,0,0,.14)':'rgba(1,255,230,.12)';
    const actionHoverStrong=useDarkContrast?'rgba(0,0,0,.22)':'rgba(1,255,230,.18)';
    const actionBorder=useDarkContrast?'rgba(0,0,0,.35)':'rgba(1,255,230,.35)';
    return `background:${visual.color};border-color:${visual.color};color:${text};--slot-bg:${visual.color};--slot-highlight-overlay:${overlay};--slot-highlight-ring:${ring};--slot-action-color:${actionColor};--slot-action-hover:${actionHover};--slot-action-hover-strong:${actionHoverStrong};--slot-action-border:${actionBorder}`;
  }

  function slotVisualHtml(item){
    const visual=normalizeSlotVisual(item&&item.visual);
    if(!visual)return '';
    if(visual.image){
      const image=String(visual.image).replace(/"/g,'&quot;');
      return `<span class="palette-visual" aria-hidden="true" style="background-image:url(&quot;${image}&quot;)"></span>`;
    }
    return '';
  }

  function slotVisualButtonHtml(dataAttr,value,title){
    return `<button class="slot-visual-btn" ${dataAttr}="${escapeHtml(String(value))}" title="${escapeHtml(title||'Edit visual')}" aria-label="${escapeHtml(title||'Edit visual')}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 11.5V13h1.5l7-7L10 4.5l-7 7Z"/><path d="M11 3.5l1.5-1.5L14 3.5 12.5 5 11 3.5Z"/></svg></button>`;
  }

  function showModal(modal){
    const el=typeof modal==='string'?document.getElementById(modal):modal;
    if(el){
      if(el.dataset.explicitCloseOnly!=='1'){
        el.dataset.explicitCloseOnly='1';
        el.addEventListener('click',event=>{
          if(event.target!==el)return;
          event.preventDefault();
          event.stopImmediatePropagation();
        },true);
      }
      enableModalTouchScroll(el);
      el.style.display='flex';
    }
  }

  function hideModal(modal){
    const el=typeof modal==='string'?document.getElementById(modal):modal;
    if(el)el.style.display='none';
  }

  function enableModalTouchScroll(modal){
    const body=modal?.querySelector?.('.modal-body');
    if(!body||body.dataset.touchScrollBound==='1')return;
    body.dataset.touchScrollBound='1';
    let touch=null;
    const isFormControl=target=>!!target.closest('button,input,select,textarea,label');
    body.addEventListener('touchstart',e=>{
      const t=e.touches&&e.touches[0];
      if(!t)return;
      touch={
        x:t.clientX,
        y:t.clientY,
        lastY:t.clientY,
        scrollTop:body.scrollTop,
        target:e.target,
        mode:null
      };
    },{passive:true});
    body.addEventListener('touchmove',e=>{
      if(!touch||body.scrollHeight<=body.clientHeight+1)return;
      const t=e.touches&&e.touches[0];
      if(!t)return;
      const dx=t.clientX-touch.x;
      const dy=t.clientY-touch.y;
      if(touch.mode===null){
        const startsOnXY=!!touch.target.closest('.xy-pad,.xy-mini');
        if(isFormControl(touch.target)&&!startsOnXY){
          touch.mode='native';
          return;
        }
        if(startsOnXY&&Math.abs(dy)<Math.abs(dx)+12&&Math.abs(dy)<18)return;
        touch.mode='scroll';
      }
      if(touch.mode!=='scroll')return;
      const next=touch.scrollTop-dy;
      body.scrollTop=Math.max(0,Math.min(body.scrollHeight-body.clientHeight,next));
      e.preventDefault();
    },{passive:false});
    ['touchend','touchcancel'].forEach(type=>body.addEventListener(type,()=>{touch=null;},{passive:true}));
  }

  function initSlotVisualEditor(options){
    const modal=document.getElementById(options.modalId);
    const targetSelect=document.getElementById(options.targetId);
    const colorWrap=document.getElementById(options.colorWrapId);
    const imageWrap=document.getElementById(options.imageWrapId);
    const colorInput=document.getElementById(options.colorInputId);
    const nameInput=options.nameInputId?document.getElementById(options.nameInputId):null;
    const resetColorBtn=options.resetColorBtnId?document.getElementById(options.resetColorBtnId):null;
    const canvas=document.getElementById(options.canvasId);
    const imageInput=document.getElementById(options.imageInputId);
    const clearBtn=document.getElementById(options.clearBtnId);
    const hint=document.getElementById(options.hintId);
    const saveBtn=document.getElementById(options.saveBtnId);
    if(!modal||!targetSelect||!colorWrap||!imageWrap||!colorInput||!canvas||!imageInput||!clearBtn||!hint||!saveBtn)return null;
    const ctx=canvas.getContext('2d');
    let drawing=false;
    let uploadedImage='';
    let hasIcon=false;
    let config={};
    let targetMap=new Map();
    const defaultColor=options.defaultColor||'#225a50';

    function editorBgColor(){
      const color=String(colorInput.value||config.defaultColor||defaultColor);
      return /^#[0-9a-f]{6}$/i.test(color)?color:defaultColor;
    }

    function editorBrushColor(){
      return contrastTextForColor(editorBgColor());
    }

    function prepareBrush(){
      ctx.strokeStyle=editorBrushColor();
      ctx.lineWidth=6;
      ctx.lineCap='round';
      ctx.lineJoin='round';
    }

    function blankCanvas(){
      ctx.fillStyle=editorBgColor();
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.beginPath();
      prepareBrush();
    }

    function clearCanvas(){
      blankCanvas();
      uploadedImage='';
      hasIcon=false;
      imageInput.value='';
    }

    function draw(e){
      const rect=canvas.getBoundingClientRect();
      const x=(e.clientX-rect.left)*canvas.width/rect.width;
      const y=(e.clientY-rect.top)*canvas.height/rect.height;
      prepareBrush();
      if(!drawing){
        ctx.beginPath();
        ctx.moveTo(x,y);
        return;
      }
      ctx.lineTo(x,y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x,y);
      uploadedImage='';
      hasIcon=true;
    }

    function loadCanvas(image){
      clearCanvas();
      if(!image)return;
      const img=new Image();
      img.onload=()=>{
        blankCanvas();
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        uploadedImage=canvas.toDataURL('image/png');
        hasIcon=true;
      };
      img.src=image;
    }

    function selectedTarget(){
      const val=targetSelect.value;
      if(val==='__default')return null;
      return targetMap.get(val)||null;
    }

    function loadEditor(){
      const target=selectedTarget();
      const visual=normalizeSlotVisual(target&&target.visual)||normalizeSlotVisual(config.defaultVisual)||{type:'visual',color:config.defaultColor||defaultColor,image:''};
      if(nameInput){
        const nameWrap=nameInput.closest('label')||nameInput.parentElement;
        if(target){
          nameInput.disabled=false;
          nameInput.value=target.name||target.label||'';
          if(nameWrap)nameWrap.style.display='';
        }else{
          nameInput.disabled=true;
          nameInput.value='';
          if(nameWrap)nameWrap.style.display='none';
        }
      }
      colorWrap.style.display='grid';
      imageWrap.style.display='grid';
      colorInput.value=visual.color||config.defaultColor||defaultColor;
      loadCanvas(visual.image||'');
    }

    function visualFromEditor(){
      const image=hasIcon?(uploadedImage||canvas.toDataURL('image/png')):'';
      return{type:'visual',color:colorInput.value||config.defaultColor||defaultColor,image};
    }

    function open(nextConfig){
      config=nextConfig||{};
      targetMap=new Map();
      const optionsHtml=[`<option value="__default">New ${escapeHtml(config.targetLabel||'slot visuals')}</option>`];
      (config.targets||[]).forEach((target,i)=>{
        const key=String(target.key??target.slot??i);
        targetMap.set(key,target.item||target);
        optionsHtml.push(`<option value="${escapeHtml(key)}">${escapeHtml(target.label||('Slot '+(i+1)))}</option>`);
      });
      targetSelect.innerHTML=optionsHtml.join('');
      if(config.selectedKey!==undefined&&config.selectedKey!==null&&targetMap.has(String(config.selectedKey))){
        targetSelect.value=String(config.selectedKey);
      }
      config.defaultColor=config.defaultColor||defaultColor;
      hint.textContent=config.hint||'Choose a background color and optionally draw/upload a visual.';
      clearCanvas();
      loadEditor();
      showModal(modal);
    }

    function close(){
      hideModal(modal);
    }

    function save(){
      const visual=visualFromEditor();
      const target=selectedTarget();
      if(target){
        if(nameInput&&!nameInput.disabled){
          const nextName=nameInput.value.trim();
          if(nextName)target.name=nextName;
        }
        config.onSaveTarget?.(target,visual);
      }
      else config.onSaveDefault?.(visual);
      close();
    }

    canvas.addEventListener('pointerdown',e=>{drawing=false;canvas.setPointerCapture?.(e.pointerId);draw(e);drawing=true;uploadedImage='';hasIcon=true;});
    canvas.addEventListener('pointermove',e=>{if(drawing)draw(e);});
    canvas.addEventListener('pointerup',()=>{drawing=false;uploadedImage='';});
    canvas.addEventListener('pointercancel',()=>{drawing=false;});
    imageInput.onchange=e=>{
      const file=e.target.files&&e.target.files[0];
      if(!file)return;
      const reader=new FileReader();
      reader.onload=()=>{
        const img=new Image();
        img.onload=()=>{
          clearCanvas();
          ctx.drawImage(img,0,0,canvas.width,canvas.height);
          uploadedImage=canvas.toDataURL('image/png');
          hasIcon=true;
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    };
    clearBtn.onclick=clearCanvas;
    colorInput.addEventListener('input',()=>{
      prepareBrush();
      if(!hasIcon)blankCanvas();
    });
    if(resetColorBtn)resetColorBtn.onclick=()=>{
      colorInput.value=config.defaultColor||defaultColor;
      prepareBrush();
      if(!hasIcon)blankCanvas();
    };
    targetSelect.onchange=loadEditor;
    saveBtn.onclick=save;
    (options.closeIds||[]).forEach(id=>{
      const el=document.getElementById(id);
      if(el)el.onclick=close;
    });
    return {open,close,normalize:normalizeSlotVisual,html:slotVisualHtml,style:slotVisualStyle};
  }

  function initTileMoveGrid(options){
    const grid=typeof options.grid==='string'?document.getElementById(options.grid):options.grid;
    const button=typeof options.button==='string'?document.getElementById(options.button):options.button;
    if(!grid)return;
    if(grid._dmxTileMoveCleanup)grid._dmxTileMoveCleanup();
    const active=!!options.active;
    const selector=options.itemSelector||'[data-tile-move-index]';
    const handleSelector=options.handleSelector||null;
    const getIndex=options.getIndex||((el)=>parseInt(el?.dataset?.tileMoveIndex,10));
    const canDrag=options.canDrag||(()=>true);
    const onMove=options.onMove||(()=>false);
    let dragIndex=null;
    let pointerDrag=null;

    grid.classList.toggle('tile-move-mode',active);
    if(button){
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    }

    const clearMarks=()=>grid.querySelectorAll('.toolbox-dragging,.toolbox-drop-before,.toolbox-drop-after').forEach(el=>el.classList.remove('toolbox-dragging','toolbox-drop-before','toolbox-drop-after'));
    const isBlockedDragStart=(target,source)=>{
      const interactive=target.closest('button,input,select,textarea,a,label');
      return !!interactive&&interactive!==source;
    };
    const targetAtPoint=(x,y,source)=>{
      return Array.from(grid.querySelectorAll(selector))
        .filter(el=>el!==source)
        .find(el=>{
          const rect=el.getBoundingClientRect();
          return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;
        })||null;
    };
    const autoScrollDuringDrag=e=>{
      const edge=72;
      const step=28;
      if(e.clientY<edge)window.scrollBy(0,-step);
      else if(e.clientY>window.innerHeight-edge)window.scrollBy(0,step);
      if(e.clientX<edge)window.scrollBy(-step,0);
      else if(e.clientX>window.innerWidth-edge)window.scrollBy(step,0);
    };
    const markTarget=(target,x)=>{
      grid.querySelectorAll('.toolbox-drop-before,.toolbox-drop-after').forEach(item=>item.classList.remove('toolbox-drop-before','toolbox-drop-after'));
      if(!target)return;
      const rect=target.getBoundingClientRect();
      const before=x<rect.left+rect.width/2;
      target.classList.toggle('toolbox-drop-before',before);
      target.classList.toggle('toolbox-drop-after',!before);
    };
    const pointerMove=e=>{
      if(!pointerDrag||pointerDrag.pointerId!==e.pointerId)return;
      const moved=Math.abs(e.clientX-pointerDrag.startX)>4||Math.abs(e.clientY-pointerDrag.startY)>4;
      if(!moved&&!pointerDrag.moved)return;
      pointerDrag.moved=true;
      pointerDrag.source.classList.add('toolbox-dragging');
      autoScrollDuringDrag(e);
      pointerDrag.target=targetAtPoint(e.clientX,e.clientY,pointerDrag.source);
      markTarget(pointerDrag.target,e.clientX);
      e.preventDefault();
    };
    const pointerEnd=e=>{
      if(!pointerDrag||pointerDrag.pointerId!==e.pointerId)return;
      const drag=pointerDrag;
      pointerDrag=null;
      if(drag.moved&&drag.target){
        const targetIndex=getIndex(drag.target);
        onMove(drag.sourceIndex,targetIndex);
      }
      clearMarks();
      window.removeEventListener('pointermove',pointerMove);
      window.removeEventListener('pointerup',pointerEnd);
      window.removeEventListener('pointercancel',pointerEnd);
    };
    const mouseMove=e=>{
      if(!pointerDrag||pointerDrag.pointerId!=='mouse')return;
      const moved=Math.abs(e.clientX-pointerDrag.startX)>4||Math.abs(e.clientY-pointerDrag.startY)>4;
      if(!moved&&!pointerDrag.moved)return;
      pointerDrag.moved=true;
      pointerDrag.source.classList.add('toolbox-dragging');
      autoScrollDuringDrag(e);
      pointerDrag.target=targetAtPoint(e.clientX,e.clientY,pointerDrag.source);
      markTarget(pointerDrag.target,e.clientX);
      e.preventDefault();
    };
    const mouseEnd=e=>{
      if(!pointerDrag||pointerDrag.pointerId!=='mouse')return;
      const drag=pointerDrag;
      pointerDrag=null;
      if(drag.moved&&drag.target){
        const targetIndex=getIndex(drag.target);
        onMove(drag.sourceIndex,targetIndex);
      }
      clearMarks();
      window.removeEventListener('mousemove',mouseMove);
      window.removeEventListener('mouseup',mouseEnd);
    };
    grid.querySelectorAll(selector).forEach(el=>{
      const idx=getIndex(el);
      el.draggable=false;
      const pointerDown=e=>{
        if(!active||!canDrag(idx,el)||isBlockedDragStart(e.target,el))return;
        if(e.pointerType==='mouse')return;
        pointerDrag={source:el,sourceIndex:idx,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,moved:false,target:null};
        e.preventDefault();
        window.addEventListener('pointermove',pointerMove);
        window.addEventListener('pointerup',pointerEnd);
        window.addEventListener('pointercancel',pointerEnd);
      };
      const mouseDown=e=>{
        if(pointerDrag||!active||!canDrag(idx,el)||isBlockedDragStart(e.target,el))return;
        pointerDrag={source:el,sourceIndex:idx,pointerId:'mouse',startX:e.clientX,startY:e.clientY,moved:false,target:null};
        e.preventDefault();
        window.addEventListener('mousemove',mouseMove);
        window.addEventListener('mouseup',mouseEnd);
      };
      const dragStartEls=handleSelector?Array.from(el.querySelectorAll(handleSelector)):[el];
      dragStartEls.forEach(startEl=>{
        startEl.draggable=false;
        startEl.addEventListener('pointerdown',pointerDown);
        startEl.addEventListener('mousedown',mouseDown);
        startEl.addEventListener('dragstart',e=>{
          if(e.currentTarget!==startEl)return;
          if(!active||!canDrag(idx,el)){
            e.preventDefault();
            return;
          }
          dragIndex=idx;
          el.classList.add('toolbox-dragging');
          if(e.dataTransfer){
            e.dataTransfer.effectAllowed='move';
            e.dataTransfer.setData('text/plain',String(idx));
          }
        });
      });
      if(!handleSelector)el.addEventListener('dragstart',e=>{
        if(!active||!canDrag(idx,el)){
          e.preventDefault();
          return;
        }
        dragIndex=idx;
        el.classList.add('toolbox-dragging');
        if(e.dataTransfer){
          e.dataTransfer.effectAllowed='move';
          e.dataTransfer.setData('text/plain',String(idx));
        }
      });
      el.addEventListener('dragover',e=>{
        if(!active||dragIndex===null)return;
        e.preventDefault();
        grid.querySelectorAll('.toolbox-drop-before,.toolbox-drop-after').forEach(item=>item.classList.remove('toolbox-drop-before','toolbox-drop-after'));
        const rect=el.getBoundingClientRect();
        const before=e.clientX<rect.left+rect.width/2;
        el.classList.toggle('toolbox-drop-before',before);
        el.classList.toggle('toolbox-drop-after',!before);
        if(e.dataTransfer)e.dataTransfer.dropEffect='move';
      });
      el.addEventListener('dragleave',()=>el.classList.remove('toolbox-drop-before','toolbox-drop-after'));
      el.addEventListener('drop',e=>{
        if(!active||dragIndex===null)return;
        e.preventDefault();
        onMove(dragIndex,idx);
        dragIndex=null;
        clearMarks();
      });
      el.addEventListener('dragend',()=>{
        dragIndex=null;
        clearMarks();
      });
    });
    grid._dmxTileMoveCleanup=()=>{
      window.removeEventListener('pointermove',pointerMove);
      window.removeEventListener('pointerup',pointerEnd);
      window.removeEventListener('pointercancel',pointerEnd);
      window.removeEventListener('mousemove',mouseMove);
      window.removeEventListener('mouseup',mouseEnd);
      pointerDrag=null;
    };
  }

  function normalizeRoomPlanePoint(point,fallback){
    return {
      id:String(point?.id||fallback?.id||'A'),
      x:Number(point?.x??fallback?.x??0)||0,
      y:Number(point?.y??fallback?.y??0)||0,
      z:Number(point?.z??fallback?.z??0)||0
    };
  }

  function initPinchZoom(element,options={}){
    if(!element)return null;
    const pointers=new Map();
    const suppressed=new Set();
    let gesture=null;
    const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
    const stop=event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const pointerDown=event=>{
      if(event.pointerType!=='touch')return;
      if(!pointers.size)options.onFirstTouch?.(event);
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pointers.size<2||gesture)return;
      const ids=[...pointers.keys()].slice(0,2);
      const startDistance=distance(pointers.get(ids[0]),pointers.get(ids[1]));
      if(startDistance<1)return;
      gesture={ids,startDistance,startZoom:Number(options.getZoom?.())||1};
      ids.forEach(id=>{
        suppressed.add(id);
        try{element.setPointerCapture?.(id);}catch(_){/* Synthetic pointers and older Safari may not be capturable. */}
      });
      options.onStart?.(event);
      stop(event);
    };
    const pointerMove=event=>{
      if(event.pointerType!=='touch'||!pointers.has(event.pointerId))return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(!suppressed.has(event.pointerId)||!gesture)return;
      const [first,second]=gesture.ids.map(id=>pointers.get(id));
      if(first&&second){
        const scale=distance(first,second)/gesture.startDistance;
        const min=Number.isFinite(options.min)?options.min:0.25;
        const max=Number.isFinite(options.max)?options.max:8;
        const zoom=Math.max(min,Math.min(max,gesture.startZoom*scale));
        options.onZoom?.(zoom,{scale,event});
      }
      stop(event);
    };
    const pointerEnd=event=>{
      if(event.pointerType!=='touch'&&!pointers.has(event.pointerId))return;
      const wasSuppressed=suppressed.has(event.pointerId);
      const endedGesture=gesture&&gesture.ids.includes(event.pointerId);
      pointers.delete(event.pointerId);
      suppressed.delete(event.pointerId);
      if(endedGesture){
        gesture=null;
        options.onEnd?.(event);
      }
      if(!pointers.size)suppressed.clear();
      if(wasSuppressed)stop(event);
    };
    element.addEventListener('pointerdown',pointerDown,true);
    element.addEventListener('pointermove',pointerMove,true);
    element.addEventListener('pointerup',pointerEnd,true);
    element.addEventListener('pointercancel',pointerEnd,true);
    return {
      isPinching:()=>!!gesture,
      destroy(){
        element.removeEventListener('pointerdown',pointerDown,true);
        element.removeEventListener('pointermove',pointerMove,true);
        element.removeEventListener('pointerup',pointerEnd,true);
        element.removeEventListener('pointercancel',pointerEnd,true);
        pointers.clear();
        suppressed.clear();
        gesture=null;
      }
    };
  }

  function normalizeRoomPlaneFixture(fixture,index){
    return {
      id:fixture?.id,
      name:String(fixture?.name||('Fixture '+(index+1))),
      x:Number(fixture?.x)||0,
      y:Number(fixture?.y)||0,
      z:Number(fixture?.z)||0,
      cal:fixture?.cal&&typeof fixture.cal==='object'?fixture.cal:{}
    };
  }

  function normalizeRoomPlane(plane,index){
    const fallbackPoints=[{id:'A',x:0,y:0,z:0},{id:'B',x:5,y:0,z:0},{id:'C',x:0,y:3,z:0}];
    const sourcePoints=Array.isArray(plane?.points)?plane.points:[];
    return {
      ...plane,
      id:plane?.id||('plane_'+index),
      name:String(plane?.name||('Plane '+(index+1))),
      points:fallbackPoints.map((fallback,i)=>normalizeRoomPlanePoint(sourcePoints[i],fallback)),
      target:{x:Number(plane?.target?.x??2.5)||0,y:Number(plane?.target?.y??1.5)||0,z:Number(plane?.target?.z??0)||0},
      fixtures:(Array.isArray(plane?.fixtures)?plane.fixtures:[]).map(normalizeRoomPlaneFixture),
      view:{
        auto:plane?.view?.auto!==false,
        centerX:Number(plane?.view?.centerX)||0,
        centerY:Number(plane?.view?.centerY)||0,
        zoom:Math.max(0.25,Math.min(8,Number(plane?.view?.zoom)||1))
      },
      visual:plane?.visual
    };
  }

  function roomPlaneWeights(plane,target=plane?.target){
    const [a,b,c]=plane?.points||[];
    if(!a||!b||!c||!target)return {valid:false,wA:0,wB:0,wC:0};
    const det=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if(Math.abs(det)<1e-9)return {valid:false,wA:0,wB:0,wC:0};
    const wA=((b.y-c.y)*(target.x-c.x)+(c.x-b.x)*(target.y-c.y))/det;
    const wB=((c.y-a.y)*(target.x-c.x)+(a.x-c.x)*(target.y-c.y))/det;
    return {valid:true,wA,wB,wC:1-wA-wB};
  }

  function roomPlaneInterpolateFixture(plane,fixture,weights){
    if(!weights?.valid)return null;
    const ids=(plane?.points||[]).map(point=>point.id);
    if(ids.length<3||ids.some(id=>!fixture?.cal?.[id]?.calibrated))return null;
    return {
      pan:weights.wA*fixture.cal[ids[0]].pan+weights.wB*fixture.cal[ids[1]].pan+weights.wC*fixture.cal[ids[2]].pan,
      tilt:weights.wA*fixture.cal[ids[0]].tilt+weights.wB*fixture.cal[ids[1]].tilt+weights.wC*fixture.cal[ids[2]].tilt
    };
  }

  function roomPlaneAutoBounds(plane){
    const points=Array.isArray(plane?.points)?plane.points:[];
    const fixtures=Array.isArray(plane?.fixtures)?plane.fixtures:[];
    const target=plane?.target||{x:0,y:0};
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    xs.push(target.x,...fixtures.map(f=>f.x));
    ys.push(target.y,...fixtures.map(f=>f.y));
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const padX=Math.max(1,(maxX-minX)*0.15),padY=Math.max(1,(maxY-minY)*0.15);
    return {minX:minX-padX,maxX:maxX+padX,minY:minY-padY,maxY:maxY+padY};
  }

  function initSavedPlaneToolbox(options){
    const maxGrid=options.maxGrid||16;
    let moveMode=false;
    let moveSelectedSlot=null;
    const getPlanes=()=>Array.isArray(options.getPlanes?.())?options.getPlanes():[];
    const setPlanes=planes=>options.setPlanes?.(Array.isArray(planes)?planes:[]);
    const getCols=()=>Math.max(1,Math.min(maxGrid,parseInt(options.getCols?.(),10)||options.defaultCols||3));
    const getRows=()=>Math.max(1,Math.min(maxGrid,parseInt(options.getRows?.(),10)||options.defaultRows||3));
    const setCols=value=>options.setCols?.(value);
    const setRows=value=>options.setRows?.(value);
    const status=(text,bad=false)=>options.onStatus?.(text,bad);
    const normalizePlane=options.normalizePlane||normalizeRoomPlane;
    const slotOf=(plane,index)=>{
      const slot=parseInt(plane?.slot,10);
      return Number.isFinite(slot)&&slot>=0?slot:index;
    };
    const indexAtSlot=slot=>getPlanes().findIndex((plane,index)=>slotOf(plane,index)===slot);
    const normalizeGrid=(priority='cols')=>{
      const planes=getPlanes();
      let cols=getCols(),rows=getRows();
      const maxSlot=planes.reduce((max,plane,index)=>Math.max(max,slotOf(plane,index)),-1);
      const needed=Math.max(planes.length,maxSlot+1);
      if(needed&&cols*rows<needed){
        if(priority==='rows'){
          cols=Math.max(cols,Math.ceil(needed/rows));
          if(cols>maxGrid){cols=maxGrid;rows=Math.ceil(needed/cols);}
        }else{
          rows=Math.max(rows,Math.ceil(needed/cols));
          if(rows>maxGrid){rows=maxGrid;cols=Math.ceil(needed/rows);}
        }
      }
      cols=Math.max(1,Math.min(maxGrid,cols));
      rows=Math.max(1,Math.min(maxGrid,rows));
      setCols(cols);setRows(rows);
      const colsInput=document.getElementById(options.colsId);
      const rowsInput=document.getElementById(options.rowsId);
      if(colsInput){colsInput.min=Math.max(1,Math.ceil(Math.max(needed,1)/rows));colsInput.value=cols;}
      if(rowsInput){rowsInput.min=Math.max(1,Math.ceil(Math.max(needed,1)/cols));rowsInput.value=rows;}
      return {cols,rows,needed};
    };
    const payload=()=>options.savePayload?.()||versionedPayload({planes:getPlanes(),planeCols:getCols(),planeRows:getRows()});
    const save=async(statusText='Plane layout saved')=>{
      if(!isHttp())return false;
      const response=await fetch(options.fetchUrl||'room_plane_setup.php',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload())
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.ok)throw new Error(data.error||('HTTP '+response.status));
      status(statusText);
      return true;
    };
    const scheduleSave=(statusText='Plane layout saved')=>save(statusText).catch(error=>status('Planes save failed: '+error.message,true));
    const move=(fromSlot,toSlot)=>{
      const planes=getPlanes();
      const fromIndex=indexAtSlot(fromSlot);
      if(fromIndex<0||fromSlot===toSlot)return false;
      const toIndex=indexAtSlot(toSlot);
      planes[fromIndex].slot=toSlot;
      if(toIndex>=0)planes[toIndex].slot=fromSlot;
      moveSelectedSlot=null;
      normalizeGrid('cols');
      render();
      scheduleSave('Moved plane to slot '+(toSlot+1));
      return true;
    };
    const handleClick=slot=>{
      const planes=getPlanes();
      const index=indexAtSlot(slot);
      const plane=index>=0?planes[index]:null;
      if(moveMode){
        if(moveSelectedSlot===null){
          if(!plane)return;
          moveSelectedSlot=slot;
          render();
          status('Select a destination slot for '+plane.name);
          return;
        }
        if(move(moveSelectedSlot,slot))return;
        moveSelectedSlot=null;
        render();
        return;
      }
      if(plane)options.onOpen?.(plane,slot);
      else if(options.onEmptySlot)options.onEmptySlot(slot);
      else status('Plane slot '+(slot+1)+' is empty');
    };
    const toggleMove=()=>{
      moveMode=!moveMode;
      moveSelectedSlot=null;
      render();
      status(moveMode?'Plane move mode enabled':'Plane move mode disabled');
    };
    function render(){
      const host=document.getElementById(options.matrixId);
      if(!host)return;
      const {cols,rows}=normalizeGrid('cols');
      const moveBtn=document.getElementById(options.moveButtonId);
      if(moveBtn){
        moveBtn.classList.toggle('active',moveMode);
        moveBtn.setAttribute('aria-pressed',moveMode?'true':'false');
      }
      host.classList.toggle('tile-move-mode',moveMode);
      host.style.gridTemplateColumns='repeat('+cols+',minmax(64px,1fr))';
      const planes=getPlanes();
      const slotAttr=options.slotAttribute||'';
      const idAttr=options.idAttribute||'';
      const slotData=slot=>slotAttr?' '+slotAttr+'="'+slot+'"':'';
      const idData=plane=>idAttr?' '+idAttr+'="'+escapeHtml(String(plane.id))+'"':'';
      let html='';
      for(let i=0,total=cols*rows;i<total;i++){
        const planeIndex=indexAtSlot(i);
        const plane=planeIndex>=0?planes[planeIndex]:null;
        if(!plane){
          html+='<div class="slot readonly" data-plane-slot="'+i+'"'+slotData(i)+' title="'+(moveMode?'Drop a plane here':'Empty plane slot')+'">'+(i+1)+'</div>';
          continue;
        }
        const visualPlane={...plane,visual:normalizeSlotVisual(plane.visual)||{type:'visual',color:options.defaultColor||'#225a50',image:''}};
        const activeClass=moveSelectedSlot===i?' active':'';
        const isActive=String(options.activeId?.()||'')===String(plane.id);
        const summary=options.fixtureSummary?.(plane)||'';
        const editAttr=options.editAttribute||'data-plane-edit';
        const deleteAttr=options.deleteAttribute||'data-plane-delete';
        const edit=options.onEdit?slotVisualButtonHtml(editAttr,String(plane.id),'Edit plane tile'):'';
        const del=options.onDelete?'<button class="slot-del" '+deleteAttr+'="'+escapeHtml(String(plane.id))+'" title="Delete plane">×</button>':'';
        html+='<div class="'+savedTileClass('slot filled',isActive)+activeClass+'" data-plane-slot="'+i+'"'+slotData(i)+' data-plane-id="'+escapeHtml(String(plane.id))+'"'+idData(plane)+' title="'+(moveMode?'Move '+escapeHtml(plane.name):'Open '+escapeHtml(plane.name))+'" style="'+slotVisualStyle(visualPlane)+'">'+
          edit+del+
          '<div class="palette-slot-content">'+slotVisualHtml(visualPlane)+'<span class="palette-slot-name">'+escapeHtml(plane.name)+'</span>'+(summary?'<span class="controller-plane-slot-meta">'+escapeHtml(summary)+'</span>':'')+'</div>'+
        '</div>';
      }
      host.innerHTML=html;
      host.querySelectorAll('[data-plane-slot]').forEach(tile=>tile.addEventListener('click',()=>handleClick(parseInt(tile.dataset.planeSlot,10)||0)));
      const editSelector=options.editAttribute?'['+options.editAttribute+']':'[data-plane-edit]';
      const deleteSelector=options.deleteAttribute?'['+options.deleteAttribute+']':'[data-plane-delete]';
      host.querySelectorAll(editSelector).forEach(button=>button.addEventListener('click',event=>{
        event.stopPropagation();
        options.onEdit?.(button.getAttribute(options.editAttribute||'data-plane-edit'));
      }));
      host.querySelectorAll(deleteSelector).forEach(button=>button.addEventListener('click',event=>{
        event.stopPropagation();
        options.onDelete?.(button.getAttribute(options.deleteAttribute||'data-plane-delete'));
      }));
      initTileMoveGrid({
        grid:host,
        button:options.moveButtonId,
        active:moveMode,
        itemSelector:'[data-plane-slot]',
        getIndex:el=>parseInt(el.dataset.planeSlot,10),
        canDrag:(idx,el)=>el.hasAttribute('data-plane-id'),
        onMove:move
      });
    }
    async function load(){
      try{
        const response=await fetch(options.fetchUrl||'room_plane_setup.php',{cache:'no-store'});
        const data=await response.json();
        if(!response.ok||data.ok===false)throw new Error(data.error||('HTTP '+response.status));
        options.onSetupLoaded?.(data);
        const planes=Array.isArray(data.planes)?data.planes:(Array.isArray(data.setup?.planes)?data.setup.planes:[]);
        setPlanes(planes.map(normalizePlane));
        setCols(Math.max(1,Math.min(maxGrid,parseInt(data.planeCols??data.setup?.planeCols??options.defaultCols??3,10)||options.defaultCols||3)));
        setRows(Math.max(1,Math.min(maxGrid,parseInt(data.planeRows??data.setup?.planeRows??options.defaultRows??3,10)||options.defaultRows||3)));
        render();
        return true;
      }catch(error){
        setPlanes([]);
        render();
        status('Saved planes unavailable: '+error.message,true);
        return false;
      }
    }
    document.getElementById(options.colsId)?.addEventListener('input',event=>{
      setCols(event.target.value);
      normalizeGrid('cols');
      render();
      scheduleSave('Plane layout saved');
    });
    document.getElementById(options.rowsId)?.addEventListener('input',event=>{
      setRows(event.target.value);
      normalizeGrid('rows');
      render();
      scheduleSave('Plane layout saved');
    });
    const moveButton=document.getElementById(options.moveButtonId);
    if(moveButton)moveButton.onclick=toggleMove;
    return {load,render,save,move,normalizeGrid,indexAtSlot,slotOf,get moveMode(){return moveMode;}};
  }

  function panTiltMax(control){
    return control?.type==='panTilt16'?65535:255;
  }

  function panTiltDefault(control){
    const max=panTiltMax(control);
    return {pan:Math.round(max/2),tilt:Math.round(max/2)};
  }

  function panTiltAxisValue(control,value,axis){
    const fallback=panTiltDefault(control);
    const source=value&&typeof value==='object'?value:fallback;
    const max=panTiltMax(control);
    return Math.max(0,Math.min(max,Math.round(parseFloat(source[axis]??fallback[axis])||0)));
  }

  function panTiltPhysicalAxis(control,logicalAxis){
    const swapped=!!control?.panTiltSwap;
    if(logicalAxis==='pan')return swapped?'tilt':'pan';
    return swapped?'pan':'tilt';
  }

  function panTiltAxisReversed(control,logicalAxis){
    return logicalAxis==='pan'?!!control?.panReverse:!!control?.tiltReverse;
  }

  function panTiltAxisMeta(control,physicalAxis){
    if(physicalAxis==='pan')return {coarse:control?.pan,fine:control?.panFine??(control?.pan||0)+1,label:'Pan'};
    return {coarse:control?.tilt,fine:control?.tiltFine??(control?.tilt||0)+1,label:'Tilt'};
  }

  function panTiltDmxRows(control,value,absoluteFn){
    if(!control||!(control.type==='panTilt16'||control.type==='panTilt8'))return[];
    const abs=typeof absoluteFn==='function'?absoluteFn:((rel)=>rel);
    const max=panTiltMax(control);
    const rows=[];
    ['pan','tilt'].forEach(logicalAxis=>{
      const physicalAxis=panTiltPhysicalAxis(control,logicalAxis);
      const meta=panTiltAxisMeta(control,physicalAxis);
      let logicalValue=panTiltAxisValue(control,value,logicalAxis);
      if(panTiltAxisReversed(control,logicalAxis))logicalValue=max-logicalValue;
      const logicalLabel=logicalAxis==='pan'?'Pan':'Tilt';
      const mappingSuffix=control.panTiltSwap?' -> '+meta.label:'';
      const reverseSuffix=panTiltAxisReversed(control,logicalAxis)?' reversed':'';
      if(control.type==='panTilt16'){
        const coarse=Math.floor(logicalValue/256);
        const fine=logicalValue%256;
        rows.push({ch:abs(meta.coarse),rel:meta.coarse,val:coarse,param:logicalLabel+' coarse'+mappingSuffix+reverseSuffix,logicalAxis,physicalAxis,part:'coarse'});
        rows.push({ch:abs(meta.fine),rel:meta.fine,val:fine,param:logicalLabel+' fine'+mappingSuffix+reverseSuffix,logicalAxis,physicalAxis,part:'fine'});
      }else{
        rows.push({ch:abs(meta.coarse),rel:meta.coarse,val:logicalValue,param:logicalLabel+mappingSuffix+reverseSuffix,logicalAxis,physicalAxis,part:'value'});
      }
    });
    return rows;
  }

  function panTiltValueFromDmx(control,readRel){
    if(!control||!(control.type==='panTilt16'||control.type==='panTilt8'))return panTiltDefault(control);
    const max=panTiltMax(control);
    const value={};
    ['pan','tilt'].forEach(logicalAxis=>{
      const physicalAxis=panTiltPhysicalAxis(control,logicalAxis);
      const meta=panTiltAxisMeta(control,physicalAxis);
      let dmxValue;
      if(control.type==='panTilt16'){
        const coarse=readRel(meta.coarse)??0;
        const fine=readRel(meta.fine)??0;
        dmxValue=((coarse&255)<<8)|(fine&255);
      }else{
        dmxValue=readRel(meta.coarse)??Math.round(max/2);
      }
      value[logicalAxis]=panTiltAxisReversed(control,logicalAxis)?max-dmxValue:dmxValue;
    });
    return value;
  }

  function ensurePanTiltDimmerEditorModal(){
    let modal=document.getElementById('commonPanTiltDimmerModal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='commonPanTiltDimmerModal';
    modal.className='modal-overlay';
    modal.style.display='none';
    modal.innerHTML=[
      '<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="commonPanTiltDimmerTitle">',
      '  <div class="modal-head">',
      '    <button type="button" data-ptd-close aria-label="Close">x</button>',
      '    <h2 id="commonPanTiltDimmerTitle">Edit Fixture Control</h2>',
      '  </div>',
      '  <div class="modal-body">',
      '    <div class="xy-pad" data-ptd-xy><div class="xy-dot" data-ptd-dot></div></div>',
      '    <div class="row"><span class="readout" data-ptd-position-readout></span><button type="button" data-ptd-center>Center Pan/Tilt</button></div>',
      '    <div class="grid2" data-ptd-relative></div>',
      '    <label>Dimmer<input type="range" min="0" max="255" data-ptd-dimmer-range></label>',
      '    <label>Dimmer value<input type="number" min="0" max="255" data-ptd-dimmer></label>',
      '    <div class="small" data-ptd-readout></div>',
      '  </div>',
      '  <div class="modal-actions">',
      '    <span data-ptd-extra-actions></span>',
      '    <button type="button" data-ptd-close>Close</button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-ptd-close]').forEach(btn=>btn.addEventListener('click',()=>closePanTiltDimmerEditor(modal)));
    return modal;
  }

  function closePanTiltDimmerEditor(modal){
    const el=modal||document.getElementById('commonPanTiltDimmerModal');
    if(!el)return;
    hideModal(el);
    const onClose=el._dmxPanTiltDimmerOnClose;
    el._dmxPanTiltDimmerOnClose=null;
    if(typeof onClose==='function')onClose();
  }

  function openPanTiltDimmerEditor(options){
    const modal=ensurePanTiltDimmerEditorModal();
    const max=Math.max(1,Math.round(Number(options?.max)||255));
    const title=modal.querySelector('#commonPanTiltDimmerTitle');
    const pad=modal.querySelector('[data-ptd-xy]');
    const dot=modal.querySelector('[data-ptd-dot]');
    const positionReadout=modal.querySelector('[data-ptd-position-readout]');
    const centerBtn=modal.querySelector('[data-ptd-center]');
    const relativeHost=modal.querySelector('[data-ptd-relative]');
    const dimmerRange=modal.querySelector('[data-ptd-dimmer-range]');
    const dimmerInput=modal.querySelector('[data-ptd-dimmer]');
    const readout=modal.querySelector('[data-ptd-readout]');
    const extraActions=modal.querySelector('[data-ptd-extra-actions]');
    const onChange=typeof options?.onChange==='function'?options.onChange:()=>{};
    const onAction=typeof options?.onAction==='function'?options.onAction:()=>{};
    modal._dmxPanTiltDimmerOnClose=typeof options?.onClose==='function'?options.onClose:null;
    let value={
      pan:clampInt(options?.value?.pan??Math.round(max/2),0,max),
      tilt:clampInt(options?.value?.tilt??Math.round(max/2),0,max),
      dimmer:clampInt(options?.value?.dimmer??255,0,255)
    };
    title.textContent=options?.title||'Edit Fixture Control';
    const actions=Array.isArray(options?.actions)?options.actions:[];
    extraActions.innerHTML=actions.map(action=>{
      const classes=[action.primary?'primary':'',action.className||''].filter(Boolean).join(' ');
      return '<button type="button" data-ptd-action="'+escapeHtml(action.id||action.label||'')+'" '+(classes?'class="'+escapeHtml(classes)+'"':'')+'>'+escapeHtml(action.label||action.id||'Action')+'</button>';
    }).join('');
    extraActions.onclick=event=>{
      const btn=event.target.closest('[data-ptd-action]');
      if(!btn)return;
      onAction(btn.dataset.ptdAction,{...value},{
        button:btn,
        getValue:()=>({...value}),
        setValue(next,{emitChange=true}={}){
          value={
            pan:clampInt(next?.pan??value.pan,0,max),
            tilt:clampInt(next?.tilt??value.tilt,0,max),
            dimmer:clampInt(next?.dimmer??value.dimmer,0,255)
          };
          renderEditor();
          if(emitChange)emit();
        }
      });
    };
    const is16=max>255;
    relativeHost.innerHTML=is16
      ? [
        relativeControlHtml('pan','Pan coarse relative',256,max),
        relativeControlHtml('pan','Pan fine relative',1,max),
        relativeControlHtml('tilt','Tilt coarse relative',256,max),
        relativeControlHtml('tilt','Tilt fine relative',1,max)
      ].join('')
      : [
        relativeControlHtml('pan','Pan relative',1,max),
        relativeControlHtml('tilt','Tilt relative',1,max)
      ].join('');

    function relativeControlHtml(axis,label,step,limit){
      return '<div class="relative-control">'+
        '<button type="button" data-ptd-relative-dir="-1" data-ptd-axis="'+axis+'" title="Decrease relative to the current value">-</button>'+
        '<label>'+escapeHtml(label)+'<input type="number" min="1" max="'+limit+'" step="'+step+'" value="'+step+'" data-ptd-relative-step data-ptd-axis="'+axis+'"></label>'+
        '<button type="button" data-ptd-relative-dir="1" data-ptd-axis="'+axis+'" title="Increase relative to the current value">+</button>'+
      '</div>';
    }

    function emit(){
      onChange({...value});
    }
    function renderEditor(){
      dimmerRange.value=String(value.dimmer);
      dimmerInput.value=String(value.dimmer);
      dot.style.left=(value.pan/max*100)+'%';
      dot.style.top=(100-value.tilt/max*100)+'%';
      positionReadout.textContent='Pan '+value.pan+' · Tilt '+value.tilt;
      readout.textContent='Pan '+value.pan+' / Tilt '+value.tilt+' / Dimmer '+value.dimmer;
    }
    function setFromPad(event){
      const rect=pad.getBoundingClientRect();
      const x=Math.max(0,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width)));
      const y=Math.max(0,Math.min(1,(event.clientY-rect.top)/Math.max(1,rect.height)));
      value.pan=clampInt(Math.round(x*max),0,max);
      value.tilt=clampInt(Math.round((1-y)*max),0,max);
      renderEditor();
      emit();
    }
    centerBtn.onclick=()=>{
      value.pan=Math.round(max/2);
      value.tilt=Math.round(max/2);
      renderEditor();
      emit();
    };
    relativeHost.onclick=event=>{
      const btn=event.target.closest('[data-ptd-relative-dir]');
      if(!btn)return;
      const axis=btn.dataset.ptdAxis;
      if(axis!=='pan'&&axis!=='tilt')return;
      const stepInput=btn.closest('.relative-control')?.querySelector('[data-ptd-relative-step]');
      const step=Math.max(1,Math.round(Number(stepInput?.value)||1));
      const dir=parseInt(btn.dataset.ptdRelativeDir,10)<0?-1:1;
      value[axis]=clampInt(value[axis]+dir*step,0,max);
      renderEditor();
      emit();
    };
    dimmerRange.oninput=()=>{
      value.dimmer=clampInt(dimmerRange.value,0,255);
      renderEditor();
      emit();
    };
    dimmerInput.oninput=()=>{
      value.dimmer=clampInt(dimmerInput.value,0,255);
      renderEditor();
      emit();
    };
    pad.onpointerdown=event=>{
      event.preventDefault();
      pad.setPointerCapture?.(event.pointerId);
      setFromPad(event);
      pad.onpointermove=setFromPad;
      pad.onpointerup=pad.onpointercancel=()=>{
        pad.releasePointerCapture?.(event.pointerId);
        pad.onpointermove=null;
        pad.onpointerup=null;
        pad.onpointercancel=null;
      };
    };
    renderEditor();
    showModal(modal);
    return {close:()=>closePanTiltDimmerEditor(modal),value:()=>({...value})};
  }

  window.DmxCommon={
    BASE_URL_KEY,
    APP_VERSION,
    isHttp,
    escapeHtml,
    appVersion,
    versionedPayload,
    normalizeDmxOutput,
    normalizeDmxOutputs,
    dmxOutputForFixture,
    dmxOutputEndpoint,
    dmxOutputsForFixtures,
    sendFixtureDmxRows,
    requestDmxOutputs,
    linkedPlaybackMembersForFixtures,
    uploadLinkedPicoPlayback,
    commandLinkedPicoPlayback,
    showUsedDmxOutputs,
    checkPicoFleetOutput,
    refreshPicoFleetStatus,
    initAdaptiveHeader,
    normalizePixelMatrix,
    normalizePixelMatrices,
    recallPixelMatrix,
    pixelMatrixImageColors,
    pixelMatrixToolboxHtml,
    mountPixelMatrixToolbox,
    initPixelMatrixEditor,
    downloadJson,
    zipJsonBytes,
    unzipJsonBytes,
    downloadZipJson,
    fetchFixtureLiveValues,
    mergeFixtureLiveValues,
    feedbackButton,
    restoreButtonFeedback,
    withButtonFeedback,
    selectableCardClass,
    savedTileClass,
    setSelectableState,
    clampInt,
    clampFloat,
    fanOrderedFixtures,
    fanOutToolboxHtml,
    mountFanOutToolbox,
    createFanOutController,
    wheelOptionRange,
    hexByte,
    rgbHex,
    cmyHex,
    cmykHex,
    hexToRgb,
    rgbToCmy,
    rgbToCmyk,
    wheelOptionIconHtml,
    wheelOptionValue,
    wheelOptionMatches,
    selectedWheelOption,
    wheelOptionTitle,
    wheelOptionIsAdjustable,
    wheelOptionRangeLabel,
    wheelOptionRangeText,
    wheelRangeSliderHtml,
    fixtureGroupEditParts,
    createGroupEditRelativeStepStore,
    fixtureGroupEditControlHtml,
    updateFixtureGroupEditWheelRangeHost,
    applyBaseUrl,
    bindBaseUrl,
    discoverPicoBaseUrl,
    discoverPicoDevices,
    preferStoredBaseUrl,
    saveUiState,
    loadUiState,
    saveSharedGroupSelection,
    loadSharedGroupSelection,
    initToolboxRail,
    initToolboxCollapseGroup,
    initFloatingToolbox,
    mountTileLayoutControls,
    initGroupsToolbox,
    normalizeSlotVisual,
    normalizeSlotVisualDefault,
    slotVisualStyle,
    slotVisualHtml,
    slotVisualButtonHtml,
    initTileMoveGrid,
    initPinchZoom,
    normalizeRoomPlane,
    roomPlaneWeights,
    roomPlaneInterpolateFixture,
    roomPlaneAutoBounds,
    initSavedPlaneToolbox,
    panTiltMax,
    panTiltDefault,
    panTiltDmxRows,
    panTiltValueFromDmx,
    openPanTiltDimmerEditor,
    closePanTiltDimmerEditor,
    showModal,
    hideModal,
    initSlotVisualEditor
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initAdaptiveHeader,{once:true});
  else setTimeout(initAdaptiveHeader,0);
})();
