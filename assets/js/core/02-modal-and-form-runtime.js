
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
    const reportEl = byId('backupReport');
    const fileInput = byId('backupFileInput');

    const setStatus = (msg)=>{ if(statusEl) statusEl.textContent = msg || ''; };
    function escapeHtml(v){
      return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
    }
    function clearReport(){
      if(!reportEl) return;
      reportEl.classList.add('hidden');
      reportEl.innerHTML = '';
    }
    function renderReport(report, title){
      if(!reportEl) return;
      const counts = report && report.counts ? report.counts : {};
      const errors = Array.isArray(report && report.errors) ? report.errors : [];
      const warnings = Array.isArray(report && report.warnings) ? report.warnings : [];
      const info = Array.isArray(report && report.info) ? report.info : [];
      const stats = report && report.stats ? report.stats : (report && report.report && report.report.stats ? report.report.stats : null);
      const items = [
        ...errors.map(text => ({ level:'error', text })),
        ...warnings.map(text => ({ level:'warning', text })),
        ...info.map(text => ({ level:'ok', text }))
      ];
      if(stats){
        ['ingredients','recipes','menus'].forEach(key=>{
          const row = stats[key] || {};
          items.push({ level:'ok', text:`${key}: ${row.incoming || 0} entrant(s), ${row.added || 0} ajouté(s), ${row.updated || 0} mis à jour, ${row.final || 0} au total.` });
        });
      }
      reportEl.classList.remove('hidden');
      reportEl.innerHTML = `
        <div class="backupReportTitle">${escapeHtml(title || 'Rapport sauvegarde')}</div>
        <div class="backupReportGrid">
          <div class="backupReportCell"><b>${escapeHtml(String(counts.ingredients ?? 0))}</b><span>Ingrédients</span></div>
          <div class="backupReportCell"><b>${escapeHtml(String(counts.recipes ?? 0))}</b><span>Recettes</span></div>
          <div class="backupReportCell"><b>${escapeHtml(String(counts.menus ?? 0))}</b><span>Menus</span></div>
        </div>
        ${items.length ? `<div class="backupReportList">${items.map(item => `<div class="backupReportItem" data-level="${escapeHtml(item.level)}">${escapeHtml(item.text)}</div>`).join('')}</div>` : ''}
      `;
    }
    function parseJsonBox(){
      const raw = (jsonBox?.value || '').trim();
      if(!raw) return { ok:false, error:'Zone JSON vide.' };
      try{ return { ok:true, value:JSON.parse(raw) }; }
      catch(_){ return { ok:false, error:'JSON invalide (parse).' }; }
    }
    function validateCurrentJson(){
      if(typeof NutriAppData !== 'object' || typeof NutriAppData.validateAll !== 'function'){
        setStatus('Validation indisponible: NutriAppData.validateAll manquant.');
        return null;
      }
      const parsed = parseJsonBox();
      if(!parsed.ok){
        setStatus(parsed.error);
        renderReport({ counts:{ingredients:0,recipes:0,menus:0}, errors:[parsed.error] }, 'Validation impossible');
        return null;
      }
      const report = NutriAppData.validateAll(parsed.value);
      renderReport(report, report && report.ok ? 'Sauvegarde valide' : 'Sauvegarde invalide');
      setStatus(report && report.ok ? 'Validation OK.' : 'Validation échouée.');
      return { parsed: parsed.value, report };
    }
    function downloadJsonFromBox(){
      const raw = (jsonBox?.value || '').trim();
      if(!raw){ setStatus('Rien à télécharger. Lance d’abord Export.'); return; }
      const parsed = parseJsonBox();
      if(!parsed.ok){ setStatus(parsed.error); return; }
      const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      const blob = new Blob([JSON.stringify(parsed.value, null, 2)], { type:'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nutriapp-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 800);
      setStatus('Fichier JSON préparé.');
    }

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
      clearReport();

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
        if(typeof NutriAppData.validateAll === 'function') renderReport(NutriAppData.validateAll(payload), 'Export généré');
        setStatus('Export généré. Tu peux maintenant le télécharger ou le copier.');
      }catch(err){
        setStatus('Erreur export.');
        console.error(err);
      }
    });

    byId('btnIngJsonDownload')?.addEventListener('click', downloadJsonFromBox);

  
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

    byId('btnBackupLoadFile')?.addEventListener('click', ()=>{
      fileInput?.click();
    });

    fileInput?.addEventListener('change', async ()=>{
      const file = fileInput.files && fileInput.files[0];
      if(!file) return;
      try{
        const text = await file.text();
        if(jsonBox) jsonBox.value = text;
        setStatus('Fichier chargé : ' + file.name);
        validateCurrentJson();
      }catch(err){
        setStatus('Lecture fichier impossible.');
        console.error(err);
      }finally{
        try{ fileInput.value = ''; }catch(_){}
      }
    });

    byId('btnIngJsonValidate')?.addEventListener('click', validateCurrentJson);

    byId('btnIngJsonApply')?.addEventListener('click', ()=>{
      if(typeof NutriAppData !== 'object' || typeof NutriAppData.importAll !== 'function'){
        setStatus('Import indisponible: NutriAppData.importAll manquant.');
        return;
      }
      const validation = validateCurrentJson();
      if(!validation || !validation.report || !validation.report.ok){
        setStatus('Import refusé : corrige d’abord le JSON.');
        return;
      }
      const mode = byId('ingImportModeMerge')?.checked ? 'merge' : 'replace';
      if(mode === 'replace'){
        const ok = confirm('Remplacer toute la bibliothèque locale par cette sauvegarde ?\n\nCette action écrase ingrédients, recettes et menus actuels.');
        if(!ok){ setStatus('Import annulé.'); return; }
      }
      const res = NutriAppData.importAll(validation.parsed, {mode});
      if(res && res.ok){
        const c = res.counts || {};
        const report = Object.assign({}, res.report || {}, { counts:c });
        renderReport(report, 'Import appliqué');
        setStatus(`Import appliqué. Ingrédients: ${c.ingredients||0} · Recettes: ${c.recipes||0} · Menus: ${c.menus||0}`);
      }else{
        if(res && res.report) renderReport(res.report, 'Import refusé');
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
