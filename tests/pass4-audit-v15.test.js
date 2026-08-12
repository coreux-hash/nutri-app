// Passe 4 — Régressions de l'audit v15 (audit global + polish).
// Tests statiques, uniquement modules natifs Node.js. Aucune dépendance.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('index.html ne charge aucun script tiers bloquant au démarrage (OCR chargé à la demande)', () => {
  const html = read('index.html');
  // Aucun <script src="http(s)://..."> classique : dépendance externe au chargement interdite.
  const externalClassicScripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']https?:\/\/[^"']+["'][^>]*>/gi)];
  assert.deepEqual(
    externalClassicScripts.map(m => m[0]),
    [],
    'Aucun script externe bloquant ne doit être injecté dans index.html'
  );
  // Le chargeur paresseux Tesseract reste présent dans le module OCR (fonctionnalité conservée).
  const ocr = read('assets/js/features/recipes/01-recipe-import-ocr.js');
  assert.match(ocr, /ensureTesseractLoaded/, 'Le chargeur OCR à la demande doit rester présent');
});

test('chaque bouton recipeColorChip expose un nom accessible (pas d’info uniquement par couleur)', () => {
  const html = read('index.html');
  const chips = [...html.matchAll(/<button\b[^>]*class="[^"]*recipeColorChip[^"]*"[^>]*>/gi)].map(m => m[0]);
  assert.ok(chips.length > 0, 'Des pastilles de couleur doivent exister dans le sélecteur');
  const unlabeled = chips.filter(tag => !/\baria-label=/.test(tag) && !/\baria-labelledby=/.test(tag));
  assert.deepEqual(unlabeled, [], 'Toute pastille de couleur doit porter un aria-label');
});
