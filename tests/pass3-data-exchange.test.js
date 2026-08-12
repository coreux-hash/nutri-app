'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const state = require('../assets/js/core/04-data-contracts-and-state.js');
const {createBrowserHarness} = require('./helpers/browser-harness.js');

const root = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));

const ingredient = {
  id:'ing_lait', name:'Lait entier', categoryId:'liquides_boissons', categoryLabel:'Liquides & boissons',
  profile:'liquid', allowedUnits:['g','ml','tbsp','tsp'], defaultUnit:'ml',
  conversions:{pieceWeightG:0,mlWeightG:1.03,tbspWeightG:15.45,tspWeightG:5.15},
  kcal:46, p:3.2, carbs:4.8, fat:1.6, thumb:'data:image/png;base64,ING', note:'Étiquette complète',
  sourceId:'source_ing', createdAt:'2026-01-01T08:00:00.000Z', updatedAt:'2026-01-02T09:00:00.000Z'
};

const recipe = {
  id:'rec_porridge', name:'Porridge lait', categoryId:'petit_dejeuner', tags:'chaud, rapide', parts:2,
  cookedWeight:420, prepTime:'12 min', prep:'Mélanger puis cuire.', thumbDataUrl:'data:image/png;base64,REC',
  rows:[{
    categoryId:'liquides_boissons', ingredientId:'ing_lait', ingredientName:'Lait entier', qty:200, unit:'ml',
    gramsResolved:206, macrosResolved:{kcal:94.76,p:6.59,c:9.89,f:3.3}, sourceIngredientId:'source_ing',
    createdAt:'2026-01-01T08:05:00.000Z', updatedAt:'2026-01-02T09:05:00.000Z'
  }],
  sourceId:'source_rec', createdAt:'2026-01-03T08:00:00.000Z', updatedAt:'2026-01-04T09:00:00.000Z'
};

const menu = {
  id:'menu_jour', title:'Journée porridge', name:'Journée porridge', category:'Quotidien', tags:'simple, batch',
  objective:'Préparer une journée simple', prep:'Préparer la veille', origin:'saved', sourceId:'source_menu',
  createdAt:'2026-01-05T08:00:00.000Z', updatedAt:'2026-01-06T09:00:00.000Z',
  lines:[
    {id:'line_rec',lane:'breakfast',kind:'recipe',sourceId:'rec_porridge',name:'Porridge lait',meta:'Recette liée',linked:true,sourceOriginalId:'source_rec',createdAt:'2026-01-05T08:10:00.000Z',updatedAt:'2026-01-06T09:10:00.000Z'},
    {id:'line_ing',lane:'snack',kind:'ingredient',sourceId:'ing_lait',name:'Lait entier',meta:'Ingrédient lié',linked:true,sourceOriginalId:'source_ing',createdAt:'2026-01-05T08:11:00.000Z',updatedAt:'2026-01-06T09:11:00.000Z'}
  ]
};

function assertContractRoundTrip(type, fixture, normalize){
  const first = normalize(fixture);
  const second = normalize(plain(first));
  assert.deepEqual(second, first);
  assert.deepEqual(Object.keys(first).sort(), [...state.CONTRACTS[type].fields].sort());
  state.CONTRACTS[type].fields.forEach(field => assert.deepEqual(second[field], first[field], type + '.' + field));
  return first;
}

test('round-trip exhaustif conserve chaque champ des trois contrats', () => {
  const normalizedIngredient = assertContractRoundTrip('ingredient', ingredient, state.normalizeIngredient);
  const normalizedRecipe = assertContractRoundTrip('recipe', recipe, state.normalizeRecipe);
  const normalizedMenu = assertContractRoundTrip('menu', menu, state.normalizeMenu);
  assert.deepEqual(Object.keys(normalizedRecipe.rows[0]).sort(), ['categoryId','createdAt','gramsResolved','ingredientId','ingredientName','macrosResolved','qty','sourceIngredientId','unit','updatedAt'].sort());
  assert.deepEqual(Object.keys(normalizedMenu.lines[0]).sort(), ['createdAt','id','kind','lane','linked','meta','name','sourceId','sourceOriginalId','updatedAt'].sort());
  assert.equal(normalizedIngredient.conversions.mlWeightG, 1.03);
});

