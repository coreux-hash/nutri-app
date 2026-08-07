(function(){
  const overlay = document.getElementById('filterOverlay');
  const modal = document.getElementById('filterModal');
  if(!overlay || !modal) return;

  const btnOpenIng = document.getElementById('btnOpenFilters');
  const btnOpenRec = document.getElementById('btnOpenFiltersRecipes');
  const btnOpenMen = document.getElementById('btnOpenFiltersMenus');
  const btnClose = document.getElementById('btnFilterClose');
  const btnBack  = document.getElementById('btnFilterBack');
  const btnReset = document.getElementById('btnFilterReset');
  const btnApply = document.getElementById('btnFilterApply');
  const titleEl  = document.getElementById('filterTitle') || modal.querySelector('.title');
  const catWrap  = document.getElementById('fltCatWrap');
  const tagsWrap = document.getElementById('fltTagsWrap');
  const scopeEl  = document.getElementById('fltScope');
  const panes    = Array.from(modal.querySelectorAll('[data-pane]'));

  const CONFIG = {
    ingredients: {
      title: 'Filtres ingrédients',
      scope: '(pour 100 g)',
      showCategory: true,
      showTags: false,
      applyLabel: 'Afficher les résultats 🔎'
    },
    recipes: {
      title: 'Filtres recettes',
      scope: '(par portion / recette)',
      showCategory: false,
      showTags: false,
      applyLabel: 'Afficher les recettes 🔎'
    },
    menus: {
      title: 'Filtres menus',
      scope: '(par menu)',
      showCategory: false,
      showTags: false,
      applyLabel: 'Afficher les menus 🔎'
    }
  };

  function getContext(name){
    return CONFIG[name] ? name : 'ingredients';
  }

  function syncRecipeFilterOptions(){
    try{
      const app = window.NutriApp || {};
      if(app.ui && app.ui.recipeList && typeof app.ui.recipeList.refreshFilter === 'function'){
        app.ui.recipeList.refreshFilter();
        return;
      }
      if(window.NutriRecipes && window.NutriRecipes.ui && window.NutriRecipes.ui.recipeList && typeof window.NutriRecipes.ui.recipeList.refreshFilter === 'function'){
        window.NutriRecipes.ui.recipeList.refreshFilter();
      }
    }catch(_e){}
  }

  function setContext(name){
    const ctx = getContext(name);
    const cfg = CONFIG[ctx];
    modal.dataset.filterContext = ctx;
    modal.classList.remove('mode-ingredients', 'mode-recipes', 'mode-menus');
    modal.classList.add('mode-' + ctx);

    panes.forEach(pane => pane.classList.toggle('hidden', pane.dataset.pane !== ctx));
    if(titleEl) titleEl.textContent = cfg.title;
    if(scopeEl) scopeEl.textContent = cfg.scope;
    if(catWrap) catWrap.classList.toggle('hidden', !cfg.showCategory);
    if(tagsWrap) tagsWrap.classList.toggle('hidden', !cfg.showTags);
    if(btnApply) btnApply.textContent = cfg.applyLabel;

    if(ctx === 'recipes') syncRecipeFilterOptions();
    return ctx;
  }

  function firstFocusableInActivePane(){
    const ctx = getContext(modal.dataset.filterContext);
    const pane = panes.find(p => p.dataset.pane === ctx);
    return pane && pane.querySelector('input,select,button,textarea');
  }

  function open(name){
    const ctx = setContext(name);
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    try{ overlay.inert = false; }catch(_e){}
    const focusEl = firstFocusableInActivePane();
    try{ focusEl && focusEl.focus && focusEl.focus(); }catch(_e){}
    return ctx;
  }

  function close(){
    try{
      const ae = document.activeElement;
      if(ae && overlay.contains(ae) && typeof ae.blur === 'function') ae.blur();
    }catch(_e){}
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    try{ overlay.inert = true; }catch(_e){}
  }

  btnOpenIng && btnOpenIng.addEventListener('click', ()=> open('ingredients'));
  btnOpenRec && btnOpenRec.addEventListener('click', ()=> open('recipes'));
  btnOpenMen && btnOpenMen.addEventListener('click', ()=> open('menus'));
  btnClose && btnClose.addEventListener('click', close);
  btnBack && btnBack.addEventListener('click', close);
  overlay.addEventListener('click', (e)=>{ if(e.target === overlay) close(); });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
  });

  btnReset && btnReset.addEventListener('click', ()=>{
    const active = getContext(modal.dataset.filterContext);
    if(active === 'ingredients'){
      ['fltQuery','fltTags','fltUsageStars','fltKcalMin','fltKcalMax','fltPMin','fltPMax','fltGMin','fltGMax','fltLMin','fltLMax']
        .forEach(id=>{ const node = document.getElementById(id); if(node) node.value = ''; });
      const sel = document.getElementById('fltCategory');
      if(sel) sel.value = '';
    } else if(active === 'recipes'){
      const q = document.getElementById('recipeSearch'); if(q) q.value = '';
      const cat = document.getElementById('recipeFilter'); if(cat) cat.value = 'all';
      const sort = document.getElementById('recipeSort'); if(sort) sort.value = 'name';
    }
  });

  setContext(modal.dataset.filterContext || 'ingredients');

  window.NutriAppFilterModal = Object.assign({}, window.NutriAppFilterModal || {}, {
    overlay,
    modal,
    open,
    close,
    setContext,
    getCurrentContext(){ return getContext(modal.dataset.filterContext); }
  });
})();
