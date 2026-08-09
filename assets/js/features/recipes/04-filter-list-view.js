/* Phase 4.2 — Features / Recipes / Filter + list view */
(function RecipesFilterListView(){
  const ns = window.NutriRecipes = window.NutriRecipes || {};
  const byId = (ns.core && ns.core.byId) || window.byId || ((id)=>document.getElementById(id));
  const escapeHtml = (ns.core && ns.core.escapeHtml) || ((s)=>String(s ?? ''));
  const fmt1 = (ns.core && ns.core.fmt1) || ((n)=>String(n ?? 0));
  const applyTheme = (ns.domain && ns.domain.applyTheme) || function(){};
  const getRuntimeRecipes = (ns.store && ns.store.getRuntimeRecipes) || window.getRuntimeRecipes;
  const computeRecipeTotalsFromRows = (ns.domain && ns.domain.computeRecipeTotalsFromRows) || window.computeRecipeTotalsFromRows;

  const RECIPE_PREMIUM_THEME = {
    autre: { main:'#a99a73', deep:'#7f7356', soft:'#cec4ae', faint:'rgba(169,154,115,.10)' },
    legumes: { main:'#528347', deep:'#355c2f', soft:'#9abe92', faint:'rgba(82,131,71,.12)' },
    cereales_feculents: { main:'#E0B445', deep:'#A77C17', soft:'#edd28a', faint:'rgba(224,180,69,.12)' },
    proteines_vegetales: { main:'#A0A33B', deep:'#707324', soft:'#c9cb86', faint:'rgba(160,163,59,.12)' },
    produits_laitiers: { main:'#E5BA4B', deep:'#aa7c15', soft:'#efd58f', faint:'rgba(229,186,75,.12)' },
    petit_dej: { main:'#E0B445', deep:'#A77C17', soft:'#edd28a', faint:'rgba(224,180,69,.12)' },
    patisseries: { main:'#d7a27e', deep:'#8b4c2f', soft:'#f0d1bc', faint:'rgba(215,162,126,.14)' },
    desserts: { main:'#d7a27e', deep:'#8b4c2f', soft:'#f0d1bc', faint:'rgba(215,162,126,.14)' },
    soupes: { main:'#7aa5e1', deep:'#33558f', soft:'#c5d8f5', faint:'rgba(122,165,225,.14)' },
    bases: { main:'#7aa5e1', deep:'#33558f', soft:'#c5d8f5', faint:'rgba(122,165,225,.14)' },
    batch_cooking: { main:'#4d8a5a', deep:'#356326', soft:'#b8d6bf', faint:'rgba(77,138,90,.14)' },
    snacks: { main:'#d9b04a', deep:'#8a5b08', soft:'#efd58f', faint:'rgba(217,176,74,.14)' }
  };
  function applyRecipePremiumTheme(cardEl, catId){
    if(!cardEl) return;
    const key = String(catId || 'autre').trim() || 'autre';
    const fromDomain = (window.CategoryDomain && typeof window.CategoryDomain.getRecipeCategoryTheme === 'function')
      ? window.CategoryDomain.getRecipeCategoryTheme(key)
      : null;
    const t = fromDomain || RECIPE_PREMIUM_THEME[key] || RECIPE_PREMIUM_THEME.autre;
    cardEl.style.setProperty('--card', '#f6f2ea');
    cardEl.style.setProperty('--card2', '#f1ebdf');
    cardEl.style.setProperty('--shadow', '0 12px 30px rgba(72,47,26,.10), 0 2px 8px rgba(72,47,26,.06)');
    cardEl.style.setProperty('--cat-main', t.main);
    cardEl.style.setProperty('--cat-deep', t.deep);
    cardEl.style.setProperty('--cat-soft', t.soft);
    cardEl.style.setProperty('--cat-faint', t.faint);
  }
  const getApp = ()=>window.NutriApp || {};
  const renderRecipeThumb = function(){
    if(ns.ui && typeof ns.ui.renderRecipeThumb === 'function') return ns.ui.renderRecipeThumb.apply(null, arguments);
    if(getApp().ui && typeof getApp().ui.renderRecipeThumb === 'function') return getApp().ui.renderRecipeThumb.apply(null, arguments);
    return undefined;
  };
  const openThumbImportForRecipe = function(){
    if(ns.ui && typeof ns.ui.openThumbImportForRecipe === 'function') return ns.ui.openThumbImportForRecipe.apply(null, arguments);
    if(getApp().ui && typeof getApp().ui.openThumbImportForRecipe === 'function') return getApp().ui.openThumbImportForRecipe.apply(null, arguments);
    return undefined;
  };
  const openKebabPopoverForRecipe = function(){
    if(ns.ui && typeof ns.ui.openKebabPopoverForRecipe === 'function') return ns.ui.openKebabPopoverForRecipe.apply(null, arguments);
    if(getApp().ui && typeof getApp().ui.openKebabPopoverForRecipe === 'function') return getApp().ui.openKebabPopoverForRecipe.apply(null, arguments);
    return undefined;
  };
  const openRecipeScenario = function(){
    if(ns.ui && typeof ns.ui.openRecipeScenario === 'function') return ns.ui.openRecipeScenario.apply(null, arguments);
    if(getApp().actions && typeof getApp().actions.openRecipeScenario === 'function') return getApp().actions.openRecipeScenario.apply(null, arguments);
    if(getApp().ui && typeof getApp().ui.openRecipeScenario === 'function') return getApp().ui.openRecipeScenario.apply(null, arguments);
    if(getApp().ui && getApp().ui.recipeScenario && typeof getApp().ui.recipeScenario.openById === 'function') return getApp().ui.recipeScenario.openById.apply(getApp().ui.recipeScenario, arguments);
    return undefined;
  };
  const openRecipeDetail = function(){
    if(ns.ui && typeof ns.ui.openRecipeDetail === 'function') return ns.ui.openRecipeDetail.apply(null, arguments);
    if(getApp().actions && typeof getApp().actions.openRecipeDetail === 'function') return getApp().actions.openRecipeDetail.apply(null, arguments);
    if(getApp().ui && typeof getApp().ui.openRecipeDetail === 'function') return getApp().ui.openRecipeDetail.apply(null, arguments);
    if(getApp().ui && getApp().ui.recipeDetail && typeof getApp().ui.recipeDetail.openById === 'function') return getApp().ui.recipeDetail.openById.apply(getApp().ui.recipeDetail, arguments);
    return undefined;
  };
/* === Global helpers (shim) === */
if(typeof window.byId!=="function"){ window.byId = (id)=>document.getElementById(id); }
if(typeof window.naNotifyRecipeCategoriesChanged!=="function"){
  window.naNotifyRecipeCategoriesChanged = ()=>{ try{ window.dispatchEvent(new CustomEvent("na:recipeCategoriesChanged")); }catch(e){} };
}


function _naNormStr(s){ return String(s||"").trim(); }
function _naSlug(s){
  return _naNormStr(s)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"_")
    .replace(/^_+|_+$/g,"");
}
function getRecipeCategoriesForFilter(){
  try{
    if(window.CategoryDomain && typeof window.CategoryDomain.getRecipeCategoriesForFilter === "function"){
      return window.CategoryDomain.getRecipeCategoriesForFilter(getRuntimeRecipes());
    }
  }catch(_e){}
  const seen = new Map();
  (getRuntimeRecipes() || []).forEach(r => {
    const id = _naNormStr(r?.categoryId || "");
    if(!id) return;
    if(!seen.has(id)) seen.set(id, { id, label: id.replace(/_/g, " ") });
  });
  return Array.from(seen.values());
}


function refreshRecipeFilter(){
  const sel = byId("recipeFilter");
  if(!sel) return;

  const prev = sel.value;
  sel.innerHTML = "";
  sel.appendChild(new Option("Toutes", "all"));

  const cats = getRecipeCategoriesForFilter()
    .filter(c => c && c.id && c.label);

  cats.sort((a,b)=> String(a.label).localeCompare(String(b.label), "fr"));
  for(const c of cats){
    sel.appendChild(new Option(c.label, c.id));
  }

  if(prev && [...sel.options].some(o=>o.value===prev)) sel.value = prev;
  if(!sel.value) sel.value = "all";
}


// Expose / sync filters when recipe categories change (CreateModal → Filters modal)
window.addEventListener("na:recipeCategoriesChanged", ()=>{ refreshRecipeFilter(); });
/* store subscriptions are bound by RecipeListView.bindStore() in Phase 3 */
function renderRecipeList(){
  const listEl = byId("recipeList");
  if(!listEl) return;

  const searchEl = byId("recipeSearch");
  const filterEl = byId("recipeFilter");
  const sortEl = byId("recipeSort");

  const q = String(searchEl?.value || "").trim().toLowerCase();
  const filt = String(filterEl?.value || "all").trim() || "all";
  const sort = String(sortEl?.value || "name").trim() || "name";

  const recipes = getRuntimeRecipes();

  listEl.innerHTML = "";

  const filtered = recipes.filter(r=>{
    const name = String(r?.name || "").toLowerCase();
    const catId = String(r?.categoryId || r?.category || r?.cat || "autre").trim() || "autre";
    const okText = !q || name.includes(q);
    const okCat = (filt === "all") || (catId === filt);
    return okText && okCat;
  }).map(r=>{
    const rows = Array.isArray(r.rows) ? r.rows : [];
    const t = computeRecipeTotalsFromRows(rows);
    const partCount = Math.max(1, Number.isFinite(Number(r?.parts)) ? Number(r.parts) : (Number.isFinite(Number(r?.portions)) ? Number(r.portions) : 1));
    const ingredientCount = rows.filter(row => {
      const ingredientId = String(row?.ingredientId || '').trim();
      const ingredientName = String(row?.ingredientName || '').trim();
      return !!(ingredientId || ingredientName);
    }).length;
    return {
      r,
      t,
      partCount,
      ingredientCount,
      per: {
        kcal: (t?.totK || 0) / partCount,
        p: (t?.totP || 0) / partCount,
        g: (t?.totG || 0) / partCount,
        l: (t?.totL || 0) / partCount
      }
    };
  });

  filtered.sort((a,b)=>{
    if(sort === "kcal100") return (a.per?.kcal || 0) - (b.per?.kcal || 0);
    return String(a.r?.name || "").localeCompare(String(b.r?.name || ""), "fr");
  });

  const countEl = byId("recipeCount");
  if(countEl) countEl.textContent = String(recipes.length);

  for(const {r,t,partCount,ingredientCount,per} of filtered){
    const card = document.createElement("article");
    card.className = "recipeCard libCardShell";
    card.dataset.recipeId = String(r.id || "");

    const catId = String(r.categoryId || r.category || r.cat || "autre").trim() || "autre";
    const catLabel = (window.CategoryDomain && typeof window.CategoryDomain.labelForCategoryId === "function") ? window.CategoryDomain.labelForCategoryId(catId) : (String(catId || "") || "Autre");
    const parts = partCount;
    const prepRaw = r?.prepTime;
    const prepText = String(prepRaw ?? "").trim();
    const prepLabel = prepText ? (/^\d+(?:[.,]\d+)?$/.test(prepText) ? `${prepText} min` : prepText) : "";

    card.innerHTML = `
      <div class="libCardTop recipeCardTop">
        <div class="recipeActions libCardActions">
          <button class="kebabBtn" type="button" aria-label="Actions recette" title="Actions">⋯</button>
        </div>
      </div>

      <div class="recipeOpenHit libCardOpenHit" data-open-detail role="button" tabindex="0" aria-label="Ouvrir la fiche recette ${escapeHtml(String(r.name || "Recette"))}">
        <div class="thumb libCardMedia recipeCardMedia" data-thumb aria-hidden="true"></div>
        <div class="recipeMain libCardBody">
          <div class="libCardIdentity">
            <h3 class="recipeTitle" title="${escapeHtml(String(r.name || "Recette"))}"><span class="recipeTitleText">${escapeHtml(String(r.name || "Recette"))}</span></h3>
            <div class="metaRow libCardMeta">
              <div class="metaTop recipeUsageRow">
                <button class="pill portionsPill portionsPill--scenario" type="button" aria-label="Adapter les quantités de la recette ${escapeHtml(String(r.name || "Recette"))}" title="Cliquer pour adapter les quantités de la recette"><span class="pillText"><b>${escapeHtml(String(parts || 1))}</b> Portions</span><span class="portionsClickHint" aria-hidden="true">Adapter</span></button>
                <span class="dotSep" aria-hidden="true"></span>
                <span class="pill recipeIngredientCountPill" title="${escapeHtml(String(ingredientCount))} ingrédient${ingredientCount > 1 ? 's' : ''}"><span class="pillText">${escapeHtml(String(ingredientCount))} ingrédients</span></span>
                ${prepLabel ? `<span class="dotSep" aria-hidden="true"></span><span class="pill prepTimePill" title="Temps de préparation : ${escapeHtml(String(prepLabel))}"><span class="pillText">${escapeHtml(String(prepLabel))}</span></span>` : ''}
              </div>
            </div>
          </div>
          <div class="metaBottom macro kpiRow libCardStats" aria-label="Valeurs nutritionnelles par portion">
            <div class="kpi"><div class="kpiVal">${fmt1(per?.kcal || 0)}</div><div class="kpiLbl"><span class="statUnit">KCAL</span><span class="statBase">énergie</span></div></div>
            <div class="kpi"><div class="kpiVal">${fmt1(per?.p || 0)}</div><div class="kpiLbl"><span class="statUnit">PROT.</span><span class="statBase">g / portion</span></div></div>
            <div class="kpi"><div class="kpiVal">${fmt1(per?.g || 0)}</div><div class="kpiLbl"><span class="statUnit">GLUC.</span><span class="statBase">g / portion</span></div></div>
            <div class="kpi"><div class="kpiVal">${fmt1(per?.l || 0)}</div><div class="kpiLbl"><span class="statUnit">LIP.</span><span class="statBase">g / portion</span></div></div>
          </div>
          <div class="recipeCardFooterMeta">
            <span class="pill catPill" data-cat title="${escapeHtml(String(catLabel || "Autre"))}"><span class="pillText">${escapeHtml(String(catLabel || "Autre"))}</span></span>
          </div>
        </div>
      </div>
    `;

    const thumbEl = card.querySelector('[data-thumb]');
    renderRecipeThumb(thumbEl, r);
    if(thumbEl){
      thumbEl.removeAttribute("aria-hidden");
      thumbEl.setAttribute("role", "button");
      thumbEl.setAttribute("tabindex", "0");
      thumbEl.setAttribute("aria-label", `Importer une image pour ${String(r.name || "Recette")}`);
      thumbEl.setAttribute("title", "Importer une vignette (max 94 KB)");
      thumbEl.addEventListener("click", (e)=>{
        e.preventDefault();
        e.stopPropagation();
        openThumbImportForRecipe(r.id);
      });
      thumbEl.addEventListener("keydown", (e)=>{
        if(e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        openThumbImportForRecipe(r.id);
      });
    }

    applyTheme(card.querySelector("[data-cat]"), catId);
    applyRecipePremiumTheme(card, catId);

    const openHit = card.querySelector('[data-open-detail]');
    openHit?.addEventListener("click", (e)=>{
      if(e.target && e.target.closest && (e.target.closest(".portionsPill") || e.target.closest(".recipeCardMedia") || e.target.closest(".kebabBtn") || e.target.closest("#kebabPopover"))) return;
      openRecipeDetail(r.id);
    });
    openHit?.addEventListener("keydown", (e)=>{
      if(e.key !== 'Enter' && e.key !== ' ') return;
      if(e.target && e.target.closest && (e.target.closest(".portionsPill") || e.target.closest(".recipeCardMedia"))) return;
      e.preventDefault();
      openRecipeDetail(r.id);
    });

    const portionsBtn = card.querySelector('.portionsPill');
    portionsBtn?.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      openRecipeScenario(r.id);
    });

    const kebabBtn = card.querySelector(".kebabBtn");
    kebabBtn?.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      openKebabPopoverForRecipe(r.id, kebabBtn);
    });

    listEl.appendChild(card);
  }

  const emptyEl = byId("recipeEmpty");
  if(emptyEl) emptyEl.style.display = (filtered.length===0) ? "block" : "none";
}



