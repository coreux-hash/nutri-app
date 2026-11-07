# NutriApp v17 — parcours d'import simplifié (2026-11-05)

## Problème
Deux portes d'entrée (« Recevoir des cartes » / « Sauvegarde technique ») pour charger un JSON ; la mauvaise porte refusait sans rediriger.
Parcours en 3 étapes, bouton final perdu sous 250 Ko de JSON brut, aperçu en double.

## Changements (UI uniquement — moteur d'import, contrats et calculs inchangés)
- Page Échanges : bouton principal **Importer un fichier** (`btnSystemImportFile`). Il lit `meta.schema` :
  `exchange.*` → Recevoir des cartes ; `backup.*` ou trois bibliothèques à la racine → Sauvegarde technique.
  Boutons secondaires : « Coller un paquet » (`btnOpenExchangeImport`, ouvre la zone JSON) et « Sauvegarde technique ».
- Recevoir des cartes : « Charger un fichier » mis en avant ; zone JSON + « Valider le JSON collé » repliées dans `#exchangeJsonDetails` ;
  aperçu sans titre/message/compteurs en double ; puces limitées à 12 (+ N autres) ;
  bouton « Ajouter N cartes à ma bibliothèque » dans un pied de fenêtre collant.
- Garde-fous croisés : paquet de cartes chargé dans la Sauvegarde → message + bouton de transfert ; sauvegarde chargée dans Recevoir → idem en sens inverse.
- Correctif mobile : le plafond générique `.createBody{max-height:calc(100dvh - 170px)}` laissait ~90 px vides sous le pied de fenêtre (défaut déjà présent en v16).

## Fichiers modifiés
- `index.html`
- `assets/js/features/shared/02-card-exchange.js`
- `assets/js/core/02-modal-and-form-runtime.js`
- `assets/css/ui/shared/10-exchange-import-flow.css` (nouveau, chargé en dernier)
- `tests/pass5-import-flow.test.js` (nouveau)

## Vérifications
- `node --check` sur les 2 JS modifiés : OK
- `node --test tests/*.test.js` : 52/52 (48 existants + 4 nouveaux)
- `manifest.webmanifest` et `sw.js` : inchangés (sha256 testés)
- Ressources CSS/JS référencées par `index.html` : toutes présentes
- Parcours rejoués dans Chrome headless (1280 px et 390 px) : import d'un paquet de 250 cartes via le bouton unique,
  routage d'une sauvegarde backup.v3, transfert Sauvegarde → Recevoir, refus d'un paquet incomplet, JSON illisible, mode « Coller ».

## Limites
- QA visuelle faite en Chrome headless uniquement ; à confirmer sur ton navigateur et ton téléphone.
- La fenêtre « Créer un paquet » (partage) a probablement le même plafond mobile : non modifiée ici.

## v17.1 — vignettes ingrédient invisibles (2026-11-05)
- Symptôme : image chargée et enregistrée, mais la carte garde le monogramme (ex. « T5 ») ; seul le ✕ apparaît.
- Causes : `07-card-requalified.css` force `.thumbPlaceholder` visible malgré `.hidden` ; le cadre `.thumb` (grille à colonne auto) retombe à 0 px quand l'image est seule.
- Correctif : `assets/css/ui/ingredients/06-ingredient-thumb-visible-fix.css` (nouveau, chargé après 10), lien ajouté dans `index.html`, test ajouté dans `tests/pass5-import-flow.test.js`.
- Vérifié : 53/53 tests ; affichage contrôlé en Chrome headless 1280 px et 390 px (2 cartes avec image, 1 sans).

