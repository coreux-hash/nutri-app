/* NutriApp Pass 1 — canonical data contracts and reusable state selectors. */
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.NutriAppState = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  const CONTRACTS = Object.freeze({
    ingredient: Object.freeze({
      required: Object.freeze(['id', 'name']),
      fields: Object.freeze(['id','name','categoryId','categoryLabel','profile','allowedUnits','defaultUnit','conversions','kcal','p','carbs','fat','thumb','note','sourceId','createdAt','updatedAt']),
      units: Object.freeze(['g','piece','ml','tbsp','tsp'])
    }),
    recipe: Object.freeze({
      required: Object.freeze(['id', 'name', 'rows']),
      fields: Object.freeze(['id','name','categoryId','tags','parts','cookedWeight','prepTime','prep','thumbDataUrl','rows','sourceId','createdAt','updatedAt'])
    }),
    menu: Object.freeze({
      required: Object.freeze(['id', 'title', 'lines']),
      fields: Object.freeze(['id','title','name','category','tags','objective','prep','lines','origin','sourceId','createdAt','updatedAt'])
    })
  });

  const runtime = { navigation:null, libraries:{}, filters:{}, storage:null };

  function asArray(value){ return Array.isArray(value) ? value : []; }
  function text(value){ return value == null ? '' : String(value).trim(); }
  function number(value){
    const n = Number(String(value == null ? '' : value).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  function positive(value){ return Math.max(0, number(value)); }
  function clone(value){ try{ return JSON.parse(JSON.stringify(value)); }catch(_){ return value; } }
  function nameKey(value){
    return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  }
  function pick(){
    for(let i=0;i<arguments.length;i+=1){
      const value = arguments[i];
      if(value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
  }
  function copyOptional(target, source, keys){
    keys.forEach(key => {
      if(source && source[key] !== undefined && source[key] !== null && source[key] !== '') target[key] = source[key];
    });
    return target;
  }

  function normalizeIngredient(raw, opts){
    if(!raw || typeof raw !== 'object') return null;
    const options = opts || {};
    const macros = raw.macros && typeof raw.macros === 'object' ? raw.macros : {};
    const profile = text(pick(raw.profile, raw.ingProfile, raw.cmProfile, 'solid')).toLowerCase() === 'liquid' ? 'liquid' : 'solid';
    const requestedUnits = asArray(pick(raw.allowedUnits, raw.unitsAllowed, raw.units, raw.allowed_units, []))
      .map(unit => text(unit).toLowerCase()).filter(unit => CONTRACTS.ingredient.units.includes(unit));
    if(profile === 'liquid'){
      const index = requestedUnits.indexOf('piece');
      if(index >= 0) requestedUnits.splice(index, 1);
    }else{
      const index = requestedUnits.indexOf('ml');
      if(index >= 0) requestedUnits.splice(index, 1);
    }
    if(!requestedUnits.includes('g')) requestedUnits.unshift('g');
    const allowedUnits = Array.from(new Set(requestedUnits.length ? requestedUnits : ['g']));
    const conversionsRaw = raw.conversions && typeof raw.conversions === 'object' ? raw.conversions : {};
    const categoryId = text(pick(raw.categoryId, raw.category_id, raw.catId, raw.cat_id, raw.category, raw.cat, ''));
    const out = {
      id: text(pick(raw.id, raw._id, raw.uid, raw.key, options.fallbackId, '')),
      name: text(pick(raw.name, raw.ingName, raw.cmName, raw.title, raw.nom, raw.label, 'Ingrédient')) || 'Ingrédient',
      categoryId,
      categoryLabel: text(pick(raw.categoryLabel, raw.category_label, options.categoryLabel, '—')) || '—',
      profile,
      allowedUnits,
      defaultUnit: 'g',
      conversions: {
        pieceWeightG: positive(pick(conversionsRaw.pieceWeightG, raw.pieceWeightG, raw.piece_weight_g, 0)),
        mlWeightG: positive(pick(conversionsRaw.mlWeightG, raw.mlWeightG, raw.ml_weight_g, 0)),
        tbspWeightG: positive(pick(conversionsRaw.tbspWeightG, raw.tbspWeightG, raw.tbsp_weight_g, 0)),
        tspWeightG: positive(pick(conversionsRaw.tspWeightG, raw.tspWeightG, raw.tsp_weight_g, 0))
      },
      kcal: positive(pick(raw.kcal, raw.Kcal, raw.kcal100, raw.calories, raw.energy, macros.kcal, macros.Kcal, 0)),
      p: positive(pick(raw.p, raw.P, raw.p100, raw.prot, raw.protein, raw.proteines, macros.p, macros.P, 0)),
      carbs: positive(pick(raw.carbs, raw.c, raw.g, raw.G, raw.g100, raw.glucides, raw.gluc, macros.carbs, macros.g, macros.G, 0)),
      fat: positive(pick(raw.fat, raw.f, raw.l, raw.L, raw.l100, raw.lipides, raw.lip, macros.fat, macros.l, macros.L, 0)),
      thumb: text(pick(raw.thumb, raw.thumbnail, raw.vignette, raw.image, raw.img, raw.photo, raw.photoDataUrl, raw.dataUrl, raw.thumbDataUrl, '')),
      note: text(pick(raw.note, raw.notes, raw.source, raw.comment, raw.remarque, ''))
    };
    if(out.allowedUnits.includes('ml') && out.conversions.mlWeightG <= 0){
      out.allowedUnits = out.allowedUnits.filter(unit => unit !== 'ml');
    }
    const defaultUnit = text(pick(raw.defaultUnit, raw.default_unit, raw.unitDefault, 'g')).toLowerCase();
    out.defaultUnit = out.allowedUnits.includes(defaultUnit) ? defaultUnit : out.allowedUnits[0];
    return copyOptional(out, raw, ['sourceId','createdAt','updatedAt']);
  }

  function normalizeRecipeRow(raw){
    const row = raw && typeof raw === 'object' ? raw : {};
    const macros = row.macrosResolved && typeof row.macrosResolved === 'object'
      ? row.macrosResolved
      : (row.macros && typeof row.macros === 'object' ? row.macros : {});
    const unitRaw = text(pick(row.unit, row.u, 'g')).toLowerCase();
    const out = {
      categoryId: text(pick(row.categoryId, row.catId, row.cat, '')),
      ingredientId: text(pick(row.ingredientId, row.ingId, row.ing, row.id, '')),
      ingredientName: text(pick(row.ingredientName, row.name, row.nameSnapshot, '')),
      qty: positive(pick(row.qty, row.quantity, 0)),
      unit: CONTRACTS.ingredient.units.includes(unitRaw) ? unitRaw : 'g',
      gramsResolved: positive(pick(row.gramsResolved, row.grams, 0)),
      macrosResolved: {
        kcal: positive(pick(macros.kcal, row.kcal, 0)),
        p: positive(pick(macros.p, row.p, 0)),
        c: positive(pick(macros.c, macros.carbs, row.c, row.carbs, 0)),
        f: positive(pick(macros.f, macros.fat, row.f, row.fat, 0))
      }
    };
    return copyOptional(out, row, ['sourceIngredientId','createdAt','updatedAt']);
  }

  function normalizeRecipe(raw, opts){
    if(!raw || typeof raw !== 'object') return null;
    const options = opts || {};
    const out = {
      id: text(pick(raw.id, raw.uuid, raw._id, options.fallbackId, '')),
      name: text(pick(raw.name, raw.nom, raw.title, 'Recette')) || 'Recette',
      categoryId: text(pick(raw.categoryId, raw.category, raw.cat, 'autre')) || 'autre',
      tags: Array.isArray(raw.tags) ? raw.tags.map(text).filter(Boolean).join(', ') : text(raw.tags),
      parts: Math.max(1, Math.min(999, Math.round(positive(pick(raw.parts, raw.portions, raw.recipePortions, 1)) || 1))),
      cookedWeight: positive(pick(raw.cookedWeight, raw.poidsCuit, 0)),
      prepTime: text(pick(raw.prepTime, raw.temps, '')),
      prep: text(pick(raw.prep, raw.preparation, '')),
      thumbDataUrl: text(pick(raw.thumbDataUrl, raw.thumb, raw.thumbnail, raw.image, raw.photoDataUrl, '')),
      rows: asArray(raw.rows).map(normalizeRecipeRow)
    };
    return copyOptional(out, raw, ['sourceId','createdAt','updatedAt']);
  }

  function normalizeMenuLine(raw, fallbackLane, opts){
    const options = opts || {};
    if(typeof raw === 'string'){
      return { id:text(options.fallbackId), lane:text(fallbackLane) || 'breakfast', kind:'note', sourceId:'', name:text(raw) || 'Sans titre', meta:'Note libre', linked:false };
    }
    if(!raw || typeof raw !== 'object') return null;
    const kindRaw = text(pick(raw.kind, raw.type, raw.sourceType, 'note')).toLowerCase();
    const kind = ['recipe','ingredient','note'].includes(kindRaw) ? kindRaw : (kindRaw === 'recette' ? 'recipe' : (kindRaw === 'ingrédient' ? 'ingredient' : 'note'));
    const sourceId = text(pick(raw.sourceId, raw.recipeId, raw.ingredientId, ''));
    const out = {
      id: text(pick(raw.id, options.fallbackId, '')),
      lane: text(pick(raw.lane, fallbackLane, 'breakfast')) || 'breakfast',
      kind,
      sourceId,
      name: text(pick(raw.name, raw.title, raw.label, raw.nameSnapshot, 'Sans titre')) || 'Sans titre',
      meta: text(pick(raw.meta, raw.note, '')),
      linked: kind !== 'note' && !!sourceId
    };
    return copyOptional(out, raw, ['sourceOriginalId','createdAt','updatedAt']);
  }

  function normalizeMenu(raw, opts){
    if(!raw || typeof raw !== 'object') return null;
    const options = opts || {};
    const nextId = typeof options.idFactory === 'function' ? options.idFactory : function(){ return ''; };
    const lines = [];
    if(Array.isArray(raw.lines)){
      raw.lines.forEach(line => {
        const normalized = normalizeMenuLine(line, line && line.lane, { fallbackId:nextId('line') });
        if(normalized) lines.push(normalized);
      });
    }else{
      ['breakfast','lunch','dinner','snack'].forEach(lane => {
        const bucket = raw.lanes && raw.lanes[lane] !== undefined ? raw.lanes[lane] : raw[lane];
        if(Array.isArray(bucket)) bucket.forEach(line => {
          const normalized = normalizeMenuLine(line, lane, { fallbackId:nextId('line') });
          if(normalized) lines.push(normalized);
        });
        else if(typeof bucket === 'string' && bucket.trim()) bucket.split('|').map(text).filter(Boolean).forEach(label => {
          lines.push(normalizeMenuLine(label, lane, { fallbackId:nextId('line') }));
        });
      });
    }
    const title = text(pick(raw.title, raw.name, raw.menuTitle, raw.mealName, 'Menu')) || 'Menu';
    const out = {
      id: text(pick(raw.id, options.fallbackId, nextId('menu'), '')),
      title,
      name: title,
      category: text(pick(raw.category, raw.menuCategory, raw.mealCategory, '')),
      tags: Array.isArray(raw.tags) ? raw.tags.map(text).filter(Boolean).join(', ') : text(pick(raw.tags, raw.menuTags, raw.mealTags, '')),
      objective: text(pick(raw.objective, raw.note, raw.menuNote, raw.mealNote, '')),
      prep: text(pick(raw.prep, raw.mealPrep, '')),
      lines,
      origin: text(pick(raw.origin, 'saved')) || 'saved',
      createdAt: text(pick(raw.createdAt, options.now, '')),
      updatedAt: text(pick(raw.updatedAt, options.now, ''))
    };
    return copyOptional(out, raw, ['sourceId']);
  }

  function menuStats(lines){
    const stats = { meals:0, recipes:0, ingredients:0, notes:0, linked:0 };
    const meals = new Set();
    asArray(lines).forEach(line => {
      if(!line) return;
      if(line.lane) meals.add(line.lane);
      if(line.kind === 'recipe'){ stats.recipes += 1; if(line.sourceId) stats.linked += 1; }
      else if(line.kind === 'ingredient'){ stats.ingredients += 1; if(line.sourceId) stats.linked += 1; }
      else stats.notes += 1;
    });
    stats.meals = meals.size;
    return stats;
  }

  function menuHasMissingSource(menu, sources){
    const refs = sources || {};
    const recipeIds = refs.recipeIds instanceof Set ? refs.recipeIds : new Set(asArray(refs.recipes).map(item => text(item && item.id)).filter(Boolean));
    const ingredientIds = refs.ingredientIds instanceof Set ? refs.ingredientIds : new Set(asArray(refs.ingredients).map(item => text(item && item.id)).filter(Boolean));
    return asArray(menu && menu.lines).some(line => {
      const id = text(line && line.sourceId);
      if(!line || line.kind === 'note' || !id) return false;
      if(typeof refs.findRecipe === 'function' && line.kind === 'recipe') return !refs.findRecipe(id);
      if(typeof refs.findIngredient === 'function' && line.kind === 'ingredient') return !refs.findIngredient(id);
      if(line.kind === 'recipe') return !recipeIds.has(id);
      if(line.kind === 'ingredient') return !ingredientIds.has(id);
      return false;
    });
  }

  function getMenuStatus(menu, sources, fallback){
    if(fallback === 'inspiration') return 'inspiration';
    const stats = menuStats(menu && menu.lines);
    if(!stats.meals) return 'draft';
    if(menuHasMissingSource(menu, sources)) return 'missing';
    if(!stats.linked) return 'incomplete';
    return 'complete';
  }

  function getFilterState(type, raw){
    const source = raw || {};
    const criteria = {};
    Object.keys(source).forEach(key => {
      const value = source[key];
      if(value === undefined || value === null || value === '') return;
      if(key === 'sort' && (value === 'name' || value === 'default')) return;
      if(key === 'filter' && value === 'all') return;
      criteria[key] = value;
    });
    return { type:text(type), active:Object.keys(criteria).length > 0, criteria };
  }

  function getLibraryState(type, allItems, visibleItems, filterState){
    const total = asArray(allItems);
    const visible = visibleItems === undefined ? total : asArray(visibleItems);
    const storageEmpty = total.length === 0;
    const filteredEmpty = !storageEmpty && visible.length === 0;
    return {
      type:text(type),
      totalCount:total.length,
      visibleCount:visible.length,
      storageEmpty,
      filteredEmpty,
      emptyKind:storageEmpty ? 'storage' : (filteredEmpty ? 'filtered' : null),
      filter:filterState || getFilterState(type, {})
    };
  }

  function publish(kind, type, state){
    if(kind === 'library') runtime.libraries[type] = clone(state);
    if(kind === 'filter') runtime.filters[type] = clone(state);
    if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
      try{ window.dispatchEvent(new CustomEvent('nutriapp:statechange', { detail:{ kind, type, state:clone(state) } })); }catch(_){ }
    }
    return state;
  }
  function publishLibraryState(type, state){ return publish('library', type, state); }
  function publishFilterState(type, state){ return publish('filter', type, state); }
  function publishNavigationState(state){
    runtime.navigation = clone(state);
    if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function'){
      try{ window.dispatchEvent(new CustomEvent('nutriapp:statechange', { detail:{ kind:'navigation', type:'activePage', state:clone(state) } })); }catch(_){ }
    }
    return state;
  }
  function getRuntimeState(){ return clone(runtime); }

  function getStorageSnapshot(source){
    const data = source || {};
    const snapshot = {
      ingredients:asArray(data.ingredients).map(item => normalizeIngredient(item)).filter(Boolean),
      recipes:asArray(data.recipes).map(item => normalizeRecipe(item)).filter(Boolean),
      menus:asArray(data.menus).map(item => normalizeMenu(item)).filter(Boolean)
    };
    runtime.storage = clone(snapshot);
    return snapshot;
  }

  function commitStorageTransaction(storage, entries){
    if(!storage || !Array.isArray(entries)) return { ok:false, error:'Transaction de stockage invalide.' };
    const getValue = key => typeof storage.get === 'function' ? storage.get(key) : storage.getItem(key);
    const setValue = (key, value) => typeof storage.set === 'function' ? storage.set(key, value) : storage.setItem(key, value);
    const removeValue = key => typeof storage.remove === 'function' ? storage.remove(key) : storage.removeItem(key);
    const before = new Map(entries.map(([key]) => [key, getValue(key)]));
    try{
      entries.forEach(([key, value]) => {
        const result = setValue(key, JSON.stringify(value));
        if(result === false) throw new Error('Écriture refusée pour ' + key);
      });
    }catch(cause){
      entries.forEach(([key]) => {
        const previous = before.get(key);
        if(previous === null || previous === undefined) removeValue(key);
        else setValue(key, previous);
      });
      return { ok:false, error:'Transaction annulée ; les valeurs précédentes ont été restaurées.', cause };
    }
    return { ok:true };
  }

  function duplicateIds(list){
    const seen = new Set();
    const duplicates = new Set();
    asArray(list).forEach(item => {
      const id = text(item && item.id);
      if(!id) return;
      if(seen.has(id)) duplicates.add(id);
      seen.add(id);
    });
    return Array.from(duplicates);
  }

  function validateRawCards(type, list, report){
    asArray(list).forEach((item, index) => {
      if(!item || typeof item !== 'object' || Array.isArray(item)){
        report.errors.push(type + '[' + index + '] doit être un objet.');
        return;
      }
      const id = text(pick(item.id, item.uuid, item._id, item.uid, item.key, ''));
      const label = type === 'menus'
        ? text(pick(item.title, item.name, item.menuTitle, item.mealName, ''))
        : text(pick(item.name, item.nom, item.title, ''));
      if(!id) report.errors.push(type + '[' + index + '] sans ID.');
      if(!label) report.errors.push(type + '[' + index + '] sans nom.');
      if(type === 'recipes' && !Array.isArray(item.rows)) report.errors.push(type + '[' + index + '].rows doit être une liste.');
      if(type === 'menus' && !Array.isArray(item.lines)) report.errors.push(type + '[' + index + '].lines doit être une liste.');
    });
  }

  function validateBackupPayload(payload){
    const report = { ok:false, schema:text(payload && payload.meta && payload.meta.schema), counts:{ingredients:0,recipes:0,menus:0}, errors:[], warnings:[], info:[] };
    if(!payload || typeof payload !== 'object' || Array.isArray(payload)){
      report.errors.push('JSON invalide : la racine doit être un objet.');
      return report;
    }
    if(!report.schema) report.errors.push('Schéma de sauvegarde absent. Schéma attendu : backup.v3.');
    else if(!['backup.v2','backup.v3'].includes(report.schema)) report.errors.push('Schéma de sauvegarde non pris en charge : ' + report.schema + '.');
    ['ingredients','recipes','menus'].forEach(key => {
      if(!Array.isArray(payload[key])) report.errors.push('Champ ' + key + ' absent ou non-liste. Une sauvegarde globale doit contenir les trois bibliothèques.');
      else validateRawCards(key, payload[key], report);
    });
    const normalized = getStorageSnapshot({ ingredients:payload.ingredients, recipes:payload.recipes, menus:payload.menus });
    report.counts = { ingredients:normalized.ingredients.length, recipes:normalized.recipes.length, menus:normalized.menus.length };
    const duplicateIngredientNames = new Set();
    const seenNames = new Set();
    normalized.ingredients.forEach(item => { const key=nameKey(item.name); if(key && seenNames.has(key)) duplicateIngredientNames.add(key); else if(key) seenNames.add(key); });
    if(duplicateIngredientNames.size) report.errors.push('Ingrédients en double par nom : ' + Array.from(duplicateIngredientNames).slice(0,5).join(', '));
    [['ingrédients',normalized.ingredients],['recettes',normalized.recipes],['menus',normalized.menus]].forEach(([label,list]) => {
      const ids = duplicateIds(list);
      if(ids.length) report.errors.push('IDs ' + label + ' en double : ' + ids.slice(0,5).join(', '));
      const missingId = list.filter(item => !text(item && item.id)).length;
      if(missingId) report.errors.push(label + ' sans ID : ' + missingId + '.');
    });
    const ingIds = new Set(normalized.ingredients.map(item => item.id));
    const recipeIds = new Set(normalized.recipes.map(item => item.id));
    let missingIngredients = 0;
    let missingRecipes = 0;
    normalized.recipes.forEach(recipe => recipe.rows.forEach(row => { if(row.ingredientId && !ingIds.has(row.ingredientId)) missingIngredients += 1; }));
    normalized.menus.forEach(menu => menu.lines.forEach(line => {
      if(line.kind === 'recipe' && line.sourceId && !recipeIds.has(line.sourceId)) missingRecipes += 1;
      if(line.kind === 'ingredient' && line.sourceId && !ingIds.has(line.sourceId)) missingIngredients += 1;
    }));
    if(missingRecipes) report.warnings.push(missingRecipes + ' recette(s) référencée(s) absente(s) de la sauvegarde.');
    if(missingIngredients) report.warnings.push(missingIngredients + ' ingrédient(s) référencé(s) absent(s) de la sauvegarde.');
    report.ok = report.errors.length === 0;
    if(report.ok) report.info.push('Structure compatible avec l’import global NutriApp.');
    report.normalized = normalized;
    return report;
  }

  function validateExchangePack(pack){
    const report = { ok:false, schema:text(pack && pack.meta && pack.meta.schema), errors:[], warnings:[], info:[], counts:{ingredients:0,recipes:0,menus:0}, missing:{ingredients:0,recipes:0} };
    if(!pack || typeof pack !== 'object' || Array.isArray(pack)){
      report.errors.push('JSON invalide : la racine doit être un objet.');
      return report;
    }
    if(report.schema !== 'exchange.v1') report.errors.push('Schéma attendu : exchange.v1.');
    if(!pack.payload || typeof pack.payload !== 'object' || Array.isArray(pack.payload)) report.errors.push('Payload absent.');
    const payload = pack.payload || {};
    ['ingredients','recipes','menus'].forEach(key => {
      if(!Array.isArray(payload[key])) report.errors.push('Payload ' + key + ' absent ou non-liste.');
      else validateRawCards(key, payload[key], report);
    });
    const ingredients = asArray(payload.ingredients).map(item => normalizeIngredient(item)).filter(Boolean);
    const recipes = asArray(payload.recipes).map(item => normalizeRecipe(item)).filter(Boolean);
    const menus = asArray(payload.menus).map(item => normalizeMenu(item)).filter(Boolean);
    report.counts = { ingredients:ingredients.length, recipes:recipes.length, menus:menus.length };
    if(!ingredients.length && !recipes.length && !menus.length) report.errors.push('Paquet vide.');
    [['ingrédients',ingredients],['recettes',recipes],['menus',menus]].forEach(([label,list]) => {
      const ids = duplicateIds(list);
      if(ids.length) report.errors.push('IDs ' + label + ' en double : ' + ids.slice(0,5).join(', '));
      if(list.some(item => !item.id)) report.errors.push('Une ou plusieurs cartes ' + label + ' n’ont pas d’ID.');
    });
    const ingIds = new Set(ingredients.map(item => item.id));
    const recipeIds = new Set(recipes.map(item => item.id));
    recipes.forEach(recipe => recipe.rows.forEach(row => { if(row.ingredientId && !ingIds.has(row.ingredientId)) report.missing.ingredients += 1; }));
    menus.forEach(menu => menu.lines.forEach(line => {
      if(line.kind === 'recipe' && line.sourceId && !recipeIds.has(line.sourceId)) report.missing.recipes += 1;
      if(line.kind === 'ingredient' && line.sourceId && !ingIds.has(line.sourceId)) report.missing.ingredients += 1;
    }));
    if(report.missing.recipes) report.warnings.push(report.missing.recipes + ' recette(s) référencée(s) absente(s) du paquet.');
    if(report.missing.ingredients) report.warnings.push(report.missing.ingredients + ' ingrédient(s) référencé(s) absent(s) du paquet.');
    asArray(pack.dependencies && pack.dependencies.missing).forEach(item => report.warnings.push('Dépendance absente à l’export : ' + text(item && item.type) + ' ' + text(item && item.id)));
    report.ok = report.errors.length === 0;
    if(report.ok) report.info.push('Paquet exchange.v1 lisible.');
    report.normalized = { ingredients, recipes, menus };
    return report;
  }

  return Object.freeze({
    CONTRACTS,
    asArray,
    nameKey,
    normalizeIngredient,
    normalizeRecipeRow,
    normalizeRecipe,
    normalizeMenuLine,
    normalizeMenu,
    menuStats,
    menuHasMissingSource,
    getMenuStatus,
    getFilterState,
    getLibraryState,
    publishLibraryState,
    publishFilterState,
    publishNavigationState,
    getRuntimeState,
    getStorageSnapshot,
    commitStorageTransaction,
    validateBackupPayload,
    validateExchangePack
  });
});
