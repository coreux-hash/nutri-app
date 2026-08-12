# Passe 2 — Navigation et overlays

## Registre unique

`assets/js/core/05-navigation-and-overlays.js` expose `NAV_REGISTRY`. Ce registre contient les libellés du drawer, titres hero, panels, hashes, FAB, boutons de filtre, pastilles et statuts de câblage.

Pages actives : Ingrédients, Recettes, Menus et Échanges. La clé technique `system` est conservée. Suivi, Réglages et Aide restent visibles mais explicitement non câblés.

## Historique

- un clic dans le drawer crée une entrée d’historique ;
- un appel interne à `showPage()` remplace l’entrée courante par défaut ;
- `popstate` et `hashchange` réappliquent tout l’état visuel depuis le registre ;
- un hash inconnu ou non câblé revient vers `#ingredients` ;
- `#exchange` est accepté comme alias puis canonisé en `#system`.

## Pile d’overlays

`NutriOverlayManager` observe les overlays existants sans imposer une réécriture brutale de chaque fonctionnalité. Il centralise :

- l’ordre réel d’ouverture et le niveau visuel ;
- le verrouillage du scroll tant qu’un niveau bloquant reste ouvert ;
- `aria-hidden` et `inert` ;
- le retour du focus vers le déclencheur ;
- le bouclage Tab minimal dans le niveau supérieur ;
- la fermeture d’un seul niveau avec Échap.

Les bulles d’information et popovers sont fermés avant la modale qui les contient. Un partage ouvert depuis une fiche se ferme donc avant la fiche.

## Tests

```sh
node --test tests/*.test.js
```

Les tests de la Passe 1 restent actifs. Ceux de la Passe 2 vérifient le registre, les correspondances DOM, les hashes, les zones non câblées, la pile d’overlays et l’absence des anciennes tables parallèles.
