# Phase 4.3 — Coupe 3

Base: phase 4.3.6 stable.

## Objectif
Supprimer les aliases recipes visibles sur `window.*` après reroutage interne.

## Suppressions effectuées
- window.renderRecipeList
- window.refreshRecipeFilter
- window.RecipeListView
- window.RecipeReadonlyView
- window.openRecipeEditor
- window.duplicateRecipe
- window.deleteRecipe
- window.openRecipeScenario
- window.openThumbImportForRecipe
- window.openKebabPopoverForRecipe
- window.renderRecipeThumb

## Reroutages complémentaires
- `ui/app/02-filters-modal-tabs.js` utilise maintenant `NutriApp.ui.recipeList.refreshFilter()`
- `05-scenario-actions-runtime.js` rerend la liste via `NutriApp/NutriRecipes` au lieu du global supprimé
- `06-print-init.js` rerend via `RecipeListView.render()` local

## Non touché
- moteur nutritionnel
- IDs DOM
- flux OCR/import/export
- helpers store/runtime bas niveau