const RecipeListView = {
  __domBound: false,
  __storeBound: false,
  __initialized: false,
  __unsubs: [],
  getState(){
    return {
      query: String(byId("recipeSearch")?.value || "").trim().toLowerCase(),
      filter: String(byId("recipeFilter")?.value || "all").trim() || "all",
      sort: String(byId("recipeSort")?.value || "name").trim() || "name"
    };
  },
  render(){
    return renderRecipeList();
  },
  refreshFilter(){
    return refreshRecipeFilter();
  },
  bindStore(){
    if(this.__storeBound) return;
    this.__storeBound = true;
    if(window.NutriStore && typeof window.NutriStore.subscribe === "function"){
      this.__unsubs.push(window.NutriStore.subscribe("recipes:changed", ()=>{
        try{ this.refreshFilter(); }catch(_){}
        try{ this.render(); }catch(_){}
      }));
      this.__unsubs.push(window.NutriStore.subscribe("ingredients:changed", ()=>{
        try{ this.render(); }catch(_){}
      }));
      this.__unsubs.push(window.NutriStore.subscribe("categories:changed", ()=>{
        try{ this.refreshFilter(); }catch(_){}
      }));
    }
  },
  bindDom(){
    if(this.__domBound) return;
    this.__domBound = true;
    byId("recipeSearch")?.addEventListener("input", ()=>this.render());
    byId("recipeFilter")?.addEventListener("change", ()=>this.render());
    byId("recipeSort")?.addEventListener("change", ()=>this.render());
  },
  init(){
    if(this.__initialized) return;
    this.__initialized = true;
    this.bindDom();
    this.bindStore();
    this.refreshFilter();
    this.render();
  }
};
  ns.ui = Object.assign({}, ns.ui || {}, { recipeList: RecipeListView, RecipeListView, renderRecipeList, refreshRecipeFilter, getRecipeCategoriesForFilter });
})();
