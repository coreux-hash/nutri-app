/* Phase 4.1 — UI Recipes / Create modal shell */
(function(){
  function safeArr(x){ return Array.isArray(x) ? x : []; }
  function str(x){ return (x===undefined||x===null) ? '' : String(x); }

  function ensureBanner(){
    let b = document.getElementById('importManualBanner');
    if(b) return b;
    const manual = document.getElementById('panelManual');
    if(!manual) return null;
    b = document.createElement('div');
    b.id = 'importManualBanner';
    b.style.cssText = 'margin:10px 0 6px;padding:10px 12px;border-radius:14px;background:rgba(243,194,71,.22);border:1px solid rgba(231,174,47,.35);color:var(--ink900);font-weight:800;';
    b.textContent = '';
    // Insert near top (after hint if possible)
    const hint = manual.querySelector('.createHint') || manual.firstElementChild;
    if(hint && hint.parentNode) hint.parentNode.insertBefore(b, hint.nextSibling);
    else manual.insertBefore(b, manual.firstChild);
    return b;
  }

  function nameKeyFallback(name){
    return str(name).trim().toLowerCase().replace(/\s+/g,' ');
  }

  function findExistingByName(name){
    try{
      if(typeof resolveIngredientReferenceByText === 'function'){
        const hit = resolveIngredientReferenceByText(name, {});
        if(hit && hit.ingredient){
          return hit.ingredient;
        }
      }
    }catch(_e){}
    try{
      const store = (typeof getIngredientStoreSnapshot === 'function') ? safeArr(getIngredientStoreSnapshot()) : [];
      const key = (typeof nameKey === 'function') ? nameKey(name) : nameKeyFallback(name);
      for(const it of store){
        const k = (typeof nameKey === 'function') ? nameKey(it && it.name) : nameKeyFallback(it && it.name);
        if(k && key && k === key) return it;
      }
    }catch(_e){}
    return null;
  }


/* =========================
   CreateModal open/close + tabs + manual step rail
========================= */
(function initCreateModal(){
  const overlay = byId("recipeCreateOverlay");
  const modal = byId("recipeCreateModal");
  const btnOpen = byId("btnOpenCreateRecipe");
  const btnClose = byId("btnCreateRecipeClose");
  const btnBack = byId("btnCreateRecipeBack");

  const pManual = byId("recipePanelManual");
  const pScan = byId("recipePanelScan");
  const pImport = byId("recipePanelImport");

  const manualStepBtns = [...(pManual?.querySelectorAll("[data-manual-step]") || [])];
  const manualStepPanels = [...(pManual?.querySelectorAll("[data-manual-step-panel]") || [])];
  const manualProxySaveBtns = [...(pManual?.querySelectorAll("[data-manual-proxy-save]") || [])];
  const manualProxyCancelBtns = [...(pManual?.querySelectorAll("[data-manual-proxy-cancel]") || [])];

  function setManualStep(step){
    const target = String(step || "identity");
    manualStepBtns.forEach(btn=>{
      const on = btn.dataset.manualStep === target;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    manualStepPanels.forEach(panel=>{
      panel.classList.toggle("is-active", panel.dataset.manualStepPanel === target);
    });
    pManual?.scrollTo?.({ top: 0, behavior: "auto" });
  }

  function open(){
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    try{ overlay.inert = false; }catch(_e){}
    setTimeout(()=>byId("recipeName")?.focus(), 0);
  }
  function close(){
    try{
      const ae = document.activeElement;
      if(ae && overlay?.contains(ae) && typeof ae.blur === "function") ae.blur();
    }catch(_){}
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    try{ overlay.inert = true; }catch(_e){}
  }

  function getRecipeEditor(){
    try{
      const app = window.NutriApp || {};
      if(app.ui && app.ui.recipeEditor) return app.ui.recipeEditor;
    }catch(_e){}
    try{ if(window.RecipeEditorModal) return window.RecipeEditorModal; }catch(_e){}
    try{ if(window.RecipeEditor) return window.RecipeEditor; }catch(_e){}
    return null;
  }

  function clearEditorIfAvailable(){
    const editor = getRecipeEditor();
    try{
      if(editor && typeof editor.reset === "function") return editor.reset();
      if(editor && typeof editor.clear === "function") return editor.clear();
    }catch(_e){}
  }

  function clickNativeManualAction(kind){
    const target = kind === "cancel"
      ? byId("cmRecipeManualCancel")
      : byId("cmRecipeManualSave");
    if(target) target.click();
    else if(kind === "cancel") close();
  }

  function setMode(mode, opts = {}){
    const targetMode = String(mode || "manual");
    buttons.forEach(b=>{
      const on = b.dataset.mode === targetMode;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    Object.entries(panels).forEach(([k,el])=>{
      if(!el) return;
      el.classList.toggle("hiddenPanel", k !== targetMode);
    });
    if(targetMode === "manual"){
      setManualStep(opts.manualStep || "identity");
    }
  }

  window.openRecipeCreateModal = function(){ open(); };
  window.closeRecipeCreateModal = function(){ close(); };
  window.setRecipeCreateMode = function(mode, opts){ setMode(mode, opts || {}); };
  window.setRecipeManualStep = function(step){ setManualStep(step); };

  btnOpen?.addEventListener("click", ()=>{
    const editor = getRecipeEditor();
    try{
      if(editor && typeof editor.create === "function") return editor.create();
    }catch(_e){}
    open();
    setMode("manual", { manualStep: "identity" });
  });
  btnClose?.addEventListener("click", ()=> { clearEditorIfAvailable(); close(); });
  btnBack?.addEventListener("click", ()=> { clearEditorIfAvailable(); close(); });

  overlay?.addEventListener("click", (e)=>{
    if(e.target === overlay) close();
  });
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && overlay && !overlay.classList.contains("hidden")) close();
  });

  const seg = modal?.querySelector(".createSeg");
  const buttons = [...(seg?.querySelectorAll("button[data-mode]") || [])];
  const panels = { manual: pManual, scan: pScan, import: pImport };

  buttons.forEach(b=>b.addEventListener("click", ()=>setMode(b.dataset.mode)));
  manualStepBtns.forEach(btn=> btn.addEventListener("click", ()=> setManualStep(btn.dataset.manualStep)));
  pManual?.addEventListener("click", (e)=>{
    const jump = e.target.closest("[data-manual-target]");
    if(!jump) return;
    setManualStep(jump.dataset.manualTarget);
  });

  manualProxySaveBtns.forEach(btn=> btn.addEventListener("click", (e)=>{
    if(e.currentTarget && (e.currentTarget.id === "cmRecipeManualSave")) return;
    clickNativeManualAction("save");
  }));
  manualProxyCancelBtns.forEach(btn=> btn.addEventListener("click", (e)=>{
    if(e.currentTarget && (e.currentTarget.id === "cmRecipeManualCancel")){
      close();
      return;
    }
    clickNativeManualAction("cancel");
  }));

  modal?.addEventListener("click", (e)=>{
    const nav = e.target.closest("[data-mode-nav]");
    if(nav){
      const mode = nav.dataset.modeNav || "manual";
      const manualStep = nav.dataset.manualTarget || undefined;
      setMode(mode, { manualStep });
      return;
    }
    const closeBtn = e.target.closest("[data-recipe-close]");
    if(closeBtn){
      close();
    }
  });

  setMode("manual", { manualStep: "identity" });
})();

})();
