
(function(){
  if(window.__phase13cOcrSharedPatchApplied) return;
  window.__phase13cOcrSharedPatchApplied = true;

  if(typeof window.byId !== 'function'){
    window.byId = function(id){ return document.getElementById(id); };
  }

  function safeString(v){ return v == null ? '' : String(v); }
  function toNumLoose(v){
    const s = safeString(v).trim().replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  function stripDiacriticsSafe(s){
    try{ return safeString(s).normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
    catch(_e){ return safeString(s); }
  }
  function collapseSpacesSafe(s){ return safeString(s).replace(/\s+/g,' ').trim(); }
  function escapeHtmlSafe(s){
    return safeString(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }
  function getRuntimeIngredientsSafe(){
    try{
      if(typeof getRuntimeIngredients === 'function'){
        const list = getRuntimeIngredients();
        if(Array.isArray(list)) return list;
      }
    }catch(_e){}
    try{
      if(window.NutriStore && typeof window.NutriStore.getIngredients === 'function'){
        const list = window.NutriStore.getIngredients();
        if(Array.isArray(list)) return list;
      }
    }catch(_e){}
    try{
      if(Array.isArray(window.ingredients)) return window.ingredients;
    }catch(_e){}
    try{
      if(Array.isArray(window.ING_STORE)) return window.ING_STORE;
    }catch(_e){}
    return [];
  }
  function findIngredientByIdSafe(id, list){
    const sid = safeString(id);
    const items = Array.isArray(list) ? list : getRuntimeIngredientsSafe();
    for(const ing of items){
      if(safeString(ing && ing.id) === sid) return ing || null;
    }
    return null;
  }
  function normalizedLookupSafe(s){
    try{
      if(typeof normalizeIngredientLookupText === 'function') return normalizeIngredientLookupText(s);
    }catch(_e){}
    let x = stripDiacriticsSafe(s).toLowerCase();
    x = x.replace(/[’']/g,' ');
    x = x.replace(/[-_/]/g,' ');
    x = x.replace(/[(),.:;+*\[\]{}!?|\\"]/g,' ');
    x = x.replace(/%/g,' ');
    x = collapseSpacesSafe(x);
    return x;
  }

  window.resolveIngredientReferenceByText = function(label, options){
    const raw = collapseSpacesSafe(label);
    const ingredients = getRuntimeIngredientsSafe();
    const preferCategoryId = safeString(options && options.preferCategoryId || '');
    if(!raw){
      return { status:'none', ingredientId:'', ingredientName:'', categoryId:'', ingredient:null, score:0, candidates:[] };
    }

    try{
      if(typeof IngredientSearchEngine !== 'undefined' && IngredientSearchEngine && typeof IngredientSearchEngine.match === 'function'){
        const hit = IngredientSearchEngine.match(raw, ingredients, { preferCategoryId });
        if(hit && (hit.status === 'exact' || hit.status === 'probable') && hit.ingredientId){
          const ingredient = findIngredientByIdSafe(hit.ingredientId, ingredients);
          return {
            status: hit.status,
            ingredientId: safeString(hit.ingredientId),
            ingredientName: safeString((ingredient && ingredient.name) || hit.ingredientName || raw),
            categoryId: safeString((ingredient && ingredient.categoryId) || ''),
            ingredient: ingredient || null,
            score: Number(hit.score || 0),
            candidates: Array.isArray(hit.candidates) ? hit.candidates : []
          };
        }
        if(hit && hit.status === 'ambiguous'){
          return {
            status: 'ambiguous',
            ingredientId: '',
            ingredientName: '',
            categoryId: '',
            ingredient: null,
            score: Number(hit.score || 0),
            candidates: Array.isArray(hit.candidates) ? hit.candidates : []
          };
        }
      }
    }catch(err){ console.warn('resolveIngredientReferenceByText.match', err); }

    const normRaw = normalizedLookupSafe(raw);
    let fallback = null;
    for(const ing of ingredients){
      const ingName = safeString(ing && ing.name);
      if(!ingName) continue;
      const normIng = normalizedLookupSafe(ingName);
      if(!normIng) continue;
      if(normIng === normRaw){ fallback = ing; break; }
      if(!fallback && normIng.includes(normRaw) && normRaw.length >= 4) fallback = ing;
    }
    if(fallback){
      return {
        status: 'fallback',
        ingredientId: safeString(fallback.id),
        ingredientName: safeString(fallback.name || raw),
        categoryId: safeString(fallback.categoryId || ''),
        ingredient: fallback,
        score: 60,
        candidates: []
      };
    }
    return { status:'none', ingredientId:'', ingredientName:'', categoryId:'', ingredient:null, score:0, candidates:[] };
  };

  try{
    if(typeof IngredientSearchEngine !== 'undefined' && IngredientSearchEngine){
      window.IngredientSearchEngine = IngredientSearchEngine;
    }
  }catch(_e){}

  // Modern OCR wrapper: avoids v5 deprecated warnings when possible.
  let __ocrWorkerPatched = null;
  const oldEnsureTesseractLoaded = (typeof window.ensureTesseractLoaded === 'function') ? window.ensureTesseractLoaded
    : ((typeof ensureTesseractLoaded === 'function') ? ensureTesseractLoaded : null);
  window.ocrRecognizeFileToText = async function(file, onProgress){
    if(!file) return '';
    const ok = oldEnsureTesseractLoaded ? await oldEnsureTesseractLoaded() : !!window.Tesseract;
    if(!ok || !window.Tesseract || typeof window.Tesseract.createWorker !== 'function') return '';
    if(!__ocrWorkerPatched){
      const T = window.Tesseract;
      try{
        if(onProgress) onProgress('OCR: initialisation…');
        __ocrWorkerPatched = await T.createWorker('fra');
      }catch(_modernErr){
        try{
          __ocrWorkerPatched = await T.createWorker();
          if(typeof __ocrWorkerPatched.loadLanguage === 'function') await __ocrWorkerPatched.loadLanguage('fra');
          if(typeof __ocrWorkerPatched.initialize === 'function') await __ocrWorkerPatched.initialize('fra');
        }catch(initErr){
          console.error(initErr);
          return '';
        }
      }
    }
    try{
      if(onProgress) onProgress('OCR: lecture…');
      const rec = await __ocrWorkerPatched.recognize(file);
      return safeString(rec && rec.data && rec.data.text || '');
    }catch(recErr){
      console.error(recErr);
      return '';
    }
  };

  function getCreateOverlay(){ return document.getElementById('createOverlay'); }
  function getRecipeCreateOverlay(){ return document.getElementById('recipeCreateOverlay'); }
  function blurActiveInside(overlay){
    try{
      const ae = document.activeElement;
      if(ae && overlay && overlay.contains(ae) && typeof ae.blur === 'function') ae.blur();
    }catch(_e){}
  }
  function syncOverlayA11y(overlay, focusTargetId){
    if(!overlay) return;
    const hidden = overlay.classList.contains('hidden') || overlay.getAttribute('aria-hidden') === 'true';
    if(hidden){
      blurActiveInside(overlay);
      try{ overlay.inert = true; }catch(_e){}
    }else{
      try{ overlay.inert = false; }catch(_e){}
      if(focusTargetId){
        setTimeout(()=>{ const t = document.getElementById(focusTargetId); try{ t && t.focus && t.focus(); }catch(_e){} }, 0);
      }
    }
  }
  [ ['createOverlay','ingName'], ['recipeCreateOverlay','recipeName'] ].forEach(([id, focusId])=>{
    const overlay = document.getElementById(id);
    if(!overlay) return;
    const mo = new MutationObserver(()=> syncOverlayA11y(overlay, focusId));
    mo.observe(overlay, { attributes:true, attributeFilter:['class','aria-hidden'] });
    syncOverlayA11y(overlay, focusId);
    overlay.addEventListener('click', function(ev){ if(ev.target === overlay) blurActiveInside(overlay); }, true);
  });
  ['btnCreateBack','btnCreateClose','btnCreateSave','btnCreateRecipeBack','btnCreateRecipeClose'].forEach(id=>{
    const btn = document.getElementById(id);
    btn && btn.addEventListener('click', function(){
      blurActiveInside(getCreateOverlay());
      blurActiveInside(getRecipeCreateOverlay());
    }, true);
  });

  function parseIngredientOcrText(text){
    const rawText = safeString(text || '');
    const lines = rawText.replace(/\r/g,'\n').split('\n').map(s=>collapseSpacesSafe(s)).filter(Boolean);
    const out = { name:'', kcal:NaN, p:NaN, carbs:NaN, fat:NaN, rawText };
    const nonMacroCandidates = [];

    function firstNumber(line){
      const m = safeString(line).match(/-?\d+(?:[.,]\d+)?/);
      return m ? toNumLoose(m[0]) : NaN;
    }
    function numberBeforeKcal(line){
      const m = safeString(line).match(/(\d+(?:[.,]\d+)?)\s*kcal/i);
      return m ? toNumLoose(m[1]) : firstNumber(line);
    }

    for(const rawLine of lines){
      const line = collapseSpacesSafe(stripDiacriticsSafe(rawLine).toLowerCase());
      if(!line) continue;
      const hasDigits = /\d/.test(line);
      if((line.includes('kcal') || line.includes('energie') || line.includes('energie ')) && !Number.isFinite(out.kcal)){
        out.kcal = numberBeforeKcal(line);
        continue;
      }
      if((line.includes('proteines') || line.includes('proteine') || line.includes('protein') || line.includes('protides')) && !Number.isFinite(out.p)){
        out.p = firstNumber(line);
        continue;
      }
      if((line.includes('glucides') || line.includes('carbohydrates') || line.includes('carbs')) && !Number.isFinite(out.carbs)){
        out.carbs = firstNumber(line);
        continue;
      }
      if((line.includes('lipides') || line.includes('matiere grasse') || line.includes('matieres grasses') || line.includes('fat')) && !Number.isFinite(out.fat)){
        out.fat = firstNumber(line);
        continue;
      }
      if(!hasDigits && rawLine.length >= 3 && rawLine.length <= 80){
        nonMacroCandidates.push(rawLine);
      }
    }

    out.name = safeString(nonMacroCandidates[0] || '').trim();
    return out;
  }

  function renderIngredientOcrPreview(parsed){
    const out = document.getElementById('ocrOut');
    if(!out) return;
    const hasData = parsed && (Number.isFinite(parsed.kcal) || Number.isFinite(parsed.p) || Number.isFinite(parsed.carbs) || Number.isFinite(parsed.fat) || safeString(parsed.rawText).trim());
    if(!hasData){
      out.style.display = 'none';
      out.innerHTML = '';
      return;
    }
    out.style.display = 'block';
    out.innerHTML = [
      '<div class="ingredientOcrCard">',
        '<div class="ingredientOcrHead">OCR détecté</div>',
        '<div class="ingredientOcrGrid">',
          '<div class="ingredientOcrMetric"><small>Nom</small><b>' + escapeHtmlSafe(parsed.name || '—') + '</b></div>',
          '<div class="ingredientOcrMetric"><small>Kcal</small><b>' + (Number.isFinite(parsed.kcal) ? escapeHtmlSafe(parsed.kcal) : '—') + '</b></div>',
          '<div class="ingredientOcrMetric"><small>P</small><b>' + (Number.isFinite(parsed.p) ? escapeHtmlSafe(parsed.p) : '—') + '</b></div>',
          '<div class="ingredientOcrMetric"><small>G</small><b>' + (Number.isFinite(parsed.carbs) ? escapeHtmlSafe(parsed.carbs) : '—') + '</b></div>',
          '<div class="ingredientOcrMetric"><small>L</small><b>' + (Number.isFinite(parsed.fat) ? escapeHtmlSafe(parsed.fat) : '—') + '</b></div>',
        '</div>',
        '<details class="ingredientOcrRaw">',
          '<summary>Texte OCR</summary>',
          '<pre>' + escapeHtmlSafe(parsed.rawText || '') + '</pre>',
        '</details>',
      '</div>'
    ].join('');
  }

  function selectIngredientManualTab(){
    const btn = document.querySelector('#createModal .createSeg button[data-mode="manual"]');
    if(btn) btn.click();
  }

  function ensureIngredientCreateOpen(){
    const overlay = getCreateOverlay();
    if(overlay && overlay.classList.contains('hidden')){
      document.getElementById('btnOpenCreate')?.click();
    }
    selectIngredientManualTab();
  }

  function dispatchFieldUpdate(el){
    if(!el) return;
    try{ el.dispatchEvent(new Event('input', { bubbles:true })); }catch(_e){}
    try{ el.dispatchEvent(new Event('change', { bubbles:true })); }catch(_e){}
  }

  function setFieldValue(id, value){
    const el = document.getElementById(id);
    if(!el) return;
    el.value = value == null ? '' : String(value);
    dispatchFieldUpdate(el);
  }
  function setChecked(id, checked){
    const el = document.getElementById(id);
    if(!el) return;
    el.checked = !!checked;
    dispatchFieldUpdate(el);
  }
  function setBannerMessage(text, tone){
    let b = document.getElementById('importManualBanner');
    const manual = document.getElementById('panelManual');
    if(!b && manual){
      b = document.createElement('div');
      b.id = 'importManualBanner';
      b.style.cssText = 'margin:10px 0 6px;padding:10px 12px;border-radius:14px;background:rgba(243,194,71,.22);border:1px solid rgba(231,174,47,.35);color:var(--ink900);font-weight:800;';
      const hint = manual.querySelector('.createHint') || manual.firstElementChild;
      if(hint && hint.parentNode) hint.parentNode.insertBefore(b, hint.nextSibling);
      else manual.insertBefore(b, manual.firstChild);
    }
    if(!b) return;
    b.textContent = safeString(text);
    if(tone === 'warn'){
      b.style.background = 'rgba(243,194,71,.22)';
      b.style.borderColor = 'rgba(231,174,47,.35)';
    }else{
      b.style.background = 'rgba(89,155,103,.16)';
      b.style.borderColor = 'rgba(89,155,103,.35)';
    }
  }

  function prefillIngredientManualFromItem(item, source){
    if(!item) return;
    ensureIngredientCreateOpen();
    const name = safeString(item.name || '').trim();
    const categoryId = safeString(item.categoryId || '').trim();
    const categoryKnown = item.categoryKnown !== false;

    if(name) setFieldValue('ingName', name);
    if(categoryId && categoryKnown){
      setFieldValue('ingCategory', categoryId);
    }else if(!categoryKnown){
      setFieldValue('ingCategory', '');
    }

    if(Number.isFinite(Number(item.kcal))) setFieldValue('ingKcal', item.kcal);
    if(Number.isFinite(Number(item.p))) setFieldValue('ingProt', item.p);
    if(Number.isFinite(Number(item.carbs))) setFieldValue('ingCarb', item.carbs);
    if(Number.isFinite(Number(item.fat))) setFieldValue('ingFat', item.fat);

    const catForProfile = categoryId || '';
    const isLiquid = catForProfile === 'liquides_boissons';
    setChecked(isLiquid ? 'profileLiquid' : 'profileSolid', true);

    const existing = name ? window.resolveIngredientReferenceByText(name, {}) : null;
    if(existing && existing.ingredient){
      setBannerMessage(source + ' : ingrédient existant reconnu (' + safeString(existing.ingredientName || name) + '). Vérifie puis enregistre.', 'ok');
    }else if(!categoryKnown && safeString(item.categoryRaw || '').trim()){
      setBannerMessage(source + ' : catégorie inconnue (' + safeString(item.categoryRaw) + '). Corrige la catégorie puis enregistre.', 'warn');
    }else{
      setBannerMessage(source + ' : fiche préremplie. Vérifie puis enregistre.', 'ok');
    }

    setTimeout(()=>{ try{ document.getElementById('ingName')?.focus(); }catch(_e){} }, 0);
  }
  window.prefillIngredientManualFromItem = prefillIngredientManualFromItem;

  window.addEventListener('nutri:import:items', function(ev){
    const item = ev && ev.detail && ev.detail[0];
    if(!item) return;
    prefillIngredientManualFromItem(item, 'Import rapide');
  });

  async function runIngredientOcr(){
    const fileInput = document.getElementById('ocrImage');
    const file = fileInput && fileInput.files && fileInput.files[0];
    const out = document.getElementById('ocrOut');
    if(!file){
      if(out){ out.style.display = 'block'; out.textContent = 'Choisis une image avant de scanner.'; }
      return;
    }
    if(out){ out.style.display = 'block'; out.textContent = 'OCR en cours…'; }
    try{
      const txt = await window.ocrRecognizeFileToText(file, function(msg){ if(out){ out.style.display = 'block'; out.textContent = msg; } });
      const clean = (typeof normalizeOcrText === 'function') ? normalizeOcrText(txt) : safeString(txt).trim();
      const parsed = parseIngredientOcrText(clean);
      window.__lastIngredientOcrParsed = parsed;
      renderIngredientOcrPreview(parsed);
    }catch(err){
      console.error(err);
      if(out){ out.style.display = 'block'; out.textContent = 'OCR échoué (erreur).'; }
    }
  }

  function bindOnce(id, evt, handler){
    const el = document.getElementById(id);
    if(!el) return;
    const key = '__bound_' + evt + '_' + id;
    if(el.dataset[key]) return;
    el.dataset[key] = '1';
    el.addEventListener(evt, handler);
  }

  bindOnce('btnOcrScan', 'click', function(){
    const input = document.getElementById('ocrImage');
    if(input && input.files && input.files[0]) runIngredientOcr();
    else input && input.click();
  });
  bindOnce('ocrImage', 'change', function(){ runIngredientOcr(); });
  bindOnce('btnOcrApplyToManual', 'click', function(){
    const parsed = window.__lastIngredientOcrParsed || parseIngredientOcrText('');
    if(!parsed || !(Number.isFinite(parsed.kcal) || Number.isFinite(parsed.p) || Number.isFinite(parsed.carbs) || Number.isFinite(parsed.fat))){
      const out = document.getElementById('ocrOut');
      if(out){ out.style.display = 'block'; out.textContent = 'Aucune donnée OCR exploitable à copier.'; }
      return;
    }
    prefillIngredientManualFromItem({
      name: parsed.name || safeString(document.getElementById('ingName') && document.getElementById('ingName').value || ''),
      kcal: parsed.kcal,
      p: parsed.p,
      carbs: parsed.carbs,
      fat: parsed.fat,
      categoryId: '',
      categoryKnown: true
    }, 'OCR ingrédient');
  });
})();


/* ===== Phase 13f — OCR shared preprocess + auto preview ===== */
(function(){
  function _safeStatusSet(el, msg){ try{ if(el) el.textContent = String(msg||''); }catch(_e){} }
  function _clampNum(v, min, max){ v=Number(v); if(!Number.isFinite(v)) return min; return Math.max(min, Math.min(max, v)); }
  async function loadImageElementFromFile(file){
    return await new Promise((resolve, reject)=>{
      try{
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function(){ try{ URL.revokeObjectURL(url); }catch(_e){} resolve(img); };
        img.onerror = function(err){ try{ URL.revokeObjectURL(url); }catch(_e){} reject(err || new Error('image load failed')); };
        img.src = url;
      }catch(err){ reject(err); }
    });
  }
  function canvasToBlob(canvas, type, quality){
    return new Promise((resolve)=>{
      try{
        canvas.toBlob(function(blob){ resolve(blob || null); }, type || 'image/png', Number.isFinite(quality) ? quality : 0.92);
      }catch(_e){ resolve(null); }
    });
  }
  async function prepareImageSourceForOcr(file, opts){
    const o = opts || {};
    const minInputW = _clampNum(o.minInputW, 32, 4096);
    const minInputH = _clampNum(o.minInputH, 32, 4096);
    const targetMinW = _clampNum(o.targetMinW, 1200, 5000);
    const maxSide = _clampNum(o.maxSide, 2200, 6000);
    const img = await loadImageElementFromFile(file);
    const srcW = Number(img.naturalWidth || img.width || 0);
    const srcH = Number(img.naturalHeight || img.height || 0);
    if(srcW < minInputW || srcH < minInputH){
      return { ok:false, reason:'too_small', width:srcW, height:srcH, source:null };
    }
    const scaleA = targetMinW / Math.max(1, srcW);
    const scaleB = maxSide / Math.max(srcW, srcH);
    const scale = Math.max(1, Math.min(scaleA, scaleB));
    const outW = Math.max(1, Math.round(srcW * scale));
    const outH = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d', { willReadFrequently:true });
    if(!ctx){
      return { ok:true, width:srcW, height:srcH, source:file, scale:1, preprocessed:false };
    }
    ctx.drawImage(img, 0, 0, outW, outH);
    try{
      const imgData = ctx.getImageData(0, 0, outW, outH);
      const data = imgData.data;
      for(let i=0;i<data.length;i+=4){
        const r=data[i], g=data[i+1], b=data[i+2];
        let y = 0.299*r + 0.587*g + 0.114*b;
        y = y < 150 ? 0 : 255;
        data[i]=data[i+1]=data[i+2]=y;
      }
      ctx.putImageData(imgData, 0, 0);
    }catch(_e){}
    const blob = await canvasToBlob(canvas, 'image/png', 0.95);
    if(!blob){
      return { ok:true, width:srcW, height:srcH, source:canvas, scale:scale, preprocessed:true };
    }
    const prepared = new File([blob], ((file && file.name) ? String(file.name).replace(/\.[^.]+$/, '') : 'ocr') + '.png', { type:'image/png' });
    return { ok:true, width:srcW, height:srcH, source:prepared, scale:scale, preprocessed:true, outW:outW, outH:outH };
  }

  const __oldSharedOcr = window.ocrRecognizeFileToText;
  window.ocrRecognizeFileToText = async function(file, onProgress){
    if(!file) return '';
    try{
      if(onProgress) onProgress('OCR: préparation image…');
      const prep = await prepareImageSourceForOcr(file, { minInputW:32, minInputH:32, targetMinW:1400, maxSide:2400 });
      if(!prep || !prep.ok){
        if(onProgress) onProgress('Image trop petite ou illisible pour OCR. Utilise une photo plus nette et plus large.');
        return '';
      }
      if(onProgress && prep.preprocessed){
        onProgress('OCR: image optimisée…');
      }
      const src = prep.source || file;
      if(typeof __oldSharedOcr === 'function'){
        return await __oldSharedOcr(src, onProgress);
      }
      return '';
    }catch(err){
      console.error(err);
      if(onProgress) onProgress('OCR échoué (prétraitement image).');
      return '';
    }
  };

  const __oldRunRecipeOcr = (typeof runRecipeOcr === 'function') ? runRecipeOcr : null;
  if(__oldRunRecipeOcr){
    window.runRecipeOcr = async function(kind){
      const st = byId('recipeOcrStatus');
      const fileInput = (kind === 'ings') ? byId('recipeOcrIngsFile') : byId('recipeOcrPrepFile');
      const textArea  = (kind === 'ings') ? byId('recipeOcrIngsText') : byId('recipeOcrPrepText');
      const file = fileInput && fileInput.files && fileInput.files[0];
      if(!file){ _safeStatusSet(st, 'Choisis une image avant de scanner.'); return; }
      _safeStatusSet(st, 'OCR en cours…');
      try{
        const txt = await window.ocrRecognizeFileToText(file, function(m){ _safeStatusSet(st, m); });
        const clean = (typeof normalizeOcrText === 'function') ? normalizeOcrText(txt) : String(txt||'').trim();
        if(textArea) textArea.value = clean;
        if(kind === 'ings'){
          const parsed = (typeof parseOcrIngredientsTextarea === 'function') ? parseOcrIngredientsTextarea() : [];
          if(typeof renderRecipeQuickPreview === 'function'){
            renderRecipeQuickPreview(parsed, 'recipeOcrIngsPreview', 'recipeOcrStatus');
          }
          if(!clean){
            _safeStatusSet(st, 'OCR terminé mais aucun texte exploitable détecté. Photo trop petite, floue ou cadrage trop serré.');
          }else if(!parsed || !parsed.length){
            _safeStatusSet(st, 'Texte OCR détecté, mais aucune ligne recette exploitable. Vérifie/corrige le texte puis clique Voir avant.');
          }
        }else{
          _safeStatusSet(st, clean ? 'OCR préparation terminé.' : 'OCR terminé mais aucun texte détecté.');
        }
      }catch(err){
        console.error(err);
        _safeStatusSet(st, 'OCR échoué (erreur).');
      }
    };
  }

  // Strengthen aria-hidden handling for create overlay close buttons.
  function moveFocusOutsideOverlay(overlay){
    try{
      if(!overlay) return;
      const sinkId = 'appFocusSink';
      let sink = document.getElementById(sinkId);
      if(!sink){
        sink = document.createElement('button');
        sink.id = sinkId;
        sink.type = 'button';
        sink.setAttribute('aria-hidden', 'true');
        sink.tabIndex = -1;
        sink.style.position = 'fixed';
        sink.style.left = '-9999px';
        sink.style.top = '0';
        sink.style.width = '1px';
        sink.style.height = '1px';
        sink.style.opacity = '0';
        document.body.appendChild(sink);
      }
      if(overlay.contains(document.activeElement)){ sink.focus(); }
    }catch(_e){}
  }
  ['btnCreateBack','btnCreateClose','cmManualCancel','btnCreateRecipeBack','btnCreateRecipeClose'].forEach(function(id){
    const el = document.getElementById(id);
    if(!el || el.dataset.phase13fBound) return;
    el.dataset.phase13fBound = '1';
    el.addEventListener('click', function(){
      moveFocusOutsideOverlay(document.getElementById('createOverlay'));
      moveFocusOutsideOverlay(document.getElementById('recipeCreateOverlay'));
    }, true);
  });

/* === phase13f: clear actions + extensible textareas === */
(function(){
  function byId(id){ return document.getElementById(id); }
  function hide(el){ if(el && el.style) el.style.display = 'none'; }
  function clearText(el){
    if(!el) return;
    if('value' in el) el.value = '';
    else el.textContent = '';
  }
  function clearHtml(el){
    if(!el) return;
    clearText(el);
    hide(el);
  }
  function autoGrow(ta){
    if(!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.max(ta.scrollHeight, 120) + 'px';
  }
  function bindAutoGrow(id){
    const ta = byId(id);
    if(!ta || ta.dataset.autoGrowBound === '1') return;
    ta.dataset.autoGrowBound = '1';
    const run = ()=>autoGrow(ta);
    ta.addEventListener('input', run);
    ta.addEventListener('change', run);
    setTimeout(run, 0);
  }

  ['recipeOcrIngsText','recipeOcrPrepText','recipeQuickImportBox','quickImportBox'].forEach(bindAutoGrow);

  const btnOcrClear = byId('btnOcrClear');
  if(btnOcrClear && btnOcrClear.dataset.clearBound !== '1'){
    btnOcrClear.dataset.clearBound = '1';
    btnOcrClear.addEventListener('click', ()=>{
      const file = byId('ocrImage'); if(file) file.value = '';
      window.__lastIngredientOcrParsed = null;
      clearHtml(byId('ocrOut'));
    });
  }

  const btnImportClear = byId('btnImportClear');
  if(btnImportClear && btnImportClear.dataset.clearBound !== '1'){
    btnImportClear.dataset.clearBound = '1';
    btnImportClear.addEventListener('click', ()=>{
      const t = byId('quickImportBox');
      if(t){ t.value = ''; autoGrow(t); }
      clearHtml(byId('quickImportPreview'));
      const s = byId('quickImportStatus'); if(s) s.textContent = '';
    });
  }

  const btnRecipeOcrClear = byId('btnRecipeOcrClear');
  if(btnRecipeOcrClear && btnRecipeOcrClear.dataset.clearBound !== '1'){
    btnRecipeOcrClear.dataset.clearBound = '1';
    btnRecipeOcrClear.addEventListener('click', ()=>{
      const t1 = byId('recipeOcrIngsText'); if(t1){ t1.value = ''; autoGrow(t1); }
      const t2 = byId('recipeOcrPrepText'); if(t2){ t2.value = ''; autoGrow(t2); }
      const f1 = byId('recipeOcrIngsFile'); if(f1) f1.value = '';
      const f2 = byId('recipeOcrPrepFile'); if(f2) f2.value = '';
      clearHtml(byId('recipeOcrIngsPreview'));
      const st = byId('recipeOcrStatus'); if(st) st.textContent = '';
    });
  }

  const btnRecipeQuickClear = byId('btnRecipeQuickClear');
  if(btnRecipeQuickClear && btnRecipeQuickClear.dataset.clearBound !== '1'){
    btnRecipeQuickClear.dataset.clearBound = '1';
    btnRecipeQuickClear.addEventListener('click', ()=>{
      const t = byId('recipeQuickImportBox');
      if(t){ t.value = ''; autoGrow(t); }
      clearHtml(byId('recipeQuickPreview'));
      const st = byId('recipeQuickStatus'); if(st) st.textContent = '';
    });
  }
})();

})();
