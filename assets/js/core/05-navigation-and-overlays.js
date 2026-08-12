/* NutriApp Pass 2 — single navigation registry and minimal overlay stack. */
(function(root, factory){
  const api = factory(root || {});
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root){
    root.NAV_REGISTRY = api.NAV_REGISTRY;
    root.NutriAppNavigationCore = api;
  }
  if(root && root.document) api.init(root.document, root);
})(typeof window !== 'undefined' ? window : globalThis, function(root){
  'use strict';

  const NAV_REGISTRY = Object.freeze({
    ingredients:Object.freeze({
      key:'ingredients', label:'Ingrédients', heroTitle:'Mes Ingrédients', pageId:'pageIngredients', hash:'#ingredients',
      createButtonId:'btnOpenCreate', filterButtonId:'btnOpenFilters', pillSelector:'#pageIngredients .pageHeadPill',
      filterLabel:'Ouvrir les filtres ingrédients', status:'active', secondary:false
    }),
    recipes:Object.freeze({
      key:'recipes', label:'Recettes', heroTitle:'Mes Recettes', pageId:'pageRecipes', hash:'#recipes',
      createButtonId:'btnOpenCreateRecipe', filterButtonId:'btnOpenFiltersRecipes', pillSelector:'#pageRecipes .pageHeadPill',
      filterLabel:'Ouvrir les filtres recettes', status:'active', secondary:false
    }),
    menus:Object.freeze({
      key:'menus', label:'Menus', heroTitle:'Mes Menus', pageId:'pageMenus', hash:'#menus',
      createButtonId:'btnOpenCreateMenu', filterButtonId:'btnOpenFiltersMenus', pillSelector:'#pageMenus .pageHeadPill',
      filterLabel:'Ouvrir les filtres menus', status:'active', secondary:false
    }),
    suivi:Object.freeze({
      key:'suivi', label:'Suivi', heroTitle:'Suivi', pageId:null, hash:'#suivi', createButtonId:null, filterButtonId:null,
      pillSelector:null, filterLabel:'Filtres indisponibles', status:'nonwired', secondary:false
    }),
    system:Object.freeze({
      key:'system', label:'Échanges', heroTitle:'Échanges', pageId:'pageSystem', hash:'#system',
      createButtonId:null, filterButtonId:null, pillSelector:null, filterLabel:'Filtres indisponibles', status:'active', secondary:false
    }),
    settings:Object.freeze({
      key:'settings', label:'Réglages', heroTitle:'Réglages', pageId:null, hash:'#settings', createButtonId:null, filterButtonId:null,
      pillSelector:null, filterLabel:'Filtres indisponibles', status:'nonwired', secondary:true
    }),
    help:Object.freeze({
      key:'help', label:'Aide', heroTitle:'Aide', pageId:null, hash:'#help', createButtonId:null, filterButtonId:null,
      pillSelector:null, filterLabel:'Filtres indisponibles', status:'nonwired', secondary:true
    })
  });

  const HASH_ALIASES = Object.freeze({ exchange:'system', exchanges:'system' });

  function normalizeHash(value){
    let raw = String(value == null ? '' : value).trim().replace(/^#/, '').toLowerCase();
    try{ raw = decodeURIComponent(raw); }catch(_){ }
    return HASH_ALIASES[raw] || raw;
  }

  function resolveNavKey(value, fallback){
    const key = normalizeHash(value);
    const entry = NAV_REGISTRY[key];
    if(entry && entry.status === 'active' && entry.pageId) return key;
    return fallback === undefined ? null : fallback;
  }

  function createOverlayStackModel(){
    const ids = [];
    return {
      open(id){
        const key = String(id || '');
        if(!key) return this.top();
        const index = ids.indexOf(key);
        if(index >= 0) ids.splice(index, 1);
        ids.push(key);
        return key;
      },
      close(id){
        const key = String(id || '');
        const index = ids.lastIndexOf(key);
        if(index >= 0) ids.splice(index, 1);
        return this.top();
      },
      closeTop(){
        return ids.length ? ids.pop() : null;
      },
      has(id){ return ids.includes(String(id || '')); },
      top(){ return ids.length ? ids[ids.length - 1] : null; },
      depth(){ return ids.length; },
      snapshot(){ return ids.slice(); }
    };
  }

  function initOverlayManager(doc, win){
    if(win.NutriOverlayManager && win.NutriOverlayManager.initialized) return win.NutriOverlayManager;
    const model = createOverlayStackModel();
    const configs = new Map();
    const returnFocus = new Map();
    const originalZ = new Map();
    const bodyOverflow = doc.body ? doc.body.style.overflow : '';
    let pendingTrigger = null;
    let lastExternalFocus = doc.activeElement || null;

    function connected(node){ return !!(node && node.isConnected !== false && typeof node.focus === 'function'); }
    function elementOf(config){ return config && typeof config.element === 'function' ? config.element() : (config && config.element); }
    function isVisible(config){
      const element = elementOf(config);
      if(!element) return false;
      return typeof config.visible === 'function' ? !!config.visible(element) : false;
    }
    function topConfig(){ return configs.get(model.top()) || null; }
    function isInsideVisibleOverlay(node){
      if(!node) return false;
      for(const config of configs.values()){
        const element = elementOf(config);
        if(isVisible(config) && element && element.contains && element.contains(node)) return true;
      }
      return false;
    }
    function syncScroll(){
      if(!doc.body) return;
      const locked = model.snapshot().some(id => {
        const config = configs.get(id);
        return config && config.lockScroll !== false && isVisible(config);
      });
      doc.body.style.overflow = locked ? 'hidden' : bodyOverflow;
      doc.body.dataset.overlayDepth = String(model.depth());
    }
    function syncStacking(){
      const stack = model.snapshot();
      configs.forEach((config, id) => {
        const element = elementOf(config);
        if(!element) return;
        const level = stack.indexOf(id);
        if(level >= 0){
          const desiredZ = String(20000 + ((level + 1) * 20));
          element.dataset.overlayLevel = String(level + 1);
          if(element.style.getPropertyValue('z-index') !== desiredZ || element.style.getPropertyPriority('z-index') !== 'important'){
            element.style.setProperty('z-index', desiredZ, 'important');
          }
        }else{
          delete element.dataset.overlayLevel;
          const original = originalZ.get(id);
          if(original && original.value){
            if(element.style.getPropertyValue('z-index') !== original.value || element.style.getPropertyPriority('z-index') !== (original.priority || '')){
              element.style.setProperty('z-index', original.value, original.priority || '');
            }
          }else if(element.style.getPropertyValue('z-index')) element.style.removeProperty('z-index');
        }
      });
    }
    function restoreWhenAllowed(target){
      if(!connected(target)) return;
      win.requestAnimationFrame(function(){
        const current = topConfig();
        const currentElement = elementOf(current);
        if(currentElement && currentElement.contains && !currentElement.contains(target)) return;
        try{ target.focus({preventScroll:true}); }catch(_){ try{ target.focus(); }catch(__){ } }
      });
    }
    function syncOne(config, closed){
      const visible = isVisible(config);
      const tracked = model.has(config.id);
      const element = elementOf(config);
      if(visible && !tracked){
        const active = doc.activeElement;
        const trigger = connected(pendingTrigger) && (!element || !element.contains(pendingTrigger))
          ? pendingTrigger
          : (connected(active) && (!element || !element.contains(active)) ? active : lastExternalFocus);
        if(!returnFocus.has(config.id)) returnFocus.set(config.id, trigger || null);
        model.open(config.id);
      }else if(!visible && tracked){
        const wasTop = model.top() === config.id;
        model.close(config.id);
        if(wasTop) closed.push(returnFocus.get(config.id));
        returnFocus.delete(config.id);
      }
      if(element && config.manageA11y !== false){
        const covered = element.dataset && element.dataset.exchangeCovered === '1';
        const hidden = !visible || covered;
        const ariaHidden = hidden ? 'true' : 'false';
        if(element.getAttribute('aria-hidden') !== ariaHidden) element.setAttribute('aria-hidden', ariaHidden);
        try{ if(element.inert !== hidden) element.inert = hidden; }catch(_){ }
      }
    }
    function syncAll(){
      const closed = [];
      configs.forEach(config => syncOne(config, closed));
      syncStacking();
      syncScroll();
      const target = closed.length ? closed[closed.length - 1] : null;
      if(target) restoreWhenAllowed(target);
      return model.snapshot();
    }
    function genericSetVisible(config, visible){
      const element = elementOf(config);
      if(!element) return false;
      if(typeof config.setVisible === 'function') config.setVisible(element, visible);
      else{
        element.classList.toggle('hidden', !visible);
        element.classList.toggle('show', visible && config.showClass === 'show');
        element.setAttribute('aria-hidden', visible ? 'false' : 'true');
      }
      syncAll();
      return true;
    }
    function requestClose(id){
      const config = configs.get(String(id || ''));
      if(!config || !isVisible(config)) return false;
      if(typeof config.close === 'function') config.close(elementOf(config));
      else if(config.closeButtonId){
        const button = doc.getElementById(config.closeButtonId);
        if(button && typeof button.click === 'function') button.click();
        else genericSetVisible(config, false);
      }else genericSetVisible(config, false);
      return true;
    }
    function register(config){
      if(!config || !config.id) return null;
      const id = String(config.id);
      configs.set(id, Object.assign({lockScroll:true, manageA11y:true}, config));
      const element = elementOf(config);
      if(element && !originalZ.has(id)) originalZ.set(id, {value:element.style.getPropertyValue('z-index'), priority:element.style.getPropertyPriority('z-index')});
      syncAll();
      return config;
    }
    function visibleByHiddenClass(element){ return !element.classList.contains('hidden') && element.getAttribute('aria-hidden') !== 'true'; }
    function visibleByShowClass(element){ return element.classList.contains('show'); }

    const definitions = [
      ['ingredientDetail','ingredientDetailOverlay',visibleByShowClass,'ingredientDetailClose'],
      ['recipeDetail','recipeDetailOverlay',visibleByShowClass,'recipeDetailClose'],
      ['menuDetail','menuDetailOverlay',visibleByShowClass,'menuDetailClose'],
      ['recipeScenario','viewRecipe',visibleByShowClass,'btnBackToList'],
      ['menuCreate','menuCreateOverlay',visibleByHiddenClass,'btnMenuCreateClose'],
      ['filters','filterOverlay',visibleByHiddenClass,'btnFilterClose'],
      ['ingredientCreate','createOverlay',visibleByHiddenClass,'btnCreateClose'],
      ['recipeCreate','recipeCreateOverlay',visibleByHiddenClass,'btnCreateRecipeClose'],
      ['backup','backupOverlay',visibleByHiddenClass,'btnBackupClose'],
      ['exchangeShare','exchangeShareOverlay',visibleByHiddenClass,'btnExchangeShareClose'],
      ['exchangeImport','exchangeImportOverlay',visibleByHiddenClass,'btnExchangeClose'],
      ['recipeConvert','recipeConvertOverlay',visibleByHiddenClass,'btnRecipeConvertCancel']
    ];
    definitions.forEach(([id, elementId, visible, closeButtonId]) => register({
      id,
      element:function(){ return doc.getElementById(elementId); },
      visible,
      closeButtonId,
      showClass:elementId.includes('Detail') ? 'show' : ''
    }));
    register({
      id:'print', element:function(){ return doc.getElementById('printOverlay'); },
      visible:function(element){ return element.style.display !== 'none'; }, closeButtonId:'btnPrintOverlayClose'
    });
    register({
      id:'drawer', element:function(){ return doc.querySelector('aside.drawer'); },
      visible:function(element){ return element.classList.contains('open'); },
      setVisible:function(element, visible){
        const shade = doc.getElementById('drawerOverlay');
        const trigger = doc.querySelector('.brand .logo');
        element.classList.toggle('open', visible);
        if(trigger) trigger.setAttribute('aria-expanded', visible ? 'true' : 'false');
        if(shade){
          shade.classList.toggle('hidden', !visible);
          shade.setAttribute('aria-hidden', visible ? 'false' : 'true');
        }
      },
      close:function(){
        const shade = doc.getElementById('drawerOverlay');
        if(shade && typeof shade.click === 'function') shade.click();
        else genericSetVisible(configs.get('drawer'), false);
      }
    });

    doc.addEventListener('pointerdown', function(event){ pendingTrigger = event.target; }, true);
    doc.addEventListener('click', function(event){
      pendingTrigger = event.target;
      win.setTimeout(function(){ if(pendingTrigger === event.target) pendingTrigger = null; }, 0);
    }, true);
    doc.addEventListener('focusin', function(event){
      if(!isInsideVisibleOverlay(event.target)) lastExternalFocus = event.target;
    }, true);

    function closeOnePopover(){
      const candidates = Array.from(doc.querySelectorAll('.uiInfoAnchor.open, .kebabMenu:not(.hidden), .notePop:not(.hidden), #kebabPopover:not(.hidden), .recipeColorPopover:not(.hidden)'))
        .filter(element => element.getAttribute('aria-hidden') !== 'true' && element.style.display !== 'none');
      const top = candidates[candidates.length - 1];
      if(!top) return false;
      if(top.classList.contains('uiInfoAnchor')){
        top.classList.remove('open');
        top.querySelector('.uiInfoDot')?.setAttribute('aria-expanded','false');
        return true;
      }
      top.classList.add('hidden');
      top.setAttribute('aria-hidden','true');
      return true;
    }
    doc.addEventListener('keydown', function(event){
      if(event.key === 'Tab'){
        syncAll();
        const config = topConfig();
        const element = elementOf(config);
        if(!element) return;
        const focusable = Array.from(element.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
          .filter(node => node.getAttribute('aria-hidden') !== 'true' && (node.offsetParent !== null || node === doc.activeElement));
        if(!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if(event.shiftKey && doc.activeElement === first){ event.preventDefault(); last.focus(); }
        else if(!event.shiftKey && doc.activeElement === last){ event.preventDefault(); first.focus(); }
        return;
      }
      if(event.key !== 'Escape') return;
      syncAll();
      if(closeOnePopover()){
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const top = model.top();
      if(top){
        event.preventDefault();
        event.stopImmediatePropagation();
        requestClose(top);
        return;
      }
    }, true);

    const observer = typeof MutationObserver === 'function' ? new MutationObserver(syncAll) : null;
    configs.forEach(config => {
      const element = elementOf(config);
      if(element && observer) observer.observe(element, {attributes:true, attributeFilter:['class','aria-hidden','style']});
    });
    syncAll();

    const manager = {
      initialized:true,
      register,
      sync:syncAll,
      open(id, opts){
        const config = configs.get(String(id || ''));
        if(!config) return false;
        if(opts && opts.trigger) returnFocus.set(config.id, opts.trigger);
        return genericSetVisible(config, true);
      },
      close:id => requestClose(id),
      closeTop(){ const id=model.top(); return id ? requestClose(id) : false; },
      getTop:() => model.top(),
      getState:() => ({stack:model.snapshot(), depth:model.depth(), scrollLocked:doc.body ? doc.body.style.overflow === 'hidden' : false})
    };
    win.NutriOverlayManager = manager;
    return manager;
  }

  function initNavigation(doc, win, overlayManager){
    if(win.NutriAppNav && win.NutriAppNav.initialized && win.NutriAppNav.registry) return win.NutriAppNav;
    const nav = doc.querySelector('nav.nav');
    const heroTitle = doc.getElementById('heroPageTitle') || doc.querySelector('.hero .title');
    const topMetaRail = doc.getElementById('topMetaRail');
    const topFilterButton = doc.getElementById('topFilterButton') || doc.querySelector('.topbar .iconbtn');
    const pillHomes = new Map();
    const pillRefs = new Map();
    let activeKey = 'ingredients';

    Object.values(NAV_REGISTRY).forEach(entry => {
      if(!entry.pillSelector) return;
      const pill = doc.querySelector(entry.pillSelector);
      if(pill && pill.parentElement){
        pillRefs.set(entry.key, pill);
        pillHomes.set(entry.key, pill.parentElement);
      }
    });

    function configureDrawer(){
      if(!nav) return;
      nav.querySelectorAll('a[data-nav-key], a[data-page], a[data-nav-placeholder]').forEach(link => {
        const key = String(link.dataset.navKey || link.dataset.page || link.dataset.navPlaceholder || '');
        const entry = NAV_REGISTRY[key];
        if(!entry) return;
        link.dataset.navKey = key;
        link.setAttribute('href', entry.hash);
        const label = link.querySelector('[data-nav-label]');
        if(label) label.textContent = entry.label;
        const wired = entry.status === 'active' && !!entry.pageId;
        link.classList.toggle('navLink--pending', !wired);
        if(wired){
          link.dataset.page = key;
          link.removeAttribute('aria-disabled');
        }else{
          delete link.dataset.page;
          link.setAttribute('aria-disabled','true');
          link.setAttribute('title', link.getAttribute('title') || 'Cette zone reste à cadrer.');
        }
      });
    }

    function syncPanels(key){
      Object.values(NAV_REGISTRY).forEach(entry => {
        if(!entry.pageId) return;
        const panel = doc.getElementById(entry.pageId);
        if(!panel) return;
        const active = entry.key === key;
        panel.classList.toggle('active', active);
        panel.setAttribute('aria-hidden', active ? 'false' : 'true');
        try{ panel.inert = !active; }catch(_){ }
      });
    }
    function syncDrawer(key){
      if(!nav) return;
      nav.querySelectorAll('a[data-nav-key]').forEach(link => {
        const active = link.dataset.navKey === key;
        link.classList.toggle('active', active);
        if(active) link.setAttribute('aria-current','page');
        else link.removeAttribute('aria-current');
      });
    }
    function syncFabs(key){
      const activeId = NAV_REGISTRY[key].createButtonId;
      const ids = new Set(Object.values(NAV_REGISTRY).map(entry => entry.createButtonId).filter(Boolean));
      ids.forEach(id => {
        const button = doc.getElementById(id);
        if(!button) return;
        const active = id === activeId;
        button.hidden = !active;
        button.style.display = active ? '' : 'none';
        button.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
    }
    function syncPill(key){
      if(!topMetaRail) return;
      pillRefs.forEach((pill, pillKey) => {
        const home = pillHomes.get(pillKey);
        if(!pill || !home) return;
        if(pillKey !== key && pill.parentElement !== home) home.appendChild(pill);
      });
      Array.from(topMetaRail.querySelectorAll ? topMetaRail.querySelectorAll('.pageHeadPill') : []).forEach(pill => {
        const activePill = pillRefs.get(key);
        if(pill !== activePill && pill.parentElement === topMetaRail) topMetaRail.removeChild(pill);
      });
      const entry = NAV_REGISTRY[key];
      if(entry && entry.pillSelector){
        const pill = pillRefs.get(key);
        const home = pillHomes.get(entry.key);
        if(pill && home) topMetaRail.appendChild(pill);
      }
      topMetaRail.classList.toggle('is-empty', !(entry && entry.pillSelector && pillRefs.get(key)));
    }
    function syncFilter(key){
      if(!topFilterButton) return;
      const entry = NAV_REGISTRY[key];
      const enabled = !!entry.filterButtonId;
      topFilterButton.classList.add('topFilterBtn');
      topFilterButton.classList.toggle('is-disabled', !enabled);
      topFilterButton.disabled = !enabled;
      topFilterButton.dataset.filterContext = enabled ? key : '';
      topFilterButton.setAttribute('aria-label', enabled ? entry.filterLabel : 'Filtres indisponibles');
      topFilterButton.setAttribute('title', enabled ? entry.filterLabel : '');
      if(!topFilterButton.querySelector('.topFilterGlyph')){
        topFilterButton.innerHTML = '<span class="topFilterGlyph" aria-hidden="true"><span></span><span></span><span></span></span>';
      }
    }
    function writeHistory(entry, mode){
      if(mode === 'none') return;
      const method = mode === 'replace' ? 'replaceState' : 'pushState';
      try{
        win.history[method]({nutriPage:entry.key}, '', entry.hash);
      }catch(_){
        try{ win.location.hash = entry.hash; }catch(__){ }
      }
    }
    function publish(entry, historyMode){
      const state = getActivePageState();
      try{ doc.body.dataset.activePage = entry.key; }catch(_){ }
      if(win.NutriAppState && typeof win.NutriAppState.publishNavigationState === 'function') win.NutriAppState.publishNavigationState(state);
      if(typeof win.CustomEvent === 'function'){
        try{ win.dispatchEvent(new win.CustomEvent('nutriapp:navigationchange', {detail:Object.assign({historyMode}, state)})); }catch(_){ }
      }
    }
    function showPage(key, options){
      const opts = options || {};
      const resolved = resolveNavKey(key, null);
      if(!resolved) return activeKey;
      const entry = NAV_REGISTRY[resolved];
      let historyMode = opts.history || 'replace';
      if(historyMode === 'push' && resolved === activeKey && normalizeHash(win.location.hash) === resolved) historyMode = 'none';
      activeKey = resolved;
      syncPanels(resolved);
      syncDrawer(resolved);
      syncFabs(resolved);
      syncPill(resolved);
      syncFilter(resolved);
      if(heroTitle) heroTitle.textContent = entry.heroTitle;
      doc.title = entry.heroTitle + ' · NutriApp';
      writeHistory(entry, historyMode);
      publish(entry, historyMode);
      return resolved;
    }
    function getActivePageState(){
      const entry = NAV_REGISTRY[activeKey] || NAV_REGISTRY.ingredients;
      return {
        key:entry.key, hash:entry.hash, pageId:entry.pageId, heroTitle:entry.heroTitle,
        createButtonId:entry.createButtonId, filterButtonId:entry.filterButtonId, pillSelector:entry.pillSelector
      };
    }
    function syncFromLocation(){
      const key = resolveNavKey(win.location.hash, 'ingredients');
      return showPage(key, {history:'none'});
    }

    configureDrawer();
    nav && nav.addEventListener('click', function(event){
      const link = event.target.closest('a[data-nav-key]');
      if(!link) return;
      const entry = NAV_REGISTRY[link.dataset.navKey];
      event.preventDefault();
      if(!entry || entry.status !== 'active' || !entry.pageId) return;
      showPage(entry.key, {history:'push'});
      overlayManager && overlayManager.close('drawer');
    });
    topFilterButton && topFilterButton.addEventListener('click', function(event){
      event.preventDefault();
      const entry = NAV_REGISTRY[activeKey];
      if(!entry.filterButtonId) return;
      const api = win.NutriAppFilterModal;
      if(api && typeof api.open === 'function') api.open(activeKey);
      else doc.getElementById(entry.filterButtonId)?.click?.();
    });
    const logo = doc.querySelector('.brand .logo');
    const drawerShade = doc.getElementById('drawerOverlay');
    logo && logo.addEventListener('click', function(event){
      event.preventDefault();
      const open = overlayManager && overlayManager.getState().stack.includes('drawer');
      if(overlayManager) open ? overlayManager.close('drawer') : overlayManager.open('drawer', {trigger:logo});
    });
    logo && logo.addEventListener('keydown', function(event){
      if(event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      logo.click();
    });
    drawerShade && drawerShade.addEventListener('click', function(){
      const drawer = doc.querySelector('aside.drawer');
      const trigger = doc.querySelector('.brand .logo');
      if(drawer) drawer.classList.remove('open');
      if(trigger) trigger.setAttribute('aria-expanded','false');
      drawerShade.classList.add('hidden');
      drawerShade.setAttribute('aria-hidden','true');
      overlayManager && overlayManager.sync();
    });
    win.addEventListener('popstate', syncFromLocation);
    win.addEventListener('hashchange', syncFromLocation);

    const api = {
      initialized:true,
      registry:NAV_REGISTRY,
      showPage,
      navigate(key, options){ return showPage(key, Object.assign({history:'push'}, options || {})); },
      getActivePage:() => activeKey,
      getActivePageState,
      resolveHash:value => resolveNavKey(value, null),
      syncFromLocation
    };
    win.NutriAppNav = api;
    const initial = resolveNavKey(win.location.hash, null);
    const canonicalInitial = initial && NAV_REGISTRY[initial].hash === String(win.location.hash || '').toLowerCase();
    showPage(initial || 'ingredients', {history:initial && canonicalInitial ? 'none' : 'replace'});
    return api;
  }

  function init(doc, win){
    const overlayManager = initOverlayManager(doc, win);
    const navigation = initNavigation(doc, win, overlayManager);
    return {overlayManager, navigation};
  }

  return Object.freeze({NAV_REGISTRY, normalizeHash, resolveNavKey, createOverlayStackModel, initOverlayManager, initNavigation, init});
});
