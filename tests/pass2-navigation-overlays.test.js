const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../assets/js/core/05-navigation-and-overlays.js');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');

test('NAV_REGISTRY est l’unique contrat des quatre pages actives', () => {
  const active = Object.values(core.NAV_REGISTRY).filter(entry => entry.status === 'active');
  assert.deepEqual(active.map(entry => entry.key), ['ingredients','recipes','menus','system']);
  assert.deepEqual(active.map(entry => entry.hash), ['#ingredients','#recipes','#menus','#system']);
  assert.equal(core.NAV_REGISTRY.system.label, 'Échanges');
  assert.equal(core.NAV_REGISTRY.system.createButtonId, null);
  assert.equal(core.NAV_REGISTRY.system.filterButtonId, null);
});

test('les liens non câblés restent déclarés mais ne deviennent pas routables', () => {
  ['suivi','settings','help'].forEach(key => {
    assert.equal(core.NAV_REGISTRY[key].status, 'nonwired');
    assert.equal(core.resolveNavKey('#' + key), null);
  });
  assert.equal(core.NAV_REGISTRY.settings.secondary, true);
  assert.equal(core.NAV_REGISTRY.help.secondary, true);
});

test('résolution de hash canonique et alias Échanges', () => {
  assert.equal(core.resolveNavKey('#ingredients'), 'ingredients');
  assert.equal(core.resolveNavKey('#RECIPES'), 'recipes');
  assert.equal(core.resolveNavKey('#exchange'), 'system');
  assert.equal(core.resolveNavKey('#inconnu', 'ingredients'), 'ingredients');
});

test('chaque entrée active référence des IDs DOM existants et uniques', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  const count = id => ids.filter(value => value === id).length;
  Object.values(core.NAV_REGISTRY).filter(entry => entry.status === 'active').forEach(entry => {
    assert.equal(count(entry.pageId), 1, entry.pageId);
    if(entry.createButtonId) assert.equal(count(entry.createButtonId), 1, entry.createButtonId);
    if(entry.filterButtonId) assert.equal(count(entry.filterButtonId), 1, entry.filterButtonId);
    if(entry.pillSelector) assert.match(entry.pillSelector, /^#[A-Za-z0-9_-]+\s+\.pageHeadPill$/);
  });
  assert.equal(count('topFilterButton'), 1);
});

function fakeElement(id){
  const classes = new Set();
  const attributes = new Map();
  const element = {
    id, dataset:{}, style:{display:''}, hidden:false, disabled:false, inert:false, parentElement:null, textContent:'',
    classList:{
      add:value => classes.add(value), remove:value => classes.delete(value), contains:value => classes.has(value),
      toggle(value, force){ const on = force === undefined ? !classes.has(value) : !!force; on ? classes.add(value) : classes.delete(value); return on; }
    },
    setAttribute:(name,value) => attributes.set(name,String(value)), getAttribute:name => attributes.get(name) ?? null,
    removeAttribute:name => attributes.delete(name),
    appendChild(child){ child.parentElement = element; element.lastChild = child; return child; },
    addEventListener(){}, querySelector(){ return null; }, querySelectorAll(){ return []; }
  };
  return element;
}

