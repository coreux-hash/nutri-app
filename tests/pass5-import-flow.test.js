const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('index.html');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);

test('v17 : point d’entrée unique et JSON replié présents une seule fois', () => {
  ['btnSystemImportFile','systemImportFileInput','systemImportStatus','exchangeJsonDetails','btnOpenExchangeImport','btnOpenBackup','exchangeJsonBox','btnExchangeValidate','btnExchangeImport']
    .forEach(id => assert.equal(ids.filter(v => v === id).length, 1, id));
  const details = html.slice(html.indexOf('id="exchangeJsonDetails"'), html.indexOf('</details>'));
  assert.ok(details.includes('id="exchangeJsonBox"'), 'la zone JSON est dans le bloc repliable');
  assert.ok(details.includes('id="btnExchangeValidate"'), 'Valider est dans le bloc repliable');
});

test('v17 : couche CSS du parcours chargée en dernier et présente', () => {
  const link = 'assets/css/ui/shared/10-exchange-import-flow.css';
  assert.ok(fs.existsSync(path.join(root, link)));
  const links = [...html.matchAll(/<link href="([^"]+\.css)"/g)].map(m => m[1]);
  assert.ok(links.indexOf(link) > links.indexOf('assets/css/ui/shared/09-responsive-cousin-fix.css'), 'chargée après 09');
});

test('v17 : routage par schéma et garde-fous croisés câblés', () => {
  const ex = read('assets/js/features/shared/02-card-exchange.js');
  const bk = read('assets/js/core/02-modal-and-form-runtime.js');
  assert.match(ex, /function detectImportKind/);
  assert.match(ex, /window\.NutriExchangeUI/);
  assert.match(ex, /data-exchange-to-backup/);
  assert.match(bk, /window\.NutriBackupUI/);
  assert.match(bk, /data-backup-to-exchange/);
  // le moteur d'import n'est pas modifié : importPack reste en add_copy
  assert.match(ex, /importPack\(currentPack, \{ mode:"add_copy" \}\)/);
});

test('v17 : detectImportKind route correctement', () => {
  const ex = read('assets/js/features/shared/02-card-exchange.js');
  const src = ex.slice(ex.indexOf('function detectImportKind'), ex.indexOf('(function bindSystemImportRouter'));
  const detect = new Function(src + '; return detectImportKind;')();
  assert.equal(detect({ meta:{ schema:'exchange.v1' }, payload:{} }), 'exchange');
  assert.equal(detect({ meta:{ schema:'backup.v3' } }), 'backup');
  assert.equal(detect({ ingredients:[], recipes:[], menus:[] }), 'backup');
  assert.equal(detect({ version:2, ingredients:[] }), 'exchange');
});

test('v17.1 : la vignette ingrédient respecte .hidden sur le monogramme', () => {
  const css = read('assets/css/ui/ingredients/06-ingredient-thumb-visible-fix.css');
  assert.match(css, /#pageIngredients \.thumbPlaceholder\.hidden\{ display:none !important; \}/);
  assert.ok(html.includes('assets/css/ui/ingredients/06-ingredient-thumb-visible-fix.css'));
});
