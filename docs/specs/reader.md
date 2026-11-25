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

Lire le Coran hors ligne, **en défilement vertical continu**, dans l'une des deux écritures
(uthmani ou simple). Chaque page du mushaf lue arrose le jardin. Décision du propriétaire du
25 novembre 2026 (D41) : le Coran ne s'affiche plus comme un livre (pas de pages qu'on tourne,
pas de cadre doré).

## Exigence absolue

Aucun mot affiché ne diffère de ce que fournit `QuranRepository`, dans l'écriture choisie. Le
texte n'est ni retouché, ni recomposé, ni coupé : chaque verset est donné tel quel, suivi de sa
marque de fin. Il s'affiche avec la police de son écriture (`KFGQPC HAFS Uthmanic Script` pour
l'uthmani, Amiri Regular pour l'écriture simple), jamais avec une police de repli : tant que la
police n'est pas chargée, le texte ne s'affiche pas. Une page dont les données sont incohérentes
donne un état d'erreur clair, jamais un texte partiel.

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

- **Un seul défilement vertical** du texte, de la page 1 à la page 604. Les versets se suivent
  en paragraphes justifiés, de droite à gauche, chacun suivi de sa marque de fin : en uthmani,
  le numéro en chiffres arabes que la police du Complexe dessine en rosace (comme l'imprimé) ;
  en écriture simple, le numéro entre les deux parenthèses ornées d'Unicode (﴿ ﴾). Entre le
  verset et sa marque, l'espace insécable de l'éditeur : une marque ne commence jamais une ligne.
- **Une section par page du mushaf** : dans l'édition de l'appli, une page commence toujours par
  un nouveau verset (vérifié pour les 604 pages), donc une section contient exactement les
  versets de sa page. Elle finit par le numéro de la page entre deux filets dorés. Le compte des
  pages (khatma, jardin, hizb, statistiques) reste celui des 604 pages.
- Où une sourate commence : le **cartouche** de la maquette (filet doré, deux médaillons, nom au
  centre, nombre de versets et lieu de révélation aux extrémités), puis la **basmala** (le texte
  de 1:1 dans l'écriture choisie), sauf pour Al-Fatiha (dont le premier verset est la basmala) et
  At-Tawba.
- **En haut**, la barre de la maquette : retour, puis le nom de la sourate et « Juz n, Hizb n ·
  Page n » de ce qu'on lit, marque-page. « Ce qu'on lit » : la section sous la **ligne de
  lecture**, au tiers de la hauteur du texte (`readingLineRatio`). La barre change en défilant.
- **En bas**, la barre de la maquette : le choix **« Uthmani | Simple »** au début, le grand
  **micro** vert au milieu, et à la fin la **taille du texte** (plus petit, plus grand).
- Un toucher sur le texte masque ou montre les deux barres ; leur place reste, le texte ne saute
  pas. VoiceOver garde les barres.
- **Taille du texte** : elle suit le réglage de taille de texte du téléphone (Dynamic Type, rampe
  Title 1), multiplié par le réglage du lecteur (5 crans, 0,85 à 1,65, mémorisé). Le zoom au
  pincement de l'ancienne page n'existe plus (écart 34 retiré). Au-delà du facteur 1,2, les
  versets sont alignés à droite au lieu d'être justifiés : avec quatre ou cinq mots par ligne,
  l'arabe justifié sans kashida ouvre de grands blancs.
- **Écriture** : uthmani (texte et police du Complexe, D19, D21) ou simple (texte imlâ'î du
  Complexe, sans voyelles, D41). Le choix est mémorisé (`settings.readerScript`, document
  version 6).
- **Reprise** : la page en lecture est la page de reprise (`lastOpenedPage`) ; le lecteur rouvre
  avec cette page en haut. La reprise est à la page, pas au verset.
- **Performance** : liste virtualisée (`FlatList`) des 604 sections, hauteurs variables mesurées.
  Elle s'ouvre sur la page demandée et ajoute les pages au-dessus à la demande
  (`READER_CONFIG.list`) : on ne mesure jamais les pages qu'on n'a pas dessinées. Sur téléphone,
  `maintainVisibleContentPosition` garde la place quand des pages s'ajoutent au-dessus ; sur le
  web, la position est corrigée de la hauteur ajoutée. Le texte d'une écriture est un seul
  fichier, chargé une fois (D3).

## 3. Compter une page lue

Décisions du propriétaire du 25 novembre 2026 (D41 et sa suite).

- **Le temps demandé suit la page** : 0,2 seconde par mot de cette page du mushaf (ses versets
  dans le texte uthmani), jamais moins de 8 secondes (`READER_CONFIG.readingTime`, règle
  `requiredReadingSeconds` du module khatma). Page médiane (129 mots) : environ 26 secondes ;
  la plus longue (161 mots) : environ 32 ; pages 1, 2 et 604 : le minimum ou à peine plus.
- Une page compte quand sa section :
  1. a été à l'écran, appli au premier plan, le temps qu'elle demande, **en tout**. Le temps
     **s'additionne d'un passage à l'autre** : défiler plus loin puis revenir, quitter le
     lecteur puis revenir. Le temps entre deux passages ne compte jamais. Entre deux
     observations, le temps est partagé entre les sections visibles selon la place que chacune
     occupe : deux pages à l'écran ne se lisent pas deux fois plus vite ;
  2. a eu sa première et sa dernière ligne à l'écran : ses versets ont été vus ;
  3. et rien ne compte pendant qu'on lance le texte (`flingScreensPerSecond`, 1,5 écran par
     seconde) : seul compte le temps où la section est visible et le défilement lent ou arrêté.
- Le temps d'une page qui n'a pas encore compté est gardé **tant que l'appli tourne**
  (`reading-memory.ts`), pas sur l'appareil : redémarrer l'appli le remet à zéro.
- La règle est observée à chaque défilement et chaque seconde : une page lue sans défiler compte
  quand son temps est atteint, et la pastille le dit tout de suite. Une page dont le temps est
  atteint compte aussi quand l'appli passe en arrière-plan (iOS peut la fermer sans prévenir) et
  quand on quitte le lecteur.
- **Une seule fois** : une page qui a compté n'est plus enregistrée dans la séance, et relire une
  page déjà lue dans la khatma en cours ne change rien : c'est le domaine qui le décide (D8).
- **La ligne d'eau** : sous le titre, dans la rangée de la pastille, une fine ligne d'eau se
  remplit pendant que la page en lecture accumule son temps ; quand le temps est atteint, une
  petite goutte se pose au bout : « cette page comptera » (il reste à voir sa dernière ligne).
  Absente pour une page déjà lue dans la khatma. Elle laisse la place à la pastille quand la page
  compte. Avec « réduire les animations », elle avance par trois paliers fixes. Elle ne déplace
  jamais le texte et VoiceOver ne l'entend pas : la pastille annonce, une fois, qu'une page a
  compté.
- Retour à la personne : la pastille d'eau sous le titre, qui nomme ce qui pousse
  (`getGardenFeed`, `GardenState.nextElement`), ou le nouvel élément quand un hizb se termine.
  Texte selon `writing.md`. Pas de son. Avec « réduire les animations », elle apparaît sans
  mouvement. Elle ne recouvre jamais le texte (écarts 64, 66, 84).
- **L'écran reste allumé** tant que le lecteur est ouvert et l'appli au premier plan
  (`expo-keep-awake`, licence MIT) ; il est rendu à la veille du système en arrière-plan et en
  quittant le lecteur.
- Seuils (temps par mot, minimum, vitesse) : **à confirmer par le propriétaire** sur un iPhone.
- La lecture suivie à la voix comptera autrement ; cette règle ne vaut que pour la lecture des
  yeux.

## 4. Depuis l'accueil

« Lire et arroser » ouvre le lecteur à la page de reprise.

## 5. États

Chargement du texte de l'écriture ; police absente (message clair, lien vers le sommaire) ;
erreur d'intégrité (message clair, pas de texte) ; première ouverture (page 1).

## 6. Ce qui n'est pas dans ce lot

La traduction, l'audio, les actions sur un verset (toucher un verset pour le copier, le
partager, l'écouter), la reprise au verset près. Aucun bouton ne les annonce, même désactivé :
une interface ne promet pas ce que l'appli ne fait pas.

## 7. Accessibilité

VoiceOver lit chaque paragraphe en arabe (`accessibilityLanguage`), le cartouche comme un titre
(« سورة الكهف، مكية، آياتها ١١٠ »), la fin de page comme « Fin de la page 293 ». Le choix
d'écriture est un groupe de boutons radio ; la taille du texte dit sa valeur (« Taille 2 sur
5 ») et ses boutons sont désactivés au bout de l'échelle. Tout contrôle sans texte a un libellé.
Cibles de 44 points, 12 points entre les deux boutons de taille.

