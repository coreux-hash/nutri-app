# NutriApp — variantes graphiques des cartes Top Trumps

## Diagnostic de la grammaire actuelle — 5 lignes

1. La carte ingrédient est une carte verticale à ratio `5 / 7`, structurée en rail d’usage, hero, identité, quatre KPI fixes et catégorie.
2. La carte recette transpose la même séquence dans une composition horizontale `46 / 54`, avec média à gauche et contenu à droite.
3. L’identité catégorie repose actuellement surtout sur une bordure épaisse de 8–10 px ; c’est le signe le plus éloigné de la finesse du create modal.
4. Les KPI sont déjà cousins par leurs hooks et leur typographie, mais restent perçus comme quatre mini-cartes indépendantes.
5. Le create modal et les fiches reposent au contraire sur du papier crème, des champs en creux, des filets de 1 px, des rayons réguliers et des ombres multi-couches.

## Sélecteurs et contraintes vérifiés

- Ingrédient : `.card.libCardShell.ingredient-card`, `.card-frame`, `.top-rail.libCardTop`, `.thumb.libCardMedia`, `.macro.kpiRow.libCardStats`, `.badge.bottom-ribbon`.
- Recette : `.recipeCard.libCardShell`, `.recipeOpenHit.libCardOpenHit`, `.recipeMain.libCardBody`, `.thumb.libCardMedia.recipeCardMedia`, `.macro.kpiRow.libCardStats`, `.catPill[data-cat]`.
- Variables runtime : `--cat` / `--cat-deep` pour l’ingrédient ; `--cat-main` / `--cat-deep` pour la recette.
- La recette n’a pas de `container-type` : aucune variante n’emploie `cqw` dans les règles partagées.
- Les sélecteurs des KPI recette dépassent volontairement la spécificité du verrou tardif situé dans `01-recipes-page-scoped.css`.

---

## Variante 01 — Registre éditorial

### A — Nom + intention

Une carte calme et éditoriale, presque imprimée.  
Elle transforme la rangée macro en un seul registre segmenté : c’est la rupture principale.

### B — Le pari graphique

La bordure catégorie épaisse disparaît au profit d’un filet supérieur de 3 px. Les quatre KPI perdent leur silhouette individuelle et deviennent quatre colonnes d’un même panneau en creux. Le hero reste crème et la catégorie finale devient un cartouche fin.

### C — Filiation avec le create modal

- filets de 1 px et surfaces crème plutôt que cadres saturés ;
- panneau macro unique en creux, comparable à un groupe de champs ;
- ombre douce à trois couches et rayons issus des tokens `core`.

### D — CSS complet

Fichier autonome : `assets/css/ui/shared/08-card-skin-01-registre.css`.

### E — Vérification de contraste

Le texte des KPI et de la catégorie utilise `#1F2A24`. Les fonds les plus teintés restent très clairs. Les ratios mesurés figurent dans le tableau commun plus bas ; le minimum de cette variante est **12,04:1** sur les cinq catégories testées.

### F — Risques et limites

- Le registre fusionné donne volontairement moins d’autonomie visuelle à chaque macro.
- Un nom très long reste tronqué par les règles existantes ; aucune ligne supplémentaire n’est créée.
- Sous 390 px, les libellés deviennent petits, mais les valeurs à quatre caractères restent visibles.

### G — Retour arrière

Supprimer la ligne `<link>` de cette variante, ou remplacer son `href` par celui d’une autre variante.

---

## Variante 02 — Fenêtre chromatique

### A — Nom + intention

La plus sensuelle des trois : la couleur catégorie est concentrée dans le hero.  
Le reste de la carte devient presque achrome afin que le média joue le rôle de fenêtre.

### B — Le pari graphique

La coque devient neutre ; le hero reçoit une teinte catégorie à 18 %, un filet teinté et une lumière radiale. Les KPI restent quatre champs séparés en creux. La pill reprend une teinte plus présente, sans devenir un bandeau saturé.

### C — Filiation avec le create modal

- champs individuels en creux proches des cartes de choix du formulaire ;
- surface générale crème et bordures légères ;
- profondeur obtenue par plusieurs ombres internes et externes discrètes.

### D — CSS complet

Fichier autonome : `assets/css/ui/shared/08-card-skin-02-fenetre.css`.

### E — Vérification de contraste

Le minimum mesuré sur les cinq catégories testées est **11,21:1**. Même une couleur personnalisée noire, mélangée à 15 % dans la pill, conserve **9,89:1** avec l’encre utilisée.