test('backup.v3 survit à deux cycles JSON sans perte de champ', () => {
  const input = {meta:{app:'NutriApp',schema:'backup.v3',exportedAt:'2026-08-11T00:00:00.000Z'},ingredients:[ingredient],recipes:[recipe],menus:[menu]};
  const first = state.validateBackupPayload(plain(input));
  assert.equal(first.ok, true, first.errors.join(' · '));
  const secondPayload = {meta:input.meta,...plain(first.normalized)};
  const second = state.validateBackupPayload(plain(secondPayload));
  assert.equal(second.ok, true, second.errors.join(' · '));
  assert.deepEqual(second.normalized, first.normalized);
});

test('menuStatus couvre priorités et variantes de résolution des sources', () => {
  const sources = {recipes:[{id:'rec_ok'}],ingredients:[{id:'ing_ok'}]};
  assert.equal(state.getMenuStatus({title:'Vide',lines:[]}, sources), 'draft');
  assert.equal(state.getMenuStatus({lines:[{lane:'lunch',kind:'note',sourceId:'',name:'Libre'}]}, sources), 'incomplete');
  assert.equal(state.getMenuStatus({lines:[{lane:'lunch',kind:'recipe',sourceId:'',name:'Sans lien'}]}, sources), 'incomplete');
  assert.equal(state.getMenuStatus({lines:[{lane:'lunch',kind:'recipe',sourceId:'rec_absente'}]}, sources), 'missing');
  assert.equal(state.getMenuStatus({lines:[{lane:'snack',kind:'ingredient',sourceId:'ing_absent'}]}, sources), 'missing');
  assert.equal(state.getMenuStatus({lines:[{lane:'lunch',kind:'recipe',sourceId:'rec_ok'},{lane:'snack',kind:'ingredient',sourceId:'ing_ok'}]}, sources), 'complete');
  assert.equal(state.getMenuStatus({lines:[{lane:'lunch',kind:'recipe',sourceId:'rec_ok'}]}, {findRecipe:id => id === 'rec_ok'}), 'complete');
  assert.equal(state.getMenuStatus({lines:[]}, sources, 'inspiration'), 'inspiration');
});

function loadExchange(seed){
  const data = {
    ingredients:plain(seed.ingredients || []),
    recipes:plain(seed.recipes || []),
    menus:plain(seed.menus || [])
  };
  let commits = 0;
  let rejectCommit = false;
  const harness = createBrowserHarness({
    storage:{menus:JSON.stringify(data.menus)},
    window:{
      STORAGE_KEYS:{ingredients:'ingredients',recipes:'recipes',menus:'menus'},
      NutriAppState:state,
      NutriAppData:{
        getIngredients:() => data.ingredients,
        commitStorageSnapshot(snapshot){
          commits += 1;
          if(rejectCommit) return {ok:false,error:'Écriture simulée refusée.'};
          data.ingredients=plain(snapshot.ingredients);
          data.recipes=plain(snapshot.recipes);
          data.menus=plain(snapshot.menus);
          harness.localStorage.setItem('menus', JSON.stringify(data.menus));
          return {ok:true};
        }
      },
      NutriStore:{getIngredients:() => data.ingredients,getRecipes:() => data.recipes,emit(){}},
      getRecipes:() => data.recipes
    }
  });
  harness.loadClassicScript(path.join(root, 'assets/js/features/shared/02-card-exchange.js'));
  return {
    api:harness.window.NutriAppExchange,
    data,
    harness,
    get commits(){ return commits; },
    rejectNextCommit(){ rejectCommit=true; }
  };
}

function fullPack(){
  return {
    meta:{app:'NutriApp',schema:'exchange.v1',kind:'card_pack',title:'Journée porridge',createdBy:'Test QA',message:'Paquet complet'},
    primary:[{type:'menu',id:menu.id,name:menu.title}],
    payload:{ingredients:[ingredient],recipes:[recipe],menus:[menu]},
    dependencies:{included:true,policy:'embed_required_cards',missing:[]},
    importPolicy:{defaultMode:'add_copy',conflictKey:'type_name',neverOverwriteSilently:true}
  };
}

test('exchange.v1 embarque menu, recette et ingrédient liés', () => {
  const runtime = loadExchange({ingredients:[ingredient],recipes:[recipe],menus:[menu]});
  const dependencies = plain(runtime.api.resolveDependencies({type:'menu',id:'menu_jour'}));
  assert.deepEqual(dependencies.ids, {ingredients:['ing_lait'],recipes:['rec_porridge'],menus:['menu_jour']});
  assert.deepEqual(dependencies.missing, []);
  const pack = plain(runtime.api.exportCardPack({type:'menu',id:'menu_jour'},{title:'Pack test'}));
  assert.deepEqual(pack.meta.counts, {ingredients:1,recipes:1,menus:1});
  assert.equal(runtime.api.validatePack(pack).ok, true);
});

