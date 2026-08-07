# Phase 4.3.6 — Coupe 2 (suite)

Base: phase 4.3.5 stable.

## Objectif
Rerouter les dépendances recipes internes vers `NutriRecipes` / `NutriApp` sans supprimer encore les aliases legacy visibles.

## Changements
- `ui/recipes/02-safe-ui-modules.js` : plus de fallback direct vers `window.RecipeListView` / `window.RecipeReadonlyView`; priorité à `NutriRecipes.ui` puis `NutriApp.ui`.
- `core/99-layer-registry.js` : plus de lecture prioritaire des globals recipes visibles; priorité aux namespaces.
- `features/recipes/04-filter-list-view.js` : `ns.ui.recipeList` exposé, ouverture scénario reroutée via `NutriApp` / `recipeScenario`.
- `features/recipes/05-scenario-actions-runtime.js` : edit / duplicate / delete passent d'abord par `NutriApp.ui.recipeEditor` puis `NutriApp.actions`, avec garde anti-récursion. Expose aussi `recipeList` / `recipeScenario` dans `NutriRecipes.ui`.
- `features/recipes/06-print-init.js` : lecture des vues via `NutriRecipes.ui` / `NutriApp.ui`.

## Non fait volontairement
- suppression de `window.renderRecipeList`, `window.openRecipeScenario`, etc.
- suppression de `window.RecipeEditor`.

## Contrôle conseillé
- page recettes : filtre / tri
- clic carte / vignette / kebab
- modifier / dupliquer / supprimer
- export PDF
- console sans erreur
