const test = require('node:test');
const assert = require('node:assert/strict');
const state = require('../assets/js/core/04-data-contracts-and-state.js');

function jsonRoundTrip(value){ return JSON.parse(JSON.stringify(value)); }

const ingredientFixture = {
  id:'ing_lait', name:'Lait', categoryId:'liquides_boissons', categoryLabel:'Liquides & boissons',
  profile:'liquid', allowedUnits:['g','ml','tbsp'], defaultUnit:'ml',
  conversions:{ pieceWeightG:0, mlWeightG:1.03, tbspWeightG:15.45, tspWeightG:5.15 },
  kcal:46, p:3.2, carbs:4.8, fat:1.6, thumb:'data:image/png;base64,AA==', note:'Étiquette',
  sourceId:'external-ing', createdAt:'2026-01-01T00:00:00.000Z', updatedAt:'2026-01-02T00:00:00.000Z'
};

const recipeFixture = {
  id:'rec_porridge', name:'Porridge', categoryId:'petit_dejeuner', tags:'chaud, rapide', parts:2,
  cookedWeight:420, prepTime:'12 min', prep:'Mélanger puis cuire.', thumbDataUrl:'data:image/png;base64,BB==',
  sourceId:'external-rec', createdAt:'2026-01-03T00:00:00.000Z', updatedAt:'2026-01-04T00:00:00.000Z',
  rows:[{
    categoryId:'liquides_boissons', ingredientId:'ing_lait', sourceIngredientId:'external-ing', ingredientName:'Lait',
    qty:200, unit:'ml', gramsResolved:206, macrosResolved:{kcal:94.76,p:6.59,c:9.89,f:3.3}
  }]
};

const menuFixture = {
  id:'menu_jour', title:'Journée simple', category:'Quotidien', tags:'simple, batch', objective:'Organisation', prep:'Préparer la veille',
  origin:'saved', sourceId:'external-menu', createdAt:'2026-01-05T00:00:00.000Z', updatedAt:'2026-01-06T00:00:00.000Z',
  lines:[
    {id:'line_rec',lane:'breakfast',kind:'recipe',sourceId:'rec_porridge',sourceOriginalId:'external-rec',name:'Porridge',meta:'Recette liée'},
    {id:'line_ing',lane:'snack',kind:'ingredient',sourceId:'ing_lait',sourceOriginalId:'external-ing',name:'Lait',meta:'Ingrédient lié'}
  ]
};

test('contrats exposés et unités canoniques figées', () => {
  assert.deepEqual(state.CONTRACTS.ingredient.units, ['g','piece','ml','tbsp','tsp']);
  assert.ok(state.CONTRACTS.recipe.fields.includes('cookedWeight'));
  assert.ok(state.CONTRACTS.recipe.fields.includes('thumbDataUrl'));
  assert.ok(state.CONTRACTS.menu.fields.includes('sourceId'));
});

test('round-trip ingrédient conserve ml, conversion et provenance', () => {
  const first = state.normalizeIngredient(ingredientFixture);
  const second = state.normalizeIngredient(jsonRoundTrip(first));
  assert.deepEqual(second, first);
  assert.equal(second.defaultUnit, 'ml');
  assert.equal(second.conversions.mlWeightG, 1.03);
  assert.equal(second.sourceId, 'external-ing');
});

test('ml est refusé pour un solide ou sans facteur de conversion', () => {
  const solid = state.normalizeIngredient({...ingredientFixture, profile:'solid'});
  const noFactor = state.normalizeIngredient({...ingredientFixture, conversions:{...ingredientFixture.conversions, mlWeightG:0}});
  assert.equal(solid.allowedUnits.includes('ml'), false);
  assert.equal(noFactor.allowedUnits.includes('ml'), false);
  assert.equal(noFactor.defaultUnit, 'g');
});

test('round-trip recette conserve les champs auparavant perdus', () => {
  const first = state.normalizeRecipe(recipeFixture);
  const second = state.normalizeRecipe(jsonRoundTrip(first));
  assert.deepEqual(second, first);
  assert.equal(second.tags, 'chaud, rapide');
  assert.equal(second.cookedWeight, 420);
  assert.equal(second.prepTime, '12 min');
  assert.equal(second.thumbDataUrl, recipeFixture.thumbDataUrl);
  assert.equal(second.rows[0].sourceIngredientId, 'external-ing');
});

test('round-trip menu conserve lignes, provenance et métadonnées', () => {
  const first = state.normalizeMenu(menuFixture);
  const second = state.normalizeMenu(jsonRoundTrip(first));
  assert.deepEqual(second, first);
  assert.equal(second.sourceId, 'external-menu');
  assert.equal(second.lines[0].sourceOriginalId, 'external-rec');
});

test('sélecteur de statut Menu distingue brouillon, incomplet, source absente et complet', () => {
  const sources = {recipes:[{id:'rec_porridge'}], ingredients:[{id:'ing_lait'}]};
  assert.equal(state.getMenuStatus({lines:[]}, sources), 'draft');
  assert.equal(state.getMenuStatus({lines:[{lane:'lunch',kind:'note',sourceId:''}]}, sources), 'incomplete');
  assert.equal(state.getMenuStatus({lines:[{lane:'lunch',kind:'recipe',sourceId:'rec_absente'}]}, sources), 'missing');
  assert.equal(state.getMenuStatus(menuFixture, sources), 'complete');
});

