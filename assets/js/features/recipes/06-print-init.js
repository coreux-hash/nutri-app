/* Phase 4.2 — Features / Recipes / Print + init */
(function RecipesPrintInit(){
  const ns = window.NutriRecipes = window.NutriRecipes || {};
  const byId = (ns.core && ns.core.byId) || window.byId || ((id)=>document.getElementById(id));
  const safeJsonParse = (ns.core && ns.core.safeJsonParse) || ((s,f)=>{ try{ return JSON.parse(s); }catch(_e){ return f; } });
  const escapeHtml = (ns.core && ns.core.escapeHtml) || ((s)=>String(s ?? ''));
  const fmt1 = (ns.core && ns.core.fmt1) || ((n)=>String(n ?? 0));
  const toNum = (ns.core && ns.core.toNum) || ((v)=>Number(v)||0);
  const getRuntimeIngredients = (ns.store && ns.store.getRuntimeIngredients) || window.getRuntimeIngredients;
  const getRuntimeRecipes = (ns.store && ns.store.getRuntimeRecipes) || window.getRuntimeRecipes;
  const getCurrentRecipe = (ns.state && ns.state.getCurrentRecipe) || window.getCurrentRecipe;
  const getScenarioPartsValue = (ns.state && ns.state.getScenarioPartsValue) || window.getScenarioPartsValue;
  const getRecipeBaseParts = (ns.state && ns.state.getRecipeBaseParts) || window.getRecipeBaseParts;
  const computeRecipeTotalsFromRows = (ns.domain && ns.domain.computeRecipeTotalsFromRows) || window.computeRecipeTotalsFromRows;
  const labelForIngredientCategoryId = (ns.domain && ns.domain.labelForIngredientCategoryId) || function(){ return 'Autre'; };
  const labelForRecipeCategoryId = (window.CategoryDomain && typeof window.CategoryDomain.labelForCategoryId === 'function')
    ? (id)=>window.CategoryDomain.labelForCategoryId(id)
    : ((id)=>String(id || ''));
  const getIngredientById = (ns.domain && ns.domain.getIngredientById) || window.getIngredientById;
  const STORE_KEYS = (ns.domain && ns.domain.STORE_KEYS) || ((typeof STORAGE_KEYS==='object' && STORAGE_KEYS) ? STORAGE_KEYS : { ingredients:'nutriapp.ingredients.v2', recipes:'nutriapp.recipes.v2' });
  const getApp = ()=>window.NutriApp || {};
  const RecipeListView = (ns.ui && (ns.ui.recipeList || ns.ui.RecipeListView)) || (getApp().ui && getApp().ui.recipeList);
  const RecipeReadonlyView = (ns.ui && (ns.ui.recipeScenario || ns.ui.RecipeReadonlyView)) || (getApp().ui && getApp().ui.recipeScenario);
  const seedDemoIngredients = (ns.ui && ns.ui.seedDemoIngredients) || window.seedDemoIngredients;
  const seedDemoRecipes = (ns.ui && ns.ui.seedDemoRecipes) || window.seedDemoRecipes;
function dumpStorage(){
  const snap = {
    ingredients: (window.NutriStore && typeof window.NutriStore.getIngredients === 'function') ? window.NutriStore.getIngredients() : safeJsonParse(NutriStorage.get(STORE_KEYS.ingredients), null),
    recipes: (window.NutriStore && typeof window.NutriStore.getRecipes === 'function') ? window.NutriStore.getRecipes() : safeJsonParse(NutriStorage.get(STORE_KEYS.recipes), null)
  };
  console.log("[NutriApp dump]", snap);
  alert("Dump console effectué (F12 > Console).");
}


/** ---------- Export PDF (print-to-PDF) : Recette (mode Ajuster) ---------- */
function openPrintOverlay(htmlBody, docTitle){
  const ov = byId("printOverlay");
  const fr = byId("printOverlayFrame");
  const ttl = byId("printOverlayTitle");
  if(!ov || !fr) return;

  try{ ttl && (ttl.textContent = docTitle || "Aperçu"); }catch(e){}
  const css = `
    <style>
      :root{color-scheme:light;}
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:18px;line-height:1.35}
      h1{font-size:20px;margin:0 0 6px}
      h2{font-size:15px;margin:16px 0 6px}
      .meta{font-size:12px;color:#444;margin:0 0 10px}
      .pill{display:inline-block;border:1px solid #ddd;border-radius:999px;padding:2px 8px;font-size:12px;margin-right:6px}
      table{width:100%;border-collapse:collapse;margin:6px 0 10px}
      th,td{border:1px solid #ddd;padding:6px 8px;font-size:12px;vertical-align:top}
      th{background:#f5f5f5;text-align:left}
      .right{text-align:right}
      .muted{color:#666}
      pre{white-space:pre-wrap;border:1px solid #ddd;background:#fafafa;padding:10px;border-radius:10px;font-size:12px}
      @media print{
        button{display:none !important}
        body{margin:10mm}
      }
    </style>
  `;
  const doc = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(docTitle||"Export")}</title>${css}</head><body>${htmlBody}</body></html>`;
  const blob = new Blob([doc], {type:"text/html;charset=utf-8"});
  const url = URL.createObjectURL(blob);

  fr.src = url;
  ov.style.display = "block";

  // Handlers one-time / safe
  const close = () => {
    try{ ov.style.display = "none"; }catch(e){}
    try{ URL.revokeObjectURL(url); }catch(e){}
    try{ fr.src = "about:blank"; }catch(e){}
  };
  const btnC = byId("btnPrintOverlayClose");
  const btnP = byId("btnPrintOverlayPrint");
  if(btnC){
    btnC.onclick = close;
  }
  if(btnP){
    btnP.onclick = () => {
      try{ fr.contentWindow && fr.contentWindow.focus(); }catch(e){}
      try{ fr.contentWindow && fr.contentWindow.print(); }catch(e){}
    };
  }
}

function buildRecipeSheetHtml(r, scenarioParts){
  const parts = Math.max(1, Number(scenarioParts||1) || 1);
  const base = getRecipeBaseParts(r);
  const scale = parts / base;
  const scaledRows = ((r && r.rows) ? r.rows : []).map((row)=> ({ ...row, qty: toNum(row.qtyG ?? row.qty ?? 0) * scale }));
  const t = computeRecipeTotalsFromRows(scaledRows);
  const metaPills = [
    r && r.categoryId ? `<span class="pill">Cat: ${escapeHtml(labelForRecipeCategoryId(r.categoryId))}</span>` : `<span class="pill">Cat: (non classée)</span>`,
    `<span class="pill">Portions: ${parts}</span>`,
    r && r.poidsCuit ? `<span class="pill">Poids cuit: ${escapeHtml(String(r.poidsCuit))} g</span>` : ""
  ].filter(Boolean).join(" ");

  const per = {
    k: (t.totK||0)/parts,
    p: (t.totP||0)/parts,
    g: (t.totG||0)/parts,
    l: (t.totL||0)/parts,
  };

  const rows = scaledRows.map((row)=>{
    const ing = getIngredientById(row.ingredientId);
    const name = (ing && ing.name) ? ing.name : (row.label || "—");
    const qty = toNum(row.qtyG ?? row.qty ?? 0);
    const x = qty/100;
    const kcal = (ing ? toNum(ing.kcal100) : 0)*x;
    const P = (ing ? toNum(ing.p100) : 0)*x;
    const G = (ing ? toNum(ing.g100) : 0)*x;
    const L = (ing ? toNum(ing.l100) : 0)*x;
    return `<tr>
      <td>${escapeHtml(name)}</td>
      <td class="right">${fmt1(qty)}</td>
      <td class="right">${fmt1(kcal)}</td>
      <td class="right">${fmt1(P)}</td>
      <td class="right">${fmt1(G)}</td>
      <td class="right">${fmt1(L)}</td>
    </tr>`;
  }).join("");

  const totalsTable = `
    <table>
      <thead><tr><th></th><th class="right">Kcal</th><th class="right">P</th><th class="right">G</th><th class="right">L</th></tr></thead>
      <tbody>
        <tr><td><b>Total recette</b></td><td class="right"><b>${fmt1(t.totK)}</b></td><td class="right"><b>${fmt1(t.totP)}</b></td><td class="right"><b>${fmt1(t.totG)}</b></td><td class="right"><b>${fmt1(t.totL)}</b></td></tr>
        <tr><td><b>Par portion</b></td><td class="right"><b>${fmt1(per.k)}</b></td><td class="right"><b>${fmt1(per.p)}</b></td><td class="right"><b>${fmt1(per.g)}</b></td><td class="right"><b>${fmt1(per.l)}</b></td></tr>
      </tbody>
    </table>
  `;

  const prep = (byId("recipePrep") ? String(byId("recipePrep").value||"") : (r && r.prep) ? String(r.prep) : "").trim();

  return `
    <h1>Fiche recette — ${escapeHtml((r && r.name) ? r.name : "Recette")}</h1>
    <div class="meta">${metaPills}</div>
    ${totalsTable}
    <h2>Ingrédients</h2>
    <table>
      <thead><tr><th>Ingrédient</th><th class="right">Qté (g)</th><th class="right">Kcal</th><th class="right">P</th><th class="right">G</th><th class="right">L</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6" class="muted">Aucun ingrédient.</td></tr>`}</tbody>
    </table>
    ${prep ? `<h2>Préparation</h2><pre>${escapeHtml(prep)}</pre>` : `<h2>Préparation</h2><div class="muted">—</div>`}
    <div class="muted" style="margin-top:10px">Note: en mode Ajuster, les quantités et les macros sont recalculées à partir des portions affichées, sans modifier la recette sauvegardée.</div>
  `;
}

function exportCurrentRecipePdf(){
  const recipe = getCurrentRecipe();
  if(!recipe){ alert("Aucune recette ouverte."); return; }
  const body = buildRecipeSheetHtml(recipe, getScenarioPartsValue());
  openPrintOverlay(body, `Recette - ${recipe.name || "export"}`);
}


/* listeners (only those still in DOM) */
byId("btnSeed")?.addEventListener("click", ()=>{
  seedDemoIngredients();
  seedDemoRecipes();
  const ingredients = getRuntimeIngredients();
  const recipes = getRuntimeRecipes();
  byId("ingCount").textContent = String(ingredients.length);
  window.naNotifyRecipeCategoriesChanged();
  try{ RecipeListView && typeof RecipeListView.render === "function" && RecipeListView.render(); }catch(_e){}
});
byId("btnDump")?.addEventListener("click", dumpStorage);


byId("btnBackToList").addEventListener("click", ()=>{
  RecipeReadonlyView.close();
});

byId("btnPartsMinus")?.addEventListener("click", ()=> RecipeReadonlyView.setParts(RecipeReadonlyView.getParts()-1));
byId("btnPartsPlus")?.addEventListener("click", ()=> RecipeReadonlyView.setParts(RecipeReadonlyView.getParts()+1));
byId("btnRecipePdf").addEventListener("click", exportCurrentRecipePdf);

/* init */
(function init(){
  const ingredients = getRuntimeIngredients();
  const recipes = getRuntimeRecipes();
  byId("ingCount").textContent = String(ingredients.length);
  const menuCountEl = byId("menuCount");
  if(menuCountEl){
    try{
      const rawMeals = localStorage.getItem('nutriapp.meals.v2');
      const meals = rawMeals ? JSON.parse(rawMeals) : [];
      menuCountEl.textContent = String(Array.isArray(meals) ? meals.length : 0);
    }catch(_err){
      menuCountEl.textContent = "0";
    }
  }
  const sel = byId("recipeFilter");
  if(sel) RecipeListView.init();
  window.naNotifyRecipeCategoriesChanged();
})();
  ns.ui = Object.assign({}, ns.ui || {}, { openPrintOverlay, buildRecipeSheetHtml, exportCurrentRecipePdf, dumpStorage });
  window.dumpStorage = dumpStorage;
})();
