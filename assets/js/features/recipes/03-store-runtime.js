/* Phase 4.2 — Features / Recipes / Store runtime */
(function RecipesStoreRuntime(){
  "use strict";
    const byId = (id) => document.getElementById(id);
  const toNum = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const escapeHtml = (s) => String(s ?? "").replace(/[&<>\"']/g, (m)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  function safeJsonParse(s, fallback){ try{ return JSON.parse(s); } catch(_){ return fallback; } }

  const page = byId("pageRecipes");
  if(!page) return;

  // Safety: if views are missing, don't crash
  if(!byId("viewList") || !byId("viewRecipe")) return;

const labelForIngredientCategoryId = (catId) => {
  try{
    if(window.IngredientCategoryDomain && typeof window.IngredientCategoryDomain.labelForCategoryId === "function"){
      return window.IngredientCategoryDomain.labelForCategoryId(catId) || "Autre";
    }
  }catch(_e){}
  return "Autre";
};

const CAT_THEME = {
  viandes_volailles: { bg:"rgba(243,194,71,.22)", bd:"rgba(231,174,47,.55)", tx:"#2b3a30" },
  poissons: { bg:"rgba(90,168,255,.18)", bd:"rgba(90,168,255,.45)", tx:"#1a3550" },
  fruits_de_mer: { bg:"rgba(150,220,255,.16)", bd:"rgba(150,220,255,.42)", tx:"#1a3f4b" },
  oeufs: { bg:"rgba(255,224,130,.20)", bd:"rgba(255,224,130,.55)", tx:"#3a2a10" },
  produits_laitiers: { bg:"rgba(220,220,220,.22)", bd:"rgba(180,180,180,.45)", tx:"#2b2b2b" },
  proteines_vegetales: { bg:"rgba(62,138,90,.16)", bd:"rgba(62,138,90,.38)", tx:"#0b4c2b" },
  cereales_feculents: { bg:"rgba(210,170,120,.18)", bd:"rgba(210,170,120,.42)", tx:"#3a2715" },
  legumes: { bg:"rgba(30,78,51,.12)", bd:"rgba(30,78,51,.26)", tx:"#22422f" },
  fruits: { bg:"rgba(255,140,105,.16)", bd:"rgba(255,140,105,.42)", tx:"#5a1e14" },
  matieres_grasses: { bg:"rgba(244,226,200,.55)", bd:"rgba(122,72,18,.26)", tx:"#6c4a16" },
  sucrants: { bg:"rgba(255,180,210,.18)", bd:"rgba(255,180,210,.42)", tx:"#4a1f33" },
  liquides_boissons: { bg:"rgba(170,210,255,.18)", bd:"rgba(170,210,255,.42)", tx:"#1a3550" },
  liquides: { bg:"rgba(170,210,255,.18)", bd:"rgba(170,210,255,.42)", tx:"#1a3550" },
  aides_techniques: { bg:"rgba(210,210,210,.18)", bd:"rgba(210,210,210,.45)", tx:"#2b2b2b" },
  techniques: { bg:"rgba(210,210,210,.18)", bd:"rgba(210,210,210,.45)", tx:"#2b2b2b" },
  epices_aromes: { bg:"rgba(255,200,120,.18)", bd:"rgba(255,200,120,.45)", tx:"#3a2715" },
  autre: { bg:"rgba(250,248,242,.85)", bd:"rgba(0,0,0,.12)", tx:"var(--ink900)" }
};
const RECIPE_CAT_THEME = {
  petit_dej:     { bg:"rgba(255,242,214,.80)", bd:"rgba(231,174,47,.40)", tx:"#8a5b08" },
  patisseries:   { bg:"rgba(255,231,221,.84)", bd:"rgba(223,149,113,.42)", tx:"#8b4c2f" },
  soupes:        { bg:"rgba(231,241,255,.84)", bd:"rgba(120,165,225,.40)", tx:"#33558f" },
  bases:         { bg:"rgba(238,245,255,.74)", bd:"rgba(120,165,225,.34)", tx:"#33558f" },
  batch_cooking: { bg:"rgba(236,248,231,.78)", bd:"rgba(62,138,90,.28)", tx:"#356326" },
  snacks:        { bg:"rgba(255,239,207,.82)", bd:"rgba(223,176,79,.40)", tx:"#8a5b08" },
  autre:         { bg:"rgba(250,248,242,.85)", bd:"rgba(0,0,0,.12)", tx:"var(--ink900)" },
  "":            { bg:"rgba(250,248,242,.85)", bd:"rgba(0,0,0,.12)", tx:"var(--ink900)" }
};
function themeForCat(catId){
  const sid = String(catId || '').trim();
  return RECIPE_CAT_THEME[sid] || CAT_THEME[sid] || RECIPE_CAT_THEME.autre;
}
function applyTheme(el, catId){
  if(!el) return;
  const t = themeForCat(catId);
  el.style.background = t.bg;
  el.style.borderColor = t.bd;
  el.style.color = t.tx;
}

function normalizeCategoryId(v){
  try{
    if(window.IngredientCategoryDomain && typeof window.IngredientCategoryDomain.normalizeCategory === "function"){
      return window.IngredientCategoryDomain.normalizeCategory(v).id || "autre";
    }
  }catch(_e){}
  return "autre";
}

function sanitizeImageSrc(v){
  const s = String(v ?? '').trim();
  if(!s) return '';
  const lower = s.toLowerCase();
  if(lower === 'undefined' || lower === 'null' || lower === '[object object]') return '';
  return s;
}

function normalizeIngredient(raw){
  const id = raw.id ?? raw.uuid ?? raw._id ?? raw.key;
  const name = raw.name ?? raw.nom ?? raw.title ?? "";
  const kcal = raw.kcal100 ?? raw.kcal ?? raw.kcal_100 ?? raw.kcalPer100 ?? raw.energyKcal ?? 0;
  const p = raw.p100 ?? raw.protein ?? raw.prot ?? raw.proteines ?? raw.P ?? raw.p ?? 0;
  const g = raw.g100 ?? raw.carbs ?? raw.glucides ?? raw.G ?? raw.g ?? 0;
  const l = raw.l100 ?? raw.fat ?? raw.lipides ?? raw.L ?? raw.l ?? 0;
  const rawCat = raw.categoryId ?? raw.category ?? raw.catId ?? raw.familleId ?? raw.famille ?? raw.metier ?? raw.metierLabel ?? "autre";
  const catId = normalizeCategoryId(rawCat);
  const profile = String(raw.profile || 'solid').toLowerCase() === 'liquid' ? 'liquid' : 'solid';
  let allowedUnits = Array.isArray(raw.allowedUnits) ? raw.allowedUnits.map(v=>String(v)) : ['g'];
  if(!allowedUnits.includes('g')) allowedUnits.unshift('g');
  allowedUnits = Array.from(new Set(allowedUnits)).filter(u => ['g','piece','ml','tbsp','tsp'].includes(u));
  if(profile === 'liquid') allowedUnits = allowedUnits.filter(u => u !== 'piece');
  if(!allowedUnits.length) allowedUnits = ['g'];
  const conversionsRaw = (raw.conversions && typeof raw.conversions === 'object') ? raw.conversions : {};
  const conversions = {
    pieceWeightG: toNum(conversionsRaw.pieceWeightG ?? raw.pieceWeightG ?? 0),
    mlWeightG: toNum(conversionsRaw.mlWeightG ?? raw.mlWeightG ?? conversionsRaw.mlWeight ?? raw.mlWeight ?? 0),
    tbspWeightG: toNum(conversionsRaw.tbspWeightG ?? raw.tbspWeightG ?? 0),
    tspWeightG: toNum(conversionsRaw.tspWeightG ?? raw.tspWeightG ?? 0),
  };
  const defaultUnitRaw = String(raw.defaultUnit ?? raw.default_unit ?? raw.unitDefault ?? '').trim();
  const defaultUnit = allowedUnits.includes(defaultUnitRaw) ? defaultUnitRaw : allowedUnits[0];
  const thumb = sanitizeImageSrc(
    raw.thumb ?? raw.thumbnail ?? raw.vignette ?? raw.image ?? raw.img ?? raw.photo ?? raw.photoDataUrl ?? raw.dataUrl ?? raw.thumbDataUrl ?? ''
  );
  return {
    id:String(id??""),
    name:String(name??"").trim(),
    categoryId:catId,
    profile,
    allowedUnits,
    defaultUnit,
    conversions,
    kcal100:toNum(kcal),
    p100:toNum(p),
    g100:toNum(g),
    l100:toNum(l),
    kcal:toNum(kcal),
    p:toNum(p),
    carbs:toNum(g),
    fat:toNum(l),
    note:String(raw.note||''),
    thumb
  };
}

function normalizeRecipe(raw){
  const id = String(raw?.id || raw?.uuid || raw?._id || ("r_" + Math.random().toString(16).slice(2)));
  const name = String(raw?.name || raw?.nom || "Recette").trim();
  const rawRecipeCategory = raw?.categoryId ?? raw?.category ?? "autre";
  const categoryId = String(rawRecipeCategory || "autre").trim() || "autre";
  const parts = clamp(toNum(raw?.parts ?? raw?.portions ?? 1), 1, 999);
  const prep = String(raw?.prep || raw?.preparation || "");
  const prepTime = String(raw?.prepTime || raw?.temps || "");
  const rows = Array.isArray(raw?.rows) ? raw.rows.map(r=>{
    const rawRowCategory = r?.categoryId ?? r?.catId ?? r?.cat ?? "";
    const unit = String(r?.unit || "g").trim().toLowerCase() || "g";
    const gramsResolved = clamp(toNum(r?.gramsResolved ?? 0), 0, 1e9);
    const kcal = toNum(r?.macrosResolved?.kcal ?? r?.macros?.kcal ?? 0);
    const p = toNum(r?.macrosResolved?.p ?? r?.macros?.p ?? 0);
    const c = toNum(r?.macrosResolved?.c ?? r?.macros?.c ?? 0);
    const f = toNum(r?.macrosResolved?.f ?? r?.macros?.f ?? 0);
    return {
      categoryId: String(rawRowCategory || "").trim(),
      ingredientId: String(r?.ingredientId || r?.ingId || r?.id || ""),
      ingredientName: String(r?.ingredientName || r?.name || "").trim(),
      qty: clamp(toNum(r?.qty ?? r?.quantity ?? 0), 0, 1e9),
      unit: ["g","piece","ml","tbsp","tsp"].includes(unit) ? unit : "g",
      gramsResolved,
      macrosResolved: { kcal, p, c, f },
    };
  }) : [];
  return { id, name, categoryId, parts, prep, prepTime, rows };
}

function loadRecipes(){
  const arr = safeJsonParse(NutriStorage.get(STORE_KEYS.recipes), []);
  return Array.isArray(arr) ? arr.map(normalizeRecipe) : [];
}
function loadIngredients(){
  const arr = safeJsonParse(NutriStorage.get(STORE_KEYS.ingredients), []);
  return Array.isArray(arr) ? arr.map(normalizeIngredient).filter(x=>x.id && x.name) : [];
}


/* Phase 1 bis — NutriStore access helpers (no UI change / no migration / no suppression) */
const STORE_KEYS = {
  ingredients: (typeof STORAGE_KEYS === 'object' && STORAGE_KEYS && STORAGE_KEYS.ingredients) ? STORAGE_KEYS.ingredients : STORAGE.ingredients,
  recipes: (typeof STORAGE_KEYS === 'object' && STORAGE_KEYS && STORAGE_KEYS.recipes) ? STORAGE_KEYS.recipes : STORAGE.recipes,
};

/* Phase 1 — NutriStore (single store facade, no UI change / no migration / no suppression) */
const NutriStore = (function(){
  const listeners = new Map();
  function clone(list){
    return Array.isArray(list) ? list.slice() : [];
  }
  function emit(event, payload){
    const cbs = listeners.get(event);
    if(!cbs) return;
    for(const cb of Array.from(cbs)){
      try{ cb(payload); }catch(err){ console.error(err); }
    }
  }
  function subscribe(event, cb){
    if(typeof cb !== 'function') return function(){};
    if(!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(cb);
    return function(){
      const set = listeners.get(event);
      if(set) set.delete(cb);
    };
  }
  function getIngredients(){
    const arr = loadIngredients();
    window.ingredients = clone(arr);
    return arr;
  }
  function setIngredients(list){
    const arr = Array.isArray(list) ? list.map(normalizeIngredient).filter(x=>x.id && x.name) : [];
    NutriStorage.writeJSON(STORE_KEYS.ingredients, arr);
    window.ingredients = clone(arr);
    emit('ingredients:changed', clone(arr));
    return true;
  }
  function getRecipes(){
    const arr = loadRecipes();
    window.recipes = clone(arr);
    return arr;
  }
  function setRecipes(list){
    const arr = Array.isArray(list) ? list.map(normalizeRecipe) : [];
    NutriStorage.writeJSON(STORE_KEYS.recipes, arr);
    window.recipes = clone(arr);
    emit('recipes:changed', clone(arr));
    try{
      if(window.NutriAppFilters && typeof window.NutriAppFilters.applyIngredients === 'function'){
        window.NutriAppFilters.applyIngredients();
      }
    }catch(_e){}
    return true;
  }
  function getRecipeById(id){
    const sid = String(id || '');
    return getRecipes().find(r => String(r.id) === sid) || null;
  }
  function saveRecipe(recipe){
    const next = normalizeRecipe(recipe || {});
    const list = getRecipes();
    const idx = list.findIndex(r => String(r.id) === String(next.id));
    if(idx >= 0) list[idx] = next;
    else list.push(next);
    setRecipes(list);
    return next;
  }
  function deleteRecipe(id){
    const sid = String(id || '');
    const list = getRecipes();
    const next = list.filter(r => String(r.id) !== sid);
    const changed = next.length !== list.length;
    if(changed) setRecipes(next);
    return changed;
  }
  return { getIngredients, setIngredients, getRecipes, setRecipes, getRecipeById, saveRecipe, deleteRecipe, subscribe, emit };
})();
window.NutriStore = NutriStore;
if(typeof syncLegacyIngredientCache === 'function'){
  try{ syncLegacyIngredientCache(window.NutriStore.getIngredients()); }catch(_){ }
}
if(window.NutriStore && typeof window.NutriStore.subscribe === 'function' && typeof syncLegacyIngredientCache === 'function'){
  window.NutriStore.subscribe('ingredients:changed', (list)=>{
    try{ syncLegacyIngredientCache(list); }catch(_){ }
  });
}

/* canonical recipe/ingredient contracts exposed globally */
window.normalizeRecipe = normalizeRecipe;
window.loadRecipes = loadRecipes;
window.saveRecipes = function(list){
  return NutriStore.setRecipes(list);
};
window.getRecipes = function(){
  return NutriStore.getRecipes();
};
window.setRecipes = function(list){
  return window.saveRecipes(list);
};
window.normalizeIngredient = normalizeIngredient;
window.loadIngredients = loadIngredients;
window.saveIngredients = function(list){
  return NutriStore.setIngredients(list);
};
window.getIngredients = function(){
  return NutriStore.getIngredients();
};
window.setIngredients = function(list){
  return window.saveIngredients(list);
};

/* Même convention visuelle que les cartes ingrédients : virgule décimale.
   Le nombre stocké et les calculs restent strictement inchangés. */
function fmt1(n){ const v=Math.round(toNum(n)*10)/10; return (Object.is(v,-0)?0:v).toString().replace('.', ','); }
function initials(name){
  const s=String(name||"R").trim();
  const p=s.split(/\s+/).filter(Boolean);
  const a=(p[0]||"R")[0]||"R";
  const b=(p[1]||"")[0]||"";
  return (a+b).toUpperCase();
}

function showView(which){
  const list = byId("viewList");
  const recipe = byId("viewRecipe");
  if(list) list.classList.toggle("show", which==="list" || which==="recipe");
  if(recipe){
    const isRecipe = which==="recipe";
    recipe.classList.toggle("show", isRecipe);
    recipe.setAttribute("aria-hidden", isRecipe ? "false" : "true");
    try{ recipe.inert = !isRecipe; }catch(_e){}
    document.body.classList.toggle("recipeScenarioOpen", isRecipe);
  }
}

/* state */
const RecipeScenarioState = {
  currentRecipe: null,
  scenarioParts: 1,
};
function getCurrentRecipe(){
  return RecipeScenarioState.currentRecipe;
}
function setCurrentRecipe(recipe){
  RecipeScenarioState.currentRecipe = recipe || null;
  return RecipeScenarioState.currentRecipe;
}
function getScenarioPartsValue(){
  return clamp(toNum(RecipeScenarioState.scenarioParts), 1, 999);
}
function setScenarioPartsValue(n){
  RecipeScenarioState.scenarioParts = clamp(toNum(n), 1, 999);
  return RecipeScenarioState.scenarioParts;
}

function getRecipeBaseParts(recipe){
  return clamp(toNum(recipe?.parts ?? recipe?.portions ?? 1), 1, 999);
}
function getScenarioScale(recipe=getCurrentRecipe()){
  const base = getRecipeBaseParts(recipe);
  return getScenarioPartsValue() / base;
}
function getScaledRows(recipe=getCurrentRecipe()){
  const rows = Array.isArray(recipe?.rows) ? recipe.rows : [];
  const scale = getScenarioScale(recipe);
  return rows.map(row => ({ ...row, qty: toNum(row.qty) * scale }));
}

/* runtime single-source access */
function getRuntimeIngredients(){
  return (window.NutriStore && typeof window.NutriStore.getIngredients === "function") ? window.NutriStore.getIngredients() : ((typeof window.getIngredients === "function") ? window.getIngredients() : []);
}
function setRuntimeIngredients(list){
  return (window.NutriStore && typeof window.NutriStore.setIngredients === "function") ? window.NutriStore.setIngredients(list) : ((typeof window.setIngredients === "function") ? window.setIngredients(list) : false);
}
function getRuntimeRecipes(){
  return (window.NutriStore && typeof window.NutriStore.getRecipes === "function") ? window.NutriStore.getRecipes() : ((typeof window.getRecipes === "function") ? window.getRecipes() : []);
}
function setRuntimeRecipes(list){
  return (window.NutriStore && typeof window.NutriStore.setRecipes === "function") ? window.NutriStore.setRecipes(list) : ((typeof window.setRecipes === "function") ? window.setRecipes(list) : false);
}

window.getRuntimeIngredients = getRuntimeIngredients;
window.setRuntimeIngredients = setRuntimeIngredients;
window.getRuntimeRecipes = getRuntimeRecipes;
window.setRuntimeRecipes = setRuntimeRecipes;

/* helpers */
function getIngredientById(id){
  try{
    if(window.IngredientDomain && typeof window.IngredientDomain.getIngredientById === "function"){
      return window.IngredientDomain.getIngredientById(id, getRuntimeIngredients());
    }
  }catch(_e){}
  const list = getRuntimeIngredients();
  return list.find(it => String(it?.id) === String(id)) || null;
}
function computeRecipeTotalsFromRows(rows){
  let totK=0, totP=0, totG=0, totL=0;
  const ings = getRuntimeIngredients();
  for(const row of (rows||[])){
    if(typeof resolveRecipeRow === "function"){
      const resolved = resolveRecipeRow(row, ings);
      if(!resolved.isResolved) continue;
      totK += toNum(resolved.macrosResolved.kcal);
      totP += toNum(resolved.macrosResolved.p);
      totG += toNum(resolved.macrosResolved.c);
      totL += toNum(resolved.macrosResolved.f);
      continue;
    }

    const ing = (typeof recipeFindIngredientByRow === "function")
      ? recipeFindIngredientByRow(row, ings)
      : getIngredientById(row?.ingredientId);
    const qty = clamp(toNum(row?.qty),0,1e9);
    const unit = String(row?.unit || "g").trim() || "g";
    if(!ing || qty<=0) continue;

    const gramsResolved = (typeof recipeConvertQtyToGrams === "function")
      ? recipeConvertQtyToGrams(ing, qty, unit)
      : qty;

    if(!(gramsResolved > 0)) continue;

    const m = (typeof recipeMacrosFromGrams === "function")
      ? recipeMacrosFromGrams(ing, gramsResolved)
      : {
          kcal: (toNum(ing?.kcal100) * gramsResolved) / 100,
          p:    (toNum(ing?.p100)    * gramsResolved) / 100,
          c:    (toNum(ing?.g100)    * gramsResolved) / 100,
          f:    (toNum(ing?.l100)    * gramsResolved) / 100
        };

    totK += toNum(m.kcal);
    totP += toNum(m.p);
    totG += toNum(m.c);
    totL += toNum(m.f);
  }
  return { totK, totP, totG, totL };
}
  const ns = window.NutriRecipes = window.NutriRecipes || {};
  ns.core = Object.assign({}, ns.core || {}, { byId, toNum, escapeHtml, clamp, safeJsonParse, fmt1, initials, showView });
  ns.domain = Object.assign({}, ns.domain || {}, { labelForIngredientCategoryId, CAT_THEME, themeForCat, applyTheme, normalizeCategoryId, normalizeIngredient, normalizeRecipe, loadRecipes, loadIngredients, STORE_KEYS, getIngredientById, computeRecipeTotalsFromRows });
  ns.state = Object.assign({}, ns.state || {}, { RecipeScenarioState, getCurrentRecipe, setCurrentRecipe, getScenarioPartsValue, setScenarioPartsValue, getRecipeBaseParts, getScenarioScale, getScaledRows });
  ns.store = Object.assign({}, ns.store || {}, { NutriStore, getRuntimeIngredients, setRuntimeIngredients, getRuntimeRecipes, setRuntimeRecipes });
  window.computeRecipeTotalsFromRows = computeRecipeTotalsFromRows;
  window.getIngredientById = getIngredientById;
  window.getCurrentRecipe = getCurrentRecipe;
  window.setCurrentRecipe = setCurrentRecipe;
  window.getScenarioPartsValue = getScenarioPartsValue;
  window.setScenarioPartsValue = setScenarioPartsValue;
  window.getRecipeBaseParts = getRecipeBaseParts;
  window.getScaledRows = getScaledRows;
})();