test('sélecteurs bibliothèque distinguent vide stockage et vide filtré', () => {
  const noStorage = state.getLibraryState('ingredients', [], [], state.getFilterState('ingredients', {}));
  const noResult = state.getLibraryState('ingredients', [ingredientFixture], [], state.getFilterState('ingredients', {q:'absent'}));
  assert.equal(noStorage.emptyKind, 'storage');
  assert.equal(noResult.emptyKind, 'filtered');
  assert.equal(noResult.totalCount, 1);
  assert.equal(noResult.visibleCount, 0);
  assert.equal(noResult.filter.active, true);
});

test('backup.v3 complet valide et conserve les contrats au round-trip', () => {
  const backup = {meta:{app:'NutriApp',schema:'backup.v3'},ingredients:[ingredientFixture],recipes:[recipeFixture],menus:[menuFixture]};
  const report = state.validateBackupPayload(jsonRoundTrip(backup));
  assert.equal(report.ok, true, report.errors.join(' · '));
  assert.equal(report.normalized.recipes[0].cookedWeight, 420);
  assert.equal(report.normalized.ingredients[0].defaultUnit, 'ml');
  assert.equal(report.normalized.menus[0].lines.length, 2);
});

test('round-trip stockage écrit puis relit les trois bibliothèques', () => {
  const values = new Map();
  const storage = {
    get:key => values.has(key) ? values.get(key) : null,
    set:(key, value) => { values.set(key, value); return true; },
    remove:key => { values.delete(key); return true; }
  };
  const snapshot = state.getStorageSnapshot({ingredients:[ingredientFixture],recipes:[recipeFixture],menus:[menuFixture]});
  const result = state.commitStorageTransaction(storage, [['ingredients',snapshot.ingredients],['recipes',snapshot.recipes],['menus',snapshot.menus]]);
  assert.equal(result.ok, true);
  const restored = state.getStorageSnapshot({
    ingredients:JSON.parse(storage.get('ingredients')),
    recipes:JSON.parse(storage.get('recipes')),
    menus:JSON.parse(storage.get('menus'))
  });
  assert.deepEqual(restored, snapshot);
});

test('transaction stockage restaure les trois valeurs si une écriture échoue', () => {
  const values = new Map([['ingredients','["avant-ing"]'],['recipes','["avant-rec"]'],['menus','["avant-menu"]']]);
  let failOnce = true;
  const storage = {
    get:key => values.has(key) ? values.get(key) : null,
    set:(key, value) => {
      if(key === 'recipes' && failOnce){ failOnce = false; return false; }
      values.set(key, value);
      return true;
    },
    remove:key => { values.delete(key); return true; }
  };
  const result = state.commitStorageTransaction(storage, [['ingredients',[]],['recipes',[]],['menus',[]]]);
  assert.equal(result.ok, false);
  assert.equal(values.get('ingredients'), '["avant-ing"]');
  assert.equal(values.get('recipes'), '["avant-rec"]');
  assert.equal(values.get('menus'), '["avant-menu"]');
});

test('backup global incomplet est bloqué avant remplacement', () => {
  const report = state.validateBackupPayload({meta:{schema:'backup.v3'},ingredients:[]});
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.includes('recipes')));
  assert.ok(report.errors.some(error => error.includes('menus')));
});

test('backup et exchange refusent les cartes structurellement incomplètes', () => {
  const backup = state.validateBackupPayload({meta:{schema:'backup.v3'},ingredients:[{id:'ing_x'}],recipes:[],menus:[]});
  assert.equal(backup.ok, false);
  assert.ok(backup.errors.some(error => error.includes('sans nom')));
  const exchange = state.validateExchangePack({meta:{schema:'exchange.v1'},payload:{ingredients:[],recipes:[{id:'rec_x',name:'Sans lignes'}],menus:[]}});
  assert.equal(exchange.ok, false);
  assert.ok(exchange.errors.some(error => error.includes('.rows')));
});

test('exchange.v1 valide les IDs et signale les dépendances absentes', () => {
  const valid = state.validateExchangePack({meta:{schema:'exchange.v1'},payload:{ingredients:[ingredientFixture],recipes:[recipeFixture],menus:[menuFixture]}});
  assert.equal(valid.ok, true, valid.errors.join(' · '));
  assert.equal(valid.warnings.length, 0);
  const missing = state.validateExchangePack({meta:{schema:'exchange.v1'},payload:{ingredients:[],recipes:[recipeFixture],menus:[]}});
  assert.equal(missing.ok, true);
  assert.ok(missing.warnings.some(warning => warning.includes('ingrédient')));
  const duplicate = state.validateExchangePack({meta:{schema:'exchange.v1'},payload:{ingredients:[ingredientFixture,ingredientFixture],recipes:[],menus:[]}});
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.errors.some(error => error.includes('double')));
});
