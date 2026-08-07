/* Phase 4.2 — Features / Recipes / Scenario + actions runtime */
(function RecipesScenarioActionsRuntime(){
  const ns = window.NutriRecipes = window.NutriRecipes || {};
  const byId = (ns.core && ns.core.byId) || window.byId || ((id)=>document.getElementById(id));
  const toNum = (ns.core && ns.core.toNum) || ((v)=>Number(v)||0);
  const escapeHtml = (ns.core && ns.core.escapeHtml) || ((s)=>String(s ?? ''));
  const showView = (ns.core && ns.core.showView) || function(){};
  const fmt1 = (ns.core && ns.core.fmt1) || ((n)=>String(n ?? 0));
  const initials = (ns.core && ns.core.initials) || ((name)=>String(name||'R').slice(0,2).toUpperCase());
  const clamp = (ns.core && ns.core.clamp) || ((n,a,b)=>{ const x = Number(n); return Math.max(a, Math.min(b, Number.isFinite(x) ? x : a)); });
  const normalizeRecipe = (ns.domain && ns.domain.normalizeRecipe) || window.normalizeRecipe;
  const normalizeCategoryId = (ns.domain && ns.domain.normalizeCategoryId) || function(v){ return String(v||'autre'); };
  const labelForIngredientCategoryId = (ns.domain && ns.domain.labelForIngredientCategoryId) || function(){ return 'Autre'; };
  const applyTheme = (ns.domain && ns.domain.applyTheme) || window.applyTheme || function(){};
  function getResolveRecipeRow(){
    return (ns.editor && ns.editor.resolveRecipeRow) || window.resolveRecipeRow;
  }
  const recipeMacrosFromGrams = (ns.editor && ns.editor.recipeMacrosFromGrams) || window.recipeMacrosFromGrams;
  const getCurrentRecipe = (ns.state && ns.state.getCurrentRecipe) || window.getCurrentRecipe;
  const setCurrentRecipe = (ns.state && ns.state.setCurrentRecipe) || window.setCurrentRecipe;
  const getScenarioPartsValue = (ns.state && ns.state.getScenarioPartsValue) || window.getScenarioPartsValue;
  const setScenarioPartsValue = (ns.state && ns.state.setScenarioPartsValue) || window.setScenarioPartsValue;
  const getRecipeBaseParts = (ns.state && ns.state.getRecipeBaseParts) || window.getRecipeBaseParts;
  const getScaledRows = (ns.state && ns.state.getScaledRows) || window.getScaledRows;
  const getRuntimeIngredients = (ns.store && ns.store.getRuntimeIngredients) || window.getRuntimeIngredients;
  const setRuntimeIngredients = (ns.store && ns.store.setRuntimeIngredients) || window.setRuntimeIngredients;
  const getRuntimeRecipes = (ns.store && ns.store.getRuntimeRecipes) || window.getRuntimeRecipes;
  const setRuntimeRecipes = (ns.store && ns.store.setRuntimeRecipes) || window.setRuntimeRecipes;
  const getIngredientById = (ns.domain && ns.domain.getIngredientById) || window.getIngredientById;
  const computeRecipeTotalsFromRows = (ns.domain && ns.domain.computeRecipeTotalsFromRows) || window.computeRecipeTotalsFromRows;
  const getApp = ()=>window.NutriApp || {};
  const RecipeListView = (ns.ui && (ns.ui.recipeList || ns.ui.RecipeListView)) || (getApp().ui && getApp().ui.recipeList);

  function closeScenarioUnifiedInfoDots(except){
    Array.from(document.querySelectorAll('.uiInfoAnchor.open')).forEach((anchor)=>{
      if(except && anchor === except) return;
      anchor.classList.remove('open');
      const btn = anchor.querySelector('.uiInfoDot');
      if(btn) btn.setAttribute('aria-expanded', 'false');
    });
  }
  function bindScenarioUnifiedInfoDot(anchor){
    if(!anchor || anchor.dataset.scenarioInfoBound === '1') return anchor;
    const btn = anchor.querySelector('.uiInfoDot');
    if(!btn) return anchor;
    anchor.dataset.scenarioInfoBound = '1';
    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      const willOpen = !anchor.classList.contains('open');
      closeScenarioUnifiedInfoDots(anchor);
      anchor.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
    return anchor;
  }
  function buildScenarioUnifiedInfoDot(text, label){
    const anchor = document.createElement('span');
    anchor.className = 'uiInfoAnchor';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'uiInfoDot';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', label || 'Informations');
    btn.textContent = 'i';
    const bubble = document.createElement('div');
    bubble.className = 'uiInfoBubble';
    bubble.textContent = text || '';
    anchor.append(btn, bubble);
    return bindScenarioUnifiedInfoDot(anchor);
  }
  document.addEventListener('click', function(ev){
    if(ev.target && ev.target.closest && ev.target.closest('.uiInfoAnchor')) return;
    closeScenarioUnifiedInfoDots();
  });
  document.addEventListener('keydown', function(ev){
    if(ev.key === 'Escape') closeScenarioUnifiedInfoDots();
  });
  function renderRecipesPage(){
    const app = getApp();
    const listView = (ns.ui && (ns.ui.recipeList || ns.ui.RecipeListView)) || (app.ui && app.ui.recipeList);
    if(listView && typeof listView.render === 'function') return listView.render();
    if(app.compat && typeof app.compat.renderRecipeList === 'function') return app.compat.renderRecipeList();
    return undefined;
  }

  const unitLabel = (u)=>({ g:"g", piece:"pièce", ml:"ml", tbsp:"càs", tsp:"càc" })[String(u||"").trim()] || String(u||"g");
  function gramsForUnit(ing, unit){
    const u = String(unit || "g").trim();
    if(u === "g") return 1;
    const conv = ing?.conversions || {};
    if(u === "piece") return toNum(conv.pieceWeightG);
    if(u === "ml") return toNum(conv.mlWeightG || conv.mlWeight);
    if(u === "tbsp") return toNum(conv.tbspWeightG);
    if(u === "tsp") return toNum(conv.tspWeightG);
    return 0;
  }
  function getScenarioDisplayUnit(ing, unit){
    return String(unit || ing?.defaultUnit || "g").trim() || "g";
  }
  function formatRowDisplayQty(ing, gramsResolved, qty, unit){
    const displayUnit = getScenarioDisplayUnit(ing, unit);
    const resolvedG = clamp(toNum(gramsResolved), 0, 1e9);
    const sourceQty = clamp(toNum(qty), 0, 1e9);
    const sourceUnit = String(unit || displayUnit || "g").trim() || "g";

    if(displayUnit === "g"){
      if(resolvedG > 0) return `${fmt1(resolvedG)} g`;
      if(sourceUnit === "g" && sourceQty > 0) return `${fmt1(sourceQty)} g`;
    }else{
      const gPerUnit = gramsForUnit(ing, displayUnit);
      if(gPerUnit > 0 && resolvedG > 0) return `${fmt1(resolvedG / gPerUnit)} ${unitLabel(displayUnit)}`;
      if(sourceUnit === displayUnit && sourceQty > 0) return `${fmt1(sourceQty)} ${unitLabel(displayUnit)}`;
    }

    if(sourceQty > 0) return `${fmt1(sourceQty)} ${unitLabel(sourceUnit)}`;
    if(resolvedG > 0) return `${fmt1(resolvedG)} g`;
    return "—";
  }
  function sanitizeImageSrc(v){
    const s = String(v ?? '').trim();
    if(!s) return '';
    const lower = s.toLowerCase();
    if(lower === 'undefined' || lower === 'null' || lower === '[object object]') return '';
    return s;
  }
  function ingredientThumbSrc(ing){
    return sanitizeImageSrc(
      ing?.thumb ?? ing?.thumbnail ?? ing?.vignette ?? ing?.image ?? ing?.img ?? ing?.photo ?? ing?.photoDataUrl ?? ing?.dataUrl ?? ing?.thumbDataUrl ?? ''
    );
  }
/* =========================
   Recipe card actions (edit / duplicate / delete)
   - uses the existing CreateModal (manual tab) as editor
========================= */
function closeAllRecipeMenus(){
  const pop = byId("kebabPopover");
  if(!pop) return;
  pop.classList.add("hidden");
  pop.removeAttribute("data-recipe-id");
}

function ensureKebabPopover(){
  let pop = byId("kebabPopover");
  if(pop) return pop;

  pop = document.createElement("div");
  pop.id = "kebabPopover";
  pop.className = "kebabMenu hidden";
  pop.setAttribute("role","menu");
  pop.setAttribute("aria-label","Actions recette");
  pop.innerHTML = `
    <button type="button" data-act="edit" role="menuitem"><span class="menuIcon">✏️</span><span>Modifier</span></button>
    <button type="button" data-act="duplicate" role="menuitem"><span class="menuIcon">⧉</span><span>Dupliquer</span></button>
    <button type="button" data-act="convert-ingredient" role="menuitem"><span class="menuIcon">🧪</span><span>Créer comme ingrédient</span></button>
    <button type="button" data-act="delete" role="menuitem" class="danger"><span class="menuIcon">🗑️</span><span>Supprimer</span></button>
  `;
  document.body.appendChild(pop);

  // Actions
  pop.addEventListener("click", (e)=>{
    const btn = e.target instanceof HTMLElement ? e.target.closest("button[data-act]") : null;
    if(!btn) return;
    e.preventDefault(); e.stopPropagation();
    const act = btn.getAttribute("data-act");
    const rid = pop.getAttribute("data-recipe-id");
    if(!rid) return;

    if(act === "edit") openRecipeEditor(rid);
    else if(act === "duplicate") duplicateRecipe(rid);
    else if(act === "convert-ingredient") openRecipeConvertModal(rid);
    else if(act === "delete") deleteRecipe(rid);

    closeAllRecipeMenus();
  });

  return pop;
}

function getIngredientCategoriesForConversion(){
  try{
    if(window.IngredientCategoryDomain && typeof window.IngredientCategoryDomain.getIngredientCategories === "function"){
      return window.IngredientCategoryDomain.getIngredientCategories();
    }
  }catch(_e){}
  return Array.isArray(window.ING_CATEGORY_ITEMS) ? window.ING_CATEGORY_ITEMS.slice() : [];
}
function recipeResolvedTotalGrams(recipe){
  const rows = Array.isArray(recipe?.rows) ? recipe.rows : [];
  const ings = (typeof getRuntimeIngredients === 'function') ? getRuntimeIngredients() : [];
  const resolveRecipeRow = getResolveRecipeRow();
  let total = 0;
  for(const row of rows){
    try{
      if(typeof resolveRecipeRow === 'function'){
        const resolved = resolveRecipeRow(row, ings);
        total += Number(resolved?.gramsResolved || 0);
      }else{
        total += Number(row?.gramsResolved || 0);
      }
    }catch(_e){
      total += Number(row?.gramsResolved || 0);
    }
  }
  return total > 0 ? total : 0;
}
function computeRecipeConversionPreview(recipe, mode, finalWeight){
  const rowsWeight = recipeResolvedTotalGrams(recipe);
  const storedFinal = Number(recipe?.cookedWeight || recipe?.poidsCuit || 0);
  const manualFinal = Number(finalWeight || 0);
  const usedWeight = (mode === 'final') ? (manualFinal > 0 ? manualFinal : storedFinal) : rowsWeight;
  const totals = (typeof computeRecipeTotalsFromRows === 'function') ? computeRecipeTotalsFromRows(Array.isArray(recipe?.rows) ? recipe.rows : []) : { totK:0, totP:0, totG:0, totL:0 };
  const valid = usedWeight > 0;
  return {
    valid,
    mode,
    rowsWeight,
    storedFinal,
    usedWeight,
    kcal100: valid ? ((Number(totals?.totK || 0) / usedWeight) * 100) : 0,
    p100: valid ? ((Number(totals?.totP || 0) / usedWeight) * 100) : 0,
    c100: valid ? ((Number(totals?.totG || 0) / usedWeight) * 100) : 0,
    f100: valid ? ((Number(totals?.totL || 0) / usedWeight) * 100) : 0,
  };
}
function ensureRecipeConvertIngredientCategoryOptions(){
  const sel = byId('recipeConvertIngredientCategory');
  if(!sel) return;
  const cats = getIngredientCategoriesForConversion().slice().sort((a,b)=>String(a.label||'').localeCompare(String(b.label||''), 'fr'));
  const prev = sel.value;
  sel.innerHTML = cats.map(c=>`<option value="${escapeHtml(String(c.id || ''))}">${escapeHtml(String(c.label || c.id || ''))}</option>`).join('');
  if(prev && [...sel.options].some(o=>o.value===prev)) sel.value = prev;
  if(!sel.value) sel.value = 'autre';
}
function closeRecipeConvertModal(){
  const ov = byId('recipeConvertOverlay');
  if(!ov) return;
  ov.classList.add('hidden');
  ov.setAttribute('aria-hidden', 'true');
  ov.removeAttribute('data-recipe-id');
}
function renderRecipeConvertPreview(){
  const rid = String(byId('recipeConvertOverlay')?.getAttribute('data-recipe-id') || '');
  const recipe = (typeof getRuntimeRecipes === 'function' ? getRuntimeRecipes() : []).find(r=>String(r?.id)===rid);
  const mode = byId('recipeConvertWeightModeFinal')?.checked ? 'final' : 'rows';
  const finalWeight = byId('recipeConvertFinalWeight')?.value || '';
  const previewEl = byId('recipeConvertPreview');
  const summaryEl = byId('recipeConvertWeightSummary');
  const statusEl = byId('recipeConvertStatus');
  if(!recipe || !previewEl || !summaryEl || !statusEl) return;
  const p = computeRecipeConversionPreview(recipe, mode, finalWeight);
  summaryEl.innerHTML = `
    <div><b>Poids lignes :</b> ${fmt1(p.rowsWeight || 0)} g</div>
    <div><b>Poids final recette :</b> ${fmt1(p.storedFinal || 0)} g</div>
    <div><b>Poids utilisé :</b> ${fmt1(p.usedWeight || 0)} g</div>
  `;
  previewEl.innerHTML = `
    <div class="recipeConvertPreview__kpi"><span>KCAL</span><b>${fmt1(p.kcal100 || 0)}</b><small>/ 100 g</small></div>
    <div class="recipeConvertPreview__kpi"><span>Prot.</span><b>${fmt1(p.p100 || 0)}</b><small>g / 100 g</small></div>
    <div class="recipeConvertPreview__kpi"><span>Gluc.</span><b>${fmt1(p.c100 || 0)}</b><small>g / 100 g</small></div>
    <div class="recipeConvertPreview__kpi"><span>Lip.</span><b>${fmt1(p.f100 || 0)}</b><small>g / 100 g</small></div>
  `;
  statusEl.textContent = p.valid ? 'Aperçu prêt. Le nouvel ingrédient sera créé avec une base nutritionnelle au 100 g.' : 'Poids exploitable manquant. Renseigne un poids final ou vérifie les lignes de recette.';
  statusEl.style.color = p.valid ? 'var(--ink500)' : '#7a4b12';
}
function openRecipeConvertModal(recipeId){
  const recipe = (typeof getRuntimeRecipes === 'function' ? getRuntimeRecipes() : []).find(r=>String(r?.id)===String(recipeId));
  const ov = byId('recipeConvertOverlay');
  if(!recipe || !ov) return;
  ov.classList.remove('hidden');
  ov.setAttribute('aria-hidden', 'false');
  ov.setAttribute('data-recipe-id', String(recipeId));
  ensureRecipeConvertIngredientCategoryOptions();
  const title = String(recipe?.name || 'Recette').trim() || 'Recette';
  if(byId('recipeConvertIngredientName')) byId('recipeConvertIngredientName').value = title;
  if(byId('recipeConvertFinalWeight')) byId('recipeConvertFinalWeight').value = Number(recipe?.cookedWeight || recipe?.poidsCuit || 0) > 0 ? String(Number(recipe?.cookedWeight || recipe?.poidsCuit || 0)) : '';
  if(byId('recipeConvertWeightModeRows')) byId('recipeConvertWeightModeRows').checked = true;
  if(byId('recipeConvertSubtitle')) byId('recipeConvertSubtitle').textContent = `Recette source : ${title}`;
  renderRecipeConvertPreview();
}
function convertRecipeToIngredient(recipeId){
  const recipes = typeof getRuntimeRecipes === 'function' ? getRuntimeRecipes() : [];
  const recipe = recipes.find(r=>String(r?.id)===String(recipeId));
  if(!recipe) return false;
  const name = String(byId('recipeConvertIngredientName')?.value || '').trim();
  const categoryId = String(byId('recipeConvertIngredientCategory')?.value || 'autre').trim() || 'autre';
  const mode = byId('recipeConvertWeightModeFinal')?.checked ? 'final' : 'rows';
  const finalWeight = byId('recipeConvertFinalWeight')?.value || '';
  const statusEl = byId('recipeConvertStatus');
  if(!name){
    if(statusEl){ statusEl.textContent = 'Nom du nouvel ingrédient manquant.'; statusEl.style.color = '#7a4b12'; }
    return false;
  }
  const p = computeRecipeConversionPreview(recipe, mode, finalWeight);
  if(!p.valid){
    if(statusEl){ statusEl.textContent = 'Conversion impossible : poids exploitable manquant.'; statusEl.style.color = '#7a4b12'; }
    return false;
  }
  const list = typeof getRuntimeIngredients === 'function' ? getRuntimeIngredients().slice() : [];
  const now = Date.now();
  const ing = {
    id: `ing_recipe_${Math.random().toString(36).slice(2,8)}${now.toString(36)}`,
    name,
    categoryId,
    profile: 'solid',
    allowedUnits: ['g'],
    defaultUnit: 'g',
    conversions: { pieceWeightG: 0, mlWeightG: 0, tbspWeightG: 0, tspWeightG: 0 },
    kcal: Number(p.kcal100 || 0),
    p: Number(p.p100 || 0),
    carbs: Number(p.c100 || 0),
    fat: Number(p.f100 || 0),
    note: `Créé depuis la recette « ${String(recipe?.name || 'Recette')} » — base ${mode === 'final' ? 'poids final' : 'poids calculé'} : ${fmt1(p.usedWeight)} g`,
    thumb: sanitizeImageSrc(recipe?.thumbDataUrl || ''),
  };
  list.push(ing);
  if(typeof setRuntimeIngredients === 'function') setRuntimeIngredients(list);
  if(statusEl){ statusEl.textContent = 'Ingrédient créé dans la bibliothèque.'; statusEl.style.color = 'var(--g900)'; }
  closeRecipeConvertModal();
  try{ if(typeof renderIngredientGrid === 'function') renderIngredientGrid(); }catch(_e){}
  try{ window.dispatchEvent(new CustomEvent('na:ingredientsChanged')); }catch(_e){}
  return true;
}
document.addEventListener('change', (e)=>{
  const t = e.target;
  if(!t) return;
  if(t.closest && t.closest('#recipeConvertOverlay') && ((t.id === 'recipeConvertWeightModeRows') || (t.id === 'recipeConvertWeightModeFinal') || (t.id === 'recipeConvertFinalWeight'))){
    renderRecipeConvertPreview();
  }
});
document.addEventListener('input', (e)=>{
  const t = e.target;
  if(!t) return;
  if(t.id === 'recipeConvertFinalWeight') renderRecipeConvertPreview();
});
document.addEventListener('click', (e)=>{
  const target = e.target instanceof HTMLElement ? e.target : null;
  if(!target) return;
  if(target.closest('#btnRecipeConvertClose') || target.closest('#btnRecipeConvertCancel')){ e.preventDefault(); closeRecipeConvertModal(); }
  if(target.id === 'recipeConvertOverlay'){ closeRecipeConvertModal(); }
  if(target.closest('#btnRecipeConvertConfirm')){ e.preventDefault(); const rid = byId('recipeConvertOverlay')?.getAttribute('data-recipe-id'); if(rid) convertRecipeToIngredient(rid); }
});
// === Thumb image import (per recipe) ===
let __thumbTargetRecipeId = null;

function ensureThumbFileInput(){
  let inp = byId("thumbFileInput");
  if(inp) return inp;

  inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/*";
  inp.id = "thumbFileInput";
  inp.style.position = "fixed";
  inp.style.left = "-9999px";
  inp.style.top = "-9999px";
  document.body.appendChild(inp);

  inp.addEventListener("change", async ()=>{
    const file = inp.files && inp.files[0];
    const rid = __thumbTargetRecipeId;
    inp.value = "";
    __thumbTargetRecipeId = null;
    if(!file || !rid) return;

    const MAX = 50 * 1024; // 50KB
    if(file.size > MAX){
      alert("Image trop lourde. Maximum 50 KB.");
      return;
    }

    const dataUrl = await new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=>resolve(String(reader.result||""));
      reader.onerror = ()=>reject(new Error("read error"));
      reader.readAsDataURL(file);
    }).catch(()=>null);

    if(!dataUrl){
      alert("Impossible de lire l'image.");
      return;
    }

    const recipes = getRuntimeRecipes();
    const r = recipes.find(x=>x.id===rid);
    if(!r) return;

    r.thumbDataUrl = dataUrl;
    setRuntimeRecipes(recipes);
    renderRecipesPage(); // refresh list to show image
  });

  return inp;
}

function openThumbImportForRecipe(recipeId){
  __thumbTargetRecipeId = recipeId;
  const inp = ensureThumbFileInput();
  inp.click();
}

function renderRecipeThumb(thumbEl, recipe){
  if(!thumbEl) return;
  const src = sanitizeImageSrc(recipe?.thumbDataUrl);
  if(src){
    thumbEl.innerHTML = `<img class="thumbImg" alt="" src="${escapeHtml(src)}">`;
  }else{
    thumbEl.textContent = initials(recipe ? recipe.name : "");
  }
}


function openKebabPopoverForRecipe(recipeId, anchorEl){
  const pop = ensureKebabPopover();

  // toggle if already open for same recipe
  if(!pop.classList.contains("hidden") && pop.getAttribute("data-recipe-id") === String(recipeId)){
    closeAllRecipeMenus();
    return;
  }

  pop.setAttribute("data-recipe-id", String(recipeId));
  pop.classList.remove("hidden");

  // Position (fixed) relative to viewport
  const r = anchorEl.getBoundingClientRect();
  const pad = 8;
  const w = pop.offsetWidth || 200;
  const h = pop.offsetHeight || 140;

  let left = r.right - w;
  let top  = r.bottom + 10;

  // keep within viewport
  left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
  if(top + h > window.innerHeight - pad){
    top = r.top - h - 10;
  }
  top = Math.max(pad, Math.min(top, window.innerHeight - h - pad));

  pop.style.left = left + "px";
  pop.style.top  = top + "px";
}

// Close on outside click / scroll / resize
document.addEventListener("click", (e)=>{
  const pop = byId("kebabPopover");
  if(!pop || pop.classList.contains("hidden")) return;
  if(e.target && (e.target.closest("#kebabPopover") || e.target.closest(".kebabBtn"))) return;
  closeAllRecipeMenus();
});
window.addEventListener("scroll", ()=>{ closeAllRecipeMenus(); }, true);
window.addEventListener("resize", ()=>{ closeAllRecipeMenus(); });
document.addEventListener("keydown", (e)=>{
  if(e.key === "Escape") closeAllRecipeMenus(null);
});

function setRecipeStatusSafe(msg, tone="muted"){
  try{
    if(typeof window.setRecipeStatus === "function") return window.setRecipeStatusSafe(msg, tone);
    const el = byId("cmRecipeStatus");
    if(!el) return;
    el.textContent = msg || "";
    el.style.color = (tone==="ok") ? "var(--g900)" : (tone==="warn") ? "#7a4b12" : (tone==="err") ? "#7b1f19" : "var(--ink500)";
  }catch(e){ /* ignore */ }
}

function saveRecipes(arr){
  try{ return setRuntimeRecipes(Array.isArray(arr) ? arr : []); }catch(e){ console.error(e); return false; }
}

function openRecipeEditor(recipeId){
  const app = getApp();
  const editorView = app.ui && app.ui.recipeEditor;
  if(editorView && typeof editorView.edit === "function"){
    return editorView.edit(recipeId);
  }
  if(app.actions && app.actions.openRecipeEditor && app.actions.openRecipeEditor !== openRecipeEditor && typeof app.actions.openRecipeEditor === "function"){
    return app.actions.openRecipeEditor(recipeId);
  }
  if(window.RecipeEditor && typeof window.RecipeEditor.openById === "function"){
    return window.RecipeEditor.openById(recipeId);
  }
  console.warn("RecipeEditor.openById unavailable");
}

function duplicateRecipe(recipeId){
  const app = getApp();
  const editorView = app.ui && app.ui.recipeEditor;
  if(editorView && typeof editorView.duplicateById === "function"){
    return editorView.duplicateById(recipeId);
  }
  if(app.actions && app.actions.duplicateRecipe && app.actions.duplicateRecipe !== duplicateRecipe && typeof app.actions.duplicateRecipe === "function"){
    return app.actions.duplicateRecipe(recipeId);
  }
  if(window.RecipeEditor && typeof window.RecipeEditor.duplicateById === "function"){
    return window.RecipeEditor.duplicateById(recipeId);
  }
  console.warn("RecipeEditor.duplicateById unavailable");
}

function deleteRecipe(recipeId){
  const app = getApp();
  const editorView = app.ui && app.ui.recipeEditor;
  if(editorView && typeof editorView.deleteById === "function"){
    return editorView.deleteById(recipeId);
  }
  if(app.actions && app.actions.deleteRecipe && app.actions.deleteRecipe !== deleteRecipe && typeof app.actions.deleteRecipe === "function"){
    return app.actions.deleteRecipe(recipeId);
  }
  if(window.RecipeEditor && typeof window.RecipeEditor.deleteById === "function"){
    return window.RecipeEditor.deleteById(recipeId);
  }
  console.warn("RecipeEditor.deleteById unavailable");
}




/* readonly rowcards render */
function getScenarioScaledRow(row, recipe, partsOverride){
  const baseRecipe = recipe || getCurrentRecipe();
  const baseParts = getRecipeBaseParts(baseRecipe);
  const currentParts = clamp(toNum(partsOverride ?? getScenarioPartsValue()), 1, 999);
  const scale = baseParts > 0 ? (currentParts / baseParts) : 1;
  return { ...row, qty: toNum(row?.qty) * scale };
}

function buildRowCard(row, options){
  const opts = options || {};
  const sourceRow = (opts.mode === 'scenario') ? getScenarioScaledRow(row, opts.recipe, opts.scenarioParts) : row;
  const resolveRecipeRow = getResolveRecipeRow();
  const resolved = (typeof resolveRecipeRow === "function")
    ? resolveRecipeRow(sourceRow, getRuntimeIngredients())
    : null;

  const ing = resolved?.ing || getIngredientById(sourceRow?.ingredientId || row?.ingredientId);
  const qty = resolved ? resolved.qty : clamp(toNum(sourceRow?.qty), 0, 1e9);
  const unit = resolved ? resolved.unit : (String(sourceRow?.unit || row?.unit || "g").trim() || "g");
  const gramsResolved = resolved ? resolved.gramsResolved : (unit === "g" ? qty : clamp(toNum(sourceRow?.gramsResolved ?? row?.gramsResolved), 0, 1e9));

  const ingThumb = ingredientThumbSrc(ing);
  const name = String(ing?.name || sourceRow?.ingredientName || row?.ingredientName || "—").trim() || "—";
  const thumbFallback = escapeHtml(initials(name || ing?.name || "I"));
  const thumbHtml = ingThumb ? `<img src="${escapeHtml(ingThumb)}" alt="">` : `<span class="rowcardInitials">${thumbFallback}</span>`;
  const displayQty = formatRowDisplayQty(ing, gramsResolved, qty, unit);
  const displayUnit = getScenarioDisplayUnit(ing, unit);
  const sourceQtyLine = `${displayQty}${gramsResolved > 0 && displayUnit !== 'g' ? ` · ${fmt1(gramsResolved)} g` : ''}`;

  const card = document.createElement("div");
  card.className = "rowcard";
  card.title = sourceQtyLine;
  card.innerHTML = `
    <div class="thumb">${thumbHtml}</div>
    <div class="rc-main">
      <div class="rc-title" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
      <span class="rc-qty" title="${escapeHtml(sourceQtyLine)}">${escapeHtml(displayQty)}</span>
    </div>
  `;
  return card;
}

function renderRecipeBody(partsOverride){
  const wrap = byId("recipeBody");
  if(!wrap) return;
  const recipe = getCurrentRecipe();
  const rows = Array.isArray(recipe?.rows) ? recipe.rows : [];
  const scenarioParts = clamp(toNum(partsOverride ?? getScenarioPartsValue()), 1, 999);
  wrap.innerHTML = "";
  for(const row of rows){
    wrap.appendChild(buildRowCard(row, { mode:'scenario', recipe, scenarioParts }));
  }
}

function syncRecipeBodyToPartsValue(){
  const el = byId("partsValue");
  if(!el || !getCurrentRecipe()) return;
  const domParts = clamp(toNum(el.textContent), 1, 999);
  if(domParts !== getScenarioPartsValue()) setScenarioPartsValue(domParts);
  renderRecipeBody(domParts);
  computeAndRenderTotals();
}

function setParts(n){
  const nextParts = setScenarioPartsValue(n);
  const partsEl = byId("partsValue");
  if(partsEl) partsEl.textContent = String(nextParts);
  renderRecipeBody(nextParts);
  computeAndRenderTotals();
}

function computeAndRenderTotals(){
  ensureScenarioResultsShell();
  if(!getCurrentRecipe()) return;
  const t = computeRecipeTotalsFromRows(getScaledRows(getCurrentRecipe()));
  byId("totKcal").textContent = fmt1(t.totK);
  byId("totP").textContent = fmt1(t.totP);
  byId("totG").textContent = fmt1(t.totG);
  byId("totL").textContent = fmt1(t.totL);
  refreshPerPortion(t);
}

function refreshPerPortion(totals){
  ensureScenarioResultsShell();
  if(!getCurrentRecipe()){
    byId("kcalPerPortion").textContent = "—";
    byId("pPerPortion").textContent = "—";
    byId("gPerPortion").textContent = "—";
    byId("lPerPortion").textContent = "—";
    return;
  }
  const t = totals || {
    totK: toNum(byId("totKcal").textContent),
    totP: toNum(byId("totP").textContent),
    totG: toNum(byId("totG").textContent),
    totL: toNum(byId("totL").textContent),
  };
  const p = getScenarioPartsValue();

  byId("kcalPerPortion").textContent = fmt1(t.totK / p);
  byId("pPerPortion").textContent = fmt1(t.totP / p);
  byId("gPerPortion").textContent = fmt1(t.totG / p);
  byId("lPerPortion").textContent = fmt1(t.totL / p);
}

function ensureScenarioResultsShell(){
  const wrap = byId("results");
  if(!wrap) return null;
  if(wrap.dataset.scenarioMacroShell === "1") return wrap;

  wrap.dataset.scenarioMacroShell = "1";
  wrap.classList.add("scenarioResults");
  wrap.innerHTML = `
    <section class="recipeDetailBlock scenarioResultsBlock" data-results-kind="portion">
      <div class="recipeDetailBlockTitle">Par portion</div>
      <div class="ingMacroGrid scenarioMacroGrid">
        <div class="ingMacroCell"><div class="ingMacroVal" id="kcalPerPortion">—</div><div class="ingMacroLbl">Kcal / portion</div></div>
        <div class="ingMacroCell"><div class="ingMacroVal" id="pPerPortion">—</div><div class="ingMacroLbl">P / portion</div></div>
        <div class="ingMacroCell"><div class="ingMacroVal" id="gPerPortion">—</div><div class="ingMacroLbl">G / portion</div></div>
        <div class="ingMacroCell"><div class="ingMacroVal" id="lPerPortion">—</div><div class="ingMacroLbl">L / portion</div></div>
      </div>
    </section>
    <section class="recipeDetailBlock scenarioResultsBlock" data-results-kind="total">
      <div class="recipeDetailBlockTitle">Total recette</div>
      <div class="ingMacroGrid scenarioMacroGrid">
        <div class="ingMacroCell"><div class="ingMacroVal" id="totKcal">—</div><div class="ingMacroLbl">Kcal total</div></div>
        <div class="ingMacroCell"><div class="ingMacroVal" id="totP">—</div><div class="ingMacroLbl">P total</div></div>
        <div class="ingMacroCell"><div class="ingMacroVal" id="totG">—</div><div class="ingMacroLbl">G total</div></div>
        <div class="ingMacroCell"><div class="ingMacroVal" id="totL">—</div><div class="ingMacroLbl">L total</div></div>
      </div>
    </section>
  `;
  return wrap;
}


function syncScenarioPrepState(){
  const prep = byId("recipePrep");
  if(!prep) return;
  prep.classList.add("scenarioPrepRead");
  prep.readOnly = true;
  const isEmpty = !String(prep.value || "").trim();
  prep.classList.toggle("is-empty", isEmpty);
  prep.style.height = "auto";
  prep.style.height = `${Math.max(148, prep.scrollHeight || 0)}px`;
}

function enhanceScenarioReadingUi(){
  const prep = byId("recipePrep");
  const prepCard = prep && prep.closest ? prep.closest(".prepCard") : null;
  const status = byId("recipeStatus");
  const body = byId("recipeBody");

  if(prepCard){
    prepCard.classList.add("prepCard--scenario");
    const meta = prep.previousElementSibling;
    if(meta && meta.tagName === "DIV"){
      meta.classList.add("scenarioPrepMeta");
      const head = meta.firstElementChild;
      if(head) head.classList.add("scenarioPrepHead");
      const timePill = meta.querySelector ? meta.querySelector(".pill") : null;
      if(timePill) timePill.classList.add("scenarioPrepTime");
    }
  }
  if(body) body.classList.add("scenarioRows");
  if(status) status.classList.add("scenarioStatusHint");
  syncScenarioPrepState();
}


function enhanceScenarioHeaderUi(){
  const view = byId("viewRecipe");
  const header = view && view.querySelector ? view.querySelector(".recipeHeader") : null;
  const lead = view && view.querySelector ? view.querySelector(".recipeLead") : null;
  if(!header || !lead || header.dataset.scenarioHeaderQuiet === "1") return;

  const backRow = header.querySelector(".backRow");
  const backBtn = byId("btnBackToList");
  const flag = header.querySelector(".scenarioFlag");
  const partsWrap = (function(){
    const el = byId("partsValue");
    return el && el.closest ? el.closest(".pill") : null;
  })();
  const partsValue = byId("partsValue");
  const minusBtn = byId("btnPartsMinus");
  const plusBtn = byId("btnPartsPlus");
  const pdfBtn = byId("btnRecipePdf");
  const title = byId("recipeTitle");
  const subtitle = lead.querySelector(".recipeLeadSub");
  if(!backRow || !backBtn || !flag || !partsWrap || !partsValue || !minusBtn || !plusBtn || !pdfBtn || !title) return;

  header.dataset.scenarioHeaderQuiet = "1";
  header.classList.add("recipeHeader--quiet");
  backRow.classList.add("recipeHeaderMain");
  backBtn.classList.add("scenarioBackBtn");

  const scenarioInfoText = String(flag.getAttribute('title') || flag.textContent || '').replace(/\s+/g, ' ').trim();
  let scenarioInfoAnchor = lead.querySelector('.scenarioPartsLabelWrap > .uiInfoAnchor') || lead.querySelector('.scenarioPortionControl .uiInfoAnchor');
  if(!scenarioInfoAnchor && scenarioInfoText){
    scenarioInfoAnchor = buildScenarioUnifiedInfoDot(scenarioInfoText, 'Voir les informations du scénario');
  }
  if(flag && flag.parentElement) flag.remove();

  let leadTop = lead.querySelector(".recipeLeadTop");
  if(!leadTop){
    leadTop = document.createElement("div");
    leadTop.className = "recipeLeadTop";
    lead.insertBefore(leadTop, lead.firstChild);
  }

  let titleBlock = lead.querySelector(".recipeLeadTitleBlock");
  if(!titleBlock){
    titleBlock = document.createElement("div");
    titleBlock.className = "recipeLeadTitleBlock";
  }
  if(title.parentElement !== titleBlock) titleBlock.appendChild(title);
  if(subtitle && subtitle.parentElement !== titleBlock) titleBlock.appendChild(subtitle);
  if(titleBlock.parentElement !== leadTop) leadTop.appendChild(titleBlock);

  let portionControl = lead.querySelector(".scenarioPortionControl");
  if(!portionControl){
    portionControl = document.createElement("div");
    portionControl.className = "scenarioPortionControl";
  }
  let secondary = lead.querySelector(".scenarioSecondaryActions");
  if(!secondary){
    secondary = document.createElement("div");
    secondary.className = "scenarioSecondaryActions";
  }
  let headerSpacer = backRow.querySelector(".scenarioHeaderSpacer");
  if(!headerSpacer){
    headerSpacer = document.createElement("span");
    headerSpacer.className = "scenarioHeaderSpacer";
  }

  partsWrap.classList.add("scenarioPartsReadout");
  let labelWrap = partsWrap.querySelector('.scenarioPartsLabelWrap');
  if(!labelWrap){
    labelWrap = document.createElement("span");
    labelWrap.className = "scenarioPartsLabelWrap";
  }
  let label = labelWrap.querySelector('.scenarioPartsLabel');
  if(!label){
    label = document.createElement("span");
    label.className = "scenarioPartsLabel";
    label.textContent = "Portions";
    labelWrap.appendChild(label);
  }
  if(scenarioInfoAnchor && scenarioInfoAnchor.parentElement !== labelWrap){
    labelWrap.appendChild(scenarioInfoAnchor);
  }
  while(partsWrap.firstChild) partsWrap.removeChild(partsWrap.firstChild);
  partsWrap.append(labelWrap, partsValue);

  minusBtn.classList.add("scenarioStepperBtn");
  plusBtn.classList.add("scenarioStepperBtn");
  minusBtn.setAttribute("aria-label", "Réduire les portions");
  plusBtn.setAttribute("aria-label", "Augmenter les portions");

  pdfBtn.classList.add("scenarioExportBtn", "scenarioActionGhost");
  pdfBtn.setAttribute("title", "Exporter la recette affichée en PDF");
  pdfBtn.innerHTML = '<span class="scenarioExportText">Exporter PDF</span>';

  portionControl.append(partsWrap, minusBtn, plusBtn);
  secondary.append(pdfBtn);

  if(subtitle && subtitle.parentElement === titleBlock){
    subtitle.insertAdjacentElement("afterend", portionControl);
  }else if(title.parentElement === titleBlock){
    title.insertAdjacentElement("afterend", portionControl);
  }else if(portionControl.parentElement !== titleBlock){
    titleBlock.appendChild(portionControl);
  }

  backRow.append(headerSpacer, secondary);

  Array.from(header.children).forEach((child)=>{
    if(child !== backRow) child.remove();
  });
}

function openRecipeScenario(id){
  const recipes = getRuntimeRecipes();
  const r = recipes.find(x=>x.id===id);
  if(!r){ alert("Recette introuvable."); return; }
  setCurrentRecipe(normalizeRecipe(r));
  byId("recipeTitle").textContent = r.name || "—";
  byId("recipePrep").value = r.prep || "";
  byId("prepTime").textContent = r.prepTime || "—";

  ensureScenarioResultsShell();
  enhanceScenarioHeaderUi();
  enhanceScenarioReadingUi();
  setParts(getRecipeBaseParts(r));
  byId("recipeStatus").textContent = "Lecture seule · ajuster les portions recalcule les grammages et les totaux sans modifier la recette sauvegardée.";
  showView("recipe");
}

let __recipeDetailRef = null;
let __recipeDetailRecipeId = "";
function ensureRecipeDetailOverlay(){
  if(__recipeDetailRef && __recipeDetailRef.overlay && document.body.contains(__recipeDetailRef.overlay)) return __recipeDetailRef;

  let overlay = byId("recipeDetailOverlay");
  if(!overlay){
    overlay = document.createElement("div");
    overlay.id = "recipeDetailOverlay";
    overlay.className = "ingDetailOverlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="ingDetailModal recipeDetailModal" id="recipeDetailModal" role="dialog" aria-modal="true" aria-label="Fiche recette">
        <div class="ingDetailHead">
          <h3 class="ctitle" id="recipeDetailTitle">Fiche recette</h3>
          <button type="button" class="iconBtn" id="recipeDetailClose" aria-label="Fermer">✕</button>
        </div>
        <div class="ingDetailBody recipeDetailBody" id="recipeDetailBody"></div>
      </div>
    `;
    const host = document.querySelector('.appOverlays') || document.body;
    host.appendChild(overlay);
  }

  const body = overlay.querySelector("#recipeDetailBody");
  const closeBtn = overlay.querySelector("#recipeDetailClose");
  const close = ()=>{
    try{
      if(document.activeElement && overlay.contains(document.activeElement)){
        if(closeBtn && typeof closeBtn.blur === "function") closeBtn.blur();
        else if(document.body && typeof document.body.focus === "function") document.body.focus();
      }
    }catch(_e){}
    __recipeDetailRecipeId = "";
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden","true");
    try{ overlay.inert = true; }catch(_e){}
    document.body.style.overflow = "";
  };

  if(!overlay.dataset.bound){
    overlay.dataset.bound = "1";
    closeBtn?.addEventListener("click", close);
    overlay.addEventListener("click", (e)=>{ if(e.target === overlay) close(); });
    document.addEventListener("keydown", (e)=>{ if(e.key === "Escape" && overlay.classList.contains("show")) close(); });
  }

  __recipeDetailRef = { overlay, body, closeBtn, close };
  return __recipeDetailRef;
}

function getRecipeForDetail(recipeId){
  const recipes = getRuntimeRecipes();
  const raw = recipes.find(x => String(x?.id) === String(recipeId));
  if(!raw) return null;
  return normalizeRecipe(raw);
}

function formatPrepHtml(text){
  const safe = escapeHtml(String(text || "").trim());
  return safe ? safe.replace(/\n/g, "<br>") : '<span class="muted">Aucune préparation enregistrée.</span>';
}

function recipeThumbHtml(recipe){
  const src = sanitizeImageSrc(recipe?.thumbDataUrl);
  if(src && src.startsWith("data:image")) return `<img src="${escapeHtml(src)}" alt="${escapeHtml(String(recipe?.name || "Recette"))}">`;
  return `<span class="recipeDetailInitials">${escapeHtml(initials(recipe?.name || "R"))}</span>`;
}

function renderRecipeDetail(recipe){
  const ref = ensureRecipeDetailOverlay();
  const body = ref.body;
  const catId = String(recipe?.categoryId || "autre").trim() || "autre";
  const catLabel = (window.CategoryDomain && typeof window.CategoryDomain.labelForCategoryId === "function")
    ? (window.CategoryDomain.labelForCategoryId(catId) || "Autre")
    : "Autre";
  const parts = clamp(toNum(recipe?.parts || 1), 1, 999);
  const totals = computeRecipeTotalsFromRows(Array.isArray(recipe?.rows) ? recipe.rows : []);
  const per = {
    totK: parts ? totals.totK / parts : totals.totK,
    totP: parts ? totals.totP / parts : totals.totP,
    totG: parts ? totals.totG / parts : totals.totG,
    totL: parts ? totals.totL / parts : totals.totL,
  };

  body.innerHTML = `
    <section class="ingLeadCard">
      <div class="ingLeadTop">
        <div class="ingLeadThumb">${recipeThumbHtml(recipe)}</div>
        <div>
          <h3 class="ingLeadName">${escapeHtml(String(recipe?.name || "Recette"))}</h3>
          <div class="recipeDetailPills">
            <span class="pill catPill" data-detail-cat title="${escapeHtml(catLabel)}">${escapeHtml(catLabel)}</span>
            <span class="pill">Portions <b>${parts}</b></span>
            <span class="pill">Temps <b>${escapeHtml(String(recipe?.prepTime || "—"))}</b></span>
          </div>
        </div>
      </div>

      <div class="ingKv recipeDetailKv">
        <div class="k">Catégorie</div><div class="v">${escapeHtml(catLabel)}</div>
        <div class="k">Portions de base</div><div class="v">${parts}</div>
        <div class="k">Temps</div><div class="v">${escapeHtml(String(recipe?.prepTime || "—"))}</div>
        <div class="k">Lignes</div><div class="v">${Array.isArray(recipe?.rows) ? recipe.rows.length : 0}</div>
      </div>

      <div class="recipeDetailBlock">
        <div class="recipeDetailBlockTitle">Totaux recette</div>
        <div class="ingMacroGrid">
          <div class="ingMacroCell"><div class="ingMacroVal">${fmt1(totals.totK || 0)}</div><div class="ingMacroLbl">Kcal total</div></div>
          <div class="ingMacroCell"><div class="ingMacroVal">${fmt1(totals.totP || 0)}</div><div class="ingMacroLbl">P total</div></div>
          <div class="ingMacroCell"><div class="ingMacroVal">${fmt1(totals.totG || 0)}</div><div class="ingMacroLbl">G total</div></div>
          <div class="ingMacroCell"><div class="ingMacroVal">${fmt1(totals.totL || 0)}</div><div class="ingMacroLbl">L total</div></div>
        </div>
      </div>

      <div class="recipeDetailBlock">
        <div class="recipeDetailBlockTitle">Par portion</div>
        <div class="ingMacroGrid">
          <div class="ingMacroCell"><div class="ingMacroVal">${fmt1(per.totK || 0)}</div><div class="ingMacroLbl">Kcal / portion</div></div>
          <div class="ingMacroCell"><div class="ingMacroVal">${fmt1(per.totP || 0)}</div><div class="ingMacroLbl">P / portion</div></div>
          <div class="ingMacroCell"><div class="ingMacroVal">${fmt1(per.totG || 0)}</div><div class="ingMacroLbl">G / portion</div></div>
          <div class="ingMacroCell"><div class="ingMacroVal">${fmt1(per.totL || 0)}</div><div class="ingMacroLbl">L / portion</div></div>
        </div>
      </div>
    </section>

    <aside class="ingAsideCard recipeDetailAside">
      <section class="recipeDetailSection">
        <div class="bigTitle" style="margin-top:0;font-size:20px;">Ingrédients</div>
        <div class="createHint" style="margin-bottom:12px;">Fiche statique : aucun ajustement scénario n’est appliqué ici.</div>
        <div class="recipeDetailRows"></div>
      </section>

      <section class="recipeDetailSection">
        <div class="bigTitle" style="margin-top:0;font-size:20px;">Préparation</div>
        <div class="recipeDetailPrep">${formatPrepHtml(recipe?.prep || "")}</div>
      </section>
    </aside>
  `;

  const catEl = body.querySelector("[data-detail-cat]");
  applyTheme(catEl, catId);

  const rowsWrap = body.querySelector(".recipeDetailRows");
  const rows = Array.isArray(recipe?.rows) ? recipe.rows : [];
  if(!rows.length){
    rowsWrap.innerHTML = '<div class="recipeDetailEmpty">Aucune ligne recette enregistrée.</div>';
  }else{
    rows.forEach((row)=> rowsWrap.appendChild(buildRowCard(row)));
  }
}

function openRecipeDetail(recipeId){
  const recipe = getRecipeForDetail(recipeId);
  if(!recipe){ alert("Recette introuvable."); return; }
  __recipeDetailRecipeId = String(recipeId || recipe?.id || '');
  const ref = ensureRecipeDetailOverlay();
  renderRecipeDetail(recipe);
  ref.overlay.classList.add("show");
  ref.overlay.setAttribute("aria-hidden","false");
  try{ ref.overlay.inert = false; }catch(_e){}
  document.body.style.overflow = "hidden";
  const focusTarget = ref.closeBtn || ref.overlay.querySelector("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])");
  try{ focusTarget && focusTarget.focus && focusTarget.focus(); }catch(_e){}
}

if(window.NutriStore && typeof window.NutriStore.subscribe === "function"){
  window.NutriStore.subscribe('ingredients:changed', ()=>{
    try{
      const viewRecipe = byId('viewRecipe');
      if(viewRecipe && viewRecipe.classList.contains('show') && getCurrentRecipe()){
        renderRecipeBody();
        computeAndRenderTotals();
      }
    }catch(_e){}
    try{
      const ref = ensureRecipeDetailOverlay();
      if(ref.overlay && ref.overlay.classList.contains('show') && __recipeDetailRecipeId){
        const recipe = getRecipeForDetail(__recipeDetailRecipeId);
        if(recipe) renderRecipeDetail(recipe);
      }
    }catch(_e){}
  });
}

enhanceScenarioHeaderUi();
enhanceScenarioReadingUi();

(function bindScenarioPartsObserver(){
  const el = byId('partsValue');
  if(!el || el.dataset.rcQtyObserverBound === '1') return;
  el.dataset.rcQtyObserverBound = '1';
  const obs = new MutationObserver(()=>{
    try{ syncRecipeBodyToPartsValue(); }catch(_e){}
  });
  obs.observe(el, { childList:true, characterData:true, subtree:true });
})();

/* demo seed */
function seedDemoIngredients(){
  const demo = [
    { id:"ing_chicken", name:"Filet de poulet", categoryId:"viandes_volailles", kcal100:110, p100:23.0, g100:0.0, l100:1.5 },
    { id:"ing_rice", name:"Riz (sec)", categoryId:"cereales_feculents", kcal100:360, p100:7.0, g100:78.0, l100:1.0 },
    { id:"ing_broccoli", name:"Brocoli", categoryId:"legumes", kcal100:34, p100:2.8, g100:6.6, l100:0.4 },
    { id:"ing_oil", name:"Huile d'olive", categoryId:"matieres_grasses", kcal100:884, p100:0.0, g100:0.0, l100:100.0 },
  ];
  if(window.NutriStore && typeof window.NutriStore.setIngredients === 'function') window.NutriStore.setIngredients(demo);
  else NutriStorage.writeJSON(STORE_KEYS.ingredients, demo);
}
function seedDemoRecipes(){
  const demo = [
    {
      id:"rec_poulet_riz",
      name:"Poulet — riz — brocoli",
      categoryId:"autre",
      parts:4,
      prepTime:"20 min",
      prep:"1) Saisir le poulet.\n2) Cuire le riz.\n3) Ajouter brocoli.\n4) Assaisonner.",
      rows:[
        { categoryId:"viandes_volailles", ingredientId:"ing_chicken", qty:220 },
        { categoryId:"cereales_feculents", ingredientId:"ing_rice", qty:140 },
        { categoryId:"legumes", ingredientId:"ing_broccoli", qty:200 },
        { categoryId:"matieres_grasses", ingredientId:"ing_oil", qty:10 },
      ]
    }
  ];
  if(window.NutriStore && typeof window.NutriStore.setRecipes === 'function') window.NutriStore.setRecipes(demo);
  else NutriStorage.writeJSON(STORE_KEYS.recipes, demo);
}


const RecipeDetailView = {
  openById(id){ return openRecipeDetail(id); },
  close(){ __recipeDetailRecipeId = ""; const ref = ensureRecipeDetailOverlay(); return ref.close(); },
  render(recipe){ return renderRecipeDetail(recipe); }
};

const RecipeReadonlyView = {
  state: (ns.state && ns.state.RecipeScenarioState) || window.RecipeScenarioState,
  openById(id){
    return openRecipeScenario(id);
  },
  close(){
    setCurrentRecipe(null);
    byId("recipeBody").innerHTML = "";
    byId("recipeTitle").textContent = "—";
    byId("recipePrep").value = "";
    byId("prepTime").textContent = "—";
    byId("recipeStatus").textContent = "";
    syncScenarioPrepState();
    showView("list");
  },
  getCurrentRecipe(){
    return getCurrentRecipe();
  },
  getParts(){
    return getScenarioPartsValue();
  },
  buildRowCard,
  renderBody: renderRecipeBody,
  syncBodyToPartsValue: syncRecipeBodyToPartsValue,
  computeTotals: computeAndRenderTotals,
  refreshPerPortion,
  setParts
};

window.refreshRecipesPage = ()=>{ try{ RecipeListView.refreshFilter(); }catch(_e){} try{ RecipeListView.render(); }catch(_e){} };

ns.ui = Object.assign({}, ns.ui || {}, { recipeList: RecipeListView, recipeDetail: RecipeDetailView, RecipeDetailView, recipeScenario: RecipeReadonlyView, RecipeReadonlyView, closeAllRecipeMenus, ensureKebabPopover, ensureThumbFileInput, openThumbImportForRecipe, renderRecipeThumb, openKebabPopoverForRecipe, setRecipeStatusSafe, openRecipeEditor, duplicateRecipe, deleteRecipe, buildRowCard, renderRecipeBody, setParts, computeAndRenderTotals, refreshPerPortion, openRecipeScenario, openRecipeDetail, seedDemoIngredients, seedDemoRecipes });
window.NutriApp = Object.assign({}, window.NutriApp || {}, {
  ui: Object.assign({}, (window.NutriApp && window.NutriApp.ui) || {}, {
    recipeDetail: RecipeDetailView,
    RecipeDetailView,
    recipeScenario: RecipeReadonlyView,
    RecipeReadonlyView,
    renderRecipeThumb,
    openThumbImportForRecipe,
    openKebabPopoverForRecipe,
    openRecipeScenario,
    openRecipeDetail,
    setRecipeStatusSafe,
    buildRowCard,
    renderRecipeBody,
    syncRecipeBodyToPartsValue,
    setParts,
    computeAndRenderTotals,
    refreshPerPortion,
    seedDemoIngredients,
    seedDemoRecipes
  }),
  actions: Object.assign({}, (window.NutriApp && window.NutriApp.actions) || {}, {
    openRecipeScenario,
    openRecipeDetail,
    openRecipeEditor,
    duplicateRecipe,
    deleteRecipe
  })
});
window.setRecipeStatusSafe = setRecipeStatusSafe;
window.seedDemoIngredients = seedDemoIngredients;
window.seedDemoRecipes = seedDemoRecipes;

})();
