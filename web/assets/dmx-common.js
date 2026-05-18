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
    const page=options.uiStatePage;
    let dragOffset={x:0,y:0};

    function clampBox(){
      if(!box)return;
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

    function setCollapsed(collapsed,save){
      if(!box)return;
      const c=!!collapsed;
      box.classList.toggle('collapsed',c);
      if(toggle)toggle.textContent=c?'+':'\u2014';
      if(collapsedKey)localStorage.setItem(collapsedKey,c?'1':'');
      if(save&&page)saveUiState(page,'sceneBoxCollapsed',c);
    }

    if(box&&posKey){
      try{applyPosition(JSON.parse(localStorage.getItem(posKey)||'null'));}catch(_){}
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
        if(page)saveUiState(page,'sceneBoxPos',pos);
      });
      window.addEventListener('resize',clampBox);
    }

    if(toggle)toggle.addEventListener('click',()=>setCollapsed(!box.classList.contains('collapsed'),true));

    return {box,header,toggle,clamp:clampBox,applyPosition,setCollapsed};
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
    initFloatingToolbox
  };
})();
