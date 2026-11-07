const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const S = require('../assets/js/core/00-image-store.js');

const IMG_A = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v89WAAAAA==';
const IMG_B = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const ING = 'nutriapp.ingredients.v2';
const REC = 'nutriapp.recipes.v2';

test('v18 : les images quittent localStorage et reviennent intactes (ingrédients)', () => {
  const list = [
    { id:'a', name:'A', thumb:IMG_A, kcal:1, note:'n' },
    { id:'b', name:'B', thumb:IMG_A },             // même photo : stockée une seule fois
    { id:'c', name:'C', thumb:IMG_B },
    { id:'d', name:'D', thumb:'' }
  ];
  const raw = JSON.stringify(list);
  const { text, images } = S.stripText(ING, raw);
  assert.equal(images.size, 2);
  assert.ok(!text.includes('data:image/'));
  assert.equal(S.refsIn(text).size, 2);
  const back = S.hydrateText(ING, text, id => images.get(id));
  assert.deepEqual(JSON.parse(back), list);
});

test('v18 : champ thumbDataUrl des recettes géré, autres clés et champs intacts', () => {
  const rec = [{ id:'r', name:'R', thumbDataUrl:IMG_B, rows:[], tags:['x'], cookedWeight:250, prepTime:10 }];
  const { text, images } = S.stripText(REC, JSON.stringify(rec));
  assert.equal(images.size, 1);
  assert.deepEqual(JSON.parse(S.hydrateText(REC, text, id => images.get(id))), rec);
  const menus = JSON.stringify([{ id:'m', thumb:IMG_A }]);
  assert.equal(S.stripText('nutriapp.meals.v2', menus).text, menus);
  const odd = JSON.stringify([{ id:'a', note:IMG_A }]);   // image hors champ géré : non touchée
  assert.equal(S.stripText(ING, odd).text, odd);
});

test('v18 : référence orpheline conservée, JSON invalide laissé tel quel, identifiant stable', () => {
  const t = JSON.stringify([{ id:'a', thumb:S.PREFIX + 'iabc_x' }]);
  assert.equal(S.hydrateText(ING, t, () => undefined), t);
  assert.equal(S.stripText(ING, '{pas du json data:image/').text, '{pas du json data:image/');
  assert.equal(S.imageId(IMG_A), S.imageId(String(IMG_A)));
  assert.notEqual(S.imageId(IMG_A), S.imageId(IMG_B));
  assert.match(S.imageId(IMG_A), /^[A-Za-z0-9_]+$/);
});

test('v18 : index.html charge le module image avant tous les scripts de l’app, différés dans l’ordre', () => {
  const html = read('index.html');
  const normal = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(normal, ['assets/js/core/00-image-store.js']);
  const deferred = [...html.matchAll(/<script type="text\/x-nutriapp" src="([^"]+)"/g)].map(m => m[1]);
  assert.equal(deferred.length, 30);
  assert.equal(deferred[0], 'assets/js/core/00-app-shell.js');
  assert.ok(html.indexOf('00-image-store.js') < html.indexOf('00-app-shell.js'));
  deferred.concat(normal).forEach(src => assert.ok(fs.existsSync(path.join(__dirname, '..', src)), src));
});

test('v18 : garde-fous du module (repli, migration sûre, attente du HTML complet)', () => {
  const src = read('assets/js/core/00-image-store.js');
  assert.match(src, /await putAll\(images\);[\s\S]{0,200}if\(started\) return;[\s\S]{0,120}origSet\.call\(ls, key, text\);/, 'images écrites avant localStorage');
  assert.match(src, /doc\.readyState === 'loading'\) doc\.addEventListener\('DOMContentLoaded', runDeferredScripts/);
  assert.match(src, /BOOT_TIMEOUT_MS/);
  assert.match(src, /if\(this !== ls \|\| !active/);
});
