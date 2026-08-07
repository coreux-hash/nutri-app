/* Phase 6.x — Recipe create modal -> ingredient library bridge */
(function(){
  const state = {
    active: false,
    selectedIngredientIds: new Set()
  };

  const byId = (id)=> document.getElementById(id);

  function overlay(){ return byId('recipeCreateOverlay'); }
  function btnOpenLibrary(){ return byId('btnRecipeLinesLibrary'); }
  function btnReturn(){ return byId('btnReturnToRecipeFromIngredients'); }


  function pageIngredients(){ return byId('pageIngredients'); }
  function syncIngredientLibraryModeUI(){
    const page = pageIngredients();
    if(page) page.classList.toggle('is-recipe-compose-mode', !!state.active);
    document.querySelectorAll('#pageIngredients .card[data-id]').forEach((card)=>{
      const id = String(card.dataset.id || '').trim();
      const checked = !!(id && state.selectedIngredientIds.has(id));
      card.dataset.selectedForRecipe = checked ? 'true' : 'false';
      const input = card.querySelector('.cardSelectInput');
      if(input) input.checked = checked;
      const wrap = card.querySelector('.libCardSelectWrap');
      if(wrap) wrap.setAttribute('aria-hidden', state.active ? 'false' : 'true');
    });
  }
  function syncReturnButton(){
    const btn = btnReturn();
    if(btn){
      btn.classList.toggle('hidden', !state.active);
      btn.setAttribute('aria-hidden', state.active ? 'false' : 'true');
    }
    syncIngredientLibraryModeUI();
  }

  function showPage(key){
    try{
      if(window.NutriAppNav && typeof window.NutriAppNav.showPage === 'function'){
        return window.NutriAppNav.showPage(key);
      }
    }catch(_e){}
    const link = document.querySelector(`nav.nav a[data-page="${String(key||'')}" ]`) || document.querySelector(`nav.nav a[data-page="${String(key||'')}"]`);
    if(link){
      link.click();
      return String(key || 'ingredients');
    }
    return String(key || 'ingredients');
  }

  function suspendRecipeModal(){
    const ov = overlay();
    if(!ov) return;
    if(typeof window.closeRecipeCreateModal === 'function'){
      window.closeRecipeCreateModal();
      return;
    }
    ov.classList.add('hidden');
    ov.setAttribute('aria-hidden', 'true');
    try{ ov.inert = true; }catch(_e){}
  }

  function resumeRecipeModal(){
    const ov = overlay();
    if(!ov) return;
    if(typeof window.openRecipeCreateModal === 'function'){
      window.openRecipeCreateModal();
      return;
    }
    ov.classList.remove('hidden');
    ov.setAttribute('aria-hidden', 'false');
    try{ ov.inert = false; }catch(_e){}
  }

  function openIngredientLibraryFromRecipe(){
    const ov = overlay();
    if(!ov || ov.classList.contains('hidden')) return;
    state.active = true;
    syncReturnButton();
    suspendRecipeModal();
    showPage('ingredients');
    setTimeout(()=>{
      try{ btnReturn()?.focus(); }catch(_e){}
    }, 0);
  }

  function getIngredients(){
    try{
      if(window.NutriStore && typeof window.NutriStore.getIngredients === 'function'){
        return window.NutriStore.getIngredients();
      }
    }catch(_e){}
    try{
      if(Array.isArray(window.__nutriIngredients)) return window.__nutriIngredients;
    }catch(_e){}
    return [];
  }

  function insertSelectedIngredientsIntoRecipe(){
    const selectedIds = [...state.selectedIngredientIds].map(id=>String(id||'').trim()).filter(Boolean);
    if(!selectedIds.length) return 0;

    const allIngredients = getIngredients();
    const byId = new Map(allIngredients.map(ing => [String(ing?.id || '').trim(), ing]));

    const editor = window.RecipeEditor;
    const adder = (editor && typeof editor.addRow === 'function')
      ? (seed)=> editor.addRow(seed)
      : (typeof window.addRecipeRow === 'function' ? (seed)=> window.addRecipeRow(seed) : null);

    if(!adder) return 0;

    let inserted = 0;
    selectedIds.forEach((id)=>{
      const ing = byId.get(id);
      if(!ing) return;
      adder({
        ingredientId: String(ing.id || ''),
        ingredientName: String(ing.name || ''),
        categoryId: String(ing.categoryId || ''),
        unit: String(ing.defaultUnit || 'g'),
        qty: ''
      });
      inserted += 1;
    });

    try{
      if(editor && typeof editor.recalc === 'function') editor.recalc();
      if(editor && typeof editor.setStatus === 'function'){
        editor.setStatus(inserted > 0
          ? `${inserted} ingrédient${inserted > 1 ? 's' : ''} inséré${inserted > 1 ? 's' : ''} depuis la bibliothèque.`
          : '', 'ok');
      }
    }catch(_e){}

    return inserted;
  }

  function returnToRecipeModal(){
    if(!state.active) return;
    insertSelectedIngredientsIntoRecipe();
    showPage('recipes');
    state.active = false;
    state.selectedIngredientIds.clear();
    syncReturnButton();
    resumeRecipeModal();
  }


  function isIngredientSelected(id){
    const key = String(id || '').trim();
    return !!(key && state.selectedIngredientIds.has(key));
  }

  function setIngredientSelected(id, isSelected){
    const key = String(id || '').trim();
    if(!key) return false;
    if(isSelected) state.selectedIngredientIds.add(key);
    else state.selectedIngredientIds.delete(key);
    syncIngredientLibraryModeUI();
    return isIngredientSelected(key);
  }

  function toggleIngredientSelection(id){
    return setIngredientSelected(id, !isIngredientSelected(id));
  }
  function clearBridge(){
    state.active = false;
    state.selectedIngredientIds.clear();
    syncReturnButton();
  }

  document.addEventListener('click', (e)=>{
    const openBtn = e.target.closest('#btnRecipeLinesLibrary');
    if(openBtn){
      e.preventDefault();
      openIngredientLibraryFromRecipe();
      return;
    }
    const returnBtn = e.target.closest('#btnReturnToRecipeFromIngredients');
    if(returnBtn){
      e.preventDefault();
      returnToRecipeModal();
      return;
    }
    const openRecipeBtn = e.target.closest('#btnOpenCreateRecipe');
    if(openRecipeBtn){
      clearBridge();
    }
  });


  document.addEventListener('change', (e)=>{
    const input = e.target.closest('#pageIngredients .cardSelectInput');
    if(!input) return;
    if(!state.active){
      input.checked = false;
      return;
    }
    const card = input.closest('.card[data-id]');
    if(!card) return;
    setIngredientSelected(card.dataset.id, !!input.checked);
  });

  window.NutriRecipeLibraryBridge = {
    isActive(){ return !!state.active; },
    isIngredientSelected,
    setIngredientSelected,
    toggleIngredientSelection,
    openIngredientLibraryFromRecipe,
    returnToRecipeModal,
    clear: clearBridge,
    syncIngredientLibraryModeUI
  };

  syncReturnButton();
})();
