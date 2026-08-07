
if(typeof window.byId!=="function"){ window.byId = function(id){ return document.getElementById(id); }; }
/* ===== Modal unique sauvegarde JSON (ingrédients) ===== */
(function(){
  const byId = (id)=>document.getElementById(id);

  // Elements
  const openBtn = byId('btnOpenBackup');
  const overlay = byId('backupOverlay');
  const closeBtn= byId('btnBackupClose');
  const backBtn = byId('btnBackupBack');

  const statusEl = byId('ingJsonModalStatus');
  const jsonBox  = byId('ingJsonBox');

  const setStatus = (msg)=>{ if(statusEl) statusEl.textContent = msg || ''; };

  // Template (aligné sur le format courant NutriApp)
  const getTemplate = ()=> JSON.stringify({
    meta:{ app:'NutriApp', schema:'backup.v2', exportedAt:new Date().toISOString() },
    ingredients:[
      {
        id:'ing_demo_1',
        name:'Avoine',
        categoryId:'cereales_feculents',
        profile:'solid',
        allowedUnits:['g','tbsp'],
        defaultUnit:'g',
        conversions:{ pieceWeightG:0, mlWeightG:0, tbspWeightG:9, tspWeightG:3 },
        kcal100:358,
        p100:13,
        g100:60,
        l100:7,
        note:'Source: étiquette / CIQUAL'
      }
    ],
    recipes:[
      {
        id:'rec_demo_1',
        name:'Porridge avoine',
        categoryId:'autre',
        parts:1,
        prepTime:'5 min',
        prep:'Mélanger puis chauffer.',
        rows:[
          {
            categoryId:'cereales_feculents',
            ingredientId:'ing_demo_1',
            ingredientName:'Avoine',
            qty:60,
            unit:'g',
            gramsResolved:60,
            macrosResolved:{ kcal:214.8, p:7.8, c:36, f:4.2 }
          }
        ]
      }
    ],
    menus:[]
  }, null, 2);

  const copyText = async (txt)=>{
    try{
      await navigator.clipboard.writeText(txt);
      return true;
    }catch(_){
      // fallback
      try{
        const ta=document.createElement('textarea');
        ta.value=txt;
        ta.style.position='fixed';
        ta.style.left='-9999px';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      }catch(__){ return false; }
    }
  };

  function open(){
    if(!overlay) return;

    // Show overlay and make it visible to AT
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden','false');

    // If supported, ensure focus can't go behind the dialog
    try{ overlay.inert = false; }catch(_){}

    setStatus('');

    // Move focus into the dialog (prevents aria-hidden focus warnings later)
    const first = (byId('btnBackupClose') || byId('btnBackupBack') || overlay.querySelector('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'));
    first && first.focus();
  }

  function close(){
    if(!overlay) return;

    // If focus is inside the overlay, move it back to the opener BEFORE hiding from AT
    try{
      if(document.activeElement && overlay.contains(document.activeElement)){
        if(openBtn) openBtn.focus();
        else document.body && document.body.focus && document.body.focus();
      }
    }catch(_){}

    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden','true');

    // If supported, inert prevents focus/interaction while hidden
    try{ overlay.inert = true; }catch(_){}
  }

  // Open/close wiring
  if(openBtn) openBtn.addEventListener('click', (e)=>{ e.preventDefault(); open(); });
  if(closeBtn) closeBtn.addEventListener('click', close);
  if(backBtn) backBtn.addEventListener('click', close);
  if(overlay) overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
// Buttons inside modal (IDs v3_5_4)
  byId('btnIngJsonTemplate')?.addEventListener('click', ()=>{
    if(jsonBox) jsonBox.value = getTemplate();
    setStatus('Template inséré.');
  });

  byId('btnIngJsonCopyTemplate')?.addEventListener('click', async ()=>{
    const ok = await copyText(getTemplate());
    setStatus(ok ? 'Template copié.' : 'Copie impossible.');
  });

  byId('btnIngJsonExport')?.addEventListener('click', ()=>{
    if(typeof NutriAppData !== 'object' || typeof NutriAppData.exportAll !== 'function'){
      setStatus('Export indisponible: NutriAppData.exportAll manquant.');
      return;
    }
    try{
      const payload = NutriAppData.exportAll();
      if(jsonBox) jsonBox.value = JSON.stringify(payload, null, 2);
      setStatus('Export généré.');
    }catch(err){
      setStatus('Erreur export.');
      console.error(err);
    }
  });

  
    // Mode buttons wiring (Remplacer / Fusionner)
    (function(){
      const bR = byId('btnModeReplace');
      const bM = byId('btnModeMerge');
      const rR = byId('ingImportModeReplace');
      const rM = byId('ingImportModeMerge');

      function setMode(mode){
        const isMerge = (mode === 'merge');
        if(rR) rR.checked = !isMerge;
        if(rM) rM.checked = isMerge;

        if(bR){
          bR.classList.toggle('green', !isMerge);
          bR.classList.toggle('gray',  isMerge);
          bR.setAttribute('aria-pressed', (!isMerge).toString());
        }
        if(bM){
          bM.classList.toggle('green', isMerge);
          bM.classList.toggle('gray',  !isMerge);
          bM.setAttribute('aria-pressed', (isMerge).toString());
        }
      }

      bR && bR.addEventListener('click', ()=> setMode('replace'));
      bM && bM.addEventListener('click', ()=> setMode('merge'));

      // init
      setMode((rM && rM.checked) ? 'merge' : 'replace');
    })();

byId('btnIngJsonApply')?.addEventListener('click', ()=>{
    if(typeof NutriAppData !== 'object' || typeof NutriAppData.importAll !== 'function'){
      setStatus('Import indisponible: NutriAppData.importAll manquant.');
      return;
    }
    const raw = (jsonBox?.value || '').trim();
    if(!raw){ setStatus('Zone JSON vide.'); return; }
    let parsed=null;
    try{ parsed = JSON.parse(raw); }catch(_){
      setStatus('JSON invalide (parse).');
      return;
    }
    const mode = byId('ingImportModeMerge')?.checked ? 'merge' : 'replace';
    const res = NutriAppData.importAll(parsed, {mode});
    if(res && res.ok){
      const c = res.counts || {}; setStatus(`Import appliqué. Ingrédients: ${c.ingredients||0} · Recettes: ${c.recipes||0} · Menus: ${c.menus||0}`);
    }else{
      setStatus((res && res.error) ? res.error : 'Import échoué.');
    }
  });

  byId('btnIngJsonClose')?.addEventListener('click', close);

  // Email helper (prépare un mail, ne colle pas automatiquement le JSON)
  byId('btnBackupEmail')?.addEventListener('click', ()=>{
    const email = (byId('backupEmail')?.value || '').trim();
    const subj = encodeURIComponent('NutriApp — sauvegarde JSON complète');
    const body = encodeURIComponent(
`Bonjour,

Je t’envoie une sauvegarde NutriApp.

1) Ouvre la modale 'Sauvegarde JSON'
2) Clique sur Export
3) Copie/colle le JSON complet dans ce mail (ou en pièce jointe)

Note : le JSON peut être long.
`
    );
    const href = 'mailto:' + encodeURIComponent(email) + '?subject=' + subj + '&body=' + body;
    try{ window.location.href = href; }catch(_){}
    setStatus('Email préparé (client mail).');
  });

})();
