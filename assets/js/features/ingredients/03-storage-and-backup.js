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

      const note = String(pick(raw.note, raw.notes, raw.source, raw.cmNote, raw.ingNote, raw.comment, raw.remarque, '')).trim();
      const thumb = String(pick(raw.thumb, raw.thumbnail, raw.vignette, raw.image, raw.img, raw.photo, raw.photoDataUrl, raw.dataUrl, raw.thumbDataUrl, '')).trim();

      const profileRaw = String(pick(raw.profile, raw.ingProfile, raw.cmProfile, 'solid')).trim().toLowerCase();
      const profile = (profileRaw === 'liquid') ? 'liquid' : 'solid';

      const allowedUnitsRaw = pick(raw.allowedUnits, raw.unitsAllowed, raw.units, raw.allowed_units, null);
      let allowedUnits = Array.isArray(allowedUnitsRaw) ? allowedUnitsRaw.map(v=>String(v).trim()).filter(Boolean) : [];
      if(!allowedUnits.includes('g')) allowedUnits.unshift('g');
      allowedUnits = Array.from(new Set(allowedUnits)).filter(u=>['g','piece','tbsp','tsp'].includes(u));
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
    })();

    function upsertIngredientInStore(data){
      if(!data || !data.id) return;
      const next = getIngredientStoreSnapshot().slice();
      const idx = next.findIndex(x => x && x.id === data.id);
      if(idx >= 0) next[idx] = normalizeIngredient(data);
      else next.push(normalizeIngredient(data));
      setIngredientStoreSnapshot(next);
    }

    // expose minimal API for backup modal (global)
    window.NutriAppData = {
      exportAll(){
        const ingredients = getIngredientStoreSnapshot();
        const recipes = getRecipeStoreSnapshot();
        return {
          meta:{
            app:'NutriApp',
            schema:'backup.v2',
            exportedAt: new Date().toISOString()
          },
          ingredients: Array.isArray(ingredients) ? ingredients : [],
          recipes: Array.isArray(recipes) ? recipes : [],
          menus: lsRead(LS_KEYS.menus, [])
        };
      },

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

      importAll(payload, opts){
        if(!payload || typeof payload !== 'object') return {ok:false, error:'JSON invalide.'};
        if(!Array.isArray(payload.ingredients)) return {ok:false, error:'Champ ingredients manquant.'};

        const mode = (opts && typeof opts === 'object' && opts.mode) ? String(opts.mode) : 'replace';
        const incoming = payload.ingredients.map(normalizeIngredient).filter(Boolean);

        // Politique A : unicité stricte du nom (imports inclus)
        const dupKeys = countDuplicateNameKeys(incoming);
        if(dupKeys.length){
          const sample = dupKeys.slice(0,5).join(', ');
          return {ok:false, error:'Import refusé : noms en double dans le fichier. Exemples: ' + sample};
        }

        const normalizeRecipeSafe = (row)=>{
          try{
            return (typeof window.normalizeRecipe === 'function') ? window.normalizeRecipe(row) : row;
          }catch(_){
            return row;
          }
        };
        const incomingRecipes = Array.isArray(payload.recipes) ? payload.recipes.map(normalizeRecipeSafe).filter(Boolean) : null;
        const incomingMenus = Array.isArray(payload.menus) ? payload.menus.slice() : null;
        let nextIngredients = [];

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
              continue;
            }

            if(it.id){
              const id = String(it.id);
              map.set(id, it);
              if(k && !nameToId.has(k)) nameToId.set(k, id);
            }else{
              const gen = 'ing_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
              it.id = gen;
              map.set(gen, it);
              if(k) nameToId.set(k, gen);
            }
          }

          nextIngredients = Array.from(map.values()).map(normalizeIngredient).filter(Boolean);

          if(incomingRecipes){
            const baseRecipes = getRecipeStoreSnapshot();
            const recipeMap = new Map();
            (Array.isArray(baseRecipes) ? baseRecipes : []).forEach(r=>{
              if(r && r.id) recipeMap.set(String(r.id), normalizeRecipeSafe(r));
            });
            incomingRecipes.forEach(r=>{
              if(!r) return;
              const rid = String(r.id || ('r_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6)));
              recipeMap.set(rid, { ...r, id: rid });
            });
            const mergedRecipes = Array.from(recipeMap.values()).map(normalizeRecipeSafe);
            setRecipeStoreSnapshot(mergedRecipes);
          }

          if(incomingMenus){
            const baseMenus = lsRead(LS_KEYS.menus, []);
            const menuMap = new Map();
            (Array.isArray(baseMenus) ? baseMenus : []).forEach(m=>{
              if(m && m.id) menuMap.set(String(m.id), m);
            });
            incomingMenus.forEach(m=>{
              if(!m) return;
              const mid = String(m.id || ('menu_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6)));
              menuMap.set(mid, { ...m, id: mid });
            });
            lsWrite(LS_KEYS.menus, Array.from(menuMap.values()));
          }
        }
        else{
          nextIngredients = incoming.slice();
          const nextRecipes = incomingRecipes ? incomingRecipes.map(normalizeRecipeSafe) : [];
          const nextMenus = incomingMenus ? incomingMenus.slice() : [];
          setRecipeStoreSnapshot(nextRecipes);
          lsWrite(LS_KEYS.menus, nextMenus);
        }

        setIngredientStoreSnapshot(nextIngredients);

        // re-render UI (ingredients)
        if(ingGrid){
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

        return {
          ok:true,
          counts:{
            ingredients: incoming.length,
            recipes: incomingRecipes ? incomingRecipes.length : 0,
            menus: incomingMenus ? incomingMenus.length : 0
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
