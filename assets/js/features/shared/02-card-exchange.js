/* NutriApp exchange.v1 — selective card packs with embedded dependencies */
(function(){
  "use strict";

  const STORAGE_KEYS_SAFE = window.STORAGE_KEYS || window.STORAGE || {};
  const MENU_KEY = STORAGE_KEYS_SAFE.menus || STORAGE_KEYS_SAFE.meals || "nutriapp.meals.v2";
  const SCHEMA = "exchange.v1";

  function byId(id){ return document.getElementById(id); }
  function uid(prefix){ return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; } }
  function asArray(value){ return Array.isArray(value) ? value : []; }
  function escapeHtml(value){
    return String(value ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[m]));
  }
  function nameKey(value){
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }
  function slug(value){
    return String(value || "pack").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pack";
  }
  function readJSON(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    }catch(_){ return fallback; }
  }
  function writeJSON(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); return true; }catch(_){ return false; }
  }

  function getIngredients(){
    try{
      if(window.NutriAppData && typeof window.NutriAppData.getIngredients === "function") return window.NutriAppData.getIngredients();
      if(window.NutriStore && typeof window.NutriStore.getIngredients === "function") return window.NutriStore.getIngredients();
      if(typeof window.getIngredients === "function") return window.getIngredients();
    }catch(_){}
    return [];
  }
  function setIngredients(list){
    if(window.NutriStore && typeof window.NutriStore.setIngredients === "function") return window.NutriStore.setIngredients(list);
    if(typeof window.setIngredients === "function") return window.setIngredients(list);
    const key = STORAGE_KEYS_SAFE.ingredients || "nutriapp.ingredients.v2";
    return writeJSON(key, list);
  }
  function getRecipes(){
    try{
      if(window.NutriStore && typeof window.NutriStore.getRecipes === "function") return window.NutriStore.getRecipes();
      if(typeof window.getRecipes === "function") return window.getRecipes();
    }catch(_){}
    return [];
  }
  function setRecipes(list){
    if(window.NutriStore && typeof window.NutriStore.setRecipes === "function") return window.NutriStore.setRecipes(list);
    if(typeof window.setRecipes === "function") return window.setRecipes(list);
    const key = STORAGE_KEYS_SAFE.recipes || "nutriapp.recipes.v2";
    return writeJSON(key, list);
  }
  function getMenus(){ return asArray(readJSON(MENU_KEY, [])); }
  function setMenus(list){
    const ok = writeJSON(MENU_KEY, asArray(list));
    try{
      if(window.NutriStore && typeof window.NutriStore.emit === "function") window.NutriStore.emit("menus:changed", asArray(list));
    }catch(_){}
    return ok;
  }
  function refreshUi(){
    try{
      if(window.NutriIngredients && window.NutriIngredients.ui && typeof window.NutriIngredients.ui.applyIngredientFilters === "function"){
        window.NutriIngredients.ui.applyIngredientFilters();
      }
    }catch(_){}
    try{ if(typeof window.refreshRecipesPage === "function") window.refreshRecipesPage(); }catch(_){}
    try{
      if(window.NutriMenus && typeof window.NutriMenus.renderSavedMenuCards === "function") window.NutriMenus.renderSavedMenuCards();
      if(window.NutriMenus && typeof window.NutriMenus.filterLibrary === "function") window.NutriMenus.filterLibrary();
    }catch(_){}
  }

  function findIngredient(id){ return getIngredients().find(x => String(x && x.id) === String(id || "")) || null; }
  function findRecipe(id){ return getRecipes().find(x => String(x && x.id) === String(id || "")) || null; }
  function findMenu(id){ return getMenus().find(x => String(x && x.id) === String(id || "")) || null; }
  function labelOf(type, item){
    if(type === "menu") return String(item && (item.title || item.name) || "Menu");
    if(type === "recipe") return String(item && item.name || "Recette");
    return String(item && item.name || "Ingrédient");
  }
  function typeLabel(type){
    return type === "menu" ? "Menu" : (type === "recipe" ? "Recette" : "Ingrédient");
  }
  function typeGlyph(type){
    return type === "menu" ? "M" : (type === "recipe" ? "R" : "I");
  }
  function typeTone(type){
    return type === "menu" ? "menu" : (type === "recipe" ? "recipe" : "ingredient");
  }
  function addMissing(missing, type, id, source){
    const key = type + ":" + String(id || "");
    if(!id || missing.some(x => x.key === key)) return;
    missing.push({ key, type, id:String(id), source:String(source || "") });
  }

  function resolveDependencies(selection){
    const selections = Array.isArray(selection) ? selection : [selection];
    const ingredientIds = new Set();
    const recipeIds = new Set();
    const menuIds = new Set();
    const primary = [];
    const missing = [];

    selections.forEach(sel => {
      const type = String(sel && sel.type || sel && sel.kind || "").trim();
      const id = String(sel && sel.id || "").trim();
      if(!type || !id) return;
      if(type === "ingredient"){
        const item = findIngredient(id);
        if(item){ ingredientIds.add(id); primary.push({ type, id, name:labelOf(type, item) }); }
        else addMissing(missing, type, id, "selection");
      }
      if(type === "recipe"){
        const item = findRecipe(id);
        if(item){ recipeIds.add(id); primary.push({ type, id, name:labelOf(type, item) }); }
        else addMissing(missing, type, id, "selection");
      }
      if(type === "menu"){
        const item = findMenu(id);
        if(item){ menuIds.add(id); primary.push({ type, id, name:labelOf(type, item) }); }
        else addMissing(missing, type, id, "selection");
      }
    });

    menuIds.forEach(id => {
      const menu = findMenu(id);
      asArray(menu && menu.lines).forEach(line => {
        const sourceId = String(line && line.sourceId || "").trim();
        if(!sourceId) return;
        if(line.kind === "recipe"){
          if(findRecipe(sourceId)) recipeIds.add(sourceId);
          else addMissing(missing, "recipe", sourceId, "menu:" + id);
        }
        if(line.kind === "ingredient"){
          if(findIngredient(sourceId)) ingredientIds.add(sourceId);
          else addMissing(missing, "ingredient", sourceId, "menu:" + id);
        }
      });
    });

    recipeIds.forEach(id => {
      const recipe = findRecipe(id);
      asArray(recipe && recipe.rows).forEach(row => {
        const ingredientId = String(row && row.ingredientId || "").trim();
        if(!ingredientId) return;
        if(findIngredient(ingredientId)) ingredientIds.add(ingredientId);
        else addMissing(missing, "ingredient", ingredientId, "recipe:" + id);
      });
    });

    return {
      primary,
      ids:{
        ingredients:Array.from(ingredientIds),
        recipes:Array.from(recipeIds),
        menus:Array.from(menuIds)
      },
      missing:missing.map(({ key, ...item }) => item)
    };
  }

  function exportCardPack(selection, opts){
    const resolved = resolveDependencies(selection);
    const ingredients = getIngredients().filter(item => resolved.ids.ingredients.includes(String(item && item.id))).map(clone);
    const recipes = getRecipes().filter(item => resolved.ids.recipes.includes(String(item && item.id))).map(clone);
    const menus = getMenus().filter(item => resolved.ids.menus.includes(String(item && item.id))).map(clone);
    const title = String(opts && opts.title || resolved.primary[0]?.name || "Pack NutriApp").trim() || "Pack NutriApp";
    return {
      meta:{
        app:"NutriApp",
        schema:SCHEMA,
        kind:"card_pack",
        exportedAt:new Date().toISOString(),
        title,
        createdBy:String(opts && (opts.createdBy || opts.sender) || "").trim(),
        message:String(opts && opts.message || "").trim(),
        counts:{ ingredients:ingredients.length, recipes:recipes.length, menus:menus.length }
      },
      primary:resolved.primary,
      payload:{ ingredients, recipes, menus },
      dependencies:{
        included:true,
        policy:"embed_required_cards",
        missing:resolved.missing
      },
      importPolicy:{
        defaultMode:"add_copy",
        conflictKey:"type_name",
        neverOverwriteSilently:true
      }
    };
  }

  function validatePack(pack){
    if(window.NutriAppState && typeof window.NutriAppState.validateExchangePack === 'function'){
      return window.NutriAppState.validateExchangePack(pack);
    }
    const report = { ok:false, schema:String(pack && pack.meta && pack.meta.schema || ""), errors:[], warnings:[], info:[], counts:{ ingredients:0, recipes:0, menus:0 } };
    if(!pack || typeof pack !== "object"){
      report.errors.push("JSON invalide : la racine doit être un objet.");
      return report;
    }
    if(!pack.meta || pack.meta.schema !== SCHEMA) report.errors.push("Schéma attendu : exchange.v1.");
    if(!pack.payload || typeof pack.payload !== "object") report.errors.push("Payload absent.");
    const ingredients = asArray(pack.payload && pack.payload.ingredients);
    const recipes = asArray(pack.payload && pack.payload.recipes);
    const menus = asArray(pack.payload && pack.payload.menus);
    report.counts = { ingredients:ingredients.length, recipes:recipes.length, menus:menus.length };
    if(!ingredients.length && !recipes.length && !menus.length) report.errors.push("Paquet vide.");
    const ingredientIds = new Set(ingredients.map(x => String(x && x.id || "")).filter(Boolean));
    const recipeIds = new Set(recipes.map(x => String(x && x.id || "")).filter(Boolean));
    let missingIngredients = 0;
    let missingRecipes = 0;
    recipes.forEach(recipe => {
      asArray(recipe && recipe.rows).forEach(row => {
        const id = String(row && row.ingredientId || "");
        if(id && !ingredientIds.has(id)) missingIngredients += 1;
      });
    });
    menus.forEach(menu => {
      asArray(menu && menu.lines).forEach(line => {
        const id = String(line && line.sourceId || "");
        if(!id) return;
        if(line.kind === "recipe" && !recipeIds.has(id)) missingRecipes += 1;
        if(line.kind === "ingredient" && !ingredientIds.has(id)) missingIngredients += 1;
      });
    });
    if(missingRecipes) report.warnings.push(missingRecipes + " recette(s) référencée(s) absente(s) du paquet.");
    if(missingIngredients) report.warnings.push(missingIngredients + " ingrédient(s) référencé(s) absent(s) du paquet.");
    asArray(pack.dependencies && pack.dependencies.missing).forEach(item => {
      report.warnings.push("Dépendance absente à l'export : " + typeLabel(item.type) + " " + String(item.id || ""));
    });
    report.ok = report.errors.length === 0;
    if(report.ok) report.info.push("Paquet exchange.v1 lisible.");
    return report;
  }

  function conflictList(type, incoming, current){
    const currentKeys = new Set(asArray(current).map(item => nameKey(type === "menu" ? (item && (item.title || item.name)) : (item && item.name))).filter(Boolean));
    return asArray(incoming).filter(item => currentKeys.has(nameKey(type === "menu" ? (item && (item.title || item.name)) : (item && item.name))))
      .map(item => ({ type, id:String(item && item.id || ""), name:labelOf(type, item) }));
  }
  function buildImportPreview(pack){
    const report = validatePack(pack);
    const payload = pack && pack.payload ? pack.payload : {};
    const conflicts = [
      ...conflictList("ingredient", payload.ingredients, getIngredients()),
      ...conflictList("recipe", payload.recipes, getRecipes()),
      ...conflictList("menu", payload.menus, getMenus())
    ];
    return {
      ok:report.ok,
      report,
      title:String(pack && pack.meta && pack.meta.title || "Pack NutriApp"),
      createdBy:String(pack && pack.meta && pack.meta.createdBy || ""),
      message:String(pack && pack.meta && pack.meta.message || ""),
      primary:asArray(pack && pack.primary),
      counts:report.counts,
      conflicts,
      missing:asArray(pack && pack.dependencies && pack.dependencies.missing)
    };
  }

  function uniqueLabel(base, usedKeys, suffix){
    const raw = String(base || "Carte importée").trim() || "Carte importée";
    let label = raw;
    if(!usedKeys.has(nameKey(label))){
      usedKeys.add(nameKey(label));
      return label;
    }
    const tag = suffix || "importé";
    let i = 1;
    do{
      label = i === 1 ? `${raw} (${tag})` : `${raw} (${tag} ${i})`;
      i += 1;
    }while(usedKeys.has(nameKey(label)));
    usedKeys.add(nameKey(label));
    return label;
  }
  function titleKey(item){ return nameKey(item && (item.title || item.name)); }
  function importPack(pack, opts){
    const validation = validatePack(pack);
    if(!validation.ok) return { ok:false, error:validation.errors.join(" · "), report:validation };
    const payload = pack.payload || {};
    const oldToNewIngredients = new Map();
    const oldToNewRecipes = new Map();
    const oldToNewMenus = new Map();
    const baseIngredients = getIngredients().map(clone);
    const baseRecipes = getRecipes().map(clone);
    const baseMenus = getMenus().map(clone);
    const ingNames = new Set(baseIngredients.map(item => nameKey(item && item.name)).filter(Boolean));
    const recipeNames = new Set(baseRecipes.map(item => nameKey(item && item.name)).filter(Boolean));
    const menuNames = new Set(baseMenus.map(titleKey).filter(Boolean));
    const suffix = (opts && opts.suffix) || "importé";

    const incomingIngredients = asArray(payload.ingredients).map(item => {
      const copy = clone(item) || {};
      const oldId = String(copy.id || "");
      copy.sourceId = oldId;
      copy.id = uid("ing");
      copy.name = uniqueLabel(copy.name || "Ingrédient importé", ingNames, suffix);
      oldToNewIngredients.set(oldId, copy.id);
      return copy;
    });

    const incomingRecipes = asArray(payload.recipes).map(item => {
      const copy = clone(item) || {};
      const oldId = String(copy.id || "");
      copy.sourceId = oldId;
      copy.id = uid("rec");
      copy.name = uniqueLabel(copy.name || "Recette importée", recipeNames, suffix);
      copy.rows = asArray(copy.rows).map(row => {
        const next = clone(row) || {};
        const oldIngredientId = String(next.ingredientId || "");
        if(oldIngredientId && oldToNewIngredients.has(oldIngredientId)) next.ingredientId = oldToNewIngredients.get(oldIngredientId);
        next.sourceIngredientId = oldIngredientId || next.sourceIngredientId || "";
        return next;
      });
      oldToNewRecipes.set(oldId, copy.id);
      return copy;
    });

    const incomingMenus = asArray(payload.menus).map(item => {
      const copy = clone(item) || {};
      const oldId = String(copy.id || "");
      copy.sourceId = oldId;
      copy.id = uid("menu");
      copy.title = uniqueLabel(copy.title || copy.name || "Menu importé", menuNames, suffix);
      copy.name = copy.title;
      copy.lines = asArray(copy.lines).map(line => {
        const next = clone(line) || {};
        const oldSourceId = String(next.sourceId || "");
        if(next.kind === "recipe" && oldToNewRecipes.has(oldSourceId)) next.sourceId = oldToNewRecipes.get(oldSourceId);
        if(next.kind === "ingredient" && oldToNewIngredients.has(oldSourceId)) next.sourceId = oldToNewIngredients.get(oldSourceId);
        next.sourceOriginalId = oldSourceId || next.sourceOriginalId || "";
        return next;
      });
      oldToNewMenus.set(oldId, copy.id);
      return copy;
    });

    if(!window.NutriAppData || typeof window.NutriAppData.commitStorageSnapshot !== 'function'){
      return { ok:false, error:'Import indisponible : transaction de stockage absente.' };
    }
    const commit = window.NutriAppData.commitStorageSnapshot({
      ingredients:baseIngredients.concat(incomingIngredients),
      recipes:baseRecipes.concat(incomingRecipes),
      menus:incomingMenus.concat(baseMenus)
    });
    if(!commit || !commit.ok) return { ok:false, error:(commit && commit.error) || 'Import non appliqué.' };

    return {
      ok:true,
      mode:"add_copy",
      counts:{ ingredients:incomingIngredients.length, recipes:incomingRecipes.length, menus:incomingMenus.length },
      maps:{
        ingredients:Object.fromEntries(oldToNewIngredients.entries()),
        recipes:Object.fromEntries(oldToNewRecipes.entries()),
        menus:Object.fromEntries(oldToNewMenus.entries())
      }
    };
  }

  function downloadJSON(payload, filename){
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 900);
  }
  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
      return true;
    }catch(_){
      try{
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        ta.remove();
        return true;
      }catch(__){
        return false;
      }
    }
  }
  function packVisualItems(packOrPreview){
    const primary = asArray(packOrPreview && packOrPreview.primary);
    if(primary.length) return primary.slice(0, 3).map(item => ({
      type:String(item.type || ""),
      name:String(item.name || item.id || "Carte")
    }));
    const payload = packOrPreview && packOrPreview.payload ? packOrPreview.payload : {};
    const fallback = [
      ...asArray(payload.menus).map(item => ({ type:"menu", name:labelOf("menu", item) })),
      ...asArray(payload.recipes).map(item => ({ type:"recipe", name:labelOf("recipe", item) })),
      ...asArray(payload.ingredients).map(item => ({ type:"ingredient", name:labelOf("ingredient", item) }))
    ];
    return fallback.slice(0, 3);
  }
  function renderPackVisual(packOrPreview, opts){
    const counts = packOrPreview && packOrPreview.counts
      ? packOrPreview.counts
      : ((packOrPreview && packOrPreview.meta && packOrPreview.meta.counts) || { ingredients:0, recipes:0, menus:0 });
    const title = String(packOrPreview && (packOrPreview.title || (packOrPreview.meta && packOrPreview.meta.title)) || "Pack NutriApp");
    const sender = String(packOrPreview && (packOrPreview.createdBy || (packOrPreview.meta && packOrPreview.meta.createdBy)) || "");
    const message = String(packOrPreview && (packOrPreview.message || (packOrPreview.meta && packOrPreview.meta.message)) || "");
    const items = packVisualItems(packOrPreview);
    const cards = (items.length ? items : [{ type:"ingredient", name:"Carte NutriApp" }]).map((item, index) => `
      <article class="exchangeStackCard exchangeStackCard--${index + 1}" data-type="${escapeHtml(typeTone(item.type))}">
        <div class="exchangeStackGlyph">${escapeHtml(typeGlyph(item.type))}</div>
        <div>
          <b>${escapeHtml(item.name)}</b>
          <span>${escapeHtml(typeLabel(item.type))}</span>
        </div>
      </article>
    `).join("");
    return `
      <div class="exchangePackVisual">
        <div class="exchangePackDeck" aria-hidden="true">${cards}</div>
        <div class="exchangePackCopy">
          <div class="exchangeEyebrow">${escapeHtml(opts && opts.eyebrow || "Paquet NutriApp")}</div>
          <h4>${escapeHtml(title)}</h4>
          ${sender ? `<p class="exchangeSender">De ${escapeHtml(sender)}</p>` : ""}
          ${message ? `<p>${escapeHtml(message)}</p>` : ""}
          <div class="exchangeMiniStats">
            <span><b>${escapeHtml(counts.ingredients || 0)}</b> ingrédients</span>
            <span><b>${escapeHtml(counts.recipes || 0)}</b> recettes</span>
            <span><b>${escapeHtml(counts.menus || 0)}</b> menus</span>
          </div>
        </div>
      </div>
    `;
  }
  function downloadCardPack(type, id){
    const item = type === "ingredient" ? findIngredient(id) : (type === "recipe" ? findRecipe(id) : findMenu(id));
    if(!item){ alert("Carte introuvable."); return null; }
    const baseTitle = labelOf(type, item);
    const pack = exportCardPack({ type, id }, { title:baseTitle });
    const filename = "nutriapp-pack-" + slug(baseTitle) + ".json";
    downloadJSON(pack, filename);
    return pack;
  }
  let pendingShareSelection = null;
  function shareIncludedMarkup(pack){
    const missing = asArray(pack && pack.dependencies && pack.dependencies.missing);
    const counts = (pack && pack.meta && pack.meta.counts) || { ingredients:0, recipes:0, menus:0 };
    const chips = [
      counts.menus ? `<span class="exchangeCardChip" data-type="menu">${escapeHtml(counts.menus)} menu${counts.menus > 1 ? "s" : ""}</span>` : "",
      counts.recipes ? `<span class="exchangeCardChip" data-type="recipe">${escapeHtml(counts.recipes)} recette${counts.recipes > 1 ? "s" : ""}</span>` : "",
      counts.ingredients ? `<span class="exchangeCardChip" data-type="ingredient">${escapeHtml(counts.ingredients)} ingrédient${counts.ingredients > 1 ? "s" : ""}</span>` : ""
    ].filter(Boolean).join("");
    const missingRows = missing.map(item => `<li>${escapeHtml(typeLabel(item.type))} ${escapeHtml(item.id || "")}</li>`).join("");
    return `
      <div class="exchangeCardRail">${chips}</div>
      ${missingRows ? `<div class="exchangeNotice exchangeNotice--warn"><b>Dépendances absentes</b><ul>${missingRows}</ul></div>` : ""}
    `;
  }
  function buildSharePackFromFields(){
    if(!pendingShareSelection) return null;
    const titleEl = byId("exchangeShareTitle");
    const senderEl = byId("exchangeShareSender");
    const messageEl = byId("exchangeShareMessage");
    return exportCardPack(pendingShareSelection, {
      title:String(titleEl && titleEl.value || "").trim(),
      createdBy:String(senderEl && senderEl.value || "").trim(),
      message:String(messageEl && messageEl.value || "").trim()
    });
  }
  function renderShareComposer(){
    const preview = byId("exchangeSharePreview");
    const status = byId("exchangeShareStatus");
    const pack = buildSharePackFromFields();
    if(!pack){
      if(preview) preview.innerHTML = "";
      if(status) status.textContent = "";
      return null;
    }
    if(preview){
      preview.innerHTML = renderPackVisual(pack, { eyebrow:"Prêt à envoyer" }) + shareIncludedMarkup(pack);
    }
    const counts = pack.meta.counts || {};
    if(status){
      status.textContent = `Paquet exchange.v1 : ${counts.ingredients || 0} ingrédient(s), ${counts.recipes || 0} recette(s), ${counts.menus || 0} menu(s).`;
    }
    return pack;
  }
  function closeShareComposer(){
    const overlay = byId("exchangeShareOverlay");
    if(!overlay) return;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    try{ overlay.inert = true; }catch(_){}
    setDetailOverlaysCovered(false);
    document.body.style.overflow = "";
    pendingShareSelection = null;
  }
  function setDetailOverlaysCovered(covered){
    ["ingredientDetailOverlay", "recipeDetailOverlay", "menuDetailOverlay"].forEach(id => {
      const detail = byId(id);
      if(!detail || !detail.classList.contains("show")) return;
      if(covered){
        detail.dataset.exchangeCovered = "1";
        detail.setAttribute("aria-hidden", "true");
        try{ detail.inert = true; }catch(_){}
      }else if(detail.dataset.exchangeCovered === "1"){
        delete detail.dataset.exchangeCovered;
        detail.setAttribute("aria-hidden", "false");
        try{ detail.inert = false; }catch(_){}
      }
    });
  }
  function openShareComposer(type, id){
    const overlay = byId("exchangeShareOverlay");
    if(!overlay) return downloadCardPack(type, id);
    const item = type === "ingredient" ? findIngredient(id) : (type === "recipe" ? findRecipe(id) : findMenu(id));
    if(!item){ alert("Carte introuvable."); return null; }
    pendingShareSelection = { type, id };
    const titleEl = byId("exchangeShareTitle");
    const senderEl = byId("exchangeShareSender");
    const messageEl = byId("exchangeShareMessage");
    const baseTitle = labelOf(type, item);
    if(titleEl) titleEl.value = baseTitle;
    if(senderEl) senderEl.value = localStorage.getItem("nutriapp.exchange.sender.v1") || "";
    if(messageEl) messageEl.value = "";
    renderShareComposer();
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    try{ overlay.inert = false; }catch(_){}
    document.body.style.overflow = "hidden";
    try{ titleEl && titleEl.focus && titleEl.focus(); }catch(_){}
    setDetailOverlaysCovered(true);
    return true;
  }

  window.NutriAppExchange = {
    schema:SCHEMA,
    resolveDependencies,
    exportCardPack,
    validatePack,
    buildImportPreview,
    importPack,
    downloadCardPack,
    openShareComposer
  };

  document.addEventListener("click", (event) => {
    const shareBtn = event.target && event.target.closest && event.target.closest("[data-exchange-share]");
    if(!shareBtn) return;
    event.preventDefault();
    event.stopPropagation();
    const type = String(shareBtn.dataset.exchangeShare || "");
    const id = String(shareBtn.dataset.exchangeId || "");
    openShareComposer(type, id);
  });

  (function bindExchangeShareUi(){
    const overlay = byId("exchangeShareOverlay");
    if(!overlay) return;
    const closeBtn = byId("btnExchangeShareClose");
    const backBtn = byId("btnExchangeShareBack");
    const copyBtn = byId("btnExchangeShareCopy");
    const downloadBtn = byId("btnExchangeShareDownload");
    const titleEl = byId("exchangeShareTitle");
    const senderEl = byId("exchangeShareSender");
    const messageEl = byId("exchangeShareMessage");
    const status = byId("exchangeShareStatus");
    [titleEl, senderEl, messageEl].forEach(el => {
      el?.addEventListener("input", renderShareComposer);
    });
    closeBtn?.addEventListener("click", closeShareComposer);
    backBtn?.addEventListener("click", closeShareComposer);
    overlay.addEventListener("click", event => { if(event.target === overlay) closeShareComposer(); });
    document.addEventListener("keydown", event => {
      if(event.key === "Escape" && !overlay.classList.contains("hidden")) closeShareComposer();
    });
    copyBtn?.addEventListener("click", async () => {
      const pack = renderShareComposer();
      if(!pack) return;
      try{ localStorage.setItem("nutriapp.exchange.sender.v1", String(senderEl && senderEl.value || "")); }catch(_){}
      const ok = await copyText(JSON.stringify(pack, null, 2));
      if(status) status.textContent = ok ? "JSON du paquet copié." : "Copie impossible. Utilise le téléchargement.";
    });
    downloadBtn?.addEventListener("click", () => {
      const pack = renderShareComposer();
      if(!pack) return;
      try{ localStorage.setItem("nutriapp.exchange.sender.v1", String(senderEl && senderEl.value || "")); }catch(_){}
      const filename = "nutriapp-pack-" + slug(pack.meta && pack.meta.title || "pack") + ".json";
      downloadJSON(pack, filename);
      if(status) status.textContent = "Paquet téléchargé.";
    });
  })();

  (function bindExchangeImportUi(){
    const openBtn = byId("btnOpenExchangeImport");
    const overlay = byId("exchangeImportOverlay");
    if(!overlay) return;
    const closeBtn = byId("btnExchangeClose");
    const backBtn = byId("btnExchangeBack");
    const loadBtn = byId("btnExchangeLoadFile");
    const validateBtn = byId("btnExchangeValidate");
    const importBtn = byId("btnExchangeImport");
    const clearBtn = byId("btnExchangeClear");
    const fileInput = byId("exchangeFileInput");
    const jsonBox = byId("exchangeJsonBox");
    const status = byId("exchangeStatus");
    const previewEl = byId("exchangePreview");
    let currentPack = null;

    const jsonDetails = byId("exchangeJsonDetails");
    const IMPORT_LABEL = "Ajouter à ma bibliothèque";
    function setImportLabel(total){
      if(!importBtn) return;
      importBtn.textContent = total > 0 ? `Ajouter ${total} carte${total > 1 ? "s" : ""} à ma bibliothèque` : IMPORT_LABEL;
    }
    function setStatus(text){ if(status) status.textContent = text || ""; }
    function setPreview(html){
      if(!previewEl) return;
      previewEl.innerHTML = html || "";
      previewEl.classList.toggle("hidden", !html);
    }
    function close(){
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      try{ overlay.inert = true; }catch(_){}
      document.body.style.overflow = "";
      try{ openBtn && openBtn.focus && openBtn.focus(); }catch(_){}
    }
    function open(opts){
      overlay.classList.remove("hidden");
      overlay.setAttribute("aria-hidden", "false");
      try{ overlay.inert = false; }catch(_){}
      document.body.style.overflow = "hidden";
      const paste = !!(opts && opts.paste);
      if(jsonDetails) jsonDetails.open = paste;
      try{
        const target = paste ? jsonBox : (loadBtn || closeBtn);
        target && target.focus();
      }catch(_){}
    }
    function receiveText(text, sourceName){
      open({ paste:false });
      if(jsonBox) jsonBox.value = String(text || "");
      const preview = validateCurrent();
      if(sourceName && (!preview || preview.ok)) setStatus("Fichier chargé : " + sourceName + ". " + (status ? status.textContent : ""));
      return preview;
    }
    window.NutriExchangeUI = Object.assign({}, window.NutriExchangeUI || {}, { open, receiveText });
    function parseBox(){
      const raw = String(jsonBox && jsonBox.value || "").trim();
      if(!raw) return { ok:false, error:"Zone JSON vide." };
      try{ return { ok:true, value:JSON.parse(raw) }; }catch(_){ return { ok:false, error:"JSON invalide." }; }
    }
    function previewMarkup(preview){
      const primary = asArray(preview.primary).length ? asArray(preview.primary) : [];
      const conflictRows = asArray(preview.conflicts).map(item => `<li><b>${escapeHtml(typeLabel(item.type))}</b> ${escapeHtml(item.name)} → copie créée</li>`).join("");
      const missingRows = asArray(preview.missing).map(item => `<li><b>${escapeHtml(typeLabel(item.type))}</b> ${escapeHtml(item.id || "")}</li>`).join("");
      const warnRows = asArray(preview.report && preview.report.warnings).map(text => `<li>${escapeHtml(text)}</li>`).join("");
      const errRows = asArray(preview.report && preview.report.errors).map(text => `<li>${escapeHtml(text)}</li>`).join("");
      const CHIP_LIMIT = 12;
      const primaryRows = primary.slice(0, CHIP_LIMIT).map(item => `<span class="exchangeCardChip" data-type="${escapeHtml(item.type)}">${escapeHtml(typeLabel(item.type))} · ${escapeHtml(item.name || item.id)}</span>`).join("")
        + (primary.length > CHIP_LIMIT ? `<span class="exchangeCardChip exchangeCardChip--more">+ ${escapeHtml(primary.length - CHIP_LIMIT)} autre(s)</span>` : "");
      return `
        ${renderPackVisual(preview, { eyebrow:"Paquet reçu" })}
        ${primaryRows ? `<div class="exchangeCardRail">${primaryRows}</div>` : ""}
        ${errRows ? `<div class="exchangeNotice exchangeNotice--error"><b>Bloquant</b><ul>${errRows}</ul></div>` : ""}
        ${warnRows ? `<div class="exchangeNotice exchangeNotice--warn"><b>À contrôler</b><ul>${warnRows}</ul></div>` : ""}
        ${conflictRows ? `<div class="exchangeNotice"><b>Conflits de noms</b><ul>${conflictRows}</ul></div>` : ""}
        ${missingRows ? `<div class="exchangeNotice exchangeNotice--warn"><b>Dépendances signalées absentes</b><ul>${missingRows}</ul></div>` : ""}
      `;
    }
    function validateCurrent(){
      const parsed = parseBox();
      currentPack = null;
      if(importBtn) importBtn.disabled = true;
      if(!parsed.ok){
        setStatus(parsed.error);
        setPreview("");
        return null;
      }
      const schema = String(parsed.value && parsed.value.meta && parsed.value.meta.schema || "");
      if(/^backup\./.test(schema)){
        setImportLabel(0);
        setStatus("Ce fichier est une sauvegarde complète (" + schema + "), pas un paquet de cartes.");
        setPreview(`<div class="exchangeNotice exchangeNotice--warn"><b>Mauvaise fenêtre</b><p>Une sauvegarde complète se restaure dans la sauvegarde technique.</p><button class="pillBtn green" type="button" data-exchange-to-backup>Ouvrir dans la sauvegarde technique</button></div>`);
        return null;
      }
      const preview = buildImportPreview(parsed.value);
      setPreview(previewMarkup(preview));
      if(preview.ok){
        currentPack = parsed.value;
        if(importBtn) importBtn.disabled = false;
        const total = (preview.counts.ingredients || 0) + (preview.counts.recipes || 0) + (preview.counts.menus || 0);
        setImportLabel(total);
        setStatus("Paquet valide. Rien ne sera écrasé : les cartes sont ajoutées en copie.");
      }else{
        setImportLabel(0);
        setStatus("Paquet refusé : " + preview.report.errors.join(" · "));
      }
      return preview;
    }

    openBtn?.addEventListener("click", (event) => { event.preventDefault(); open({ paste:true }); });
    previewEl?.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-exchange-to-backup]") : null;
      if(!target) return;
      event.preventDefault();
      const text = jsonBox ? jsonBox.value : "";
      close();
      if(window.NutriBackupUI && typeof window.NutriBackupUI.receiveText === "function") window.NutriBackupUI.receiveText(text, "transfert depuis Recevoir des cartes");
    });
    closeBtn?.addEventListener("click", close);
    backBtn?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if(event.target === overlay) close(); });
    document.addEventListener("keydown", (event) => { if(event.key === "Escape" && !overlay.classList.contains("hidden")) close(); });
    loadBtn?.addEventListener("click", () => fileInput && fileInput.click());
    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if(!file) return;
      try{
        const text = await file.text();
        if(jsonBox) jsonBox.value = text;
        if(jsonDetails) jsonDetails.open = false;
        const preview = validateCurrent();
        if(preview && preview.ok) setStatus("Fichier chargé : " + file.name + ". " + (status ? status.textContent : ""));
      }catch(err){
        console.error(err);
        setStatus("Lecture du fichier impossible.");
      }finally{
        try{ fileInput.value = ""; }catch(_){}
      }
    });
    validateBtn?.addEventListener("click", validateCurrent);
    jsonBox?.addEventListener("input", () => {
      currentPack = null;
      if(importBtn) importBtn.disabled = true;
      setImportLabel(0);
      setPreview("");
      setStatus("Contenu modifié. Valide le paquet avant de l’appliquer.");
    });
    clearBtn?.addEventListener("click", () => {
      if(jsonBox) jsonBox.value = "";
      currentPack = null;
      if(importBtn) importBtn.disabled = true;
      setImportLabel(0);
      setStatus("");
      setPreview("");
    });
    importBtn?.addEventListener("click", () => {
      if(!currentPack){
        const preview = validateCurrent();
        if(!preview || !preview.ok) return;
      }
      const result = importPack(currentPack, { mode:"add_copy" });
      if(!result.ok){
        setStatus(result.error || "Import refusé.");
        return;
      }
      if(importBtn) importBtn.disabled = true;
      setImportLabel(0);
      currentPack = null;
      setStatus(`Cartes ajoutées : ${result.counts.ingredients} ingrédient(s), ${result.counts.recipes} recette(s), ${result.counts.menus} menu(s).`);
      setPreview(`<div class="exchangeNotice exchangeNotice--ok"><b>Import terminé</b><p>Les cartes reçues ont été ajoutées comme copies locales. Les cartes existantes n'ont pas été écrasées.</p></div>`);
    });
  })();

  // Point d'entrée unique : lit le fichier et ouvre la bonne fenêtre selon meta.schema.
  function detectImportKind(value){
    const schema = String(value && value.meta && value.meta.schema || "");
    if(/^backup\./.test(schema)) return "backup";
    if(/^exchange\./.test(schema)) return "exchange";
    const hasLibraries = value && Array.isArray(value.ingredients) && Array.isArray(value.recipes) && Array.isArray(value.menus);
    return hasLibraries ? "backup" : "exchange";
  }
  (function bindSystemImportRouter(){
    const btn = byId("btnSystemImportFile");
    const input = byId("systemImportFileInput");
    const statusEl = byId("systemImportStatus");
    if(!btn || !input) return;
    const say = (text) => { if(statusEl) statusEl.textContent = text || ""; };
    btn.addEventListener("click", () => { say(""); input.click(); });
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if(!file) return;
      try{
        const text = await file.text();
        let value;
        try{ value = JSON.parse(text); }
        catch(_){ say("« " + file.name + " » n'est pas un JSON lisible."); return; }
        const kind = detectImportKind(value);
        if(kind === "backup" && window.NutriBackupUI && typeof window.NutriBackupUI.receiveText === "function"){
          window.NutriBackupUI.receiveText(text, file.name);
        }else if(window.NutriExchangeUI && typeof window.NutriExchangeUI.receiveText === "function"){
          window.NutriExchangeUI.receiveText(text, file.name);
        }else{
          say("Import indisponible.");
        }
      }catch(err){
        console.error(err);
        say("Lecture du fichier impossible.");
      }finally{
        try{ input.value = ""; }catch(_){}
      }
    });
  })();
  window.NutriExchangeUI = Object.assign({}, window.NutriExchangeUI || {}, { detectImportKind });
})();