## 8. Tests et vérification

- Modèle (`scroll-model.test.ts`) : les 604 sections couvrent les 6 236 versets une fois, chacune
  sa page ; le texte de chaque verset est celui du dépôt, dans les deux écritures, pour les 604
  pages ; cartouche et basmala aux bons endroits ; ligne de lecture ; règle des 30 secondes avec
  horloge simulée (page lue, page jamais vue jusqu'au bout, page trop brève, pages lancées,
  temps partagé, arrière-plan, une fois par séance, temps additionné d'un passage et d'une
  séance à l'autre, temps propre à chaque page, horloge qui recule) ; mots de chaque page ;
  règle du temps par mot (module khatma).
- Écran (`reader-screen.test.tsx`), à travers le vrai magasin : liste verticale virtualisée qui
  s'ouvre sur la page demandée et grandit vers le haut ; texte exact (pages 1, 293, 604 en
  uthmani, 293 en simple) ; page comptée, lancée, jamais vue, en arrière-plan (sans compter,
  et comptée en partant), déjà lue, en quittant, temps additionné en quittant puis revenant, fin
  de hizb ; ligne d'eau (remplissage, goutte, absente pour une page lue, paliers avec « réduire
  les animations ») ; écran gardé allumé ; barre qui suit la lecture ; marque-page ; choix d'écriture mémorisé ;
  taille du texte ; pastille ; états.
