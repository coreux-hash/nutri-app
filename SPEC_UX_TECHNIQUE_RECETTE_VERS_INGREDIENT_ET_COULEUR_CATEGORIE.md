# NutriApp — Spécification UX + technique exacte

## Périmètre
Ajout de deux évolutions ciblées, sans refonte structurelle :
1. action **Créer comme ingrédient** dans le kebab des fiches recettes ;
2. choix d’une **couleur de catégorie recette** dans le modal recette, via palette contrôlée.

## UX — Conversion recette → ingrédient
- Emplacement : menu kebab de chaque carte recette.
- Libellé : **Créer comme ingrédient**.
- Clic : ouvre un modal dédié, pas d’action immédiate.
- Champs du modal :
  - nom du nouvel ingrédient ;
  - catégorie ingrédient cible ;
  - mode de poids :
    - **Poids calculé** = somme des grammes résolus des lignes recette ;
    - **Poids final** = poids final saisi par l’utilisateur.
  - champ poids final (g).
- Aperçu temps réel : kcal / prot / gluc / lip au 100 g.
- Validation : si aucun poids exploitable > 0, la conversion est bloquée.
- Résultat : création d’un nouvel ingrédient dans la bibliothèque, base nutritionnelle au 100 g, unité par défaut `g`, unités autorisées `['g']`.

## Technique — Conversion recette → ingrédient
- Source des recettes : `getRuntimeRecipes()` / `setRuntimeRecipes()`.
- Source des ingrédients : `getRuntimeIngredients()` / `setRuntimeIngredients()`.
- Calcul des macros : `computeRecipeTotalsFromRows(rows)`.
- Calcul du poids :
  - priorité au mode choisi dans le modal ;
  - mode `rows` = somme de `gramsResolved` ou de `resolveRecipeRow(row, ingredients).gramsResolved` ;
  - mode `final` = champ manuel ou `recipe.cookedWeight` existant.
- Formules :
  - `kcal100 = totalK / usedWeight * 100`
  - `p100 = totalP / usedWeight * 100`
  - `c100 = totalG / usedWeight * 100`
  - `f100 = totalL / usedWeight * 100`
- Donnée créée : ingrédient compatible avec le modèle runtime actuel.
- Champ `note` : traçabilité vers la recette source et le poids de base utilisé.

## UX — Couleur de catégorie recette
- Emplacement : dans le bloc de création de nouvelle catégorie du modal recette.
- Contrôle : **bulle couleur indépendante** à côté du champ nom.
- Interaction : clic sur la bulle → ouverture d’un popover contenant une palette fermée.
- Palette V1 : 12 couleurs validées.
- La couleur sélectionnée est visible immédiatement dans la bulle.
- Pas de saisie RVB libre en V1.

## Technique — Couleur de catégorie recette
- Stockage enrichi des catégories personnalisées : `{ id, label, color }`.
- Compatibilité ascendante : les anciennes catégories sans couleur reçoivent une couleur par défaut.
- Domaine enrichi :
  - `getRecipeCategoryColor(id)`
  - `getRecipeCategoryTheme(id)`
  - `getRecipeCategoryPalette()`
  - `normalizeRecipeCategoryColor(color)`
- Thème dérivé depuis la couleur principale : `main`, `deep`, `soft`, `faint`.
- Application : les cartes recette continuent d’utiliser `applyRecipePremiumTheme`, mais lisent d’abord le thème dérivé du `CategoryDomain`.

## Fichiers modifiés
- `index.html`
- `assets/js/domain/01-recipe-domains.js`
- `assets/js/features/recipes/02-recipe-editor-init.js`
- `assets/js/features/recipes/04-filter-list-view.js`
- `assets/js/features/recipes/05-scenario-actions-runtime.js`
- `assets/css/ui/recipes/02-recipe-editor-scoped.css`

## Risques connus
- La conversion utilise le poids résolu des lignes ou le poids final saisi ; si ces données sont fausses, l’ingrédient créé sera faux.
- La V1 ne gère pas encore un profil liquide ni des unités avancées pour l’ingrédient dérivé.
- La couleur de catégorie ne s’applique qu’aux catégories recette, pas aux catégories ingrédient.
