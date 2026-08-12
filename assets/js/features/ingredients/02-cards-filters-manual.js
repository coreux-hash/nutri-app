/* Phase 4.2 — Features / Ingredients / Cards + filters + manual save */
(function(){
  const ns = window.NutriIngredients = window.NutriIngredients || {};
  const cm = ns.ui && ns.ui.cm;
  const ingGrid = ns.ui && ns.ui.ingGrid ? ns.ui.ingGrid : el.ingGrid;
  const close = function(){ return ns.ui && typeof ns.ui.closeCreateModal === 'function' ? ns.ui.closeCreateModal() : undefined; };
  const open = function(){ return ns.ui && typeof ns.ui.openCreateModal === 'function' ? ns.ui.openCreateModal() : undefined; };
  const setMode = function(mode){ return ns.ui && typeof ns.ui.setCreateMode === 'function' ? ns.ui.setCreateMode(mode) : undefined; };
  const fillIngredientUnitForm = function(ing){ return ns.ui && typeof ns.ui.fillIngredientUnitForm === 'function' ? ns.ui.fillIngredientUnitForm(ing) : undefined; };
  const getAllowedUnitsFromForm = function(){ return ns.ui && typeof ns.ui.getAllowedUnitsFromForm === 'function' ? ns.ui.getAllowedUnitsFromForm() : ['g']; };
  const getProfileFromForm = function(){ return ns.ui && typeof ns.ui.getProfileFromForm === 'function' ? ns.ui.getProfileFromForm() : 'solid'; };
  const normalizeCategory = function(input){
    return ns.domain && typeof ns.domain.normalizeCategory === 'function'
      ? ns.domain.normalizeCategory(input)
      : (window.normalizeCategory ? window.normalizeCategory(input) : { id:'', label:String(input||'') });
  };
  const ING_CAT_LABEL_BY_ID = (ns.domain && ns.domain.ING_CAT_LABEL_BY_ID) || {};
  const ING_CAT_COLOR = (ns.domain && ns.domain.ING_CAT_COLOR) || { get(){ return { bg:'var(--chipMutedBg)', fg:'var(--chipMutedFg)' }; } };
  function getIngredientStoreSnapshot(){
    if(ns.store && typeof ns.store.getIngredientStoreSnapshot === 'function'){
      return ns.store.getIngredientStoreSnapshot();
    }
    if(typeof window.getIngredientStoreSnapshot === 'function'){
      return window.getIngredientStoreSnapshot();
    }
    if(window.NutriStore && typeof window.NutriStore.getIngredients === 'function'){
      return window.NutriStore.getIngredients();
    }
    return [];
  }
  function upsertIngredientInStore(data){
    if(ns.store && typeof ns.store.upsertIngredientInStore === 'function'){
      return ns.store.upsertIngredientInStore(data);
    }
    if(typeof window.upsertIngredientInStore === 'function'){
      return window.upsertIngredientInStore(data);
    }
    if(window.NutriStore && typeof window.NutriStore.getIngredients === 'function' && typeof window.NutriStore.setIngredients === 'function'){
      const next = window.NutriStore.getIngredients().slice();
      const idx = next.findIndex(x => x && String(x.id) === String(data && data.id));
      if(idx >= 0) next[idx] = data;
      else next.push(data);
      return window.NutriStore.setIngredients(next);
    }
    return false;
  }
let editingId = null;

function numOr0(v){
  const n = parseFloat(String(v||'').replace(',','.'));
  return Number.isFinite(n) ? n : 0;
}

function nameKey(s){
  const raw = String(s || '').trim().toLowerCase();
  if(!raw) return '';
  // Remove diacritics (é -> e) when supported
  const norm = raw.normalize ? raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'') : raw;
  return norm.replace(/\s+/g,' ').trim();
}
function cardNoteText(value){
  const text = value == null ? '' : String(value).trim();
  return /^(?:undefined|null)$/i.test(text) ? '' : text;
}
function findByNameKey(key){
  if(!key) return null;
  for(const it of getIngredientStoreSnapshot()){
    if(it && it.name && nameKey(it.name) === key) return it;
  }
  return null;
}
function countDuplicateNameKeys(list){
  const seen = new Set();
  const dups = new Set();
  for(const it of list){
    if(!it) continue;
    const k = nameKey(it.name);
    if(!k) continue;
    if(seen.has(k)) dups.add(k);
    else seen.add(k);
  }
  return Array.from(dups);
}

function badgeClass(categoryId, categoryLabel){
  // keep legacy CSS classes for the 4 broad groups, but source of truth is categoryId/label
  const label = (categoryLabel || (categoryId ? ING_CAT_LABEL_BY_ID[categoryId] : '') || '').toLowerCase();
  if(label.includes('fruit')) return 'bFruit';
  if(label.includes('lég') || label.includes('leg')) return 'bVeg';
  if(label.includes('prot')) return 'bProt';
  if(label.includes('fécul') || label.includes('fecul') || label.includes('starch')) return 'bSt';
  return 'bFruit';
}

function formatUnitLabel(u){
  return ({ g:'g', piece:'pièce', ml:'ml', tbsp:'càs', tsp:'càc' }[u] || String(u||''));
}
function formatProfileLabel(profile){
  return (String(profile||'solid') === 'liquid') ? 'Liquide' : 'Solide';
}
function encodeDataObject(obj){
  try{ return encodeURIComponent(JSON.stringify(obj || {})); }catch(_){ return encodeURIComponent('{}'); }
}
function getRecipeStoreSnapshot(){
  try{
    if(window.NutriStore && typeof window.NutriStore.getRecipes === 'function'){
      return window.NutriStore.getRecipes();
    }
  }catch(_e){}
  try{
    if(typeof NutriStorage !== 'undefined' && NutriStorage && typeof NutriStorage.get === 'function'){
      const raw = NutriStorage.get((typeof STORAGE_KEYS === 'object' && STORAGE_KEYS && STORAGE_KEYS.recipes) ? STORAGE_KEYS.recipes : 'nutriapp.recipes.v2');
      const arr = JSON.parse(raw || '[]');
      return Array.isArray(arr) ? arr : [];
    }
  }catch(_e){}
  try{
    const arr = JSON.parse(localStorage.getItem('nutriapp.recipes.v2') || '[]');
    return Array.isArray(arr) ? arr : [];
  }catch(_e){}
  return [];
}
function buildIngredientUsageIndex(recipes){
  const byId = new Map();
  const byName = new Map();
  const list = Array.isArray(recipes) ? recipes : [];
  for(const recipe of list){
    const seenIds = new Set();
    const seenNames = new Set();
    const rows = Array.isArray(recipe?.rows) ? recipe.rows : [];
    for(const row of rows){
      const rid = String(row?.ingredientId || row?.ingId || row?.id || '').trim();
      const rname = nameKey(row?.ingredientName || row?.name || '');
      if(rid) seenIds.add(rid);
      if(rname) seenNames.add(rname);
    }
    seenIds.forEach(id => byId.set(id, (byId.get(id) || 0) + 1));
    seenNames.forEach(nk => byName.set(nk, (byName.get(nk) || 0) + 1));
  }
  return { totalRecipes: list.length, byId, byName };
}
function usageStarsFromRate(rate){
  const pct = Number(rate || 0);
  if(pct >= 20) return 3;
  if(pct >= 8) return 2;
  if(pct >= 2) return 1;
  return 0;
}
function getIngredientUsageMeta(data, usageIndex){
  const index = usageIndex || buildIngredientUsageIndex(getRecipeStoreSnapshot());
  const totalRecipes = Number(index?.totalRecipes || 0);
  const id = String(data?.id || '').trim();
  const nk = nameKey(data?.name || '');
  const byId = index?.byId instanceof Map ? index.byId : new Map();
  const byName = index?.byName instanceof Map ? index.byName : new Map();
  const usedInRecipes = Math.max(id ? (byId.get(id) || 0) : 0, nk ? (byName.get(nk) || 0) : 0);
  const rate = totalRecipes > 0 ? (usedInRecipes / totalRecipes) * 100 : 0;
  const stars = usageStarsFromRate(rate);
  return { totalRecipes, usedInRecipes, rate, stars };
}
function getCardTone(catId){
  const tones = {
    aides_techniques:{ main:'#6A6866', deep:'#4E4C4A' },
    autre:{ main:'#B3A276', deep:'#85754F' },
    cereales_feculents:{ main:'#DDB545', deep:'#A77F17' },
    epices_aromes:{ main:'#C89737', deep:'#926819' },
    fruits:{ main:'#D36F45', deep:'#9A4728' },
    fruits_de_mer:{ main:'#54A7C4', deep:'#2F7792' },
    legumes:{ main:'#4E8B43', deep:'#34652E' },
    liquides_boissons:{ main:'#3EA2C7', deep:'#207392' },
    matieres_grasses:{ main:'#859333', deep:'#5E6724' },
    oeufs:{ main:'#D3642B', deep:'#984218' },
    poissons:{ main:'#17779E', deep:'#0F5776' },
    produits_laitiers:{ main:'#DDB54A', deep:'#A77B18' },
    proteines_vegetales:{ main:'#A3A93A', deep:'#727823' },
    sucrants:{ main:'#9D8DB7', deep:'#705F89' },
    viandes_volailles:{ main:'#B93B27', deep:'#882919' }
  };
  return tones[String(catId || 'autre').trim()] || tones.autre;
}
function recipeInitials(name){
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return 'R';
  return parts.slice(0, 2).map(p => p.charAt(0)).join('').toUpperCase();
}
function renderUsageStarsHTML(meta){
  const stars = Math.max(0, Math.min(3, Number(meta?.stars || 0)));
  const rate = Number(meta?.rate || 0);
  const usedInRecipes = Number(meta?.usedInRecipes || 0);
  const totalRecipes = Number(meta?.totalRecipes || 0);
  const title = `Usage recettes : ${stars}/3 · ${rate.toFixed(1)} % (${usedInRecipes}/${totalRecipes || 0})`;
  return `<div class="usage-band usageStars" data-usage-stars="${stars}" data-usage-rate="${rate.toFixed(2)}" aria-label="${title}" title="${title}">
    <div class="usage-stars" aria-hidden="true">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div>
  </div>`;
}
function buildIngredientPillsHTML(data){
  const defaultUnit = data?.defaultUnit ? formatUnitLabel(data.defaultUnit) : "g";
  return `
    <div class="ingPills ingPills--compact subtitle" title="Unité par défaut : ${defaultUnit}">
      <span class="ingPill ok"><span class="ingPillText">${formatProfileLabel(data?.profile)}</span></span>
      <span class="sep">•</span>
      <span class="ingPill k"><span class="ingPillText">${defaultUnit}</span></span>
    </div>`;
}

function isRecipeComposeModeActive(){
  try{ return !!(window.NutriRecipeLibraryBridge && typeof window.NutriRecipeLibraryBridge.isActive === 'function' && window.NutriRecipeLibraryBridge.isActive()); }catch(_e){}
  return false;
}
function isIngredientSelectedForRecipe(id){
  try{ return !!(window.NutriRecipeLibraryBridge && typeof window.NutriRecipeLibraryBridge.isIngredientSelected === 'function' && window.NutriRecipeLibraryBridge.isIngredientSelected(id)); }catch(_e){}
  return false;
}
function renderRecipeSelectCheckboxHTML(id){
  const checked = isIngredientSelectedForRecipe(id);
  return `<div class="libCardSelectWrap" aria-hidden="${isRecipeComposeModeActive() ? "false" : "true"}">
    <label class="cardSelectCtl" title="Sélectionner pour la recette">
      <input class="cardSelectInput" type="checkbox" data-action="selectForRecipe" aria-label="Sélectionner pour la recette" ${checked ? "checked" : ""} />
      <span class="cardSelectBox" aria-hidden="true"></span>
    </label>
  </div>`;
}
function cardHTML(data, usageIndex){
  const kcal = Math.round(data.kcal);
  const thumb = (typeof data.thumb === "string" ? data.thumb : "").trim();
  const hasThumb = !!thumb && thumb.startsWith("data:image");
  const p = Math.round(data.p);
  const carbs = Math.round(data.carbs);
  const fat = Math.round(data.fat||0);
  const catId = data.categoryId || normalizeCategory(data.categoryLabel || data.category || "").id;
  const catLabel = data.categoryLabel || (catId ? ING_CAT_LABEL_BY_ID[catId] : (data.category||"—")) || "—";
  const tone = getCardTone(catId);
  const usageMeta = getIngredientUsageMeta(data, usageIndex);
  const noteText = cardNoteText(data.note);

  return `
  <div class="card libCardShell ingredient-card" style="--cat:${tone.main};--cat-deep:${tone.deep};" data-id="${data.id}"
       data-name="${encodeURIComponent(data.name)}"
       data-category="${encodeURIComponent(catId)}"
       data-categorylabel="${encodeURIComponent(catLabel)}"
       data-kcal="${data.kcal}"
       data-p="${data.p}"
       data-carbs="${data.carbs}"
       data-fat="${data.fat}"
       data-note="${encodeURIComponent(noteText)}"
       data-profile="${encodeURIComponent(data.profile || "solid")}"
       data-allowedunits="${encodeURIComponent(JSON.stringify(Array.isArray(data.allowedUnits) ? data.allowedUnits : ["g"]))}"
       data-defaultunit="${encodeURIComponent(data.defaultUnit || "g")}"
       data-conversions="${encodeDataObject(data.conversions)}"
       data-thumb="${encodeURIComponent((typeof data.thumb === "string" ? data.thumb : "").trim())}"
       data-usage-stars="${usageMeta.stars}"
       data-usage-rate="${usageMeta.rate.toFixed(2)}"
       data-selected-for-recipe="${isIngredientSelectedForRecipe(data.id) ? "true" : "false"}">
    <div class="card-inner">
      <div class="card-frame">
        <div class="top-rail libCardTop libCardTop--actionsOnly">
          <div class="rail-left">
            ${renderRecipeSelectCheckboxHTML(data.id)}
            <button class="infoDot info-dot-btn ${noteText ? "" : "hidden"}" type="button" data-action="note" aria-label="Note/source">•••</button>
            <div class="notePop hidden" data-role="notePop"></div>
          </div>
          ${renderUsageStarsHTML(usageMeta)}
          <div class="rail-right libCardActions">
            <button class="kebabBtn menu-btn" type="button" data-action="cardMenu" aria-label="Actions">
              <span class="menu-glyph" aria-hidden="true"><span></span><span></span><span></span></span>
            </button>
            <div class="kebabMenu hidden" role="menu" aria-label="Actions ingrédient">
              <button type="button" data-action="edit"><span>✏️</span><span>Modifier</span></button>
              <button type="button" data-action="duplicate"><span>⧉</span><span>Dupliquer</span></button>
              <button type="button" class="danger" data-action="delete"><span>🗑️</span><span>Supprimer</span></button>
            </div>
          </div>
        </div>

        <div class="thumb thumb--hero libCardMedia hero">
          <label class="thumbUpload" title="Importer une vignette (max 94 KB)">
            <input class="thumbInput" type="file" accept="image/*" />
            <span class="thumbPlaceholder ${hasThumb ? "hidden" : ""}">${recipeInitials(data.name)}</span>
            <img class="thumbPreview ${hasThumb ? "" : "hidden"}" ${hasThumb ? `src="${thumb}"` : ""} alt="Vignette" />
          </label>
          <button class="thumbRemove ${hasThumb ? "" : "hidden"}" type="button" aria-label="Supprimer l'image" title="Supprimer l'image">✕</button>
          <div class="thumbError hidden">Max 94 KB</div>
        </div>

        <div class="cardBody libCardBody">
          <div class="libCardIdentity title-block">
            <div class="libCardTitleRow" style="display:block;position:relative;width:100%;">
              <h4 class="cardTitle title" title="${data.name}"><span class="cardTitleText">${data.name}</span></h4>
            </div>
            <div class="libCardMeta">
              ${buildIngredientPillsHTML(data)}
            </div>
          </div>

          <div class="macro kpiRow libCardStats stats" aria-label="Valeurs nutritionnelles pour 100 grammes">
            <div class="kpi stat"><div class="kpiVal stat-value">${kcal}</div><div class="kpiLbl stat-label"><span class="stat-unit">KCAL</span><span>énergie</span></div></div>
            <div class="kpi stat"><div class="kpiVal stat-value">${String(data.p).replace('.',',')}</div><div class="kpiLbl stat-label"><span class="stat-unit">PROT.</span><span>g / 100</span></div></div>
            <div class="kpi stat"><div class="kpiVal stat-value">${String(data.carbs).replace('.',',')}</div><div class="kpiLbl stat-label"><span class="stat-unit">GLUC.</span><span>g / 100</span></div></div>
            <div class="kpi stat"><div class="kpiVal stat-value">${String(data.fat||0).replace('.',',')}</div><div class="kpiLbl stat-label"><span class="stat-unit">LIP.</span><span>g / 100</span></div></div>
          </div>

          <div class="libCardFooterMeta bottom-ribbon-wrap">
            <div class="badgeRow libCardCategoryRow">
              <span class="badge bottom-ribbon" title="${catLabel}"><span class="badgeText">${catLabel}</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function upsertCard(data, usageIndex){
  if(!ingGrid) return;
  const existing = ingGrid.querySelector(`.card[data-id="${data.id}"]`);
  if(existing){
    const noteText = cardNoteText(data.note);
    existing.dataset.name = encodeURIComponent(data.name);
    existing.dataset.category = encodeURIComponent(data.categoryId || normalizeCategory(data.categoryLabel || data.category || "").id || "");
    existing.dataset.categorylabel = encodeURIComponent(data.categoryLabel || (data.categoryId ? ING_CAT_LABEL_BY_ID[data.categoryId] : (data.category||"—")) || "—");
    existing.dataset.kcal = String(data.kcal);
    existing.dataset.p = String(data.p);
    existing.dataset.carbs = String(data.carbs);
    existing.dataset.fat = String(data.fat);
    existing.dataset.note = encodeURIComponent(noteText);
    existing.dataset.profile = encodeURIComponent(data.profile || "solid");
    existing.dataset.allowedunits = encodeURIComponent(JSON.stringify(Array.isArray(data.allowedUnits) ? data.allowedUnits : ["g"]));
    existing.dataset.defaultunit = encodeURIComponent(data.defaultUnit || "g");
    existing.dataset.conversions = encodeDataObject(data.conversions);
    existing.dataset.thumb = encodeURIComponent((typeof data.thumb === "string" ? data.thumb : "").trim());
    const usageMeta = getIngredientUsageMeta(data, usageIndex);
    existing.dataset.usageStars = String(usageMeta.stars);
    existing.dataset.usageRate = usageMeta.rate.toFixed(2);
    existing.dataset.selectedForRecipe = isIngredientSelectedForRecipe(data.id) ? "true" : "false";

    const thumb = (typeof data.thumb === "string" ? data.thumb : "").trim();
    const hasThumb = !!thumb && thumb.startsWith("data:image");
    const img = existing.querySelector('.thumbPreview');
    const ph = existing.querySelector('.thumbPlaceholder');
    const rm = existing.querySelector('.thumbRemove');
    if(img && ph && rm){
      if(hasThumb){ img.src = thumb; img.classList.remove('hidden'); ph.classList.add('hidden'); rm.classList.remove('hidden'); }
      else { img.removeAttribute('src'); img.classList.add('hidden'); ph.classList.remove('hidden'); ph.textContent = recipeInitials(data.name); rm.classList.add('hidden'); const inp = existing.querySelector('.thumbInput'); if(inp) inp.value = ""; }
    }

    const title = existing.querySelector('.cardTitleText') || existing.querySelector('.cardTitle');
    const badge = existing.querySelector('.badgeRow .badge');
    const pills = existing.querySelector('.ingPills');
    const macro = existing.querySelector('.macro');
    if(title) title.textContent = data.name;
    const titleWrap = existing.querySelector('.cardTitle');
    if(titleWrap) titleWrap.setAttribute('title', data.name);
    const catId = data.categoryId || normalizeCategory(data.categoryLabel || data.category || "").id;
    const catLabel = data.categoryLabel || (catId ? ING_CAT_LABEL_BY_ID[catId] : (data.category||"—")) || "—";
    const tone = getCardTone(catId);
    existing.style.setProperty('--cat', tone.main);
    existing.style.setProperty('--cat-deep', tone.deep);
    if(badge){
      const badgeText = badge.querySelector('.badgeText');
      if(badgeText) badgeText.textContent = catLabel; else badge.textContent = catLabel;
      badge.setAttribute('title', catLabel);
      badge.style.background = "";
      badge.style.color = "";
    }
    if(pills) pills.outerHTML = buildIngredientPillsHTML(data);
    if(macro){
      const vals = macro.querySelectorAll('.kpiVal');
      if(vals[0]) vals[0].textContent = String(Math.round(data.kcal));
      if(vals[1]) vals[1].textContent = String(data.p).replace('.',',');
      if(vals[2]) vals[2].textContent = String(data.carbs).replace('.',',');
      if(vals[3]) vals[3].textContent = String(data.fat||0).replace('.',',');
    }
    const usageNode = existing.querySelector('.usageStars');
    if(usageNode) usageNode.outerHTML = renderUsageStarsHTML(usageMeta);
    const selectInput = existing.querySelector('.cardSelectInput');
    if(selectInput) selectInput.checked = isIngredientSelectedForRecipe(data.id);
    const selectWrap = existing.querySelector('.libCardSelectWrap');
    if(selectWrap) selectWrap.setAttribute('aria-hidden', isRecipeComposeModeActive() ? "false" : "true");
    const hint = existing.querySelector('.infoDot');
    const pop = existing.querySelector('.notePop');
    if(hint){
      const hasNote = !!noteText;
      hint.classList.toggle('hidden', !hasNote);
      if(pop){
        pop.textContent = noteText;
        pop.classList.add('hidden');
      }
    }
    return;
  }
  ingGrid.insertAdjacentHTML('beforeend', cardHTML(data, usageIndex));
}

// ===============================
// Ingredient Search + Filters (FIX3 - scoped)
// ===============================
const ingQuery = document.getElementById('ingQuery');
const fltQuery = document.getElementById('fltQuery');
const fltCat   = document.getElementById('fltCategory');
const fltUsage = document.getElementById('fltUsageStars');
const btnApply = document.getElementById('btnFilterApply');
const btnReset = document.getElementById('btnFilterReset');

const flt = {
  kcalMin: document.getElementById('fltKcalMin'),
  kcalMax: document.getElementById('fltKcalMax'),
  pMin:    document.getElementById('fltPMin'),
  pMax:    document.getElementById('fltPMax'),
  gMin:    document.getElementById('fltGMin'),
  gMax:    document.getElementById('fltGMax'),
  lMin:    document.getElementById('fltLMin'),
  lMax:    document.getElementById('fltLMax'),
};

function _toNum(v){
  const s = String(v ?? '').trim();
  if(!s) return null;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
  function _inRange(val, mn, mx){
    const v = Number(val ?? 0);
    if(mn !== null && v < mn) return false;
    if(mx !== null && v > mx) return false;
    return true;
  }
  function _isIngredientFilterContext(){
    try{
      const api = window.NutriAppFilterModal;
      if(api && typeof api.getCurrentContext === 'function') return api.getCurrentContext() === 'ingredients';
      const modal = document.getElementById('filterModal');
      return !modal || String(modal.dataset.filterContext || 'ingredients') === 'ingredients';
    }catch(_){
      return true;
    }
  }
  function _getFilter(){
  const qPage = (ingQuery?.value || '').trim();
  const qModal = (fltQuery?.value || '').trim();
  const q = qPage || qModal;
  const cat = (fltCat?.value || '').trim();
  const usageStars = (fltUsage?.value || '').trim();
  return {
    q,
    cat,
    usageStars,
    kcalMin:_toNum(flt.kcalMin?.value), kcalMax:_toNum(flt.kcalMax?.value),
    pMin:_toNum(flt.pMin?.value),       pMax:_toNum(flt.pMax?.value),
    gMin:_toNum(flt.gMin?.value),       gMax:_toNum(flt.gMax?.value),
    lMin:_toNum(flt.lMin?.value),       lMax:_toNum(flt.lMax?.value),
  };
}

function applyIngredientFilters(){
  if(!ingGrid) return;

  const source = getIngredientStoreSnapshot();
  const usageIndex = buildIngredientUsageIndex(getRecipeStoreSnapshot());
  const f0 = _getFilter();
  const qKey = (typeof nameKey === 'function') ? nameKey(f0.q) : (f0.q || '').toLowerCase();

  const filtered = source.filter(it=>{
    if(!it) return false;

    if(qKey){
      const nKey = (typeof nameKey === 'function') ? nameKey(it.name) : String(it.name||'').toLowerCase();
      if(!nKey.includes(qKey)) return false;
    }

    if(f0.cat){
      if(String(it.categoryId||'') !== f0.cat) return false;
    }

    const usageMeta = getIngredientUsageMeta(it, usageIndex);
    if(f0.usageStars !== '' && String(usageMeta.stars) !== String(f0.usageStars)) return false;

    if(!_inRange(it.kcal,  f0.kcalMin, f0.kcalMax)) return false;
    if(!_inRange(it.p,     f0.pMin,    f0.pMax))    return false;
    if(!_inRange(it.carbs, f0.gMin,    f0.gMax))    return false;
    if(!_inRange(it.fat,   f0.lMin,    f0.lMax))    return false;

    return true;
  }).slice().sort((a,b)=>String(a?.name||'').localeCompare(String(b?.name||''), 'fr'));

  ingGrid.innerHTML = '';
  for(let i = filtered.length - 1; i >= 0; i--){
    const it = filtered[i];
    if(it && it.id) upsertCard(it, usageIndex);
  }

  const filterState = window.NutriAppState
    ? window.NutriAppState.getFilterState('ingredients', f0)
    : { type:'ingredients', active:!!(f0.q || f0.cat || f0.usageStars), criteria:f0 };
  const libraryState = window.NutriAppState
    ? window.NutriAppState.getLibraryState('ingredients', source, filtered, filterState)
    : { totalCount:source.length, visibleCount:filtered.length, storageEmpty:source.length === 0, filteredEmpty:source.length > 0 && filtered.length === 0 };
  window.NutriAppState?.publishFilterState?.('ingredients', filterState);
  window.NutriAppState?.publishLibraryState?.('ingredients', libraryState);
  const countEl = document.getElementById('ingCount');
  if(countEl){
    countEl.textContent = String(libraryState.totalCount);
    countEl.dataset.visibleCount = String(libraryState.visibleCount);
  }
  const emptyEl = document.getElementById('ingEmpty');
  if(emptyEl){
    emptyEl.style.display = libraryState.emptyKind ? 'block' : 'none';
    emptyEl.textContent = libraryState.storageEmpty
      ? 'Aucun ingrédient enregistré. Utilise le bouton + pour créer la première carte.'
      : (libraryState.filteredEmpty ? 'Aucun ingrédient ne correspond aux filtres actifs.' : '');
  }
  return libraryState;
}

// expose helper for other flows
window.NutriAppFilters = window.NutriAppFilters || {};
window.NutriAppFilters.applyIngredients = applyIngredientFilters;

// wiring: page search
if(ingQuery){
  ingQuery.addEventListener('input', ()=>{
    if(fltQuery) fltQuery.value = ingQuery.value;
    applyIngredientFilters();
  });
}

// wiring: modal apply (capture before close handler)
  if(btnApply){
    btnApply.addEventListener('click', ()=>{
      if(!_isIngredientFilterContext()) return;
      if(ingQuery && fltQuery && !ingQuery.value.trim()) ingQuery.value = fltQuery.value;
      applyIngredientFilters();
    }, {capture:true});
  }

// wiring: reset
  if(btnReset){
    btnReset.addEventListener('click', ()=>{
      if(!_isIngredientFilterContext()) return;
      if(ingQuery) ingQuery.value = '';
      if(fltQuery) fltQuery.value = '';
    if(fltCat) fltCat.value = '';
    if(fltUsage) fltUsage.value = '';
    Object.values(flt).forEach(el=>{ if(el) el.value = ''; });
    applyIngredientFilters();
  }, {capture:true});
}

// live change on cat/macros
[fltCat, fltUsage, flt.kcalMin, flt.kcalMax, flt.pMin, flt.pMax, flt.gMin, flt.gMax, flt.lMin, flt.lMax]
  .filter(Boolean)
  .forEach(el=> el.addEventListener('input', applyIngredientFilters));



function clearManual(){
  cm.name && (cm.name.value = '');
  cm.cat && (cm.cat.value = '');
  fillIngredientUnitForm(null);
  cm.kcal && (cm.kcal.value = '');
  cm.p && (cm.p.value = '');
  cm.c && (cm.c.value = '');
  cm.f && (cm.f.value = '');
  cm.note && (cm.note.value = '');
  editingId = null;
}

function readManual(){
  const name = (cm.name?.value || '').trim();
  const categoryId = (cm.cat?.value || '').trim();
  const categoryLabel = ING_CAT_LABEL_BY_ID[categoryId] || '—';
  const allowedUnits = getAllowedUnitsFromForm();
  const data = {
    id: editingId || ('ing_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6)),
    name: name || 'Ingrédient',
    categoryId: categoryId || '',
    categoryLabel: categoryLabel,
    profile: getProfileFromForm(),
    allowedUnits,
    defaultUnit: allowedUnits.includes(cm.defaultUnit?.value) ? cm.defaultUnit.value : (allowedUnits[0] || 'g'),
    conversions: {
      pieceWeightG: numOr0(cm.pieceWeightG?.value),
      mlWeightG: numOr0(cm.mlWeightG?.value),
      tbspWeightG: numOr0(cm.tbspWeightG?.value),
      tspWeightG: numOr0(cm.tspWeightG?.value),
    },
    kcal: numOr0(cm.kcal?.value),
    p: numOr0(cm.p?.value),
    carbs: numOr0(cm.c?.value),
    fat: numOr0(cm.f?.value),
    note: (cm.note?.value || '').trim()
  };
  return data;
}

function saveManual(){
  const previous = editingId ? getIngredientStoreSnapshot().find(it => String(it?.id) === String(editingId)) : null;
  const data = normalizeIngredient({ ...(previous || {}), ...readManual() });
  const now = new Date().toISOString();
  if(!data.createdAt) data.createdAt = now;
  data.updatedAt = now;
  const k = nameKey(data.name);

  // Politique A : unicité stricte (par nom normalisé)
  if(editingId){
    // En édition : interdire de prendre le nom d'un autre ingrédient
    for(const it of getIngredientStoreSnapshot()){
      if(it && it.id && String(it.id) !== String(editingId) && nameKey(it.name) === k){
        alert('Nom déjà utilisé : "' + data.name + '".\nChoisis un autre nom ou modifie l\'ingrédient existant.');
        return;
      }
    }
  }else{
    // En création : proposer de mettre à jour l'existant si même nom
    const existing = findByNameKey(k);
    if(existing && existing.id){
      const ok = confirm('"' + data.name + '" existe déjà.\n\nOK = Mettre à jour l\'existant\nAnnuler = Ne rien faire');
      if(!ok) return; // on garde la modale ouverte
      data.id = String(existing.id); // on écrase l'existant
      editingId = String(existing.id);
      if(existing.thumb && !data.thumb) data.thumb = existing.thumb;
      if(existing.sourceId && !data.sourceId) data.sourceId = existing.sourceId;
      if(existing.createdAt) data.createdAt = existing.createdAt;
    }
  }

  upsertCard(data);
  const storeWriteResult = upsertIngredientInStore(data);
  const saved = getIngredientStoreSnapshot().some(it => it && String(it.id) === String(data.id));
  if(storeWriteResult === false || !saved){
    console.error('[NutriIngredients] saveManual: ingredient not persisted', { id:data.id, name:data.name, storeWriteResult });
    return;
  }
  applyIngredientFilters();
  close();           // close only after persistence is confirmed
  clearManual();
}


cm.saveManual?.addEventListener('click', saveManual);
cm.cancelManual?.addEventListener('click', ()=>{ close(); clearManual(); });
document.getElementById('btnCreateSave')?.addEventListener('click', saveManual);

// Expose a small API for "Modifier" action from cards
window.NutriAppOpenCreate = function(opts){
  open();
  setMode('manual');
  const d = opts || {};
  editingId = d.id || null;
  if(cm.name) cm.name.value = d.name || '';
  if(cm.cat)  cm.cat.value = d.categoryId || d.category || '';
  fillIngredientUnitForm(d);
  if(cm.kcal) cm.kcal.value = (d.kcal ?? d.kcal100 ?? '');
  if(cm.p)    cm.p.value = (d.p ?? d.p100 ?? '');
  if(cm.c)    cm.c.value = (d.carbs ?? d.g100 ?? '');
  if(cm.f)    cm.f.value = (d.fat ?? d.l100 ?? '');
  if(cm.note) cm.note.value = d.note || '';
};
  ns.store = Object.assign({}, ns.store || {}, { numOr0, nameKey, findByNameKey, countDuplicateNameKeys, getIngredientStoreSnapshot, upsertIngredientInStore, getRecipeStoreSnapshot, buildIngredientUsageIndex, getIngredientUsageMeta, usageStarsFromRate });
  ns.ui = Object.assign({}, ns.ui || {}, {
    badgeClass, formatUnitLabel, formatProfileLabel, encodeDataObject, buildIngredientPillsHTML, renderUsageStarsHTML, cardHTML, upsertCard, applyIngredientFilters, clearManual, readManual, saveManual
  });
})();