## v17.2 — « Archiver dans un fichier » (2026-11-05)
Échanges → **Archiver des ingrédients**. Sort une sélection d'ingrédients vers un paquet `exchange.v1` téléchargé, puis les retire de l'app pour libérer du stockage.
- Recherche, filtre par catégorie, « Tout cocher (liste affichée) », taille estimée par ingrédient et des données de l'app.
- Verrou : un ingrédient utilisé dans une recette (`rows[].ingredientId`) ou un menu (`lines[kind=ingredient].sourceId`) n'est pas cochable.
- Sécurité : « 2. Retirer de l'app » n'est actif qu'après « 1. Télécharger l'archive » pour la même sélection ; confirmation avant retrait.
- Retrait via `NutriAppData.deleteIngredientsByIds` (nouveau, même chemin que la suppression unitaire) : seule la clé ingrédients est réécrite ; recettes et menus vérifiés identiques octet par octet.
- Réimport : Échanges → « Importer un fichier » (ajout en copie, images conservées).
- Fichiers : `assets/js/features/shared/03-archive-to-file.js` (nouveau), `assets/css/ui/shared/11-archive-to-file.css` (nouveau), `index.html`, `assets/js/core/05-navigation-and-overlays.js` (+1 entrée overlay), `assets/js/features/ingredients/03-storage-and-backup.js` (+1 méthode), `tests/pass6-archive-to-file.test.js` (nouveau).
- Vérifié : 57/57 tests ; parcours complet rejoué en Chrome headless 1280 px et 390 px (verrous, téléchargement, invalidation si la sélection change, retrait, compteur, Échap, réimport).
- Limite : la taille affichée est une estimation (nombre de caractères stockés), pas la mesure exacte du quota du navigateur.
- Étape suivante prévue (option A) : statut « archivé » dans l'app.

