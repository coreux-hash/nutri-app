# Passe 3 — Checklist QA responsive NutriApp

Cette checklist est manuelle. Un contrôle statique ou un test DOM ne prouve pas qu’un écran est visuellement correct. Chaque case doit être cochée dans un navigateur réel et accompagnée d’une capture en cas d’échec.

## Viewports obligatoires

- [ ] 360 × 740 — mobile étroit
- [ ] 390 × 844 — mobile courant
- [ ] 430 × 932 — mobile large
- [ ] 768 × 1024 — tablette portrait
- [ ] 1280 × 800 — desktop compact
- [ ] 1440 × 900 — desktop large

À chaque changement de viewport : recharger `index.html`, vérifier le hash initial, puis refaire le parcours sans conserver un overlay ouvert du viewport précédent.

## Jeux de données à préparer

- [ ] Stockage totalement vide.
- [ ] Au moins trois ingrédients, dont un liquide en `ml` et un ingrédient sans média.
- [ ] Au moins deux recettes : une complète avec ingrédients liés et une sans média.
- [ ] Un menu complet avec recette et ingrédient liés.
- [ ] Un Menu brouillon sans ligne.
- [ ] Un Menu incomplet avec note ou ligne non liée.
- [ ] Un menu avec Source absente : recette supprimée ou ingrédient supprimé après liaison.
- [ ] Un paquet `exchange.v1` valide contenant menu, recette et ingrédient.
- [ ] Un paquet invalide auquel manque une liste `payload`.
- [ ] Un paquet créant un conflit de nom avec chaque type de carte.
- [ ] Un `backup.v3` complet et un backup incomplet.

## Matrice des parcours

Exécuter toutes les lignes aux six viewports. Reporter `OK`, `KO` ou `N/A` avec justification.

| Parcours | 360 × 740 | 390 × 844 | 430 × 932 | 768 × 1024 | 1280 × 800 | 1440 × 900 |
| --- | --- | --- | --- | --- | --- | --- |
| Drawer ouvert | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Bibliothèque Ingrédients | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Filtres Ingrédients | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Fiche Ingrédient | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Partage Ingrédient | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Bibliothèque Recettes | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Filtres Recettes | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Fiche Recette | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Partage Recette | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Bibliothèque Menus | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Filtres Menus | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Fiche Menu | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Studio Menu | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Partage Menu | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Page Échanges | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Import paquet | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Sauvegarde technique | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| État stockage vide | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| État filtré vide | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Menu brouillon | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Menu incomplet | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Source absente | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

## Contrôles communs à chaque écran

- [ ] Aucun titre rogné, masqué sous la topbar ou coupé sans raison.
- [ ] Aucun débordement horizontal de `body`, carte, tableau, textarea ou modal.
- [ ] Texte lisible sans chevauchement et sans réduction excessive.
- [ ] Cible tactile exploitable ; aucun bouton important hors viewport.
- [ ] Pastille compteur visible, lisible et rattachée à la bonne bibliothèque.
- [ ] FAB `+` correspondant à la page active ; aucun FAB sur Échanges.
- [ ] Bouton filtre correspondant à la page active ; désactivé sur Échanges.
- [ ] État actif du drawer cohérent avec panel, hero et hash.
- [ ] Retour navigateur rétablit page, hero, FAB, filtre et pastille.
- [ ] Scroll de page ou de modal possible jusqu’au dernier contenu.
- [ ] Fermeture d’un overlay restaure le scroll initial.
- [ ] Focus clavier rendu au bouton déclencheur après fermeture.

## Drawer et navigation

- [ ] Drawer ouvert : tous les liens restent accessibles sans être coupés verticalement.
- [ ] Ingrédients, Recettes, Menus et Échanges sont routés.
- [ ] « Échanges » est affiché alors que la clé technique reste `system`.
- [ ] Suivi, Réglages et Aide sont visiblement non câblés et ne changent pas de panel.
- [ ] Échap ferme le drawer uniquement, sans fermer un autre niveau derrière.

## Bibliothèques et filtres

- [ ] Les cartes Ingrédients, Recettes et Menus gardent une largeur cohérente.
- [ ] Les médias absents ne cassent ni hauteur, ni alignement, ni actions.
- [ ] Le compteur total est exact sans filtre.
- [ ] Le compteur filtré correspond au nombre de cartes visibles.
- [ ] Reset restaure cartes, compteur et état vide.
- [ ] État stockage vide explique qu’aucune carte n’existe.
- [ ] État filtré vide explique qu’aucun résultat ne correspond.

## Fiches, partage et overlays

- [ ] Chaque clic de carte ouvre la bonne fiche.
- [ ] Modifier, dupliquer, supprimer et partager sont lisibles et actionnables selon le contexte.
- [ ] Le partage s’affiche devant la fiche, jamais derrière.
- [ ] La fiche couverte devient `aria-hidden` et `inert` pendant le partage.
- [ ] Premier Échap : fermeture du partage seulement.
- [ ] Retour visuel et focus propres sur la fiche.
- [ ] Deuxième Échap : fermeture de la fiche.
- [ ] Aucun scroll bloqué après fermeture du dernier overlay.

## Menus

- [ ] Menu brouillon : statut visible sur carte et fiche.
- [ ] Menu incomplet : statut visible et distinct du brouillon.
- [ ] Source absente : statut visible et source concernée compréhensible.
- [ ] Comptes repas, recettes et ingrédients cohérents.
- [ ] Studio Menu conservé, entièrement accessible et sans déplacement fonctionnel brutal.
- [ ] Retour fiche ↔ studio ne perd aucune ligne ni métadonnée.

## Échanges et sauvegarde

- [ ] Paquet valide : aperçu, expéditeur, message et compteurs exacts.
- [ ] Paquet invalide : bouton appliquer indisponible et erreur lisible.
- [ ] Conflit : chaque nom concerné est annoncé comme copie à créer.
- [ ] Dépendance absente : avertissement visible sans être confondu avec une erreur JSON.
- [ ] Import appliqué : cartes existantes conservées, copies renommées, liens remappés.
- [ ] Zone JSON et sélecteur de fichier restent lisibles sans débordement.
- [ ] Export `backup.v3` contient les trois bibliothèques.
- [ ] Backup incomplet refusé avant toute écriture.
- [ ] Import backup complet restaure les trois bibliothèques ensemble.

## Fiche d’anomalie

Pour chaque `KO`, noter :

- viewport exact et niveau de zoom ;
- page/hash ;
- stockage ou fixture utilisé ;
- parcours minimal de reproduction ;
- résultat observé et résultat attendu ;
- capture avant/après ;
- blocage fonctionnel ou défaut visuel ;
- navigateur, version et système.

## Critère de sortie

La Passe 3 visuelle est terminée uniquement lorsque les 132 cellules de la matrice sont renseignées, que les anomalies bloquantes sont corrigées ou explicitement reportées, et qu’un second passage confirme les corrections aux viewports concernés.
