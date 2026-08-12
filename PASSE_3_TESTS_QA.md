# NutriApp — Passe 3 Tests et QA responsive

## Exécution

Depuis la racine de l’application :

```bash
node --test tests/*.test.js
```

Le socle utilise uniquement les modules natifs de Node.js : `node:test`, `node:assert`, `node:fs`, `node:path`, `node:crypto` et `node:vm`. Aucune dépendance n’est installée.

## Couverture automatisée

- contrats Ingrédient, Recette et Menu, avec round-trip exhaustif champ par champ ;
- stockage transactionnel et restauration en cas d’échec ;
- sélecteurs de bibliothèques, filtres et statuts Menu ;
- `backup.v3` complet, incomplet, schéma erroné et doublons ;
- `exchange.v1`, dépendances embarquées ou absentes, conflits de noms et import en copie ;
- remappage des IDs recette → ingrédient et menu → recette/ingrédient ;
- navigation, hash, historique, panels, hero, FAB, filtres et pastilles ;
- overlays, ordre de pile, Échap niveau par niveau, scroll, focus, `inert` et `z-index` ;
- unicité des IDs critiques et empreintes de `manifest.webmanifest`/`sw.js`.

`tests/helpers/browser-harness.js` fournit un faux navigateur volontairement minimal. Il exécute les scripts classiques dans `node:vm` avec un DOM, un historique et un `localStorage` contrôlés. Il ne remplace pas un navigateur de rendu.

## Limite explicite

Les tests automatisés ne valident ni les césures, ni les débordements réellement peints, ni la densité visuelle. Ces contrôles restent dans `qa/PASSE_3_QA_RESPONSIVE.md` et doivent être réalisés dans un navigateur réel aux six viewports définis.
