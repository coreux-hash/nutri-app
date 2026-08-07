# Phase 4.3.3 — Coupe 2

Reroutage interne des dépendances recipes vers `window.NutriApp` et `window.NutriRecipes`.

Ce patch ne supprime pas encore les aliases recipes visibles sur `window.*`.

## Fichiers modifiés
- `assets/js/core/99-layer-registry.js`
- `assets/js/features/recipes/04-filter-list-view.js`
- `assets/js/features/recipes/05-scenario-actions-runtime.js`
- `assets/js/features/recipes/06-print-init.js`

## Intention
- réduire les dépendances internes aux globals recipes legacy
- préparer la Coupe 3 sans changer les comportements visibles
