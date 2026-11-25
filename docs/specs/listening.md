# Spécification — l'écran d'écoute (lot 2, première partie : l'écran)

Demande du propriétaire, 24 novembre 2026 : « Ils sont où, les versets, le détecteur de
son ? » Le dessin de l'écran est validé (la rosace, D27 et D29, feuille de route « Lot 2 »).
Il n'existe qu'en prototype web, hors du dépôt. Cette spécification le fait entrer dans
l'appli. **Le moteur qui transforme la voix en mots (D5) n'est pas dans ce lot** : l'écran
est construit derrière une interface, avec un moteur simulé, pour que le vrai moteur se
branche ensuite sans toucher à l'écran.

Tout ce document applique [la règle des skills](../design/SKILLS.md) et
[la charte](../design/brand-spec.md) : les lire d'abord.

## Mise à jour du 25 novembre 2026 : les maquettes font foi

Règle du propriétaire : les maquettes validées sont la référence visuelle. L'écran suit
désormais `docs/design/shazam.png` (fond vert et treillis d'étoiles, micro doré dans ses
anneaux, carte blanche du résultat) ; la rosace est retirée, son rythme reste aux ondes du
micro. Les cinq états (écoute, passage reconnu, plusieurs passages, rien trouvé, micro refusé
ou échec) gardent la même scène ; seule la carte change. Le suivi de la voix
(`docs/design/voix.png`) existe en écran d'essai, `/voice-follow?page=294&from=18:10`, avec la
règle du domaine `followRecitation`. Couleurs et tailles : `src/ui/listening-tokens.ts`.
Écarts et questions au propriétaire : `design/SKILLS.md`, écarts 85 à 89.

## Références

- Le dessin validé : `/home/claude/gen/ecoute/styles/site/index.html` (prototype animé,
  clair et sombre) et les images `/home/claude/gen/ecoute/styles/F2-rosace-clair.png`,
  `/home/claude/gen/ecoute/styles/envoi/*.jpg`. Ces fichiers ne sont pas dans le dépôt : les
  lire là où ils sont. Le prototype fait foi pour le dessin et le mouvement ; les couleurs
  viennent de `src/ui/tokens.ts` (les quatre couleurs de l'appli, valeurs claires et
  sombres, D29).
- Ce que la rosace est : l'étoile à huit branches qui marque les quarts de hizb dans le
  mushaf. Deux carrés superposés, huit carrés égaux autour d'une étoile, des pétales qui
  partent à chaque souffle de la voix.
- Les décisions D27, D28 et D29 (`docs/DECISIONS.md`), et la liste « Reste à faire en
  natif » de D29.

## Périmètre

`src/features/listening/**`, la route de l'écran dans `src/app`, l'espace de noms
`listening` (français, anglais, arabe), et `src/domain/listening/**` pour les interfaces et
la machine d'états, s'il en faut une. Rien d'autre.

## 1. Ce que l'écran fait

Un seul geste, un écran entier qui écoute, un résultat qui arrive avec évidence (D27).

- **À l'écoute** (validé) : la rosace au centre, le titre, le bouton « Arrêter ». La
  lumière des lignes et les pétales suivent le niveau de la voix, de 0 à 1. En silence, un
  pétale discret part toutes les deux secondes environ.
- **Passage reconnu** : la sourate, les versets, et l'ouverture du lecteur à la bonne page
  (route du lecteur : `/reader/<page>`, voir `specs/reader.md`).
- **Plusieurs passages possibles** : la recherche ne choisit jamais au hasard
  (`specs/recognition.md`) ; l'écran liste les passages et laisse choisir.
- **Rien trouvé** et **micro refusé** : dire ce qui s'est passé et quoi faire, sans
  reproche (`writing.md`). Le micro refusé renvoie vers les réglages du système.

Seul « À l'écoute » est validé par le propriétaire. Les quatre autres états sont à dessiner
avec les composants du système et à faire passer par la revue de design avant de lui être
montrés (D28).

## 2. Les interfaces

- `SpeechEngine` (déclarée par le domaine) : démarrer, arrêter, et deux flux : le niveau de
  la voix (0 à 1) et les mots reconnus au fil de l'eau. Un état d'autorisation du micro.
- Un **moteur simulé** pour les tests et pour faire vivre l'écran : il rejoue un niveau de
  voix et une suite de mots donnés. Il est nommé comme tel et ne sert jamais dans la
  version publiée.
- La recherche du passage est celle du domaine (`createVerseIndex`, `index.search`) :
  l'écran ne la refait pas.

## 3. Règles de dessin et d'accessibilité (D29)

- Pas de réglage d'apparence : l'écran suit le téléphone, clair ou sombre, avec la valeur
  de nuit de chaque couleur.
- « Augmenter le contraste » : les valeurs prévues par la charte.
- « Réduire les animations » : aucun pétale ne part ni ne grandit ; la voix n'agit que sur
  la lumière des lignes.
- La rosace est un ornement : VoiceOver annonce l'état (« À l'écoute », « Passage
  reconnu : … »), pas le dessin.
- Fluide sur un iPhone X : le dessin se fait avec ce que l'appli embarque déjà
  (`react-native-svg`, `react-native-reanimated`). Toute autre dépendance se demande.

## 4. Ce qui n'est pas dans ce lot

Le vrai micro et le moteur vocal (D5), la lecture suivie mot à mot dans le lecteur, la
bannière en haut de l'écran et l'île dynamique. **Tant que le vrai moteur n'est pas là,
l'écran n'est relié à aucun bouton de l'appli** : une interface ne promet pas ce que
l'appli ne fait pas. Il s'ouvre par sa route, pour les essais.

## 5. Tests et vérification

- Machine d'états : chaque passage d'un état à l'autre, avec le moteur simulé (voix puis
  passage unique ; passage ambigu ; rien de reconnu ; micro refusé ; arrêt).
- Rendu : chaque état, en français et en arabe, en clair et en sombre, avec et sans
  « réduire les animations ».
- `npm run check` ; `npx expo export --platform ios --output-dir <dossier temporaire>`.
- Aucun iPhone ici : la fluidité et l'aspect réel ne sont **pas vérifiés**. Le rapport le
  dit.
