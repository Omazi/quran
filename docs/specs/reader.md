# Spécification — le lecteur du Coran (onglet Coran)

Demande du propriétaire, 24 novembre 2026, après avoir installé la première version : « Il
manque le Coran. » Le texte et la police sont dans l'appli depuis le lot 1 ; il n'y avait pas
d'écran pour les lire.

Tout ce document applique [la règle des skills](../design/SKILLS.md) et
[la charte](../design/brand-spec.md) : les lire d'abord. Référence de parcours et de
composition : `docs/design/mushaf.png` (maquettes « Le jardin, version 2 », validées pour le
parcours et la composition). Couleurs, typographies et espacements : `src/ui/tokens.ts` fait
foi, pas la capture.

## Périmètre

`src/features/reader/**`, `src/app/(tabs)/quran.tsx`, la route du lecteur dans `src/app`,
l'espace de noms `reader` (français, anglais, arabe), et le branchement du bouton « Lire et
arroser » de l'accueil. Rien d'autre. Un manque dans le domaine ou le magasin se signale à
l'architecte ; il ne se contourne pas dans l'écran.

## But

Lire le mushaf page par page, hors ligne, tel qu'il est imprimé. Chaque page lue arrose le
jardin.

## Exigence absolue

Aucun mot affiché ne diffère de ce que fournit `QuranRepository`. Le texte n'est ni
retouché, ni recomposé, ni coupé autrement que par les lignes du mushaf. Il s'affiche avec
la police du Complexe du roi Fahd embarquée (`src/ui/fonts`), jamais avec une police de
repli : tant que la police n'est pas chargée, la page ne s'affiche pas. Une page dont les
données sont incohérentes donne un état d'erreur clair, jamais un texte partiel.

## 1. Onglet Coran : le sommaire

- _Rôle_ : « où est-ce que je reprends, et comment aller à une sourate ? »
- En tête, **Reprendre** : la page de reprise, avec le nom de sa sourate. La page de
  reprise est la dernière page ouverte dans le lecteur ; à défaut, la première page non lue
  de la khatma en cours (`getKhatmProgress`).
- La liste des **114 sourates** : numéro, nom arabe, nom translittéré, mecquoise ou
  médinoise, nombre de versets, page. Un choix **Sourates / Juz** bascule vers les 30 juz
  et leurs hizb. Un champ de recherche du système filtre par nom ou par numéro.
- **Aller à la page** (1 à 604).
- Les noms et les nombres viennent de `QuranStructure`. Aucune liste n'est recopiée dans
  l'écran.

## 2. Le lecteur

- Une page du mushaf par écran : ses 15 lignes, dans l'ordre et avec les coupures de
  l'imprimé, le cartouche de sourate et la basmala là où le mushaf les place. Chaque ligne
  occupe la largeur de la page, comme dans l'imprimé.
- On tourne les pages **dans le sens du livre** : la page suivante est à gauche. Ce sens ne
  change pas avec la langue de l'interface (`right-to-left.md` : le contenu ne se met pas en
  miroir).
- En haut : le nom de la sourate de la page, « Juz n · Hizb n », le numéro de page, le
  retour. Un toucher sur la page masque ou montre ces barres.
- Le fond de la page est le rôle `paper`, clair et sombre ; l'encre est son rôle associé ;
  les ornements utilisent `ornament`. Pas d'ornement dessiné en code au-delà d'un filet :
  un cadre orné demande une image, et il n'y en a pas (D12, charte « Icônes et images »).
- La taille du texte de la page suit la largeur de l'écran, pas le réglage de taille de
  texte : la page est un contenu composé, comme une image. C'est un écart à
  `typography.md › Supporting Dynamic Type`, inscrit au registre (écart 30) : la page s’agrandit par le zoom. Les
  barres et le sommaire, eux, suivent le réglage.
- Seules la page courante et ses voisines sont montées. Les données se chargent par
  tranches, à la demande. Tourner une page doit rester fluide sur un iPhone X.

## 3. Compter une page lue

- Une page compte quand la personne y est restée au moins `minimumSecondsOnPage` secondes,
  appli au premier plan, puis tourne la page ou quitte le lecteur. Valeur de départ :
  **30 secondes**, dans la configuration de la fonctionnalité. **À confirmer par le
  propriétaire.** Feuilleter ne fait rien pousser.
- L'enregistrement passe par le magasin (`recordPageRead`), à la date locale. Relire une
  page déjà lue dans la khatma en cours ne change rien : c'est le domaine qui le décide
  (D8), l'écran ne refait pas ce calcul.
- Retour à la personne : un message bref quand une page vient de compter, et un message qui
  nomme le nouvel élément du jardin quand un hizb se termine (`getGardenFeed`). Texte selon
  `writing.md`. Pas de son. Avec « réduire les animations », le message apparaît sans
  mouvement.
- La lecture suivie à la voix (lot 2) comptera autrement ; cette règle ne vaut que pour la
  lecture des yeux.

## 4. Depuis l'accueil

« Lire et arroser » ouvre le lecteur à la page de reprise.

## 5. États

Chargement d'une tranche de pages ; erreur d'intégrité (message clair, pas de texte) ;
première ouverture (page 1).

## 6. Ce qui n'est pas dans ce lot

Le micro et la lecture suivie (lot 2), l'écriture simple (aucune source établie), les
signets, la traduction, l'audio. Aucun bouton ne les annonce, même désactivé : une interface
ne promet pas ce que l'appli ne fait pas.

## 7. Accessibilité

VoiceOver lit la page dans l'ordre, en arabe (`accessibilityLanguage`). Tout contrôle sans
texte a un libellé. Cibles de 44 points.

## 8. Tests et vérification

- Modèle : page de reprise ; règle des 30 secondes avec une horloge simulée (page
  feuilletée, page lue, appli en arrière-plan, page déjà lue) ; ordre des pages ; bornes 1
  et 604.
- Rendu : sommaire et lecteur, en français et en arabe, en clair et en sombre ; états de
  chargement et d'erreur.
- Exactitude : pour plusieurs pages, dont la 1, la 2, une page avec un début de sourate et
  la 604, le texte rendu est mot pour mot celui du dépôt de données.
- `npm run check` ; `npx expo export --platform ios --output-dir <dossier temporaire>`.
- Aucun simulateur ni iPhone ici : l'aspect réel n'est **pas vérifié** tant que le
  propriétaire n'a pas ouvert l'écran sur son téléphone. Le rapport le dit.
- L'écran passe la revue de design (`docs/TEAM.md`) avant d'être montré au propriétaire.
