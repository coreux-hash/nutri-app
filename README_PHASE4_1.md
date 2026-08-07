# NutriApp — Phase 4.1

Cette version poursuit la Phase 4 avec un objectif précis :
- réduire les dépendances croisées implicites entre fichiers ;
- regrouper les assets par frontière `core / domain / ui / features` ;
- conserver le comportement de l'application sans réécriture métier.

## Frontières
- `assets/js/core/` : shell global, refs DOM, storage/API transverses, registry final
- `assets/js/domain/` : catégories, normalisation et règles métier réutilisables
- `assets/js/ui/` : shells d'interface, modules UI, info-dots, tabs
- `assets/js/features/` : flux produit (ingrédients, recettes, OCR, import)

## Nettoyages réellement effectués
- `05-store-domain-and-runtime.js` n'est plus un bloc hybride unique :
  - `ui/recipes/01-create-modal-shell.js`
  - `domain/01-recipe-domains.js`
  - `features/recipes/01-recipe-import-ocr.js`
  - `features/recipes/02-recipe-editor-init.js`
- le binding `recipe editor init` a été déplacé après `features/recipes/04-recipe-editor-runtime.js`
  pour supprimer une dépendance temporelle inutile à `window.RecipeEditor`.
- un registry final (`assets/js/core/99-layer-registry.js`) reconstruit une vue claire
  des objets exposés dans `window.NutriApp`.

## Dette assumée
Deux fichiers restent volontairement composites pour éviter une casse fonctionnelle :
- `assets/js/features/ingredients/01-ingredients-runtime-composite.js`
- `assets/js/features/recipes/03-recipes-page-runtime.js`

Ils sont désormais isolés dans `features/` et explicitement signalés dans `NutriAppBoundaryReport`.

## Contrôle minimal
1. Ouvrir `index.html`
2. Vérifier la console
3. Tester :
   - filtres ingrédients
   - création / édition ingrédient
   - page recettes
   - scénario recette
   - création / édition / duplication / suppression recette
   - OCR / import rapide
