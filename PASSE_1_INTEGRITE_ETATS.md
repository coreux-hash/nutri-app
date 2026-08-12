# Passe 1 — Intégrité des données et états

Cette livraison stabilise les contrats locaux sans framework, sans dépendance et sans modification du moteur nutritionnel.

## Contrats figés

- `Ingrédient` : identité, catégorie, profil, unités, unité par défaut, conversions, macros, média, note et provenance.
- `Recette` : identité, catégorie, tags, portions, poids cuit, temps, préparation, média, lignes et provenance.
- `Menu` : identité, catégorie, tags, objectif, préparation, lignes, origine, dates et provenance.

La source exécutable de ces contrats et des sélecteurs purs est `assets/js/core/04-data-contracts-and-state.js`.

## Décision `ml`

`ml` est réservé au profil liquide. Une carte ne conserve `ml` que si `conversions.mlWeightG` est strictement positif. L’interface propose explicitement ce facteur ; la valeur initiale suggérée pour un liquide est `1`, modifiable. Le moteur nutritionnel existant n’est pas modifié.

## États centralisés

- bibliothèques : total, visible, vide stockage, vide filtré ;
- filtres : critères et indicateur actif ;
- menus : brouillon, incomplet, source absente, complet, inspiration ;
- validation : rapports Backup et Exchange structurés.

Les états publiés sont consultables via `NutriAppState.getRuntimeState()` et signalés par l’événement `nutriapp:statechange`.

## Stockage et imports

- le normaliseur Recette conserve désormais `tags`, `cookedWeight`, `prepTime`, `thumbDataUrl` et les métadonnées de provenance ;
- `backup.v3` exige les trois listes avant tout remplacement ;
- Backup et Exchange écrivent les trois bibliothèques comme une transaction applicative et restaurent les valeurs précédentes si une écriture échoue ;
- toute modification du JSON invalide la validation précédente et désactive le bouton d’application.

## Tests

Exécuter depuis la racine :

```sh
node --test tests/*.test.js
```

Les tests couvrent les round-trips, le cas `ml`, les champs Recette, les statuts Menu, les états vides, Backup, Exchange, les IDs critiques et l’intégrité de `manifest.webmanifest` / `sw.js`.
