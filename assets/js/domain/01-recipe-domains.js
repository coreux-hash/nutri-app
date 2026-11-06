/* Phase 4.1 — Domain / Ingredient + Recipe + Category */
(function(){
/* =========================
   Data (prototype)
   - catégories ingrédients (héritées clean_v3)
   - catégories recettes + custom (héritées v3_5_4)
========================= */
window.ING_CATEGORY_ITEMS = window.ING_CATEGORY_ITEMS || [
  { id: "cereales_feculents", label: "Céréales & féculents" },
  { id: "legumes", label: "Légumes" },
  { id: "fruits", label: "Fruits" },
  { id: "viandes_volailles", label: "Viande & volaille" },
  { id: "charcuterie_salaisons", label: "Charcuterie & salaisons" },
  { id: "poissons", label: "Poisson" },
  { id: "fruits_de_mer", label: "Fruits de mer" },
  { id: "oeufs", label: "Œufs" },
  { id: "proteines_vegetales", label: "Protéines végétales" },
  { id: "fromages", label: "Fromages" },
  { id: "produits_laitiers", label: "Produits laitiers" },
  { id: "matieres_grasses", label: "Matières grasses" },
  { id: "fruits_coque_graines", label: "Fruits à coque & graines" },
  { id: "sucrants", label: "Sucrants" },
  { id: "tartinables_confitures", label: "Tartinables & confitures" },
  { id: "aides_techniques", label: "Aides techniques (levure, gélifiants…)" },
  { id: "epices_aromes", label: "Épices, herbes & arômes" },
  { id: "condiments_sauces", label: "Condiments, sauces & vinaigres" },
  { id: "liquides_boissons", label: "Liquides & boissons" },
  { id: "autre", label: "Autres / divers" }
];

/* U1 — ADN couleur unifié : couleurs de base calées sur la palette canonique (mains ingrédient).
   Catégories communes = teinte ingrédient exacte ; catégories propres recette = même hue, saturée. */
const RECIPE_CATEGORIES = [
  { id: "",               label: "(non classée)", color: "#B3A276" }, // = ingr. autre
  { id: "petit_dej",      label: "Petit Déj", color: "#DDB545" },      // = ingr. cereales_feculents
  { id: "patisseries",    label: "Pâtisseries / Desserts", color: "#C57F54" }, // même hue chaude, saturée
  { id: "soupes",         label: "Soupes", color: "#5187C9" },         // même bleu, saturé
  { id: "bases",          label: "Bases de préparations", color: "#5187C9" },
  { id: "batch_cooking",  label: "Batch cooking", color: "#4E8B43" },  // = ingr. legumes
  { id: "snacks",         label: "Snacks / Collations", color: "#C6963A" }, // même or, saturé
  { id: "autre",          label: "Autre", color: "#B3A276" }           // = ingr. autre (exact)
];

/* U3 — nuancier du sélecteur de catégorie custom aligné sur l'ADN (teintes canoniques saturées) */
const RECIPE_CATEGORY_COLOR_PALETTE = [
  "#B3A276","#DDB545","#C89737","#4E8B43","#A3A93A","#528347",
  "#3EA2C7","#54A7C4","#D36F45","#D3642B","#B93B27","#9D8DB7"
];

const STORAGE = { ingredients: "nutriapp.ingredients.v2", recipes: "nutriapp.recipes.v2", recipeCatsCustom: "nutriapp_recipeCatsCustom_v1" };

function slugifyId(label){
  return String(label||"").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/[^a-z0-9]+/g,"_")
    .replace(/^_+|_+$/g,"")
    .slice(0,40) || "cat";
}

const IngredientDomain = (function(){
  function normalize(raw){ return normalizeIngredient(raw); }
  function getById(id, list){
    const sid = String(id || "");
    const source = Array.isArray(list) ? list : ((window.NutriStore && typeof window.NutriStore.getIngredients === 'function') ? window.NutriStore.getIngredients() : []);
    return source.find(i => String(i && i.id) === sid) || null;
  }
  return { normalizeIngredient: normalize, getIngredientById: getById };
})();

const RecipeDomain = (function(){
  function normalize(raw){ return normalizeRecipe(raw); }
  function computeTotals(rows){ return computeRecipeTotalsFromRows(rows); }
  function validate(recipe){
    const r = normalize(recipe || {});
    const errors = [];
    if(!String(r.name || '').trim()) errors.push('name');
    if(!Array.isArray(r.rows)) errors.push('rows');
    return { valid: errors.length === 0, errors, recipe: r };
  }
  function duplicateRecipe(recipe){
    const src = normalize(recipe || {});
    return normalize({
      ...src,
      id: `r_${Math.random().toString(36).slice(2,10)}${Date.now().toString(36)}`,
      name: src.name ? `${src.name} (copie)` : 'Copie',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  return { normalizeRecipe: normalize, computeRecipeTotalsFromRows: computeTotals, validateRecipe: validate, duplicateRecipe };
})();

const CategoryDomain = (function(){
  const customKey = STORAGE.recipeCatsCustom;
  function normalizeHexColor(input, fallback=''){
    const raw = String(input || '').trim();
    if(!raw) return fallback;
    const hex = raw.replace(/[^#0-9a-fA-F]/g, '');
    const m3 = /^#?([0-9a-fA-F]{3})$/.exec(hex);
    if(m3){
      return '#' + m3[1].split('').map(ch => ch + ch).join('').toUpperCase();
    }
    const m6 = /^#?([0-9a-fA-F]{6})$/.exec(hex);
    if(m6) return '#' + m6[1].toUpperCase();
    return fallback;
  }
  function hexToRgb(hex){
    const h = normalizeHexColor(hex, '#A99A73').slice(1);
    return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
  }
  function rgbToHex(r,g,b){
    const clamp = (n)=>Math.max(0, Math.min(255, Math.round(Number(n)||0)));
    return '#' + [clamp(r), clamp(g), clamp(b)].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  function mixHex(a,b,ratio){
    const ra = hexToRgb(a), rb = hexToRgb(b), t = Math.max(0, Math.min(1, Number(ratio)||0));
    return rgbToHex(ra.r + (rb.r-ra.r)*t, ra.g + (rb.g-ra.g)*t, ra.b + (rb.b-ra.b)*t);
  }
  function themeFromColor(main){
    const m = normalizeHexColor(main, '#A99A73');
    return {
      main: m,
      deep: mixHex(m, '#000000', .30), /* U2 — deep = main x0.70, aligné sur le ratio ingrédient */
      soft: mixHex(m, '#FFFFFF', .48),
      faint: `rgba(${hexToRgb(m).r},${hexToRgb(m).g},${hexToRgb(m).b},.14)`
    };
  }
  function sanitize(list){
    return (Array.isArray(list) ? list : [])
      .filter(x => x && typeof x.id === 'string' && typeof x.label === 'string')
      .map(x => ({ id: String(x.id).trim(), label: String(x.label).trim(), color: normalizeHexColor(x.color, '#D7A27E') }))
      .filter(x => x.id && x.label && x.id !== 'autre' && !RECIPE_CATEGORIES.some(base => base.id === x.id));
  }
  function loadCustom(){
    try{ return sanitize(NutriStorage.readJSON(customKey, [])); }catch(e){ return []; }
  }
  function saveCustom(list){
    const clean = sanitize(list);
    try{ NutriStorage.writeJSON(customKey, clean); }catch(e){}
    try{ window.NutriStore && typeof window.NutriStore.emit === 'function' && window.NutriStore.emit('categories:changed', clean.map(c => ({...c}))); }catch(_){ }
    return clean;
  }
  function getBaseCategories(){ return RECIPE_CATEGORIES.map(c => ({...c})); }
  function getCustomCategories(){ return loadCustom().map(c => ({...c})); }
  function getRecipeCategories(){ return getBaseCategories().concat(getCustomCategories()); }
  function getRecipeCategoryById(id){
    const sid = String(id || '');
    return getRecipeCategories().find(c => c.id === sid) || null;
  }
  function getRecipeCategoryColor(id){
    return normalizeHexColor(getRecipeCategoryById(id)?.color, '#B3A276'); /* U1b — fallback = autre canonique */
  }
  function getRecipeCategoryTheme(id){
    return themeFromColor(getRecipeCategoryColor(id));
  }
  function isValidRecipeCategory(id){ return getRecipeCategories().some(c => c.id === String(id || '')); }
  function labelForRecipeCategoryId(id){
    const sid = String(id || '');
    return (getRecipeCategoryById(sid) || {}).label || sid || '';
  }
  function labelForCategoryId(id){ return labelForRecipeCategoryId(id); }
  function createRecipeCategory(label, color){
    const cleanLabel = String(label || '').trim();
    const cleanColor = normalizeHexColor(color, '#D7A27E');
    if(!cleanLabel) return null;
    const id = 'user_' + slugifyId(cleanLabel);
    const existing = getRecipeCategories().find(c => c.id === id);
    if(existing) return { ...existing, created: false, exists: true };
    const next = saveCustom(getCustomCategories().concat({ id, label: cleanLabel, color: cleanColor }));
    const created = next.find(c => c.id === id) || { id, label: cleanLabel, color: cleanColor };
    return { ...created, created: true, exists: false };
  }
  function renameRecipeCategory(id, nextLabel){
    const sid = String(id || '');
    const label = String(nextLabel || '').trim();
    if(!sid || !label) return false;
    const custom = getCustomCategories();
    const idx = custom.findIndex(c => c.id === sid);
    if(idx < 0) return false;
    custom[idx] = { ...custom[idx], label };
    saveCustom(custom);
    return true;
  }
  function deleteRecipeCategory(id){
    const sid = String(id || '');
    const custom = getCustomCategories();
    const idx = custom.findIndex(c => c.id === sid);
    if(idx < 0) return false;
    custom.splice(idx,1);
    saveCustom(custom);
    const recipes = (window.NutriStore && typeof window.NutriStore.getRecipes === 'function') ? window.NutriStore.getRecipes() : [];
    const migrated = Array.isArray(recipes) ? recipes.map(r => {
      const nr = normalizeRecipe(r || {});
      if(String(nr.categoryId || '') !== sid) return nr;
      return { ...nr, categoryId: 'autre', updatedAt: Date.now() };
    }) : [];
    if(window.NutriStore && typeof window.NutriStore.setRecipes === 'function') window.NutriStore.setRecipes(migrated);
    return true;
  }
  function getRecipeCategoriesForFilter(recipes){
    const map = new Map();
    for(const c of getRecipeCategories()){
      if(!c || !c.id || !c.label) continue;
      if(c.id === 'autre') continue;
      map.set(c.id, c.label);
    }
    const list = Array.isArray(recipes) ? recipes : ((window.NutriStore && typeof window.NutriStore.getRecipes === 'function') ? window.NutriStore.getRecipes() : []);
    for(const r of list){
      const id = String((r && (r.categoryId || r.category || r.cat)) || '').trim();
      if(!id || id === 'autre' || map.has(id)) continue;
      map.set(id, labelForCategoryId(id) || id);
    }
    return [...map.entries()].map(([id,label]) => ({ id, label }))
      .sort((a,b)=> String(a.label).localeCompare(String(b.label), 'fr'));
  }
  return {
    loadRecipeCatsCustom: loadCustom,
    saveRecipeCatsCustom: saveCustom,
    getRecipeCategories,
    getAllRecipeCategories: getRecipeCategories,
    getCustomRecipeCategories: getCustomCategories,
    getRecipeCategoryById,
    getRecipeCategoryColor,
    getRecipeCategoryTheme,
    getRecipeCategoryPalette: ()=>RECIPE_CATEGORY_COLOR_PALETTE.slice(),
    normalizeRecipeCategoryColor: normalizeHexColor,
    isValidRecipeCategory,
    labelForCategoryId,
    createRecipeCategory,
    deleteRecipeCategory,
    renameRecipeCategory,
    getRecipeCategoriesForFilter,
  };
})();

window.IngredientDomain = IngredientDomain;
window.RecipeDomain = RecipeDomain;
window.CategoryDomain = CategoryDomain;

function loadRecipeCatsCustom(){ return CategoryDomain.loadRecipeCatsCustom(); }
function saveRecipeCatsCustom(list){ return CategoryDomain.saveRecipeCatsCustom(list); }
let recipeCatsCustom = loadRecipeCatsCustom();
function getAllRecipeCategories(){ recipeCatsCustom = CategoryDomain.getCustomRecipeCategories(); return CategoryDomain.getRecipeCategories(); }
function isValidRecipeCategory(id){ return CategoryDomain.isValidRecipeCategory(id); }

function populateRecipeCategorySelect(sel){
  if(!sel) return;
  const prev = sel.value;
  sel.innerHTML = "";
  const cats = CategoryDomain.getRecipeCategories().slice().sort((a,b)=>String(a.label||'').localeCompare(String(b.label||''), 'fr'));
  for(const c of cats){
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    sel.appendChild(opt);
  }
  if(prev && [...sel.options].some(o=>o.value===prev)) sel.value = prev;
}

window.loadRecipeCatsCustom = loadRecipeCatsCustom;
window.saveRecipeCatsCustom = saveRecipeCatsCustom;
window.getAllRecipeCategories = getAllRecipeCategories;
window.isValidRecipeCategory = isValidRecipeCategory;
window.populateRecipeCategorySelect = populateRecipeCategorySelect;
Object.defineProperty(window, 'recipeCatsCustom', {
  configurable: true,
  enumerable: false,
  get(){ return recipeCatsCustom; },
  set(v){ recipeCatsCustom = Array.isArray(v) ? v : []; }
});

/* Sample ingredient library (prototype only) */
let ingredients = [
  { id:"ing_1", name:"Flocons d'avoine", categoryId:"cereales_feculents", kcal100:389, prot100:16.9, carb100:66.3, fat100:6.9 },
  { id:"ing_2", name:"Banane", categoryId:"fruits", kcal100:89, prot100:1.1, carb100:22.8, fat100:0.3 },
  { id:"ing_3", name:"Fromage blanc 0%", categoryId:"produits_laitiers", kcal100:46, prot100:8.0, carb100:3.6, fat100:0.2 },
  { id:"ing_4", name:"Beurre de cacahuète", categoryId:"matieres_grasses", kcal100:588, prot100:25.1, carb100:20.0, fat100:50.0 },
  { id:"ing_5", name:"Œuf entier", categoryId:"oeufs", kcal100:143, prot100:12.6, carb100:0.7, fat100:9.5 },
];

function getIngredientById(id){ return ingredients.find(i=>i.id===id); }
function getIngCatLabel(id){ return ((window.ING_CATEGORY_ITEMS||[]).find(x=>x.id===id)||{}).label || ""; }
})();
