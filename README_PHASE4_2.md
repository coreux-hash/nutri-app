# NutriApp Phase 4.2

Cette phase remplace la 4.1.1 comme base physique de travail.

## Objectif
Extraire les deux composites restants par sous-systèmes internes, sans encore passer en imports/exports ES modules.

## Découpage appliqué

### Ingrédients
- `01-create-modal-and-categories.js`
- `02-cards-filters-manual.js`
- `03-storage-and-backup.js`
- `04-page-interactions-detail-thumb.js`

### Recettes
- `03-store-runtime.js`
- `04-filter-list-view.js`
- `05-scenario-actions-runtime.js`
- `06-print-init.js`

## Frontières
- `NutriIngredients` : namespace interne ingrédients
- `NutriRecipes` : namespace interne recettes
- Les globals legacy restent exposés pour compatibilité

## Vérifications à faire
- ouverture app
- console propre
- création / édition ingrédient
- filtres ingrédients
- création / édition recette
- liste / scénario / dupliquer / supprimer
- import rapide / OCR
