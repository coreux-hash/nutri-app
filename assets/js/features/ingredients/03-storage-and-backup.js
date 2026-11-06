/* Phase 4.2 — Features / Ingredients / Storage + backup */
(function(){
  const ns = window.NutriIngredients = window.NutriIngredients || {};
  const normalizeCategory = function(input){
    return ns.domain && typeof ns.domain.normalizeCategory === 'function'
      ? ns.domain.normalizeCategory(input)
      : (window.normalizeCategory ? window.normalizeCategory(input) : { id:'', label:String(input||'') });
  };
  const ingGrid = (ns.ui && ns.ui.ingGrid) || el.ingGrid;
  const upsertCard = function(data){ return ns.ui && typeof ns.ui.upsertCard === 'function' ? ns.ui.upsertCard(data) : undefined; };
  const numOr0 = (ns.store && typeof ns.store.numOr0 === 'function')
    ? ns.store.numOr0
    : (window.numOr0 || function(v){ const n = parseFloat(String(v||'').replace(',', '.')); return Number.isFinite(n) ? n : 0; });
    // --- Persistence (localStorage) + Backup API ---
    const LS_KEYS = STORAGE_KEYS;
    // --- Phase 1 ter: storage facade (no UI change / no migration / no suppression) ---
    const NutriStorage = window.NutriStorage || (function(){
      function get(key){
        try{ return localStorage.getItem(key); }catch(_){ return null; }
      }
      function set(key, value){
        try{ localStorage.setItem(key, value); return true; }catch(_){ return false; }
      }
      function remove(key){
        try{ localStorage.removeItem(key); return true; }catch(_){ return false; }
      }
      function readJSON(key, fallback){
        try{
          const raw = get(key);
          if(!raw) return fallback;
          const val = JSON.parse(raw);
          return (val === null || val === undefined) ? fallback : val;
        }catch(_){ return fallback; }
      }
      function writeJSON(key, value){
        return set(key, JSON.stringify(value));
      }
      return { get, set, remove, readJSON, writeJSON };
    })();
    window.NutriStorage = NutriStorage;
// --- Migration (v1 -> v2) : si la machine a des anciennes clés, on les copie vers v2 si v2 est vide
    
    // --- Normalisation ingrédient (compat anciennes bibliothèques / schémas) ---
    function normalizeIngredient(raw){
      if(!raw || typeof raw !== 'object') return null;

      if(window.NutriAppState && typeof window.NutriAppState.normalizeIngredient === 'function'){
        const fallbackId = String(raw.id || raw._id || raw.uid || raw.key || ('ing_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6)));
        const catPicked = raw.categoryId ?? raw.category_id ?? raw.catId ?? raw.cat_id ?? raw.category ?? raw.cat ?? raw.ingCategory ?? raw.cmCategory ?? '';
        const catNorm = normalizeCategory(catPicked);
        return window.NutriAppState.normalizeIngredient({ ...raw, categoryId:catNorm.id, categoryLabel:raw.categoryLabel || catNorm.label || '—' }, { fallbackId, categoryLabel:catNorm.label || '—' });
      }

      // Support éventuel: valeurs stockées sous un sous-objet (ex: macros)
      const macros = (raw.macros && typeof raw.macros === 'object') ? raw.macros : null;

      // Helper: récupérer la première valeur définie (non-null/undefined)
      const pick = (...vals) => {
        for(const v of vals){
          if(v !== undefined && v !== null && v !== '') return v;
        }
        return undefined;
      };

      const id = String(pick(raw.id, raw._id, raw.uid, raw.key, ('ing_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6))));
      const name = String(pick(raw.name, raw.ingName, raw.cmName, raw.title, raw.nom, raw.label, 'Ingrédient')).trim();
      const catPicked = pick(raw.categoryId, raw.category_id, raw.catId, raw.cat_id, raw.category, raw.cat, raw.ingCategory, raw.cmCategory, raw.famille, raw.type, '');
      const catNorm = normalizeCategory(catPicked);

      // Valeurs numériques: on accepte plusieurs conventions (kcal/p/carbs/fat, Kcal/P/G/L, prot/gluc/lip, etc.)
      const kcalRaw  = pick(raw.kcal, raw.Kcal, raw.kcal100, raw.calories, raw.energy, raw.cmKcal, raw.ingKcal, macros?.kcal, macros?.Kcal);
      const protRaw  = pick(raw.p, raw.P, raw.prot, raw.protein, raw.proteines, raw.cmP, raw.ingProt, macros?.p, macros?.P, macros?.prot, raw.prot100, raw.protein100, raw.prot_100, raw.cmProt, raw.ingP);
      const carbRaw  = pick(raw.carbs, raw.c, raw.g, raw.G, raw.glucides, raw.gluc, raw.carb100, raw.carbs100, raw.carb_100, raw.cmCarbs, raw.ingCarb, macros?.carbs, macros?.g, macros?.G, raw.cmCarb, raw.cmG, raw.ingG);
      const fatRaw   = pick(raw.fat, raw.f, raw.l, raw.L, raw.lipides, raw.lip, raw.fat100, raw.fat_100, raw.cmFat, raw.ingFat, macros?.fat, macros?.l, macros?.L, raw.cmLip, raw.cmL, raw.ingL);

        const note = String(pick(raw.note, raw.notes, raw.source, raw.cmNote, raw.ingNote, raw.comment, raw.remarque) || '').trim();
        const thumb = String(pick(raw.thumb, raw.thumbnail, raw.vignette, raw.image, raw.img, raw.photo, raw.photoDataUrl, raw.dataUrl, raw.thumbDataUrl) || '').trim();

      const profileRaw = String(pick(raw.profile, raw.ingProfile, raw.cmProfile, 'solid')).trim().toLowerCase();
      const profile = (profileRaw === 'liquid') ? 'liquid' : 'solid';

      const allowedUnitsRaw = pick(raw.allowedUnits, raw.unitsAllowed, raw.units, raw.allowed_units, null);
      let allowedUnits = Array.isArray(allowedUnitsRaw) ? allowedUnitsRaw.map(v=>String(v).trim()).filter(Boolean) : [];
      if(!allowedUnits.includes('g')) allowedUnits.unshift('g');
      allowedUnits = Array.from(new Set(allowedUnits)).filter(u=>['g','piece','ml','tbsp','tsp'].includes(u));
      if(!allowedUnits.length) allowedUnits = ['g'];

      const conversionsRaw = (raw.conversions && typeof raw.conversions === 'object') ? raw.conversions : {};
      const conversions = {
        pieceWeightG: numOr0(pick(conversionsRaw.pieceWeightG, raw.pieceWeightG, raw.piece_weight_g)),
        mlWeightG: numOr0(pick(conversionsRaw.mlWeightG, raw.mlWeightG, raw.ml_weight_g)),
        tbspWeightG: numOr0(pick(conversionsRaw.tbspWeightG, raw.tbspWeightG, raw.tbsp_weight_g)),
        tspWeightG: numOr0(pick(conversionsRaw.tspWeightG, raw.tspWeightG, raw.tsp_weight_g)),
      };
      const defaultUnitRaw = String(pick(raw.defaultUnit, raw.default_unit, raw.unitDefault, 'g')).trim();
      const defaultUnit = allowedUnits.includes(defaultUnitRaw) ? defaultUnitRaw : allowedUnits[0];

      const out = {
        id,
        name,
        categoryId: catNorm.id,
        categoryLabel: catNorm.label || '—',
        profile,
        allowedUnits,
        defaultUnit,
        conversions,
        kcal: numOr0(kcalRaw),
        p: numOr0(protRaw),
        carbs: numOr0(carbRaw),
        fat: numOr0(fatRaw),
        thumb,
        note
      };

      ['sourceId','createdAt','updatedAt'].forEach(key=>{ if(raw[key] !== undefined) out[key] = raw[key]; });
      return out;
    }

function migrateIfNeeded(){
      try{
        const v2_ing = NutriStorage.get(STORAGE_KEYS.ingredients);
        const v1_ing = NutriStorage.get('nutriapp.ingredients.v1');
        if ((!v2_ing || v2_ing === '[]') && v1_ing && v1_ing !== '[]') {
          try{
            const arr = JSON.parse(v1_ing);
            if(Array.isArray(arr)){
              const norm = arr.map(normalizeIngredient).filter(Boolean);
              NutriStorage.writeJSON(STORAGE_KEYS.ingredients, norm);
            } else {
              NutriStorage.set(STORAGE_KEYS.ingredients, v1_ing);
            }
          }catch(_){
            NutriStorage.set(STORAGE_KEYS.ingredients, v1_ing);
          }
        }

        const v2_rec = NutriStorage.get(STORAGE_KEYS.recipes);
        const v1_rec = NutriStorage.get('nutriapp.recipes.v1');
        if ((!v2_rec || v2_rec === '[]') && v1_rec && v1_rec !== '[]') {
          NutriStorage.set(STORAGE_KEYS.recipes, v1_rec);
        }
        if (v1_rec && v1_rec !== '[]' && STORAGE_KEYS.recipes !== 'nutriapp.recipes.v1') {
          try{ localStorage.removeItem('nutriapp.recipes.v1'); }catch(_){ }
        }

        const v2_meals = NutriStorage.get(STORAGE_KEYS.meals);
        const v1_menus = NutriStorage.get('nutriapp.menus.v1');
        if ((!v2_meals || v2_meals === '[]') && v1_menus && v1_menus !== '[]') NutriStorage.set(STORAGE_KEYS.meals, v1_menus);
      }catch(e){}
    }

    migrateIfNeeded();;


    function lsRead(key, fallback){
      try{
        const raw = NutriStorage.get(key);
        if(!raw) return fallback;
        const val = JSON.parse(raw);
        return (val === null || val === undefined) ? fallback : val;
      }catch(_){ return fallback; }
    }
      function lsWrite(key, value){
        NutriStorage.writeJSON(key, value);
      }
      function nameKey(value){
        return String(value || '')
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ');
      }
      function countDuplicateNameKeys(list){
        const counts = new Map();
        (Array.isArray(list) ? list : []).forEach(item=>{
          const key = nameKey(item && item.name);
          if(!key) return;
          counts.set(key, (counts.get(key) || 0) + 1);
        });
        return Array.from(counts.entries()).filter(([,count])=>count > 1).map(([key])=>key);
      }

      // Legacy ingredient cache (derived only). Canonical source is NutriStore / persisted storage.
    function syncLegacyIngredientCache(list){
      const next = Array.isArray(list) ? list.map(normalizeIngredient).filter(Boolean) : [];
      ING_STORE = next.slice();
      try{ window.ING_STORE = next.slice(); }catch(_){ }
      return ING_STORE;
    }
    function getIngredientStoreSnapshot(){
      const list = (window.NutriStore && typeof window.NutriStore.getIngredients === 'function')
        ? window.NutriStore.getIngredients()
        : lsRead(LS_KEYS.ingredients, []);
      return syncLegacyIngredientCache(list);
    }
    function setIngredientStoreSnapshot(list){
      const next = Array.isArray(list) ? list.map(normalizeIngredient).filter(Boolean) : [];
      if(window.NutriStore && typeof window.NutriStore.setIngredients === 'function') window.NutriStore.setIngredients(next);
      else lsWrite(LS_KEYS.ingredients, next);
      return syncLegacyIngredientCache(next);
    }
    function getRecipeStoreSnapshot(){
      if(window.NutriStore && typeof window.NutriStore.getRecipes === 'function') return window.NutriStore.getRecipes();
      return lsRead(LS_KEYS.recipes, []);
    }
    function setRecipeStoreSnapshot(list){
      const next = Array.isArray(list) ? list.map(r=>{
        try{ return (typeof window.normalizeRecipe === 'function') ? window.normalizeRecipe(r) : r; }
        catch(_){ return r; }
      }).filter(Boolean) : [];
      if(window.NutriStore && typeof window.NutriStore.setRecipes === 'function') window.NutriStore.setRecipes(next);
      else lsWrite(LS_KEYS.recipes, next);
      return next;
    }

    let ING_STORE = [];
    syncLegacyIngredientCache(lsRead(LS_KEYS.ingredients, []));
    // écrase en v2 normalisé (évite NaN au rendu)
    lsWrite(LS_KEYS.ingredients, ING_STORE);


    // Render stored ingredients at load
    (function bootIngredients(){
      if(!ingGrid) return;
      const list = getIngredientStoreSnapshot().slice()
        .sort((a,b)=>String(a?.name||'').localeCompare(String(b?.name||''), 'fr'));
      for(let i=list.length-1;i>=0;i--){
        const it = list[i];
        if(it && it.id) upsertCard(it);
      }
      // First-paint filtered/empty-state render. It must run after every ingredient
      // store module is wired: called inline it executes before this module finishes
      // exposing the real ns.store snapshot (end of file), so the snapshot resolver in
      // 02-cards-filters-manual.js still self-delegates and the render throws (swallowed),
      // leaving the empty-state hidden on a fresh library and the count/library unrefreshed.
      // Defer one pass to DOMContentLoaded so it renders against the real store.
      var __ingFirstRender = function(){
        try{
          var api = window.NutriIngredients && window.NutriIngredients.ui;
          if(api && typeof api.applyIngredientFilters === 'function') api.applyIngredientFilters();
        }catch(_){ }
      };
      if(document.readyState === 'complete') setTimeout(__ingFirstRender, 0);
      else document.addEventListener('DOMContentLoaded', __ingFirstRender, { once:true });
    })();

    function upsertIngredientInStore(data){
      if(!data || !data.id) return;
      const next = getIngredientStoreSnapshot().slice();
      const idx = next.findIndex(x => x && x.id === data.id);
      if(idx >= 0) next[idx] = normalizeIngredient(data);
      else next.push(normalizeIngredient(data));
      setIngredientStoreSnapshot(next);
    }

      function uid(prefix){
        return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      }
      function normalizeRecipeSafe(row){
        try{
          return (typeof window.normalizeRecipe === 'function') ? window.normalizeRecipe(row) : row;
        }catch(_){
          return row;
        }
      }
      function normalizeMenuBackup(raw){
        if(!raw || typeof raw !== 'object') return null;
        if(window.NutriAppState && typeof window.NutriAppState.normalizeMenu === 'function'){
          return window.NutriAppState.normalizeMenu(raw, { idFactory:uid, now:new Date().toISOString() });
        }
        const lines = [];
        const normalizeLine = (line, fallbackLane)=>{
          if(!line) return null;
          if(typeof line === 'string'){
            return { id:uid('line'), lane:fallbackLane || 'breakfast', kind:'note', sourceId:'', name:String(line), meta:'Import texte' };
          }
          const kindRaw = String(line.kind || line.type || line.sourceType || 'note').trim().toLowerCase();
          const kind = ['recipe','ingredient','note'].includes(kindRaw) ? kindRaw : (kindRaw === 'recette' ? 'recipe' : (kindRaw === 'ingrédient' ? 'ingredient' : 'note'));
          return {
            id:String(line.id || uid('line')),
            lane:String(line.lane || fallbackLane || 'breakfast'),
            kind,
            sourceId:String(line.sourceId || line.recipeId || line.ingredientId || ''),
            name:String(line.name || line.title || line.label || line.nameSnapshot || '').trim() || 'Sans titre',
            meta:String(line.meta || line.note || '').trim()
          };
        };
        if(Array.isArray(raw.lines)){
          raw.lines.forEach(line => {
            const normalized = normalizeLine(line, line && line.lane);
            if(normalized) lines.push(normalized);
          });
        }else{
          ['breakfast','lunch','dinner','snack'].forEach(lane=>{
            const bucket = (raw.lanes && raw.lanes[lane]) || raw[lane] || [];
            if(Array.isArray(bucket)){
              bucket.forEach(line=>{
                const normalized = normalizeLine(line, lane);
                if(normalized) lines.push(normalized);
              });
            }else if(typeof bucket === 'string' && bucket.trim()){
              bucket.split('|').map(s=>s.trim()).filter(Boolean).forEach(label=>{
                lines.push({ id:uid('line'), lane, kind:'note', sourceId:'', name:label, meta:'Import simple' });
              });
            }
          });
        }
        return {
          ...raw,
          id:String(raw.id || uid('menu')),
          title:String(raw.title || raw.name || raw.menuTitle || raw.mealName || 'Menu').trim() || 'Menu',
          category:String(raw.category || raw.menuCategory || raw.mealCategory || '').trim(),
          tags:Array.isArray(raw.tags) ? raw.tags.join(', ') : String(raw.tags || raw.menuTags || raw.mealTags || '').trim(),
          objective:String(raw.objective || raw.note || raw.menuNote || raw.mealNote || '').trim(),
          prep:String(raw.prep || raw.mealPrep || '').trim(),
          lines,
          createdAt:String(raw.createdAt || new Date().toISOString()),
          updatedAt:String(raw.updatedAt || new Date().toISOString()),
          origin:String(raw.origin || 'saved')
        };
      }
      function asArray(value){
        return Array.isArray(value) ? value : [];
      }
      function duplicateIds(list){
        const seen = new Set();
        const dup = new Set();
        asArray(list).forEach(item=>{
          const id = String(item && item.id || '').trim();
          if(!id) return;
          if(seen.has(id)) dup.add(id);
          seen.add(id);
        });
        return Array.from(dup);
      }
      function validateBackupPayload(payload){
        if(window.NutriAppState && typeof window.NutriAppState.validateBackupPayload === 'function'){
          return window.NutriAppState.validateBackupPayload(payload);
        }
        const report = {
          ok:false,
          schema:String(payload && payload.meta && payload.meta.schema || ''),
          counts:{ ingredients:0, recipes:0, menus:0 },
          errors:[],
          warnings:[],
          info:[]
        };
        if(!payload || typeof payload !== 'object'){
          report.errors.push('JSON invalide : la racine doit être un objet.');
          return report;
        }
        const allowedSchemas = ['', 'backup.v2', 'backup.v3'];
        if(payload.meta && payload.meta.schema && !allowedSchemas.includes(String(payload.meta.schema))){
          report.warnings.push('Schéma non standard pour une sauvegarde globale : ' + String(payload.meta.schema));
        }
        if(!Array.isArray(payload.ingredients)) report.warnings.push('Champ ingredients absent ou non-liste : il sera traité comme une liste vide.');
        if(!Array.isArray(payload.recipes)) report.warnings.push('Champ recipes absent ou non-liste : il sera traité comme une liste vide.');
        if(!Array.isArray(payload.menus)) report.warnings.push('Champ menus absent ou non-liste : il sera traité comme une liste vide.');
        const ingredients = asArray(payload.ingredients).map(normalizeIngredient).filter(Boolean);
        const recipes = asArray(payload.recipes).map(normalizeRecipeSafe).filter(Boolean);
        const menus = asArray(payload.menus).map(normalizeMenuBackup).filter(Boolean);
        report.counts = { ingredients:ingredients.length, recipes:recipes.length, menus:menus.length };
        const dupNames = countDuplicateNameKeys(ingredients);
        if(dupNames.length) report.errors.push('Ingrédients en double par nom : ' + dupNames.slice(0,5).join(', '));
        const dupIngIds = duplicateIds(ingredients);
        const dupRecipeIds = duplicateIds(recipes);
        const dupMenuIds = duplicateIds(menus);
        if(dupIngIds.length) report.errors.push('IDs ingrédients en double : ' + dupIngIds.slice(0,5).join(', '));
        if(dupRecipeIds.length) report.errors.push('IDs recettes en double : ' + dupRecipeIds.slice(0,5).join(', '));
        if(dupMenuIds.length) report.errors.push('IDs menus en double : ' + dupMenuIds.slice(0,5).join(', '));
        const importedIngredientIds = new Set(ingredients.map(x=>String(x && x.id || '')).filter(Boolean));
        const importedRecipeIds = new Set(recipes.map(x=>String(x && x.id || '')).filter(Boolean));
        let recipeMissingIngredients = 0;
        recipes.forEach(recipe=>{
          asArray(recipe && recipe.rows).forEach(row=>{
            const id = String(row && row.ingredientId || '').trim();
            if(id && !importedIngredientIds.has(id)) recipeMissingIngredients += 1;
          });
        });
        if(recipeMissingIngredients) report.warnings.push(recipeMissingIngredients + ' ligne(s) recette référencent un ingrédient non inclus dans la sauvegarde.');
        let menuMissingRecipes = 0;
        let menuMissingIngredients = 0;
        menus.forEach(menu=>{
          asArray(menu && menu.lines).forEach(line=>{
            const id = String(line && line.sourceId || '').trim();
            if(!id) return;
            if(line.kind === 'recipe' && !importedRecipeIds.has(id)) menuMissingRecipes += 1;
            if(line.kind === 'ingredient' && !importedIngredientIds.has(id)) menuMissingIngredients += 1;
          });
        });
        if(menuMissingRecipes) report.warnings.push(menuMissingRecipes + ' ligne(s) menu référencent une recette non incluse dans la sauvegarde.');
        if(menuMissingIngredients) report.warnings.push(menuMissingIngredients + ' ligne(s) menu référencent un ingrédient non inclus dans la sauvegarde.');
        if(!report.errors.length){
          report.ok = true;
          report.info.push('Structure compatible avec l’import global NutriApp.');
        }
        report.normalized = { ingredients, recipes, menus };
        return report;
      }
      function refreshAfterBackupImport(){
        // v17.6 — passe par le filtre ingrédients : reconstruit la grille ET met à jour
        // le compteur du hero (#ingCount), l'état vide et les filtres actifs.
        let refreshed = false;
        try{
          const applyIng = window.NutriIngredients?.ui?.applyIngredientFilters || window.NutriAppFilters?.applyIngredients;
          if(typeof applyIng === 'function'){ applyIng(); refreshed = true; }
        }catch(_){}
        if(!refreshed && ingGrid){
          ingGrid.innerHTML = '';
          const list = getIngredientStoreSnapshot().slice();
          for(let i=list.length-1;i>=0;i--){
            const it = list[i];
            if(it && it.id) upsertCard(it);
          }
        }
        try{
          if(window.refreshRecipesPage && typeof window.refreshRecipesPage === 'function') window.refreshRecipesPage();
        }catch(_){}
        try{
          if(window.NutriMenus && typeof window.NutriMenus.renderSavedMenuCards === 'function') window.NutriMenus.renderSavedMenuCards();
          if(window.NutriMenus && typeof window.NutriMenus.filterLibrary === 'function') window.NutriMenus.filterLibrary();
        }catch(_){}
      }

      function commitStorageSnapshot(snapshot){
        const normalized = {
          ingredients:asArray(snapshot && snapshot.ingredients).map(normalizeIngredient).filter(Boolean),
          recipes:asArray(snapshot && snapshot.recipes).map(normalizeRecipeSafe).filter(Boolean),
          menus:asArray(snapshot && snapshot.menus).map(normalizeMenuBackup).filter(Boolean)
        };
        const entries = [[LS_KEYS.ingredients, normalized.ingredients], [LS_KEYS.recipes, normalized.recipes], [LS_KEYS.menus, normalized.menus]];
        const transaction = window.NutriAppState?.commitStorageTransaction
          ? window.NutriAppState.commitStorageTransaction(NutriStorage, entries)
          : { ok:false, error:'Transaction de stockage indisponible.' };
        if(!transaction.ok) return { ok:false, error:'Import non appliqué : le stockage local a été restauré.', cause:transaction.cause };
        syncLegacyIngredientCache(normalized.ingredients);
        try{
          window.ingredients = normalized.ingredients.slice();
          window.recipes = normalized.recipes.slice();
          window.NutriStore?.emit?.('ingredients:changed', normalized.ingredients.slice());
          window.NutriStore?.emit?.('recipes:changed', normalized.recipes.slice());
          window.NutriStore?.emit?.('menus:changed', normalized.menus.slice());
        }catch(_){ }
        refreshAfterBackupImport();
        return { ok:true, snapshot:normalized };
      }

      // expose minimal API for backup modal (global)
      window.NutriAppData = {
        exportAll(){
          const ingredients = getIngredientStoreSnapshot();
          const recipes = getRecipeStoreSnapshot();
          const menus = asArray(lsRead(LS_KEYS.menus, [])).map(normalizeMenuBackup).filter(Boolean);
          return {
            meta:{
              app:'NutriApp',
              schema:'backup.v3',
              exportedAt: new Date().toISOString(),
              counts:{
                ingredients:Array.isArray(ingredients) ? ingredients.length : 0,
                recipes:Array.isArray(recipes) ? recipes.length : 0,
                menus:Array.isArray(menus) ? menus.length : 0
              },
              storageKeys:{
                ingredients:LS_KEYS.ingredients,
                recipes:LS_KEYS.recipes,
                menus:LS_KEYS.menus
              }
            },
            ingredients: Array.isArray(ingredients) ? ingredients : [],
            recipes: Array.isArray(recipes) ? recipes : [],
            menus: Array.isArray(menus) ? menus : []
          };
        },

        validateAll(payload){
          const report = validateBackupPayload(payload);
          const { normalized, ...publicReport } = report;
          return publicReport;
        },

        commitStorageSnapshot,

      // Ingredients helpers (used by UI actions)
      getIngredients(){
        return getIngredientStoreSnapshot();
      },
      findIngredientById(id){
        if(!id) return null;
        return getIngredientStoreSnapshot().find(x=>x.id===id) || null;
      },
      deleteIngredientById(id){
        if(!id) return false;
        const base = getIngredientStoreSnapshot();
        const next = base.filter(x=>x.id!==id);
        const changed = next.length < base.length;
        if(changed) setIngredientStoreSnapshot(next);
        return changed;
      },
      // v17.2 — retrait groupé (archivage) : même chemin que deleteIngredientById, une seule écriture,
      // seule la clé ingrédients est réécrite (recettes et menus intacts).
      deleteIngredientsByIds(ids){
        const drop = new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean));
        if(!drop.size) return { ok:false, removed:0 };
        const base = getIngredientStoreSnapshot();
        const next = base.filter(x=>!drop.has(String(x && x.id)));
        const removed = base.length - next.length;
        if(removed) setIngredientStoreSnapshot(next);
        return { ok:removed > 0, removed };
      },

        importAll(payload, opts){
          const validation = validateBackupPayload(payload);
          if(!validation.ok){
            return {ok:false, error:validation.errors.join(' · ') || 'Sauvegarde invalide.', report:validation};
          }

          const mode = (opts && typeof opts === 'object' && opts.mode) ? String(opts.mode) : 'replace';
          const incoming = validation.normalized.ingredients;
          const incomingRecipes = validation.normalized.recipes;
          const incomingMenus = validation.normalized.menus;
          let nextIngredients = [];
          let nextRecipes = [];
          let nextMenus = [];
          const stats = {
            mode,
            ingredients:{ incoming:incoming.length, added:0, updated:0, final:0 },
            recipes:{ incoming:incomingRecipes.length, added:0, updated:0, final:0 },
            menus:{ incoming:incomingMenus.length, added:0, updated:0, final:0 }
          };

          if(mode === 'merge'){
            const base = getIngredientStoreSnapshot();
            const map = new Map();
            const nameToId = new Map();

          if(Array.isArray(base)){
            for(const it of base){
              if(it && it.id){
                map.set(String(it.id), it);
                const k = nameKey(it.name);
                if(k && !nameToId.has(k)) nameToId.set(k, String(it.id));
              }
            }
          }

          let conflicts = 0;
          for(const it of incoming){
            const k = nameKey(it.name);
            if(k && nameToId.has(k)) conflicts++;
          }

          if(conflicts > 0){
            const ok = confirm(conflicts + ' ingrédient(s) importé(s) ont un nom déjà présent.\n\nOK = Mettre à jour l\'existant\nAnnuler = Annuler l\'import');
            if(!ok) return {ok:false, error:'Import annulé (noms déjà présents).'};
          }

          for(const it of incoming){
            const k = nameKey(it.name);

              if(k && nameToId.has(k)){
                const existingId = nameToId.get(k);
                const prev = map.get(existingId) || {};
                map.set(existingId, { ...prev, ...it, id: existingId });
                stats.ingredients.updated += 1;
                continue;
              }

              if(it.id){
                const id = String(it.id);
                if(map.has(id)) stats.ingredients.updated += 1;
                else stats.ingredients.added += 1;
                map.set(id, it);
                if(k && !nameToId.has(k)) nameToId.set(k, id);
              }else{
                const gen = 'ing_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
                it.id = gen;
                map.set(gen, it);
                if(k) nameToId.set(k, gen);
                stats.ingredients.added += 1;
              }
            }

            nextIngredients = Array.from(map.values()).map(normalizeIngredient).filter(Boolean);
            stats.ingredients.final = nextIngredients.length;

            const baseRecipes = getRecipeStoreSnapshot();
            const recipeMap = new Map();
            (Array.isArray(baseRecipes) ? baseRecipes : []).forEach(r=>{
              if(r && r.id) recipeMap.set(String(r.id), normalizeRecipeSafe(r));
            });
            incomingRecipes.forEach(r=>{
              if(!r) return;
              const rid = String(r.id || uid('r'));
              if(recipeMap.has(rid)) stats.recipes.updated += 1;
              else stats.recipes.added += 1;
              recipeMap.set(rid, { ...r, id: rid });
            });
            nextRecipes = Array.from(recipeMap.values()).map(normalizeRecipeSafe);
            stats.recipes.final = nextRecipes.length;

            const baseMenus = lsRead(LS_KEYS.menus, []);
            const menuMap = new Map();
            (Array.isArray(baseMenus) ? baseMenus : []).forEach(m=>{
              if(m && m.id) menuMap.set(String(m.id), normalizeMenuBackup(m));
            });
            incomingMenus.forEach(m=>{
              if(!m) return;
              const mid = String(m.id || uid('menu'));
              if(menuMap.has(mid)) stats.menus.updated += 1;
              else stats.menus.added += 1;
              menuMap.set(mid, { ...m, id: mid });
            });
            nextMenus = Array.from(menuMap.values()).map(normalizeMenuBackup).filter(Boolean);
            stats.menus.final = nextMenus.length;
          }
          else{
            nextIngredients = incoming.slice();
            nextRecipes = incomingRecipes.map(normalizeRecipeSafe);
            nextMenus = incomingMenus.map(normalizeMenuBackup).filter(Boolean);
            stats.ingredients.added = nextIngredients.length;
            stats.recipes.added = nextRecipes.length;
            stats.menus.added = nextMenus.length;
            stats.ingredients.final = nextIngredients.length;
            stats.recipes.final = nextRecipes.length;
            stats.menus.final = nextMenus.length;
          }

          const commit = commitStorageSnapshot({ ingredients:nextIngredients, recipes:nextRecipes, menus:nextMenus });
          if(!commit.ok) return { ok:false, error:commit.error, report:validation };

          return {
            ok:true,
            counts:{
              ingredients: incoming.length,
              recipes: incomingRecipes.length,
              menus: incomingMenus.length
            },
            report:{
              ok:true,
              warnings:validation.warnings,
              info:validation.info,
              stats
            }
          };
        }
      };
  ns.store = Object.assign({}, ns.store || {}, {
    NutriStorage, normalizeIngredient, lsRead, lsWrite, syncLegacyIngredientCache, getIngredientStoreSnapshot, setIngredientStoreSnapshot, getRecipeStoreSnapshot, setRecipeStoreSnapshot, upsertIngredientInStore
  });
  try{ window.getIngredientStoreSnapshot = getIngredientStoreSnapshot; }catch(_){ }
  try{ window.setIngredientStoreSnapshot = setIngredientStoreSnapshot; }catch(_){ }
})();