function navigationHarness(initialHash){
  const ids = {};
  const add = id => (ids[id] = fakeElement(id));
  ['pageIngredients','pageRecipes','pageMenus','pageSystem','btnOpenCreate','btnOpenCreateRecipe','btnOpenCreateMenu',
    'btnOpenFilters','btnOpenFiltersRecipes','btnOpenFiltersMenus','topFilterButton','topMetaRail','heroPageTitle'].forEach(add);
  const pillByKey = {};
  ['ingredients','recipes','menus'].forEach(key => {
    const pill = fakeElement(key + 'Pill');
    const home = fakeElement(key + 'Home');
    home.appendChild(pill);
    pillByKey[key] = pill;
  });
  const links = Object.keys(core.NAV_REGISTRY).map(key => {
    const link = fakeElement('link-' + key);
    link.dataset.navKey = key;
    const label = fakeElement('label-' + key);
    link.querySelector = selector => selector === '[data-nav-label]' ? label : null;
    return link;
  });
  const nav = fakeElement('nav');
  nav.querySelectorAll = () => links;
  const body = fakeElement('body');
  const document = {
    body, title:'NutriApp',
    getElementById:id => ids[id] || null,
    querySelector(selector){
      if(selector === 'nav.nav') return nav;
      if(selector === '.hero .title') return ids.heroPageTitle;
      const match = selector.match(/^#page(Ingredients|Recipes|Menus) \.pageHeadPill$/);
      if(match) return pillByKey[match[1].toLowerCase()];
      return null;
    }
  };
  const listeners = {};
  const calls = [];
  const window = {
    location:{hash:initialHash},
    history:{
      pushState(_state,_title,hash){ calls.push(['push',hash]); window.location.hash = hash; },
      replaceState(_state,_title,hash){ calls.push(['replace',hash]); window.location.hash = hash; }
    },
    addEventListener:(type,callback) => { listeners[type] = callback; },
    dispatchEvent(){}, CustomEvent:function(type,options){ this.type=type; this.detail=options.detail; }
  };
  const overlay = {close(){}, open(){}, getState(){ return {stack:[]}; }};
  return {document,window,ids,pillByKey,links,calls,listeners,overlay};
}

test('navigation DOM pilote ensemble panel, hero, FAB, filtre, pastille et retour', () => {
  const harness = navigationHarness('#recipes');
  const api = core.initNavigation(harness.document, harness.window, harness.overlay);
  assert.equal(api.getActivePage(), 'recipes');
  assert.equal(harness.ids.pageRecipes.classList.contains('active'), true);
  assert.equal(harness.ids.pageIngredients.classList.contains('active'), false);
  assert.equal(harness.ids.heroPageTitle.textContent, 'Mes Recettes');
  assert.equal(harness.ids.btnOpenCreateRecipe.hidden, false);
  assert.equal(harness.ids.btnOpenCreate.hidden, true);
  assert.equal(harness.ids.topFilterButton.dataset.filterContext, 'recipes');
  assert.equal(harness.ids.topMetaRail.lastChild, harness.pillByKey.recipes);

  api.navigate('menus');
  assert.deepEqual(harness.calls.at(-1), ['push','#menus']);
  assert.equal(api.getActivePage(), 'menus');
  assert.equal(harness.ids.btnOpenCreateMenu.hidden, false);

  harness.window.location.hash = '#system';
  harness.listeners.popstate();
  assert.equal(api.getActivePage(), 'system');
  assert.equal(harness.ids.heroPageTitle.textContent, 'Échanges');
  assert.equal(harness.ids.topFilterButton.disabled, true);
  assert.equal(harness.ids.topMetaRail.classList.contains('is-empty'), true);
});

test('drawer et registre contiennent exactement les mêmes clés visibles', () => {
  const drawerKeys = [...html.matchAll(/<a\b[^>]*data-nav-key="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(drawerKeys, Object.keys(core.NAV_REGISTRY));
});

test('la pile ferme strictement un niveau à la fois', () => {
  const stack = core.createOverlayStackModel();
  stack.open('recipeDetail');
  stack.open('exchangeShare');
  assert.deepEqual(stack.snapshot(), ['recipeDetail','exchangeShare']);
  assert.equal(stack.closeTop(), 'exchangeShare');
  assert.deepEqual(stack.snapshot(), ['recipeDetail']);
  assert.equal(stack.top(), 'recipeDetail');
  assert.equal(stack.closeTop(), 'recipeDetail');
  assert.equal(stack.depth(), 0);
});

test('réouvrir un overlay le replace au sommet sans duplication', () => {
  const stack = core.createOverlayStackModel();
  stack.open('filters');
  stack.open('ingredientCreate');
  stack.open('filters');
  assert.deepEqual(stack.snapshot(), ['ingredientCreate','filters']);
});

test('le runtime central gère historique, retour, focus, scroll et interception Échap', () => {
  const source = read('assets/js/core/05-navigation-and-overlays.js');
  assert.match(source, /pushState/);
  assert.match(source, /replaceState/);
  assert.match(source, /addEventListener\('popstate'/);
  assert.match(source, /addEventListener\('hashchange'/);
  assert.match(source, /stopImmediatePropagation\(\)/);
  assert.match(source, /preventScroll:true/);
  assert.match(source, /body\.style\.overflow = locked \? 'hidden'/);
  assert.match(source, /dataset\.overlayLevel/);
});

test('le nouveau runtime est chargé avant les modules fonctionnels', () => {
  const runtime = html.indexOf('assets/js/core/05-navigation-and-overlays.js');
  assert.ok(runtime > 0);
  assert.ok(runtime < html.indexOf('assets/js/ui/app/02-filters-modal-tabs.js'));
  assert.ok(runtime < html.indexOf('assets/js/ui/menus/02-menus-studio.js'));
  assert.ok(runtime < html.indexOf('assets/js/features/shared/02-card-exchange.js'));
});

test('les anciennes tables parallèles de navigation ont été retirées', () => {
  const legacy = read('assets/js/features/ingredients/04-page-interactions-detail-thumb.js');
  assert.doesNotMatch(legacy, /const panelTitles\s*=/);
  assert.doesNotMatch(legacy, /const pageHeadPills\s*=/);
  assert.doesNotMatch(legacy, /const filterButtons\s*=/);
});
