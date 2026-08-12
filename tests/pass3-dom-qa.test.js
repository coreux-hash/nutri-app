'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const navigationCore = require('../assets/js/core/05-navigation-and-overlays.js');
const {MiniElement, createEvent, createBrowserHarness} = require('./helpers/browser-harness.js');

const root = path.resolve(__dirname, '..');
const read = filename => fs.readFileSync(path.join(root, filename), 'utf8');
const hash = filename => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, filename))).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));

function createNavigationDom(initialHash){
  const harness = createBrowserHarness({location:{hash:initialHash,protocol:'file:'}});
  const {document} = harness;
  const ids = {};
  const add = (id, tag) => (ids[id] = document.createElementWithId(id, tag));
  [
    'pageIngredients','pageRecipes','pageMenus','pageSystem',
    'btnOpenCreate','btnOpenCreateRecipe','btnOpenCreateMenu',
    'btnOpenFilters','btnOpenFiltersRecipes','btnOpenFiltersMenus',
    'topFilterButton','topMetaRail','heroPageTitle'
  ].forEach(id => add(id, id.startsWith('btn') ? 'button' : 'div'));
  const pills = {};
  ['ingredients','recipes','menus'].forEach(key => {
    const pill = new MiniElement('span', document, key + 'Pill');
    pill.classList.add('pageHeadPill');
    const home = new MiniElement('div', document, key + 'PillHome');
    home.appendChild(pill);
    pills[key] = pill;
    document.mapSelector(navigationCore.NAV_REGISTRY[key].pillSelector, pill);
  });
  ids.topMetaRail.querySelectorAll = selector => selector === '.pageHeadPill'
    ? ids.topMetaRail.children.filter(child => child.classList.contains('pageHeadPill'))
    : [];
  const links = Object.keys(navigationCore.NAV_REGISTRY).map(key => {
    const link = new MiniElement('a', document, 'nav-' + key);
    const label = new MiniElement('span', document, 'label-' + key);
    link.dataset.navKey = key;
    link.querySelector = selector => selector === '[data-nav-label]' ? label : null;
    return link;
  });
  const nav = new MiniElement('nav', document, 'drawerNav');
  nav.querySelectorAll = selector => selector.includes('a[') ? links : [];
  document.mapSelector('nav.nav', nav);
  document.mapSelector('.hero .title', ids.heroPageTitle);
  return {harness,ids,pills,links};
}

test('harness navigateur charge le runtime classique et applique la navigation initiale', () => {
  const fixture = createNavigationDom('#recipes');
  fixture.harness.loadClassicScript(path.join(root, 'assets/js/core/05-navigation-and-overlays.js'));
  const api = fixture.harness.window.NutriAppNav;
  assert.equal(api.getActivePage(), 'recipes');
  assert.equal(fixture.ids.pageRecipes.classList.contains('active'), true);
  assert.equal(fixture.ids.pageIngredients.inert, true);
  assert.equal(fixture.ids.heroPageTitle.textContent, 'Mes Recettes');
  assert.equal(fixture.ids.btnOpenCreateRecipe.hidden, false);
  assert.equal(fixture.ids.btnOpenCreate.hidden, true);
  assert.equal(fixture.ids.topFilterButton.dataset.filterContext, 'recipes');
  assert.equal(fixture.ids.topMetaRail.lastChild, fixture.pills.recipes);
  assert.deepEqual(fixture.ids.topMetaRail.children, [fixture.pills.recipes]);

  api.navigate('menus');
  assert.deepEqual(fixture.harness.historyCalls.at(-1), ['push','#menus']);
  assert.equal(api.getActivePage(), 'menus');
  assert.deepEqual(fixture.ids.topMetaRail.children, [fixture.pills.menus]);
  assert.equal(fixture.pills.recipes.parentElement.id, 'recipesPillHome');

  fixture.harness.window.location.hash = '#system';
  fixture.harness.window.dispatchEvent(createEvent('popstate'));
  assert.equal(api.getActivePage(), 'system');
  assert.equal(fixture.ids.heroPageTitle.textContent, 'Échanges');
  assert.equal(fixture.ids.topFilterButton.disabled, true);
  assert.equal(fixture.ids.topMetaRail.classList.contains('is-empty'), true);
  assert.deepEqual(fixture.ids.topMetaRail.children, []);
});

