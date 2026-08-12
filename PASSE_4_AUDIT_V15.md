# Passe 4 — Audit global v15 et polish

Audit statique complet à partir de v14 (page_counter_scope). Aucune refonte,
aucune dépendance ajoutée, moteur nutritionnel / manifest.webmanifest / sw.js
inchangés (empreintes SHA-256 verrouillées, toujours vérifiées par les tests).

## Corrections implémentées

1. **Suppression d'un script tiers bloquant au démarrage** (index.html)
   `<script src="https://unpkg.com/tesseract.js@5.1.0/…">` était chargé de
   façon synchrone et bloquante à chaque ouverture, alors que l'app est décrite
   comme locale/autonome. Le module OCR (`features/recipes/01-recipe-import-ocr.js`)
   charge déjà Tesseract à la demande via `ensureTesseractLoaded()` (unique point
   d'entrée, avec liste de CDN de repli). La ligne était donc redondante et créait
   une dépendance de démarrage à un CDN externe. Retirée. L'OCR reste fonctionnel
   (chargement paresseux au premier usage réel).

2. **Nom accessible sur les pastilles de couleur** (index.html)
   Les 12 boutons `recipeColorChip` du sélecteur de couleur de catégorie recette
   n'avaient aucun nom accessible (information transmise uniquement par la couleur).
   Ajout d'un `aria-label="Couleur #RRGGBB"` dérivé du `data-color` existant
   (aucune valeur inventée). Le JS lit ces chips par classe/`data-color` : inchangé.

## Tests

- `node --test tests/*.test.js` → 44/44 (42 existants + 2 régressions Passe 4).
- `node --check` sur les 36 fichiers JS → OK.
- Empreintes `manifest.webmanifest` / `sw.js` inchangées.
- Aucun ID HTML dupliqué.

## Non corrigé volontairement (voir compte rendu)

- Coexistence du gestionnaire Échap central (`core/05-navigation-and-overlays.js`)
  avec ~8 handlers `document`/Escape dans les modules : risque de fermeture
  multi-niveaux sur une seule touche Échap. Non corrigé à l'aveugle (refactor
  multi-fichiers non validable sans navigateur). À traiter en passe dédiée + QA.
- QA responsive (6+ viewports) et rendu visuel : non vérifiables sans navigateur.
