# Passation NutriApp v16.1 — 2026-11-02 — Report des deux corrections de l'audit v15

Référence : `nutriapp_exchange_nav_v16_global_audit_polish` (contient déjà la case « Suivi » et le nouveau rendu de la liste du 2026-11-02, cf. `PASSATION_NUTRIAPP_suivi_2026-11-02.md` côté v15).
Demande : reporter dans v16 les deux corrections de l'`index.html` v15 « global audit » perdues en v16 (OCR non chargé au démarrage ; pastilles de couleur nommées).

## 1. Constat vérifié avant report
- L'`index.html` v16 = celui de GitHub : script `tesseract.min.js` en `<head>` (avec `defer`, ajouté par l'audit v16 — A2) ; 12 boutons `recipeColorChip` sans `aria-label`.
- L'audit v15 avait supprimé le script en s'appuyant sur le chargeur à la demande `ensureTesseractLoaded` (`01-recipe-import-ocr.js`). **Problème trouvé** : ce chargeur est enfermé dans la fonction isolée du module (l.2 `(function(){`), donc invisible pour `01-ocr-shared-patch.js` (l.140), qui fournit le `window.ocrRecognizeFileToText` réellement utilisé. Sans script préchargé, ce module teste `!!window.Tesseract` → faux → **l'OCR renvoie toujours un texte vide**.
- Mesuré en navigateur (Tesseract simulé) : sans le script en tête et sans correctif → 0 chargement, résultat vide ; v16 d'origine (`defer`) → 1 chargement au démarrage, OCR fonctionnel. Le test v15 ne vérifiait que la présence du mot `ensureTesseractLoaded`, d'où une régression non détectée.

## 2. Modifications
- `index.html` : suppression du `<script defer src="https://unpkg.com/tesseract.js@5.1.0/…">` ; `aria-label="Couleur #XXXXXX"` sur les 12 `recipeColorChip`. Résultat identique octet pour octet à l'`index.html` v15 « global audit ».
- `assets/js/features/recipes/01-recipe-import-ocr.js` : `window.ensureTesseractLoaded = ensureTesseractLoaded;` (1 ligne + commentaire).
- `assets/js/features/shared/01-ocr-shared-patch.js` : le module partagé utilise `window.ensureTesseractLoaded` (repli sur l'ancien test conservé).
- `tests/pass4-ingredient-boot-and-assets.test.js` : le test A2 « tesseract en defer » est remplacé par « aucun script tiers au démarrage + chargeur exposé et réutilisé + ordre de chargement » ; ajout du test v15 « pastilles nommées ». 5 → 6 tests.

## 3. Comportements préservés
Contrats, moteur, stockage, sauvegarde/import, manifest et service worker non touchés ; OCR recettes et ingrédients toujours disponibles (chargé au premier usage via les CDN de secours existants).

## 4. Contrôles exécutés
- `node --test` : 48/48 (13 + 4 + 11 + 9 + 5 + 6). `node --check` sur les fichiers modifiés.
- Navigateur 390 et 1366 : **aucune requête externe au démarrage**, aucune erreur JS, chargeur exposé, 12 pastilles nommées, état vide Ingrédients affiché (correctif A1 de v16 intact), page Recettes OK.
- OCR (Tesseract simulé) : 0 chargement au démarrage, 1 au premier appel, texte lu.
- Case « Suivi » et totaux des recettes inchangés (234,41 / 171,6 par portion).

## 5. Limites
- L'OCR réel n'a pas été testé (CDN inaccessibles ici) ; seul le mécanisme de chargement l'a été, avec une bibliothèque simulée.
- Hors ligne, l'OCR reste indisponible (comme avant) ; le démarrage, lui, ne dépend plus du réseau.
- Service worker : recharger deux fois après mise en ligne.

## 6. GitHub (`nutri-app`), ensemble
`index.html`, `assets/js/features/recipes/01-recipe-import-ocr.js`, `assets/js/features/shared/01-ocr-shared-patch.js` (+ `tests/pass4-ingredient-boot-and-assets.test.js` facultatif), en plus des 3 fichiers de la case « Suivi » s'ils ne sont pas encore en ligne.
