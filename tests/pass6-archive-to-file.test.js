const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('index.html');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);

test('v17.2 : fenêtre d’archivage présente, IDs uniques', () => {
  ['btnOpenArchive','archiveOverlay','archiveModal','btnArchiveClose','btnArchiveBack','archiveSearch','archiveCategory','archiveList','archiveSummary','archiveStorage','btnArchiveDownload','btnArchiveRemove','btnArchiveSelectVisible']
    .forEach(id => assert.equal(ids.filter(v => v === id).length, 1, id));
  assert.ok(html.indexOf('02-card-exchange.js') < html.indexOf('03-archive-to-file.js'), 'archive chargé après le module d’échange');
  assert.ok(fs.existsSync(path.join(root, 'assets/css/ui/shared/11-archive-to-file.css')));
  assert.ok(html.includes('assets/css/ui/shared/11-archive-to-file.css'));
});

test('v17.2 : la fenêtre est enregistrée dans la pile d’overlays (Échap)', () => {
  const nav = read('assets/js/core/05-navigation-and-overlays.js');
  assert.match(nav, /\['archive','archiveOverlay',visibleByHiddenClass,'btnArchiveClose'\]/);
});

test('v17.2 : garde-fous de l’archivage', () => {
  const js = read('assets/js/features/shared/03-archive-to-file.js');
  // retrait seulement après téléchargement de la même sélection
  assert.match(js, /state\.downloadedKey !== key/);
  // ingrédients utilisés par une recette ou un menu verrouillés
  assert.match(js, /row && row\.ingredientId/);
  assert.match(js, /line\.kind === "ingredient"/);
  // archive validée avant téléchargement
  assert.match(js, /validateExchangePack/);
  // retrait par le chemin « ingrédients seulement », jamais par la transaction globale
  assert.match(js, /deleteIngredientsByIds/);
  assert.doesNotMatch(js, /commitStorageSnapshot\(/);
});

test('v17.2 : deleteIngredientsByIds n’écrit que les ingrédients', () => {
  const src = read('assets/js/features/ingredients/03-storage-and-backup.js');
  const start = src.indexOf('deleteIngredientsByIds(ids){');
  assert.ok(start > 0);
  const body = src.slice(start, src.indexOf('},', start));
  assert.match(body, /setIngredientStoreSnapshot\(next\)/);
  assert.doesNotMatch(body, /recipes|menus|commitStorageSnapshot/);
});