## v17.3 — image d'ingrédient pleine dans l'encart (2026-11-05)
- L'image remplit l'encart (marge de 4 px), entière et sans recadrage, coins arrondis ; la bordure du cadre et la barre de catégorie restent visibles.
- Les cartes sans image gardent le monogramme (règles limitées aux cartes dont l'image est affichée, via `:has()`).
- Fichier : `assets/css/ui/ingredients/06-ingredient-thumb-visible-fix.css`.
- Navigateurs : `:has()` requiert Chrome/Edge 105+, Safari 15.4+, Firefox 121+ ; sur un navigateur plus ancien, l'affichage reste celui de la v17.1.

## v17.4 — catégorie « Charcuterie & salaisons » (2026-11-05)
- Nouvelle catégorie d'ingrédient `charcuterie_salaisons` (« Charcuterie & salaisons »), placée après « Viande & volaille ».
- Déclarée dans les deux listes (`assets/js/domain/01-recipe-domains.js`, `assets/js/features/ingredients/01-create-modal-and-categories.js`), avec alias de libellés (charcuterie, salaisons…).
- Couleur de carte (`02-cards-filters-manual.js`) et pastille (`03-store-runtime.js`) : teinte rose « jambon », distincte du rouge viande.
- Les ingrédients existants ne sont pas déplacés automatiquement. Paquet Carrefour fourni avec les 90 produits du rayon charcuterie reclassés.
- Test : `tests/pass7-category-charcuterie.test.js`. Vérifié : 59/59 ; import du paquet reclassé et rendu des cartes en Chrome headless.

## v17.5 — taxonomie des ingrédients en 20 catégories, par rôle culinaire (2026-11-05)
Ordre : cereales_feculents, legumes, fruits, viandes_volailles, charcuterie_salaisons, poissons, fruits_de_mer, oeufs,
proteines_vegetales, fromages, produits_laitiers, matieres_grasses, fruits_coque_graines, sucrants, tartinables_confitures,
aides_techniques, epices_aromes, condiments_sauces, liquides_boissons, autre.
- Créées : `fromages`, `fruits_coque_graines`, `tartinables_confitures`, `condiments_sauces`.
- Renommée (libellé seulement, identifiant inchangé) : `matieres_grasses` → « Matières grasses ». L'ancien libellé reste reconnu à l'import.
- Règles d'arbitrage : chocolat pâtissier / pépites / pralin / vermicelles → sucrants ; préparations toutes faites → autre ;
  vendu comme un fromage → fromages, mangé comme un yaourt (fromage blanc, quark, skyr) → produits_laitiers ;
  beurre de cacahuète → fruits_coque_graines (ingrédient de base, pas l'usage).
- Aucune carte existante n'est déplacée automatiquement.
- Fichiers : les deux listes, `02-cards-filters-manual.js` (couleurs), `03-store-runtime.js` (pastilles), `tests/pass7-category-charcuterie.test.js`. Vérifié : 60/60.

## v17.6 — compteurs du hero après restauration et conversion (2026-11-06)
- Bug : après Sauvegarde technique → « Remplacer » ou « Fusionner », le compteur « Ingrédients » du hero restait sur l'ancien chiffre jusqu'au rechargement.
  Cause : `refreshAfterBackupImport` reconstruisait la grille à la main sans passer par `applyIngredientFilters` (qui tient le compteur, l'état vide et les filtres).
  Correctif : `03-storage-and-backup.js` appelle `applyIngredientFilters` ; la reconstruction manuelle ne sert plus qu'en secours.
- Bug : « Créer comme ingrédient » depuis une recette ajoutait l'ingrédient sans rafraîchir la page Ingrédients (compteur et grille).
  Cause : l'événement `na:ingredientsChanged` était émis mais personne ne l'écoutait. Correctif : écouteur dans `02-cards-filters-manual.js`.
- Compteur « Recettes » vérifié sans défaut : restauration remplacer/fusionner, dupliquer, supprimer, import d'un paquet d'échange recette + ingrédient, rechargement sur chaque page.
- Test : `tests/pass8-hero-counters.test.js`. Vérifié : 62/62 ; parcours rejoués en Chrome headless.

## v17.7 — archivage : plus de retrait « silencieux » (2026-11-06)
- Constat utilisateur : archive téléchargée, puis « 2. Retirer de l'app » sans effet visible. Le parcours, rejoué en Chrome headless avec les 17 ingrédients de l'utilisateur, retire bien les 16 cartes quand la confirmation est acceptée.
- Deux cas finissaient sans message : confirmation refusée ou boîtes de dialogue bloquées par le navigateur (`confirm()` renvoie false), et fonction de retrait absente (ancienne version d'un fichier JS servie par le cache du service worker, stratégie cache d'abord).
- Correctif : `03-archive-to-file.js` affiche un message explicite dans les deux cas. Aucune donnée n'est modifiée dans ces cas.
- Test : ajout dans `tests/pass8-hero-counters.test.js`. Vérifié : 63/63 ; retrait accepté et refusé rejoués en Chrome headless.

## v18 — images rangées hors de localStorage (IndexedDB) (2026-11-07)
Problème : localStorage est plafonné à ~5 Mo par origine ; les vignettes en occupaient ~90 % (bibliothèque de 473 fiches ≈ 3,2 Mo).
- Nouveau `assets/js/core/00-image-store.js`, seul script chargé normalement par `index.html` ; les 30 scripts de l'app sont
  déclarés en `type="text/x-nutriapp"` (même ordre) et exécutés par ce module une fois les images chargées.
- À l'écriture des clés `nutriapp.ingredients.v2` (champ `thumb`) et `nutriapp.recipes.v2` (champ `thumbDataUrl`), chaque
  data URL est rangée dans IndexedDB (base `nutriapp-images`, identifiant dérivé du contenu : une photo partagée n'est stockée
  qu'une fois) et remplacée dans localStorage par `nutriimg:<id>`. À la lecture, les références sont remplacées par les images.
- Transparent pour le reste du code : contrats, sauvegardes backup.v3, paquets exchange.v1 et archives contiennent toujours
  les images complètes ; les imports s'écrivent automatiquement dans le nouveau format.
- Migration au premier lancement : images écrites dans IndexedDB AVANT la réécriture de localStorage.
- Nettoyage : une image qui n'est plus référencée par aucune fiche est supprimée d'IndexedDB (2 s après l'écriture).
- Repli : IndexedDB absent ou muet (délai 4 s) → démarrage comme en v17, images dans localStorage. Référence sans image → conservée.
- DOMContentLoaded / load posés pendant le chargement sont rejoués après le dernier script (enregistrement du service worker inclus).
- Fenêtre Archiver : affiche l'occupation réelle de localStorage et, à part, le nombre et le poids des images.
- Limites connues : une écriture IndexedDB est asynchrone ; une fermeture brutale de l'onglet dans les millisecondes qui suivent un
  ajout d'image pourrait perdre cette image (la fiche reste). Les images restent propres à chaque navigateur, comme avant.
- Tests : `tests/pass9-image-store.test.js` (68/68). Chrome headless : migration 473 fiches (localStorage 3,19 M → 0,36 M caractères,
  423 images uniques), 1 500 fiches à images distinctes (11,2 M caractères) importées et relues, export complet, nettoyage,
  repli sans IndexedDB, référence orpheline ; parcours v17 (compteurs, archivage, restauration desktop/mobile, 12 paquets) inchangés.