- Parcours complet (`reading-progress-routes.test.tsx`) : le premier hizb lu dans le lecteur,
  page après page pendant le temps que chacune demande, se voit sur l'accueil et le profil, et
  après un redémarrage ; des pages défilées trop vite ne comptent pas.
- Données : `npm run data:verify` (le texte simple est la colonne de l'éditeur, caractère pour
  caractère) ; empreinte du texte simple vérifiée par les tests.
- `npm run check` ; `npx expo export --platform ios`.
- Captures web 393 × 852 (clair, sombre, français, arabe) : aucun simulateur ni iPhone ici.
  L'aspect réel, le défilement sur un iPhone X et la justification de l'arabe par iOS ne sont
  **pas vérifiés** tant que le propriétaire n'a pas ouvert l'écran sur son téléphone.

## 9. Comparaison avec les lecteurs en défilement continu

Demande du propriétaire (25 novembre 2026) : « ça doit ressembler à ce que je t'avais proposé
comme site. Regarde Quran 360, comment ils ont fait. Regarde les autres sites. » Ce qui a pu être
regardé, et comment :

| Point              | quran.com, mode Lecture (code source lu)                                                                                      | quran.com, mode Traduction                | Jannatuk (D41)                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| Unité de la liste  | Une page du mushaf par élément, liste virtualisée (react-virtuoso), 1 200 px dessinés au-delà de l'écran                      | Un verset par cellule                     | Une page du mushaf par élément, `FlatList`, 7 écrans gardés                      |
| Texte              | Lignes du mushaf ; sur mobile, les mots passent « en ligne » et le texte coule, centré                                        | Arabe puis traduction, un bloc par verset | Paragraphe justifié par sourate, qui coule ; aligné à droite aux grandes tailles |
| Fin de page        | Numéro de page petit et estompé, centré, puis un filet entre deux pages                                                       | —                                         | Numéro de page entre deux filets dorés                                           |
| En-tête de sourate | Nom translittéré et traduit, puis la basmala ; boutons « écouter » et mode au-dessus                                          | Idem                                      | Cartouche de la maquette (nom arabe, versets, lieu), puis la basmala             |
| Marque de verset   | Glyphe de la police du mushaf                                                                                                 | Numéro du verset dans la cellule          | Rosace de la police du Complexe ; ﴿ ﴾ en écriture simple                         |
| Barre en défilant  | Barre de contexte : sourate, Juz, Hizb, Page, barre de progression                                                            | Idem                                      | Barre de la maquette : sourate, « Juz, Hizb · Page », marque-page                |
| Position suivie    | IntersectionObserver sur les versets dans une bande sous la barre (jusqu'à 70 % de l'écran) ; enregistre le dernier verset lu | Idem                                      | Section sous la ligne de lecture (tiers de l'écran) ; reprise à la page          |
| Changer de mode    | Choix « Lecture / Traduction » en haut de la sourate                                                                          | Idem                                      | Choix « Uthmani / Simple » dans la barre du bas, comme la maquette               |
| Taille             | Échelle de taille du texte coranique dans les réglages                                                                        | Idem                                      | Dynamic Type × 5 crans dans la barre du bas                                      |

Ce qui n'a **pas** pu être regardé : Quran 360 (appli seulement ; la fiche App Store et Google
Play, trouvées par la recherche, sont bloquées par le proxy de l'environnement), Tarteel et
quran.com en direct (sites bloqués de même). La comparaison avec eux reste à faire sur un
téléphone ; le site que le propriétaire a envoyé la veille n'est pas encore connu (l'adresse est
demandée). Le lecteur est fait pour s'ajuster : l'unité de liste, la ligne de lecture,
l'alignement, la fin de page et les tailles sont des réglages nommés (`READER_CONFIG`) ou des
composants isolés (`page-section-view.tsx`, `surah-cartouche.tsx`).

On ne reprend ni leur marque ni leurs éléments graphiques : seulement des principes d'usage
(une page par élément, fin de page discrète, bande de lecture pour suivre la position).

Sources :

- dépôt `quran/quran.com-frontend-next`, commit `aff1a035`, fichiers
  `src/components/QuranReader/ReadingView/Page.tsx`, `Page.module.scss`, `PageFooter.tsx`,
  `PageFooter.module.scss`, `Line.module.scss`, `ReadingView/index.tsx`,
  `src/components/QuranReader/observer.ts`, `ContextMenu/README.md`,
  `src/components/chapters/ChapterHeader/index.tsx`,
  `TranslationView/TranslationViewCell.module.scss` (lus le 25 novembre 2026, rien de copié) ;
- page « New translation reading mode, read like a book » de quran.com (titre trouvé par la
  recherche, page non lisible ici) ;
- dépôt `AlfaazPlus/QuranApp`, commit `a6a6eb80`, `ReadingFlowReader.kt` (licence GPL : lu pour le
  principe d'une page par élément avec titre, basmala et mots, rien de copié) ;
- fiches App Store de Quran 360 (`id1613305778`, `id1611115111`) : trouvées, non lisibles.