test('harness navigateur vérifie pile, z-index, scroll, focus et Échap niveau par niveau', () => {
  const harness = createBrowserHarness({location:{hash:'#ingredients',protocol:'file:'}});
  const {document} = harness;
  document.body.style.overflow = 'auto';
  const trigger = document.createElementWithId('outsideTrigger','button');
  const detail = document.createElementWithId('recipeDetailOverlay');
  const detailClose = document.createElementWithId('recipeDetailClose','button');
  const share = document.createElementWithId('exchangeShareOverlay');
  const shareClose = document.createElementWithId('btnExchangeShareClose','button');
  const shareTrigger = new MiniElement('button', document, 'shareTrigger');
  detail.appendChild(shareTrigger);
  share.classList.add('hidden');
  share.setAttribute('aria-hidden','true');
  detailClose.addEventListener('click', () => detail.classList.remove('show'));
  shareClose.addEventListener('click', () => share.classList.add('hidden'));

  harness.loadClassicScript(path.join(root, 'assets/js/core/05-navigation-and-overlays.js'));
  const manager = harness.window.NutriOverlayManager;

  trigger.focus();
  document.dispatchEvent(createEvent('pointerdown',{target:trigger}));
  detail.classList.add('show');
  manager.sync();
  assert.deepEqual(plain(manager.getState().stack), ['recipeDetail']);
  assert.equal(document.body.style.overflow, 'hidden');

  shareTrigger.focus();
  document.dispatchEvent(createEvent('pointerdown',{target:shareTrigger}));
  detail.dataset.exchangeCovered = '1';
  share.classList.remove('hidden');
  share.setAttribute('aria-hidden','false');
  manager.sync();
  assert.deepEqual(plain(manager.getState().stack), ['recipeDetail','exchangeShare']);
  assert.equal(detail.inert, true);
  assert.equal(share.inert, false);
  assert.ok(Number(share.style.getPropertyValue('z-index')) > Number(detail.style.getPropertyValue('z-index')));

  document.dispatchEvent(createEvent('keydown',{key:'Escape'}));
  manager.sync();
  assert.equal(share.classList.contains('hidden'), true);
  assert.equal(detail.classList.contains('show'), true);
  assert.deepEqual(plain(manager.getState().stack), ['recipeDetail']);
  assert.equal(document.activeElement, shareTrigger);
  assert.equal(document.body.style.overflow, 'hidden');

  delete detail.dataset.exchangeCovered;
  document.dispatchEvent(createEvent('keydown',{key:'Escape'}));
  manager.sync();
  assert.equal(detail.classList.contains('show'), false);
  assert.deepEqual(plain(manager.getState().stack), []);
  assert.equal(document.activeElement, trigger);
  assert.equal(document.body.style.overflow, 'auto');
});

test('audit étendu : IDs critiques uniques pour bibliothèques, navigation et overlays', () => {
  const html = read('index.html');
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  const duplicates = [...new Set(ids.filter((id,index) => ids.indexOf(id) !== index))];
  assert.deepEqual(duplicates, []);
  const critical = [
    'pageIngredients','pageRecipes','pageMenus','pageSystem','heroPageTitle','topMetaRail','topFilterButton','drawerOverlay',
    'btnOpenCreate','btnOpenCreateRecipe','btnOpenCreateMenu','btnOpenFilters','btnOpenFiltersRecipes','btnOpenFiltersMenus',
    'ingGrid','ingEmpty','ingCount','recipeList','recipeEmpty','recipeCount','menusLibraryGrid','menusStorageEmpty','menusSearchEmpty','menuCount',
    'ingredientDetailOverlay','recipeDetailOverlay','menuDetailOverlay','viewRecipe','filterOverlay','createOverlay','recipeCreateOverlay','menuCreateOverlay',
    'exchangeShareOverlay','exchangeImportOverlay','backupOverlay','exchangeJsonBox','ingJsonBox','btnExchangeValidate','btnExchangeImport',
    'btnExchangeShareClose','btnExchangeClose','btnBackupClose','recipeConvertOverlay','printOverlay'
  ];
  critical.forEach(id => assert.equal(ids.filter(value => value === id).length, 1, id));
});

test('empreintes protégées et chargement des scripts restent verrouillés', () => {
  assert.equal(hash('manifest.webmanifest'), 'f415077b0d426cdb16f2e9df7b185f23f08fba20622fd11fa58649afe27254a9');
  assert.equal(hash('sw.js'), '668133b6f92f092993a268d7700e7985296536b55ed67b8840f2d1b857b36a6b');
  const html = read('index.html');
  const contract = html.indexOf('assets/js/core/04-data-contracts-and-state.js');
  const navigation = html.indexOf('assets/js/core/05-navigation-and-overlays.js');
  const exchange = html.indexOf('assets/js/features/shared/02-card-exchange.js');
  assert.ok(contract > 0 && navigation > contract && exchange > navigation);
});

test('la checklist QA contient les six viewports et tous les parcours prioritaires', () => {
  const checklist = read('qa/PASSE_3_QA_RESPONSIVE.md');
  ['360 × 740','390 × 844','430 × 932','768 × 1024','1280 × 800','1440 × 900'].forEach(viewport => assert.match(checklist, new RegExp(viewport.replace('×','×'))));
  [
    'Drawer ouvert','Bibliothèque Ingrédients','Filtres Ingrédients','Fiche Ingrédient','Partage Ingrédient',
    'Bibliothèque Recettes','Fiche Recette','Partage Recette','Bibliothèque Menus','Fiche Menu','Studio Menu','Partage Menu',
    'Page Échanges','Import paquet','Sauvegarde technique','État stockage vide','État filtré vide','Menu brouillon','Menu incomplet','Source absente'
  ].forEach(label => assert.ok(checklist.includes(label), label));
});
