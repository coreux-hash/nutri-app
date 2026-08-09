/* Phase 4.2 — Features / Ingredients / Page interactions + detail + thumb */
(function(){
  const ns = window.NutriIngredients = window.NutriIngredients || {};
  const buildIngredientPillsHTML = function(data){ return ns.ui && typeof ns.ui.buildIngredientPillsHTML === 'function' ? ns.ui.buildIngredientPillsHTML(data) : ''; };
  const formatUnitLabel = function(u){ return ns.ui && typeof ns.ui.formatUnitLabel === 'function' ? ns.ui.formatUnitLabel(u) : String(u||''); };
  const formatProfileLabel = function(p){ return ns.ui && typeof ns.ui.formatProfileLabel === 'function' ? ns.ui.formatProfileLabel(p) : String(p||''); };
  const upsertCard = function(data){ return ns.ui && typeof ns.ui.upsertCard === 'function' ? ns.ui.upsertCard(data) : undefined; };
  const upsertIngredientInStore = function(data){ return ns.store && typeof ns.store.upsertIngredientInStore === 'function' ? ns.store.upsertIngredientInStore(data) : undefined; };
  function getIngredientStoreSnapshot(){
    if(ns.store && typeof ns.store.getIngredientStoreSnapshot === 'function') return ns.store.getIngredientStoreSnapshot();
    if(typeof window.getIngredientStoreSnapshot === 'function') return window.getIngredientStoreSnapshot();
    if(window.NutriStore && typeof window.NutriStore.getIngredients === 'function') return window.NutriStore.getIngredients();
    return [];
  }
  function persistIngredientToStore(data){
    const direct = upsertIngredientInStore(data);
    if(typeof direct !== 'undefined') return direct;
    if(window.NutriStore && typeof window.NutriStore.getIngredients === 'function' && typeof window.NutriStore.setIngredients === 'function'){
      const next = window.NutriStore.getIngredients().slice();
      const idx = next.findIndex(x => x && String(x.id) === String(data && data.id));
      if(idx >= 0) next[idx] = data;
      else next.unshift(data);
      return window.NutriStore.setIngredients(next);
    }
    return false;
  }
  function duplicateIngredientById(id){
    if(!id) return false;
    const source = (window.NutriAppData && typeof window.NutriAppData.findIngredientById === 'function')
      ? window.NutriAppData.findIngredientById(id)
      : (getIngredientStoreSnapshot().find(it => it && String(it.id) === String(id)) || null);
    if(!source){
      alert('Ingrédient introuvable.');
      return false;
    }
    const copy = JSON.parse(JSON.stringify(source));
    copy.id = 'ing_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    copy.name = (copy.name || 'Ingrédient') + ' (copie)';
    const ok = persistIngredientToStore(copy);
    if(ok === false){
      console.warn('[NutriApp] Duplicate ingredient: store indisponible');
      return false;
    }
    if(ns.ui && typeof ns.ui.applyIngredientFilters === 'function') ns.ui.applyIngredientFilters();
    else upsertCard(copy);
    return true;
  }
  // Mobile drawer: open/close on logo click
  (function(){
    const logo = document.querySelector('.brand .logo');
    const drawer = document.querySelector('aside.drawer');
    const overlay = document.getElementById('drawerOverlay');
    if(!logo || !drawer || !overlay) return;

    function open(){
      drawer.classList.add('open');
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden','false');
    }
    function close(){
      drawer.classList.remove('open');
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden','true');
    }
    function toggle(){
      drawer.classList.contains('open') ? close() : open();
    }

    logo.addEventListener('click', (e)=>{ e.preventDefault(); toggle(); });
    overlay.addEventListener('click', close);
    drawer.addEventListener('click', (e)=>{
      const link = e.target.closest('a');
      if(link) close();
    });
})();


  // Sidebar navigation: switch visible page panels (Ingredients / Recipes / Menus / Echanges)
  (function(){
    const nav = document.querySelector('nav.nav');
    if(!nav) return;
    const heroTitle = document.getElementById('heroPageTitle') || document.querySelector('.hero .title');
    const topMetaRail = document.getElementById('topMetaRail');
    const topFilterBtn = document.querySelector('.topbar .iconbtn');
    const panelTitles = {
      ingredients: 'Mes Ingrédients',
      recipes: 'Mes Recettes',
      menus: 'Mes Menus',
      system: 'Échanges',
    };
    const panels = {
      ingredients: document.getElementById('pageIngredients'),
      recipes: document.getElementById('pageRecipes'),
      menus: document.getElementById('pageMenus'),
      system: document.getElementById('pageSystem'),
    };
    const pageHeadMeta = {
      ingredients: document.querySelector('#pageIngredients .pageHeadMeta'),
      recipes: document.querySelector('#pageRecipes .pageHeadMeta'),
      menus: document.querySelector('#pageMenus .pageHeadMeta'),
    };
    const pageHeadPills = {
      ingredients: document.querySelector('#pageIngredients .pageHeadPill'),
      recipes: document.querySelector('#pageRecipes .pageHeadPill'),
      menus: document.querySelector('#pageMenus .pageHeadPill'),
    };
    const filterButtons = {
      ingredients: document.getElementById('btnOpenFilters'),
      recipes: document.getElementById('btnOpenFiltersRecipes'),
      menus: document.getElementById('btnOpenFiltersMenus'),
    };
    const filterLabels = {
      ingredients: 'Ouvrir les filtres ingrédients',
      recipes: 'Ouvrir les filtres recettes',
      menus: 'Ouvrir les filtres menus',
    };
    function syncFabs(key){
      const fabIng = document.getElementById('btnOpenCreate');
      const fabRec = document.getElementById('btnOpenCreateRecipe');
      const fabMen = document.getElementById('btnOpenCreateMenu');
      if(fabIng) fabIng.style.display = (key === 'ingredients') ? '' : 'none';
      if(fabRec) fabRec.style.display = (key === 'recipes') ? '' : 'none';
      if(fabMen) fabMen.style.display = (key === 'menus') ? '' : 'none';
    }
    function syncTopMeta(key){
      if(!topMetaRail) return;
      Object.entries(pageHeadPills).forEach(([k,pill])=>{
        const home = pageHeadMeta[k];
        if(!pill || !home) return;
        if(k === key){
          topMetaRail.appendChild(pill);
        }else if(pill.parentElement !== home){
          home.appendChild(pill);
        }
      });
      topMetaRail.classList.toggle('is-empty', !pageHeadPills[key]);
    }
    function syncTopFilter(key){
      if(!topFilterBtn) return;
      const hasFilter = !!filterButtons[key];
      topFilterBtn.classList.add('topFilterBtn');
      topFilterBtn.classList.toggle('is-disabled', !hasFilter);
      topFilterBtn.disabled = !hasFilter;
      topFilterBtn.dataset.filterContext = hasFilter ? key : '';
      topFilterBtn.setAttribute('aria-label', hasFilter ? filterLabels[key] : 'Filtres indisponibles');
      topFilterBtn.setAttribute('title', hasFilter ? filterLabels[key] : '');
      if(!topFilterBtn.querySelector('.topFilterGlyph')){
        topFilterBtn.innerHTML = '<span class="topFilterGlyph" aria-hidden="true"><span></span><span></span><span></span></span>';
      }
    }
    function openTopFilter(){
      if(!topFilterBtn || topFilterBtn.disabled) return;
      const ctx = String(topFilterBtn.dataset.filterContext || '').trim();
      if(!ctx) return;
      const api = window.NutriAppFilterModal;
      if(api && typeof api.open === 'function'){
        api.open(ctx);
        return;
      }
      const fallback = filterButtons[ctx];
      if(fallback && typeof fallback.click === 'function') fallback.click();
    }
    topFilterBtn?.addEventListener('click', (e)=>{
      e.preventDefault();
      openTopFilter();
    });
    function show(key){
      const finalKey = panels[key] ? key : 'ingredients';
      Object.entries(panels).forEach(([k,el])=>{
        if(!el) return;
        el.classList.toggle('active', k === finalKey);
      });

      if(heroTitle) heroTitle.textContent = panelTitles[finalKey] || panelTitles.ingredients;
      syncFabs(finalKey);
      syncTopMeta(finalKey);
      syncTopFilter(finalKey);

      nav.querySelectorAll('a[data-page]').forEach(a=>{
        a.classList.toggle('active', a.dataset.page === finalKey);
      });

      try{ document.body.dataset.activePage = finalKey; }catch(_e){}
      return finalKey;
    }
    window.NutriAppNav = Object.assign({}, window.NutriAppNav || {}, {
      showPage: show,
      getActivePage(){
        try{ return document.body.dataset.activePage || 'ingredients'; }catch(_e){}
        return 'ingredients';
      }
    });

    nav.addEventListener('click', (e)=>{
      const pending = e.target.closest('a[data-nav-placeholder]');
      if(pending){
        e.preventDefault();
        return;
      }
      const a = e.target.closest('a[data-page]');
      if(!a) return;
      e.preventDefault();
      const shown = show(a.dataset.page);
      /* Chromium traite chaque URL file:// comme une origine opaque distincte.
         La vue change déjà via show(); l'URL n'est synchronisée qu'en HTTP(S). */
      if(location.protocol === 'http:' || location.protocol === 'https:'){
        try{ history.replaceState(null, '', a.getAttribute('href') || ('#' + shown)); }catch(_e){}
      }
    });

    const h = (location.hash || '').replace('#','');
    if(h && panels[h]) show(h);
    else show('ingredients');
  })();







// Ingredient cards: kebab (3 dots) actions (Modifier / Dupliquer)
(function(){
  const ingPage = document.getElementById('pageIngredients');
  if(!ingPage) return;

  function readableNote(value){
    const text = value == null ? '' : String(value).trim();
    return /^(?:undefined|null)$/i.test(text) ? '' : text;
  }

  function closeAll(){
    ingPage.querySelectorAll('.kebabMenu').forEach(m=> m.classList.add('hidden'));
    ingPage.querySelectorAll('.notePop').forEach(p=> p.classList.add('hidden'));
  }

  ingPage.addEventListener('click', (e)=>{
    const info = e.target.closest('.infoDot');
    if(info){
      const card = info.closest('.card');
      const pop = card?.querySelector('.notePop');
      if(!card || !pop) return;
      const note = decodeURIComponent(card.dataset.note || '');
      const noteTxt = readableNote(note);
      if(!noteTxt){
        info.classList.add('hidden');
        pop.textContent = '';
        pop.classList.add('hidden');
        return;
      }

      // close others, toggle this one
      ingPage.querySelectorAll('.notePop').forEach(p=> { if(p!==pop) p.classList.add('hidden'); });
      pop.textContent = noteTxt;
      pop.classList.toggle('hidden');
      e.stopPropagation();
      return;
    }


    const btn = e.target.closest('.kebabBtn');
    if(btn){
      const card = btn.closest('.card');
      const menu = card?.querySelector('.kebabMenu');
      if(!menu) return;
      const wasHidden = menu.classList.contains('hidden');
      closeAll();
      if(wasHidden) menu.classList.remove('hidden');
      e.stopPropagation();
      return;
    }

    const act = e.target.closest('.kebabMenu button');
    if(act){
      const action = act.dataset.action;
      const card = act.closest('.card');
      closeAll();

      if(action === 'edit'){
        // UI preview: open Create modal in Manual mode
        const card = act.closest('.card');
        const d = card ? {
          id: card.dataset.id,
          name: decodeURIComponent(card.dataset.name || ''),
          category: decodeURIComponent(card.dataset.category || ''),
          kcal: parseFloat(card.dataset.kcal || '0'),
          p: parseFloat(card.dataset.p || '0'),
          carbs: parseFloat(card.dataset.carbs || '0'),
          fat: parseFloat(card.dataset.fat || '0'),
          note: decodeURIComponent(card.dataset.note || ''),
          profile: decodeURIComponent(card.dataset.profile || 'solid'),
          allowedUnits: (()=>{ try{return JSON.parse(decodeURIComponent(card.dataset.allowedunits || '%5B%22g%22%5D'));}catch(_){return ['g'];} })(),
          defaultUnit: decodeURIComponent(card.dataset.defaultunit || 'g'),
          conversions: (()=>{ try{return JSON.parse(decodeURIComponent(card.dataset.conversions || '%7B%7D'));}catch(_){return {}; } })(),
          thumb: decodeURIComponent(card.dataset.thumb || '')
        } : {};
        window.NutriAppOpenCreate ? window.NutriAppOpenCreate(d) : document.getElementById('btnOpenCreate')?.click();
      }
      if(action === 'duplicate'){
        const id = card?.dataset?.id;
        duplicateIngredientById(id);
      }
      if(action === 'delete'){
        const id = card?.dataset?.id;
        if(!id) return;

        const it = window.NutriAppData?.findIngredientById ? window.NutriAppData.findIngredientById(id) : null;
        const name = it?.name || card.querySelector('.cardTitle')?.textContent || 'cet ingrédient';

        if(!confirm(`Supprimer l’ingrédient “${name}” ?`)) return;

        const ok = window.NutriAppData?.deleteIngredientById ? window.NutriAppData.deleteIngredientById(id) : false;
        if(!ok){
          console.warn('[NutriApp] Delete: id introuvable ou store indisponible:', id);
        }
        card.remove();
      }

      e.stopPropagation();
      return;
    }
  });

  document.addEventListener('click', (e)=>{
    // click outside closes
    if(!e.target.closest('#pageIngredients .card')) closeAll();
    else if(!e.target.closest('.kebabMenu') && !e.target.closest('.kebabBtn') && !e.target.closest('.notePop') && !e.target.closest('.infoDot')) closeAll();
  });
})();



(function(){
  const overlay = document.getElementById('ingredientDetailOverlay');
  const body = document.getElementById('ingredientDetailBody');
  const closeBtn = document.getElementById('ingredientDetailClose');
  const ingPageEl = document.getElementById('pageIngredients');
  if(!overlay || !body || !ingPageEl) return;

  function escapeHtml(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function fmt(n){
    const v = Number(n || 0);
    return Number.isFinite(v) ? (Math.round(v * 10) / 10).toString().replace(/\.0$/, '') : '0';
  }
  function decodeJson(str, fallback){
    try{ return JSON.parse(decodeURIComponent(str || '')); }catch(_){ return fallback; }
  }
  function getIngredientFromCard(card){
    const id = card?.dataset?.id || '';
    const stored = window.NutriAppData?.findIngredientById ? window.NutriAppData.findIngredientById(id) : null;
    if(stored) return stored;
    return {
      id,
      name: decodeURIComponent(card?.dataset?.name || ''),
      categoryId: decodeURIComponent(card?.dataset?.category || ''),
      categoryLabel: decodeURIComponent(card?.dataset?.categorylabel || '—'),
      kcal: parseFloat(card?.dataset?.kcal || '0'),
      p: parseFloat(card?.dataset?.p || '0'),
      carbs: parseFloat(card?.dataset?.carbs || '0'),
      fat: parseFloat(card?.dataset?.fat || '0'),
      note: decodeURIComponent(card?.dataset?.note || ''),
      profile: decodeURIComponent(card?.dataset?.profile || 'solid'),
      allowedUnits: decodeJson(card?.dataset?.allowedunits, ['g']),
      defaultUnit: decodeURIComponent(card?.dataset?.defaultunit || 'g'),
      conversions: decodeJson(card?.dataset?.conversions, {}),
      thumb: decodeURIComponent(card?.dataset?.thumb || '')
    };
  }
  function conversionRows(ing){
    const conv = ing?.conversions || {};
    const allowed = Array.isArray(ing?.allowedUnits) ? ing.allowedUnits : ['g'];
    const rows = [];
    if(allowed.includes('g')) rows.push('<div class="ingConvItem"><div class="ingConvTitle">Grammage</div><div class="ingMuted">Base du moteur : calcul nutritionnel direct sur 100 g.</div></div>');
    if(allowed.includes('piece')) rows.push(`<div class="ingConvItem"><div class="ingConvTitle">Pièce</div><div>1 pièce = <b>${fmt(conv.pieceWeightG)}</b> g</div></div>`);
    if(allowed.includes('ml')) rows.push(`<div class="ingConvItem"><div class="ingConvTitle">Millilitres</div><div>1 ml = <b>${fmt(conv.mlWeightG)}</b> g</div></div>`);
    if(allowed.includes('tbsp')) rows.push(`<div class="ingConvItem"><div class="ingConvTitle">Cuillère à soupe</div><div>1 càs = <b>${fmt(conv.tbspWeightG)}</b> g</div></div>`);
    if(allowed.includes('tsp')) rows.push(`<div class="ingConvItem"><div class="ingConvTitle">Cuillère à café</div><div>1 càc = <b>${fmt(conv.tspWeightG)}</b> g</div></div>`);
    return rows.join('');
  }
  function renderDetail(ing){
    const thumb = (typeof ing?.thumb === 'string' ? ing.thumb : '').trim();
    const leadThumb = thumb && thumb.startsWith('data:image') ? `<img src="${thumb}" alt="${escapeHtml(ing?.name || 'Ingrédient')}">` : '🥣';
    const allowed = Array.isArray(ing?.allowedUnits) ? ing.allowedUnits : ['g'];
    body.innerHTML = `
      <section class="ingLeadCard">
        <div class="ingLeadTop">
          <div class="ingLeadThumb">${leadThumb}</div>
          <div>
            <h3 class="ingLeadName">${escapeHtml(ing?.name || 'Ingrédient')}</h3>
            ${buildIngredientPillsHTML(ing)}
          </div>
        </div>
        <div class="ingKv">
          <div class="k">Catégorie</div><div class="v">${escapeHtml(ing?.categoryLabel || '—')}</div>
          <div class="k">Profil</div><div class="v">${formatProfileLabel(ing?.profile)}</div>
          <div class="k">Unités autorisées</div><div class="v">${allowed.map(formatUnitLabel).join(' · ')}</div>
          <div class="k">Unité par défaut</div><div class="v">${formatUnitLabel(ing?.defaultUnit || 'g')}</div>
        </div>
        <div class="ingMacroGrid">
          <div class="ingMacroCell"><div class="ingMacroVal">${fmt(ing?.kcal)}</div><div class="ingMacroLbl">Kcal /100g</div></div>
          <div class="ingMacroCell"><div class="ingMacroVal">${fmt(ing?.p)}</div><div class="ingMacroLbl">P /100g</div></div>
          <div class="ingMacroCell"><div class="ingMacroVal">${fmt(ing?.carbs)}</div><div class="ingMacroLbl">G /100g</div></div>
          <div class="ingMacroCell"><div class="ingMacroVal">${fmt(ing?.fat)}</div><div class="ingMacroLbl">L /100g</div></div>
        </div>
        ${ing?.note ? `<div class="ingNoteBox"><b>Note</b><div style="margin-top:8px">${escapeHtml(ing.note)}</div></div>` : ''}
        <div class="exchangeDetailActions">
          <button class="btn ghost" data-exchange-share="ingredient" data-exchange-id="${escapeHtml(ing?.id || '')}" type="button">Partager la carte</button>
        </div>
      </section>
      <aside class="ingAsideCard">
        <div class="bigTitle" style="margin-top:0;font-size:20px;">Conversions</div>
        <div class="createHint" style="margin-bottom:12px;">Ces équivalences servent au moteur recette pour convertir vers des grammes résolus.</div>
        <div class="ingConvList">${conversionRows(ing)}</div>
      </aside>`;
  }
  function openDetail(ing){
    renderDetail(ing);
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden','false');
    try{ overlay.inert = false; }catch(_e){}
    document.body.style.overflow = 'hidden';
    const focusTarget = closeBtn || overlay.querySelector('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
    try{ focusTarget && focusTarget.focus && focusTarget.focus(); }catch(_e){}
  }
  function closeDetail(){
    try{
      if(document.activeElement && overlay.contains(document.activeElement)){
        if(closeBtn && typeof closeBtn.blur === 'function') closeBtn.blur();
        else if(document.body && typeof document.body.focus === 'function') document.body.focus();
      }
    }catch(_e){}
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden','true');
    try{ overlay.inert = true; }catch(_e){}
    document.body.style.overflow = '';
  }
  ingPageEl.addEventListener('click', (e)=>{
    const bodyEl = e.target.closest('.cardBody');
    if(!bodyEl) return;
    const bridge = window.NutriRecipeLibraryBridge;
    const composeMode = !!(bridge && typeof bridge.isActive === 'function' && bridge.isActive());
    if(composeMode){
      if(e.target.closest('.infoDot, .notePop')) return;
      if(e.target.closest('.kebabBtn, .kebabMenu, .cardSelectCtl, .cardSelectInput')) return;
      const card = bodyEl.closest('.card[data-id]');
      if(!card) return;
      e.preventDefault();
      if(typeof bridge.toggleIngredientSelection === 'function'){
        bridge.toggleIngredientSelection(card.dataset.id);
      }
      return;
    }
    if(e.target.closest('.kebabBtn, .kebabMenu, .infoDot, .notePop, .thumb, .thumbRemove, .thumbInput, .thumbUpload')) return;
    const card = bodyEl.closest('.card');
    if(!card) return;
    openDetail(getIngredientFromCard(card));
  });
  closeBtn.addEventListener('click', closeDetail);
  overlay.addEventListener('click', (e)=>{ if(e.target === overlay) closeDetail(); });
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && overlay.classList.contains('show')) closeDetail(); });
})();

// ===== Unified Escape handler (drawer / filtres / create / backup / kebab) =====
(function(){
  const isShown = (el)=> !!(el && !el.classList.contains('hidden') && el.getAttribute('aria-hidden') !== 'true');

  document.addEventListener('keydown', (e)=>{
    if(e.key !== 'Escape') return;

    // Priority: close top-most blocking overlays first
    const backupOverlay = document.getElementById('backupOverlay');
    if(isShown(backupOverlay)){
      (document.getElementById('btnBackupClose') || document.getElementById('btnBackupBack'))?.click?.();
      return;
    }

    const createOverlay = document.getElementById('createOverlay');
    if(isShown(createOverlay)){
      (document.getElementById('btnCreateClose') || document.getElementById('btnCreateBack'))?.click?.();
      return;
    }

    const filterOverlay = document.getElementById('filterOverlay');
    if(isShown(filterOverlay)){
      (document.getElementById('btnFilterClose') || document.getElementById('btnFilterBack'))?.click?.();
      return;
    }

    // Drawer (mobile)
    const drawer = document.querySelector('aside.drawer');
    if(drawer && drawer.classList.contains('open')){
      document.getElementById('drawerOverlay')?.click?.(); // overlay click already closes drawer
      return;
    }

    // Close kebab + note popovers (best-effort)
    document.querySelectorAll('#pageIngredients .kebabMenu:not(.hidden), #pageIngredients .notePop:not(.hidden)')
      .forEach(el=> el.classList.add('hidden'));
  });
})();


// Thumb upload (max 94 KB) for ingredient vignettes
(function(){
  const MAX = 94 * 1024; // 94 KB
  document.addEventListener('change', (e)=>{
    const input = e.target;
    if(!(input instanceof HTMLInputElement)) return;
    if(!input.classList.contains('thumbInput')) return;
    const file = input.files && input.files[0];
    const wrap = input.closest('.thumb');
    const img = wrap && wrap.querySelector('.thumbPreview');
    const ph  = wrap && wrap.querySelector('.thumbPlaceholder');
    const err = wrap && wrap.querySelector('.thumbError');
    if(!wrap || !img || !ph || !err) return;

    err.classList.add('hidden');

    if(!file){
      img.classList.add('hidden');
      ph.classList.remove('hidden');
      return;
    }
    if(file.size > MAX){
      input.value = '';
      img.classList.add('hidden');
      ph.classList.remove('hidden');
      err.textContent = 'Max 94 KB';
      err.classList.remove('hidden');
      return;
    }
    if(!file.type.startsWith('image/')){
      input.value = '';
      img.classList.add('hidden');
      ph.classList.remove('hidden');
      err.textContent = 'Fichier image uniquement';
      err.classList.remove('hidden');
      return;
    }
    const reader = new FileReader();
    const rm = wrap.querySelector('.thumbRemove');
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      img.src = dataUrl;
      img.classList.remove('hidden');
      ph.classList.add('hidden');
      if(rm) rm.classList.remove('hidden');

      // Persist with ingredient
      const card = input.closest('.card');
      const id = card ? String(card.getAttribute('data-id') || '') : '';
      if(id && window.NutriAppData && typeof window.NutriAppData.findIngredientById === 'function'){
        const it = window.NutriAppData.findIngredientById(id);
        if(it){
          it.thumb = dataUrl;
          upsertIngredientInStore(it);
          upsertCard(it);
        }
      }
    };
    reader.readAsDataURL(file);
  });

  // Remove thumb (small cross on top-left)
  document.addEventListener('click', (e)=>{
    const btn = e.target;
    if(!(btn instanceof HTMLElement)) return;
    if(!btn.classList.contains('thumbRemove')) return;

    e.preventDefault();
    e.stopPropagation();

    const card = btn.closest('.card');
    const wrap = btn.closest('.thumb');
    if(!card || !wrap) return;

    const id = String(card.getAttribute('data-id') || '');
    const img = wrap.querySelector('.thumbPreview');
    const ph  = wrap.querySelector('.thumbPlaceholder');
    const err = wrap.querySelector('.thumbError');
    const inp = wrap.querySelector('.thumbInput');

    if(err) err.classList.add('hidden');
    if(inp) inp.value = '';
    if(img){
      img.removeAttribute('src');
      img.classList.add('hidden');
    }
    if(ph) ph.classList.remove('hidden');
    btn.classList.add('hidden');

    if(id && window.NutriAppData && typeof window.NutriAppData.findIngredientById === 'function'){
      const it = window.NutriAppData.findIngredientById(id);
      if(it){
        it.thumb = '';
        upsertIngredientInStore(it);
        upsertCard(it);
      }
    }
  });
})();
})();
