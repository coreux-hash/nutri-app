/* Phase 4.1 — Features / Recipes / Editor init bindings */
(function(){
/* =========================
   Init bindings (ids/listeners clés)
========================= */
(function initRecipeEditor(){
  // Import rapide (Import rapide tab)
  try{ window.wireRecipeQuickImportListeners && window.wireRecipeQuickImportListeners(); }catch(e){ console.error(e); }

  // OCR Recette (Scan/OCR tab)
  try{ window.wireRecipeOcrListeners && window.wireRecipeOcrListeners(); }catch(e){ console.error(e); }

  // categories
  window.populateRecipeCategorySelect && window.populateRecipeCategorySelect(byId("recipeCategory"));

  // show custom wrap when category === 'autre'
  function syncRecipeCustomCatUi(){
    const sel = byId("recipeCategory");
    const wrap = byId("recipeCustomCategoryWrap");
    if(!sel || !wrap) return;
    const show = (sel.value === "autre");
    wrap.classList.toggle("hidden", !show);
    if(show) byId("recipeCustomCategoryName")?.focus();
  }
  byId("recipeCategory")?.addEventListener("change", syncRecipeCustomCatUi);
  syncRecipeCustomCatUi();

  function syncRecipeCustomColorUi(nextColor){
    const color = (window.CategoryDomain && typeof window.CategoryDomain.normalizeRecipeCategoryColor === 'function')
      ? window.CategoryDomain.normalizeRecipeCategoryColor(nextColor, '#D7A27E')
      : (String(nextColor || '#D7A27E').trim() || '#D7A27E');
    const input = byId('recipeCustomCategoryColor');
    const swatch = byId('recipeCustomCategoryColorSwatch');
    const btn = byId('recipeCustomCategoryColorBtn');
    if(input) input.value = color;
    if(swatch) swatch.style.background = color;
    if(btn) btn.style.setProperty('--recipe-custom-color', color);
    const chips = [...(byId('recipeCustomCategoryColorPalette')?.querySelectorAll('.recipeColorChip') || [])];
    chips.forEach(chip=>chip.classList.toggle('is-active', String(chip.dataset.color || '').toUpperCase() === color.toUpperCase()));
  }
  function closeRecipeCustomColorPopover(){
    const pop = byId('recipeCustomCategoryColorPopover');
    const btn = byId('recipeCustomCategoryColorBtn');
    if(pop) pop.classList.add('hidden');
    if(btn) btn.setAttribute('aria-expanded', 'false');
  }
  function toggleRecipeCustomColorPopover(){
    const pop = byId('recipeCustomCategoryColorPopover');
    const btn = byId('recipeCustomCategoryColorBtn');
    if(!pop || !btn) return;
    const nextOpen = pop.classList.contains('hidden');
    pop.classList.toggle('hidden', !nextOpen);
    btn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  }
  byId('recipeCustomCategoryColorBtn')?.addEventListener('click', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    toggleRecipeCustomColorPopover();
  });
  byId('recipeCustomCategoryColorPalette')?.addEventListener('click', (e)=>{
    const chip = e.target instanceof HTMLElement ? e.target.closest('.recipeColorChip[data-color]') : null;
    if(!chip) return;
    e.preventDefault();
    syncRecipeCustomColorUi(String(chip.dataset.color || '#D7A27E'));
    closeRecipeCustomColorPopover();
  });
  document.addEventListener('click', (e)=>{
    if(e.target && (e.target.closest('#recipeCustomCategoryColorBtn') || e.target.closest('#recipeCustomCategoryColorPopover'))) return;
    closeRecipeCustomColorPopover();
  });
  syncRecipeCustomColorUi(byId('recipeCustomCategoryColor')?.value || '#D7A27E');

  // add custom category
  byId("btnAddRecipeCategory")?.addEventListener("click", ()=>{
    const name = String(byId("recipeCustomCategoryName")?.value || "").trim();
    if(!name){ setRecipeStatusSafe("Nom de catégorie manquant.", "warn"); return; }
    const created = CategoryDomain.createRecipeCategory(name, byId("recipeCustomCategoryColor")?.value || "#D7A27E");
    if(!created){ setRecipeStatusSafe("Impossible de créer la catégorie.", "warn"); return; }
    window.recipeCatsCustom = CategoryDomain.getCustomRecipeCategories();
    window.populateRecipeCategorySelect && window.populateRecipeCategorySelect(byId("recipeCategory"));
    window.naNotifyRecipeCategoriesChanged();
    byId("recipeCategory").value = created.id;
    byId("recipeCustomCategoryWrap").classList.add("hidden");
    byId("recipeCustomCategoryName").value = "";
    syncRecipeCustomColorUi("#D7A27E");
    setRecipeStatusSafe(created.created ? "Catégorie créée." : "Catégorie déjà existante : sélectionnée.", created.created ? "ok" : "muted");
  });

  // delete selected custom category
  byId("btnDeleteRecipeCategory")?.addEventListener("click", ()=>{
    const sel = byId("recipeCategory");
    if(!sel) return;
    const catId = String(sel.value||"");
    if(!catId || catId==="autre"){
      alert("Choisis une catégorie personnalisée à supprimer.");
      return;
    }
    const idx = (window.recipeCatsCustom || []).findIndex(c=>c && c.id===catId);
    if(idx<0){
      alert("Suppression disponible uniquement pour les catégories personnalisées.");
      return;
    }
    const label = (window.recipeCatsCustom || [])[idx]?.label || catId;
    const ok = confirm(`Supprimer la catégorie “${label}” ?\n\nToutes vos recettes seront déplacées dans la catégorie “Autre”.`);
    if(!ok) return;

    // 1) remove custom category
    const _cats = Array.isArray(window.recipeCatsCustom) ? window.recipeCatsCustom.slice() : [];
    _cats.splice(idx,1);
    window.recipeCatsCustom = _cats;
    window.saveRecipeCatsCustom && window.saveRecipeCatsCustom(_cats);

    // 2) migrate existing recipes to "autre" (best-effort)
    try{
      const keyRecipes = (typeof STORAGE_KEYS==="object" && STORAGE_KEYS && STORAGE_KEYS.recipes) ? STORAGE_KEYS.recipes : "nutriapp.recipes.v2";
      const arr = NutriStorage.readJSON(keyRecipes, []);
      if(Array.isArray(arr)){
        let changed = false;
        for(const r of arr){
          if(r && r.categoryId===catId){ r.categoryId = "autre"; changed = true; }
        }
        if(changed) NutriStorage.writeJSON(keyRecipes, arr);
      }
    }catch(e){}

    // 3) rebuild select + keep user on "autre"
    populateRecipeCategorySelect(sel);
    sel.value = "autre";

    // 4) refresh filters immediately
    window.naNotifyRecipeCategoriesChanged();
    setRecipeStatusSafe("Catégorie supprimée. Recettes déplacées dans Autre.", "muted");
  });

    // rows wiring handled by RecipeEditor (CLEAN_BASE v2)

  // seed first row
  try{ RecipeEditor.addRow({ categoryId:"cereales_feculents" }); }catch(_){ }
})();
})();