### F — Risques et limites

- Une image déjà très colorée réduira la perception de la teinte de fond du hero.
- C’est la variante la moins radicale dans la rangée macro : la rupture se concentre volontairement sur le média.
- Sur un écran très étroit, les quatre champs imposent des labels compacts.

### G — Retour arrière

Supprimer la ligne `<link>` de cette variante, ou remplacer son `href`.

---

## Variante 03 — Index latéral

### A — Nom + intention

La plus identitaire : la carte devient une fiche classée par une tranche colorée.  
La catégorie n’encadre plus la carte ; elle l’indexe.

### B — Le pari graphique

Une tranche de 7 px à gauche remplace la bordure périphérique. Le hero reçoit un rappel interne de cette tranche, les KPI deviennent des cellules techniques à filet supérieur et la catégorie finale prend la forme d’une petite étiquette d’archive alignée à gauche.

### C — Filiation avec le create modal

- papier crème, panneaux à filet fin et ombres multi-couches ;
- rayons plus techniques mais cohérents, répétés sur le hero, les KPI et les réceptacles ;
- couleur limitée à des signes fonctionnels : tranche, filet, étiquette.

### D — CSS complet

Fichier autonome : `assets/css/ui/shared/08-card-skin-03-index.css`.

### E — Vérification de contraste

Le fond des KPI reste quasi blanc et atteint **14,84:1**. La pill reste entre **12,08:1** et **13,19:1** sur les catégories testées.

### F — Risques et limites

- La recette perd 6 px de largeur utile à cause de la tranche ; le test à 390 px ne montre cependant aucun débordement.
- Une catégorie très longue est ramenée à la largeur disponible et conserve l’ellipse existante.
- Cette direction est plus “outil de classement” que “carte de collection” ; c’est un choix assumé.

### G — Retour arrière

Supprimer la ligne `<link>` `08-card-skin-03-index.css`. C’est la variante activée par défaut dans le fichier `index.html` livré.

---

## Contrastes calculés

Méthode WCAG : luminance relative sRGB, puis `(Lclair + 0,05) / (Lfoncé + 0,05)`.  
Seuil AA du texte normal : **4,5:1**. Toutes les valeurs ci-dessous utilisent l’encre réelle `#1F2A24`.

| Catégorie réelle | Couleur | V1 macro | V1 pill | V2 macro | V2 pill | V3 macro | V3 pill |
|---|---:|---:|---:|---:|---:|---:|---:|
| Aides techniques | `#6A6866` | 12,18 | 12,46 | 11,63 | 11,50 | 14,84 | 12,30 |
| Céréales / féculents | `#DDB545` | 12,80 | 13,27 | 12,32 | 12,81 | 14,84 | 13,19 |
| Fruits | `#D36F45` | 12,39 | 12,72 | 11,86 | 11,93 | 14,84 | 12,59 |
| Poissons | `#17779E` | 12,16 | 12,43 | 11,61 | 11,47 | 14,84 | 12,27 |
| Viandes / volailles | `#B93B27` | 12,04 | 12,27 | 11,47 | 11,21 | 14,84 | 12,08 |

## Vérifications d’exécution

- CSS analysé sans erreur pour les trois fichiers.
- Rendu Chromium contrôlé à `1280 × 900` et `390 × 844`.
- Largeur de défilement égale à la largeur client pour les deux familles : aucun débordement horizontal.
- Hauteur de défilement égale à la hauteur client pour les deux familles : aucun débordement de carte.
- KPI fixes et identiques entre familles : `66 px` sur desktop, `56 px` sous 580 px.
- Cas testés : titre recette long, nom ingrédient long, valeur macro décimale à quatre caractères et pill compacte.

## H — Recommandation

Je retiendrais **Index latéral**.

Ce n’est pas la variante la plus décorative, mais c’est celle qui résout le mieux le problème de fond : la catégorie reste immédiatement reconnaissable sans enfermer toute la carte dans un cadre coloré épais. Elle crée une silhouette neuve, commune aux ingrédients et aux recettes, tout en reprenant réellement la discipline du create modal — papier, filets, champs réguliers, profondeur calme. Elle est aussi la seule des trois dont l’identité reste forte quand le hero contient une vraie photo.

`Registre éditorial` est le meilleur second choix si la priorité absolue devient la densité et la lecture nutritionnelle. `Fenêtre chromatique` est la plus séduisante avec des placeholders, mais son effet dépend davantage de la nature des images importées.
