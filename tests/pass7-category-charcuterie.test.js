const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('v17.4 : catégorie charcuterie_salaisons déclarée partout, juste après viandes_volailles', () => {
  for(const rel of ['assets/js/domain/01-recipe-domains.js','assets/js/features/ingredients/01-create-modal-and-categories.js']){
    const src = read(rel);
    const a = src.indexOf('"viandes_volailles"'), b = src.indexOf('"charcuterie_salaisons"'), c = src.indexOf('"poissons"');
    assert.ok(a > 0 && b > a && c > b, rel);
    assert.match(src, /label: "Charcuterie & salaisons"/);
  }
  assert.match(read('assets/js/features/ingredients/02-cards-filters-manual.js'), /charcuterie_salaisons:\{ main:'#[0-9A-F]{6}', deep:'#[0-9A-F]{6}' \}/);
  assert.match(read('assets/js/features/recipes/03-store-runtime.js'), /charcuterie_salaisons: \{ bg:/);
});

test('v17.4 : alias de libellés vers charcuterie_salaisons', () => {
  const src = read('assets/js/features/ingredients/01-create-modal-and-categories.js');
  ["'charcuterie'","'salaisons'","'charcuterie & salaisons'"].forEach(k => assert.ok(src.includes(k + ": 'charcuterie_salaisons'"), k));
});

test('v17.5 : liste de 20 catégories identique dans les deux déclarations, avec couleurs et pastilles', () => {
  const ids = (rel) => [...read(rel).matchAll(/\{ id: "([a-z_]+)", label: "/g)].map(m => m[1]);
  const a = ids('assets/js/domain/01-recipe-domains.js');
  const b = ids('assets/js/features/ingredients/01-create-modal-and-categories.js');
  const expected = ['cereales_feculents','legumes','fruits','viandes_volailles','charcuterie_salaisons','poissons','fruits_de_mer','oeufs','proteines_vegetales','fromages','produits_laitiers','matieres_grasses','fruits_coque_graines','sucrants','tartinables_confitures','aides_techniques','epices_aromes','condiments_sauces','liquides_boissons','autre'];
  assert.deepEqual(a, expected);
  assert.deepEqual(b, expected);
  const tones = read('assets/js/features/ingredients/02-cards-filters-manual.js');
  const theme = read('assets/js/features/recipes/03-store-runtime.js');
  expected.forEach(id => {
    assert.match(tones, new RegExp(`\\b${id}:\\{ main:`), 'couleur carte ' + id);
    assert.match(theme, new RegExp(`\\b${id}: \\{ bg:`), 'pastille ' + id);
  });
  // ancien libellé toujours reconnu à l'import
  assert.ok(read('assets/js/features/ingredients/01-create-modal-and-categories.js').includes("'matières grasses / oléagineux': 'matieres_grasses'"));
});
