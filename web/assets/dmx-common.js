(function(){
  'use strict';

  const BASE_URL_KEY='dmxPicoBaseUrl';
  const APP_VERSION='0.9.2';
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

  function downloadJson(filename,data){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=filename;
    a.click();
    URL.revokeObjectURL(a.href);
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
      if(box)rail.appendChild(box);
    });
  }

  function saveSharedToolboxOrder(rail){
    if(!rail)return;
    const order=Array.from(rail.querySelectorAll('.scene-toolbox[data-toolbox-type]'))
      .map(box=>box.dataset.toolboxType)
      .filter(Boolean);
    const merged=normalizeToolboxOrder(order,DEFAULT_TOOLBOX_ORDER);
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
    const max=Math.max(min,Math.min(760,window.innerWidth-toolboxRailMinMainWidth()));
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

  function initToolboxRailHeader(rail){
    if(!rail||rail.querySelector('.toolbox-rail-header'))return;
    const header=document.createElement('div');
    header.className='toolbox-rail-header';
    header.innerHTML='<span class="toolbox-rail-title">Toolboxes</span><button class="toolbox-rail-toggle" type="button" title="Hide toolboxes" aria-expanded="true">›</button>';
    rail.prepend(header);
    header.querySelector('.toolbox-rail-toggle').addEventListener('click',()=>{
      setToolboxRailCollapsed(rail,!rail.classList.contains('collapsed'),{save:true});
    });
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

  function configureToolboxRailDragHandle(box){
    if(!box)return;
    box.draggable=false;
    const header=box.querySelector('.scene-toolbox__header');
    if(!header)return;
    header.draggable=false;
    header.dataset.toolboxDragHandle='1';
    header.title=header.title||'Drag to reorder toolbox';
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
    initToolboxRailScrollGuard(rail);
    applySharedToolboxRailWidth().catch(()=>{});
    applySharedToolboxRailCollapsed(rail).catch(()=>{});
    (entries||[]).forEach(entry=>{
      const box=typeof entry.box==='string'?document.getElementById(entry.box):entry.box;
      if(!box)return;
      box.dataset.toolboxType=entry.type||box.id;
      configureToolboxRailDragHandle(box);
      rail.appendChild(box);
    });
    rail.querySelectorAll('.scene-toolbox[data-toolbox-type]').forEach(configureToolboxRailDragHandle);
    applySharedToolboxOrder(rail).catch(()=>{});
    if(rail.dataset.toolboxRailInit==='1')return {applyOrder:()=>applySharedToolboxOrder(rail),saveOrder:()=>saveSharedToolboxOrder(rail)};
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
      if(before)rail.insertBefore(dragging,target);
      else rail.insertBefore(dragging,target.nextSibling);
    };
    rail.addEventListener('pointerdown',e=>{
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
    return {applyOrder:()=>applySharedToolboxOrder(rail),saveOrder:()=>saveSharedToolboxOrder(rail)};
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
          const top=Math.max(0,box.offsetTop-12);
          rail.scrollTo({top,behavior:'auto'});
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
    const layoutPrefix=options.layoutStoragePrefix||'groupsBox';
    let groups=[];
    let selectedIds=new Set();
    let cols=parseInt(localStorage.getItem(layoutPrefix+'Cols')||localStorage.getItem(statePrefix+'Cols'))||2;
    let rows=parseInt(localStorage.getItem(layoutPrefix+'Rows')||localStorage.getItem(statePrefix+'Rows'))||4;

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
          <button id="${idPrefix}Export" class="icon-btn export-btn" title="Export groups JSON"></button>
          <button id="${idPrefix}Import" class="icon-btn import-btn" title="Import groups JSON"></button>
          <button id="${idPrefix}Rename" title="Rename selected group">Rename</button>
          <button id="${idPrefix}Delete" class="danger" title="Delete selected groups">Delete</button>
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
    function selectedGroups(){return groups.filter((g,i)=>selectedIds.has(key(g,i)));}
    function selectedGroupIds(){return selectedGroups().map(g=>g.id).filter(Boolean);}
    function applySharedSelection(ids){
      const wanted=new Set(normalizeGroupSelection(ids));
      selectedIds.clear();
      groups.forEach((g,i)=>{if(wanted.has(String(g.id)))selectedIds.add(key(g,i));});
    }
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
      const inRail=!!box?.closest('.toolbox-rail');
      if(list)list.style.gridTemplateColumns='repeat('+cols+','+(inRail?'minmax(0,1fr)':'minmax(170px,1fr)')+')';
      if(box&&!inRail){
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
      localStorage.setItem(layoutPrefix+'Cols',cols);
      localStorage.setItem(layoutPrefix+'Rows',rows);
      saveUiState('toolboxes',layoutPrefix+'Cols',cols);
      saveUiState('toolboxes',layoutPrefix+'Rows',rows);
    }
    function updateActions(){
      const selected=selectedGroups();
      const rename=document.getElementById(idPrefix+'Rename');
      const del=document.getElementById(idPrefix+'Delete');
      const edit=document.getElementById(idPrefix+'Edit');
      if(rename)rename.disabled=selected.length!==1;
      if(del)del.disabled=selected.length===0;
      if(edit){
        const requiresSelection=options.editRequiresSelection!==false;
        edit.disabled=(requiresSelection&&selected.length===0)||!options.canEdit?.(selected);
      }
    }
    function notify(){
      options.onSelectionChange?.(selectedGroups(),groups);
      updateActions();
    }
    function render(priority='cols'){
      const list=document.getElementById(listId);
      if(!list)return;
      applyLayout(priority);
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
        const r=await fetch('group_setup.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(versionedPayload({baseUrl:options.baseUrlInput?.value||'',groups}))});
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
      applySharedSelection(await loadSharedGroupSelection());
      render();
      notify();
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
          groups=data.groups.map((g,i)=>({...g,id:g.id||('grp_'+Date.now()+'_'+i),fixtureIds:Array.isArray(g.fixtureIds)?g.fixtureIds:[],values:g.values||{}}));
          selectedIds.clear();saveSharedGroupSelection([]);render('cols');notify();saveGroups();
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
      saveSharedGroupSelection(selectedGroupIds());
      render('cols');notify();
    });
    document.getElementById(idPrefix+'Export').onclick=exportGroups;
    document.getElementById(idPrefix+'Import').onclick=()=>document.getElementById(importFileId).click();
    document.getElementById(importFileId).onchange=e=>{if(e.target.files[0])importGroups(e.target.files[0]);e.target.value='';};
    document.getElementById(idPrefix+'Rename').onclick=()=>{
      const selected=selectedGroups();if(selected.length!==1)return;
      const g=selected[0];
      const name=(prompt('Group name:',g.name||'Group')||'').trim();
      if(!name||name===g.name)return;
      g.name=name;render('cols');saveGroups();
    };
    document.getElementById(idPrefix+'Delete').onclick=()=>{
      const selected=selectedGroups();if(!selected.length)return;
      const ids=new Set(selected.map(g=>g.id));
      if(!confirm('Delete '+selected.length+' selected group'+(selected.length===1?'':'s')+'?\n\n'+selected.map(g=>g.name).join(', ')))return;
      groups=groups.filter(g=>!ids.has(g.id));
      selectedIds.clear();saveSharedGroupSelection([]);render('cols');notify();saveGroups();
    };
    const edit=document.getElementById(idPrefix+'Edit');
    if(edit)edit.onclick=()=>{
      const selected=selectedGroups();
      if(selected.length||options.editRequiresSelection===false)options.onEdit?.(selected);
    };
    document.getElementById(colsId).addEventListener('input',e=>{cols=e.target.value;applyLayout('cols');render('cols');saveLayout('cols');});
    document.getElementById(rowsId).addEventListener('input',e=>{rows=e.target.value;applyLayout('rows');render('rows');saveLayout('rows');});
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
    return {box,toolbox,loadGroups,render,refreshActions:updateActions,selectedGroups,clearSelection,get groups(){return groups;}};
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
    const lum=luminanceForColor(visual.color);
    const overlay=lum>0.45?'rgba(0,0,0,.28)':'rgba(255,255,255,.18)';
    const ring=lum>0.45?'rgba(0,0,0,.5)':'rgba(1,255,230,.45)';
    const actionColor=lum>0.45?'#06110e':'#01ffe6';
    const actionHover=lum>0.45?'rgba(0,0,0,.14)':'rgba(1,255,230,.12)';
    const actionHoverStrong=lum>0.45?'rgba(0,0,0,.22)':'rgba(1,255,230,.18)';
    const actionBorder=lum>0.45?'rgba(0,0,0,.35)':'rgba(1,255,230,.35)';
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
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    return {open,close,normalize:normalizeSlotVisual,html:slotVisualHtml,style:slotVisualStyle};
  }

  window.DmxCommon={
    BASE_URL_KEY,
    APP_VERSION,
    isHttp,
    escapeHtml,
    appVersion,
    versionedPayload,
    downloadJson,
    clampInt,
    clampFloat,
    fanOrderedFixtures,
    applyBaseUrl,
    bindBaseUrl,
    preferStoredBaseUrl,
    saveUiState,
    loadUiState,
    saveSharedGroupSelection,
    loadSharedGroupSelection,
    initToolboxRail,
    initFloatingToolbox,
    initGroupsToolbox,
    normalizeSlotVisual,
    normalizeSlotVisualDefault,
    slotVisualStyle,
    slotVisualHtml,
    slotVisualButtonHtml,
    showModal,
    hideModal,
    initSlotVisualEditor
  };
})();
