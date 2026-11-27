# Spécification — les jardins des niveaux 2 à 7

Décision du propriétaire (D23, D46, 26 novembre 2026) : six vrais jardins, un par niveau, chacun
d'un style et d'un aménagement totalement différents, le même pour tout le monde : oasis (2),
verger au bord de l'eau (3), jardin de montagne (4), cerisiers en fleurs (5), pinède et
clairière (6), jardin de nuit (7). Le niveau 1 (cour à fontaine) ne change pas.

## Ce que chaque jardin respecte

- **Les 60 étapes du catalogue** (`src/domain/garden/catalog.ts`), dans le même ordre, avec les
  mêmes identifiants et les mêmes types : ce que l'appli dit d'une étape (« Les canaux », « Un
  grenadier ») reste vrai à l'écran, chaque style le dessine à sa façon (les « canaux » de l'oasis
  sont sa source et son bassin ; ceux du verger, sa rivière). L'eau d'abord, puis les allées et le
  sol, les plantes, et les points forts à la fin (pavillon, cascade, pleine floraison).
- Oiseaux (3 étapes) et papillons : aucun modèle dans les packs, comme au niveau 1 : ces quatre
  étapes ne montrent rien. Les noms des arbres suivent le catalogue (le cycle des espèces), pas
  leur dessin : un « grenadier » du jardin de cerisiers est un cerisier (comme au niveau 1, où
  la variante décale déjà les espèces). À trancher par le propriétaire.
- Même caméra isométrique, même cadre (1170 × 816), même lumière que le niveau 1 ; le jardin de
  nuit a sa propre lumière (lune), lue dans le fichier, et des matières qui luisent (lanternes,
  fleurs blanches, lumière au sol).
- Mêmes mécaniques : pousse page par page (tronc et feuillage séparés), sécheresse (l'eau baisse
  puis disparaît, les pelouses jaunissent, les arbres perdent leurs feuilles, les éléments
  s'effacent), reprise, fondu des bords et zoom, images de repli (sec par étape et par
  feuillage, eau en calque, éléments découpés pour la pousse).

## Outils

`tools/garden-3d/levels/make_levels.py` (les six aménagements) → `bake.py --level N` (le GLB) →
`render.py set --level N` (les images, dessinées par la scène 3D de l'appli elle-même) →
`tools/garden-pictures/growth-sprites.py --level N` (les éléments découpés) → `pack.mjs` (un paquet
par niveau et le manifeste). `render.py check --level N` fait une planche à regarder.

## Téléchargement à la demande

Avec leurs images, les six jardins pèsent environ 100 Mo : ils ne sont pas dans l'appli. Le paquet
d'un niveau (`level-N.gardenpack` : GLB, images, découpes, mention des licences) est téléchargé la
première fois qu'un écran montre ce jardin (l'accueil au niveau atteint, la célébration, « Mes
jardins », le jardin d'un proche dont le niveau est visible), depuis la branche `garden-art` du
dépôt du propriétaire (comme le modèle de voix, D42). Il est vérifié (taille et SHA-256 du
manifeste `src/data/garden-art/garden-art.json`) avant d'être dépaqueté dans les documents de
l'appli, puis gardé. Tant qu'il n'est pas là (téléchargement, hors ligne, copie refusée), l'image du
niveau 1 avec la teinte du style reste, comme avant. Un proche qui cache son niveau montre le
jardin du niveau 1 : le style dirait le niveau.

**Pas vérifié** : le téléchargement sur un iPhone (aucun iPhone ici, D24), et l'adresse elle-même
tant que la branche `garden-art` n'est pas poussée par le propriétaire.
