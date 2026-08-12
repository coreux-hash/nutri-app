const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');

test('IDs critiques de la Passe 1 existent une seule fois', () => {
  const html = read('index.html');
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  const critical = ['ingGrid','ingEmpty','ingCount','recipeList','recipeEmpty','recipeCount','menusLibraryGrid','menusStorageEmpty','menusSearchEmpty','menuCount','allowMl','mlWeightG','recipePrepTime','exchangeJsonBox','ingJsonBox'];
  critical.forEach(id => assert.equal(ids.filter(value => value === id).length, 1, id));
  assert.deepEqual([...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))], []);
});

test('module de contrats chargé avant les modules de données', () => {
  const html = read('index.html');
  const contract = html.indexOf('assets/js/core/04-data-contracts-and-state.js');
  assert.ok(contract > 0);
  assert.ok(contract < html.indexOf('assets/js/features/ingredients/03-storage-and-backup.js'));
  assert.ok(contract < html.indexOf('assets/js/features/recipes/03-store-runtime.js'));
  assert.ok(contract < html.indexOf('assets/js/ui/menus/02-menus-studio.js'));
  assert.ok(contract < html.indexOf('assets/js/features/shared/02-card-exchange.js'));
});

test('manifest et service worker restent strictement inchangés', () => {
  assert.equal(sha256('manifest.webmanifest'), 'f415077b0d426cdb16f2e9df7b185f23f08fba20622fd11fa58649afe27254a9');
  assert.equal(sha256('sw.js'), '668133b6f92f092993a268d7700e7985296536b55ed67b8840f2d1b857b36a6b');
});

test('le moteur nutritionnel n’est pas redéfini par le module d’état', () => {
  const source = read('assets/js/core/04-data-contracts-and-state.js');
  ['resolveRecipeRow','recipeConvertQtyToGrams','recipeMacrosFromGrams','computeRecipeTotalsFromRows'].forEach(name => {
    assert.equal(new RegExp(`function\\s+${name}\\b`).test(source), false, name);
  });
});
