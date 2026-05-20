(function(){
  'use strict';

  const BASE_URL_KEY='dmxPicoBaseUrl';

  function isHttp(){
    return location.protocol==='http:'||location.protocol==='https:';
  }

  function escapeHtml(value){
    return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function clampInt(value,min,max){
    const n=parseInt(value||0,10);
    return Math.max(min,Math.min(max,isNaN(n)?min:n));
  }

  function clampFloat(value,min,max){
    const n=parseFloat(value);
    return Math.max(min,Math.min(max,isNaN(n)?min:n));
  }

  function applyBaseUrl(input,fallback=''){
    if(!input)return '';
    input.value=localStorage.getItem(BASE_URL_KEY)||fallback||'';
    return input.value;
  }

  function bindBaseUrl(input,options={}){
    if(!input)return;
    applyBaseUrl(input,options.fallback);
    let timer=0;
    input.addEventListener('input',()=>{
      localStorage.setItem(BASE_URL_KEY,input.value);
      if(typeof options.onInput!=='function')return;
      clearTimeout(timer);
      const wait=Number.isFinite(options.debounceMs)?options.debounceMs:0;
      timer=setTimeout(()=>options.onInput(input.value),wait);
    });
  }

  function preferStoredBaseUrl(input,fallback=''){
    if(!input)return '';
    input.value=localStorage.getItem(BASE_URL_KEY)||fallback||'';
    return input.value;
  }

  function saveUiState(page,key,val){
    if(!isHttp())return;
    fetch('ui_state.php',{method:'POST',headers:{'Content-Type':'application/json'},
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

    function clampBox(){
      if(!box)return;
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
      box.style.left=(parseInt(pos.x)||0)+'px';
      box.style.top=(parseInt(pos.y)||0)+'px';
      box.style.right='auto';
      clampBox();
    }

    function applySize(size){
      if(!box||!size)return;
      const w=parseInt(size.w||size.width);
      const h=parseInt(size.h||size.height);
      if(w)box.style.width=Math.max(minWidth,w)+'px';
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

    function setCollapsed(collapsed,save){
      if(!box)return;
      const c=!!collapsed;
      if(c&&!box.classList.contains('collapsed')){
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
          box.style.resize='both';
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
    }

    if(box&&posKey){
      try{applyPosition(JSON.parse(localStorage.getItem(posKey)||'null'));}catch(_){}
    }
    if(box&&sizeKey){
      try{applySize(JSON.parse(localStorage.getItem(sizeKey)||'null'));}catch(_){}
    }
    if(collapsedKey&&localStorage.getItem(collapsedKey)==='1')setCollapsed(true,false);

    if(box&&header){
      header.addEventListener('pointerdown',e=>{
        if(e.target.closest('button'))return;
        header.setPointerCapture(e.pointerId);
        const r=box.getBoundingClientRect();
        dragOffset={x:e.clientX-r.left,y:e.clientY-r.top};
        header.style.cursor='grabbing';
      });
      header.addEventListener('pointermove',e=>{
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

    if(toggle)toggle.addEventListener('click',()=>setCollapsed(!box.classList.contains('collapsed'),true));

    return {box,header,toggle,clamp:clampBox,applyPosition,applySize,setCollapsed};
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
    const importFileId=idPrefix+'ImportFile';
    const statePrefix=idPrefix;
    let groups=[];
    let selectedIds=new Set();
    let cols=parseInt(localStorage.getItem(statePrefix+'Cols'))||2;
    let rows=parseInt(localStorage.getItem(statePrefix+'Rows'))||4;

    const box=document.createElement('div');
    box.id=boxId;
    box.className='scene-toolbox scene-toolbox--groups';
    box.innerHTML=`
      <div id="${headerId}" class="scene-toolbox__header">
        <span style="font-weight:700;font-size:13px">${escapeHtml(title)}</span>
        <button id="${toggleId}" class="scene-toolbox__toggle">—</button>
      </div>
      <div class="scene-toolbox__body">
        <div class="groups-toolbar">
          <button id="${idPrefix}Export" class="icon-btn export-btn" title="Export groups JSON"></button>
          <button id="${idPrefix}Import" class="icon-btn import-btn" title="Import groups JSON"></button>
          <button id="${idPrefix}Rename" class="icon-btn" title="Rename selected group">Aa</button>
          <button id="${idPrefix}Delete" class="icon-btn danger" title="Delete selected groups">×</button>
          ${showEdit?`<button id="${idPrefix}Edit" class="primary groups-edit-btn" title="Edit selected groups">Group<br>Edit</button>`:''}
          <input id="${importFileId}" type="file" accept=".json,application/json" style="display:none">
          <div class="groups-layout-controls">
            <label style="display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted)">Cols<input id="${colsId}" type="number" min="1" max="8" value="2" style="width:52px;padding:6px"></label>
            <label style="display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted)">Rows<input id="${rowsId}" type="number" min="1" max="12" value="4" style="width:52px;padding:6px"></label>
          </div>
        </div>
        <div id="${listId}" class="list groups-matrix"><div class="small">No saved groups yet.</div></div>
      </div>`;
    host.appendChild(box);

    const toolbox=initFloatingToolbox({
      boxId,headerId,toggleId,
      posStorageKey:statePrefix+'Pos',
      collapsedStorageKey:statePrefix+'Collapsed',
      uiStatePage:page,
      uiStatePosKey:statePrefix+'Pos',
      uiStateCollapsedKey:statePrefix+'Collapsed'
    });

    function key(g,i){return g.id||('idx_'+i);}
    function selectedGroups(){return groups.filter((g,i)=>selectedIds.has(key(g,i)));}
    function clampLayout(priority='cols'){
      const count=groups.length;
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
      if(list)list.style.gridTemplateColumns='repeat('+cols+',minmax(170px,1fr))';
      if(box){
        const width=Math.max(280,cols*178+24);
        box.style.width=Math.min(Math.max(280,window.innerWidth-24),width)+'px';
      }
      const colsInput=document.getElementById(colsId);
      const rowsInput=document.getElementById(rowsId);
      if(colsInput){
        colsInput.min=Math.max(1,Math.ceil(groups.length/rows));
        colsInput.value=cols;
      }
      if(rowsInput){
        rowsInput.min=Math.max(1,Math.ceil(groups.length/cols));
        rowsInput.value=rows;
      }
    }
    function saveLayout(priority='cols'){
      clampLayout(priority);
      localStorage.setItem(statePrefix+'Cols',cols);
      localStorage.setItem(statePrefix+'Rows',rows);
      saveUiState(page,statePrefix+'Cols',cols);
      saveUiState(page,statePrefix+'Rows',rows);
    }
    function updateActions(){
      const selected=selectedGroups();
      const rename=document.getElementById(idPrefix+'Rename');
      const del=document.getElementById(idPrefix+'Delete');
      const edit=document.getElementById(idPrefix+'Edit');
      if(rename)rename.disabled=selected.length!==1;
      if(del)del.disabled=selected.length===0;
      if(edit)edit.disabled=selected.length===0||!options.canEdit?.(selected);
    }
    function notify(){
      options.onSelectionChange?.(selectedGroups(),groups);
      updateActions();
    }
    function render(){
      const list=document.getElementById(listId);
      if(!list)return;
      applyLayout();
      if(!groups.length){
        list.innerHTML='<div class="small">No saved groups yet.</div>';
        updateActions();
        return;
      }
      const total=cols*rows;
      let html='';
      for(let i=0;i<total;i++){
        const g=groups[i];
        if(!g){html+='<div class="group-empty" title="Empty group slot"></div>';continue;}
        const active=selectedIds.has(key(g,i));
        html+=`<div class="item${active?' active':''}" data-group-index="${i}" title="Select or deselect group">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong>${escapeHtml(g.name||('Group '+(i+1)))}</strong><span class="small">${(g.fixtureIds||[]).length} fixture${(g.fixtureIds||[]).length!==1?'s':''}</span></div>
        </div>`;
      }
      list.innerHTML=html;
      updateActions();
    }
    async function saveGroups(){
      try{
        const r=await fetch('group_setup.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({baseUrl:options.baseUrlInput?.value||'',groups})});
        const j=await r.json();
        if(!j.ok)options.onStatus?.('Groups save failed: '+j.error,true);
      }catch(err){options.onStatus?.('Groups save error: '+err.message,true);}
    }
    async function loadGroups(){
      try{
        const d=await fetch('group_setup.php',{cache:'no-store'}).then(r=>r.json());
        if(d.baseUrl&&options.baseUrlInput&&!localStorage.getItem(BASE_URL_KEY))options.baseUrlInput.value=d.baseUrl;
        groups=Array.isArray(d.groups)?d.groups.map((g,i)=>({...g,id:g.id||('grp_'+Date.now()+'_'+i),fixtureIds:Array.isArray(g.fixtureIds)?g.fixtureIds:[],values:g.values||{}})):[];
      }catch(_){groups=[];}
      selectedIds.clear();
      render();
      notify();
    }
    function exportGroups(){
      const blob=new Blob([JSON.stringify({baseUrl:options.baseUrlInput?.value||'',groups},null,2)],{type:'application/json'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='dmx_groups.json';a.click();URL.revokeObjectURL(a.href);
    }
    function importGroups(file){
      const fr=new FileReader();
      fr.onload=e=>{
        try{
          const data=JSON.parse(e.target.result);
          if(!Array.isArray(data.groups))throw new Error('Expected {groups:[...]}');
          if(data.baseUrl&&options.baseUrlInput&&!localStorage.getItem(BASE_URL_KEY))options.baseUrlInput.value=data.baseUrl;
          groups=data.groups.map((g,i)=>({...g,id:g.id||('grp_'+Date.now()+'_'+i),fixtureIds:Array.isArray(g.fixtureIds)?g.fixtureIds:[],values:g.values||{}}));
          selectedIds.clear();render();notify();saveGroups();
          options.onStatus?.('Imported '+groups.length+' group(s)');
        }catch(err){options.onStatus?.('Import failed: '+err.message,true);}
      };
      fr.readAsText(file);
    }

    document.getElementById(listId).addEventListener('click',e=>{
      const item=e.target.closest('[data-group-index]');
      if(!item)return;
      const i=parseInt(item.dataset.groupIndex,10);
      const g=groups[i];if(!g)return;
      const k=key(g,i);
      if(selectedIds.has(k))selectedIds.delete(k);else selectedIds.add(k);
      render();notify();
    });
    document.getElementById(idPrefix+'Export').onclick=exportGroups;
    document.getElementById(idPrefix+'Import').onclick=()=>document.getElementById(importFileId).click();
    document.getElementById(importFileId).onchange=e=>{if(e.target.files[0])importGroups(e.target.files[0]);e.target.value='';};
    document.getElementById(idPrefix+'Rename').onclick=()=>{
      const selected=selectedGroups();if(selected.length!==1)return;
      const g=selected[0];
      const name=(prompt('Group name:',g.name||'Group')||'').trim();
      if(!name||name===g.name)return;
      g.name=name;render();saveGroups();
    };
    document.getElementById(idPrefix+'Delete').onclick=()=>{
      const selected=selectedGroups();if(!selected.length)return;
      const ids=new Set(selected.map(g=>g.id));
      if(!confirm('Delete '+selected.length+' selected group'+(selected.length===1?'':'s')+'?\n\n'+selected.map(g=>g.name).join(', ')))return;
      groups=groups.filter(g=>!ids.has(g.id));
      selectedIds.clear();render();notify();saveGroups();
    };
    const edit=document.getElementById(idPrefix+'Edit');
    if(edit)edit.onclick=()=>{const selected=selectedGroups();if(selected.length)options.onEdit?.(selected);};
    document.getElementById(colsId).addEventListener('input',e=>{cols=e.target.value;applyLayout('cols');render();saveLayout('cols');});
    document.getElementById(rowsId).addEventListener('input',e=>{rows=e.target.value;applyLayout('rows');render();saveLayout('rows');});
    loadUiState(page).then(st=>{
      if(st[statePrefix+'Collapsed']!==undefined)toolbox.setCollapsed(!!st[statePrefix+'Collapsed'],false);
      if(st[statePrefix+'Pos'])toolbox.applyPosition(st[statePrefix+'Pos']);
      if(st[statePrefix+'Cols']!==undefined)cols=st[statePrefix+'Cols'];
      if(st[statePrefix+'Rows']!==undefined)rows=st[statePrefix+'Rows'];
      render();
    }).catch(()=>{});
    loadGroups();
    function clearSelection(){
      if(!selectedIds.size)return;
      selectedIds.clear();
      render();
      notify();
    }
    return {box,toolbox,loadGroups,render,selectedGroups,clearSelection,get groups(){return groups;}};
  }

  window.DmxCommon={
    BASE_URL_KEY,
    isHttp,
    escapeHtml,
    clampInt,
    clampFloat,
    applyBaseUrl,
    bindBaseUrl,
    preferStoredBaseUrl,
    saveUiState,
    loadUiState,
    initFloatingToolbox,
    initGroupsToolbox
  };
})();
