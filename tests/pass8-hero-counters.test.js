const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('v17.6 : la restauration de sauvegarde repasse par le filtre ingrédients (compteur du hero)', () => {
  const src = read('assets/js/features/ingredients/03-storage-and-backup.js');
  const start = src.indexOf('function refreshAfterBackupImport(){');
  const end = src.indexOf('function commitStorageSnapshot(', start);
  assert.ok(start > 0 && end > start);
  const body = src.slice(start, end);
  assert.match(body, /applyIngredientFilters \|\| window\.NutriAppFilters\?\.applyIngredients/);
  assert.match(body, /if\(!refreshed && ingGrid\)/, 'reconstruction manuelle gardée seulement en secours');
  assert.match(body, /refreshRecipesPage/, 'le compteur recettes reste rafraîchi');
});

test('v17.6 : na:ingredientsChanged rafraîchit la page ingrédients (« Créer comme ingrédient »)', () => {
  const emitter = read('assets/js/features/recipes/05-scenario-actions-runtime.js');
  assert.match(emitter, /new CustomEvent\('na:ingredientsChanged'\)/);
  const listener = read('assets/js/features/ingredients/02-cards-filters-manual.js');
  assert.match(listener, /window\.addEventListener\('na:ingredientsChanged', \(\)=>\{ try\{ applyIngredientFilters\(\); \}catch\(_\)\{ \} \}\);/);
});