test('exchange.v1 distingue dépendance absente et paquet structurellement incomplet', () => {
  const runtime = loadExchange({ingredients:[],recipes:[recipe],menus:[]});
  const exported = plain(runtime.api.exportCardPack({type:'recipe',id:'rec_porridge'}));
  assert.deepEqual(exported.dependencies.missing, [{type:'ingredient',id:'ing_lait',source:'recipe:rec_porridge'}]);
  const warning = runtime.api.validatePack(exported);
  assert.equal(warning.ok, true);
  assert.equal(warning.missing.ingredients, 1);
  assert.ok(warning.warnings.some(item => item.includes('absente')));

  const malformed = {meta:{schema:'exchange.v1'},payload:{recipes:[recipe]}};
  const rejected = runtime.api.importPack(malformed);
  assert.equal(rejected.ok, false);
  assert.equal(runtime.commits, 0);
  assert.ok(rejected.report.errors.some(item => item.includes('ingredients')));
  assert.ok(rejected.report.errors.some(item => item.includes('menus')));
});

test('aperçu Exchange détecte les trois conflits de nom', () => {
  const runtime = loadExchange({ingredients:[ingredient],recipes:[recipe],menus:[menu]});
  const preview = plain(runtime.api.buildImportPreview(fullPack()));
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.conflicts.map(item => item.type).sort(), ['ingredient','menu','recipe']);
  assert.deepEqual(preview.conflicts.map(item => item.name).sort(), ['Journée porridge','Lait entier','Porridge lait'].sort());
});

test('import Exchange en copie renomme les conflits et remappe toutes les dépendances', () => {
  const runtime = loadExchange({ingredients:[ingredient],recipes:[recipe],menus:[menu]});
  const result = plain(runtime.api.importPack(fullPack(), {suffix:'reçu'}));
  assert.equal(result.ok, true);
  assert.deepEqual(result.counts, {ingredients:1,recipes:1,menus:1});
  assert.equal(runtime.commits, 1);
  const importedIngredient = runtime.data.ingredients.find(item => item.sourceId === 'ing_lait');
  const importedRecipe = runtime.data.recipes.find(item => item.sourceId === 'rec_porridge');
  const importedMenu = runtime.data.menus.find(item => item.sourceId === 'menu_jour');
  assert.match(importedIngredient.name, /\(reçu\)$/);
  assert.match(importedRecipe.name, /\(reçu\)$/);
  assert.match(importedMenu.title, /\(reçu\)$/);
  assert.equal(importedRecipe.rows[0].ingredientId, importedIngredient.id);
  assert.equal(importedRecipe.rows[0].sourceIngredientId, 'ing_lait');
  assert.equal(importedMenu.lines.find(line => line.kind === 'recipe').sourceId, importedRecipe.id);
  assert.equal(importedMenu.lines.find(line => line.kind === 'ingredient').sourceId, importedIngredient.id);
  assert.ok(importedMenu.lines.every(line => line.sourceOriginalId));
});

test('échec transactionnel Exchange ne publie aucune copie locale', () => {
  const runtime = loadExchange({ingredients:[ingredient],recipes:[recipe],menus:[menu]});
  const before = plain(runtime.data);
  runtime.rejectNextCommit();
  const result = runtime.api.importPack(fullPack());
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Écriture simulée refusée.');
  assert.deepEqual(runtime.data, before);
});

test('formats JSON refusent schémas erronés, doublons et backup incomplet', () => {
  const wrongExchange = state.validateExchangePack({meta:{schema:'exchange.v2'},payload:{ingredients:[ingredient],recipes:[],menus:[]}});
  assert.equal(wrongExchange.ok, false);
  const duplicateExchange = state.validateExchangePack({meta:{schema:'exchange.v1'},payload:{ingredients:[ingredient,ingredient],recipes:[],menus:[]}});
  assert.equal(duplicateExchange.ok, false);
  const incompleteBackup = state.validateBackupPayload({meta:{schema:'backup.v3'},ingredients:[ingredient],recipes:[]});
  assert.equal(incompleteBackup.ok, false);
  const duplicateNamesBackup = state.validateBackupPayload({meta:{schema:'backup.v3'},ingredients:[ingredient,{...ingredient,id:'ing_2',name:'  LAIT ENTIER  '}],recipes:[],menus:[]});
  assert.equal(duplicateNamesBackup.ok, false);
  assert.ok(duplicateNamesBackup.errors.some(item => item.includes('double par nom')));
});
