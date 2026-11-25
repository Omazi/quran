# Charte de design

Méthode : protocole « brand-spec » du skill SwiftUI Design et mode « amélioration » du
skill Apple Design (étapes 1 à 3). Voir [SKILLS.md](SKILLS.md).

## 1. Le sujet

- **Produit** : une appli de Coran gratuite. Lire fait pousser un jardin ; ne pas lire le
  dessèche.
- **Public** : des musulmans de tous âges, en français, en anglais et en arabe ; beaucoup
  ouvrent l'appli une ou deux minutes, chaque jour.
- **Rôle de l'interface** : s'effacer devant deux contenus, la page du mushaf et le
  jardin. Tout le reste est du système.
- **Signature** : le jardin. C'est le seul endroit où l'on met 120 % d'effort
  (SwiftUI Design, étape 4). Depuis D35, il s'affiche en images rendues à partir des modèles
  3D choisis par le propriétaire (D22), pas dessinées en code (D12 reste vrai). Il court d'un
  bord à l'autre de l'écran, sans cadre. Une image absente donne l'emplacement neutre et
  nommé.

## 2. Direction : les maquettes validées

**Règle du propriétaire (25 novembre 2026, D39) : les maquettes validées de `docs/design/` sont la
référence visuelle.** Les skills de design restent la méthode ; quand une maquette contredit une
règle d'Apple ou cette charte, la maquette l'emporte et l'écart est inscrit dans
[SKILLS.md](SKILLS.md), où le propriétaire tranche au cas par cas. On ne dessine rien « de tête ».

| Choix               | Décision du propriétaire                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Référence           | Les maquettes d'abord (`accueil`, `soif`, `mort`, `nouveau`, `khatm`, `mushaf`, `visite`, `bienvenue`, `voix`) ; la charte complète ce qu'elles ne montrent pas         |
| Couleur d'action    | Vert forêt `#1F5C45` dans toute l'appli ; la nuit, `#2E7A5B` pour tout bouton plein (libellé blanc), `#7FCCA6` pour un mot ou un symbole vert. Bleu d'eau = l'eau seule |
| Titres              | Fraunces demi-gras (embarquée, OFL) ; San Francisco pour le reste ; New York pour le seul titre de l'écran d'écoute                                                     |
| Nuit                | « Crépuscule » : ciel sombre et chaud, cartes sombres et chaudes ; valeurs dérivées des maquettes et mesurées                                                           |
| Surfaces et boutons | Cartes blanches arrondies avec l'ombre douce des maquettes (de jour) ; boutons en capsule dessinés (`ActionButton`)                                                     |
| Pièces du système   | Gardées là où elles ne changent pas l'apparence : onglets, barres de navigation, menus, feuilles d'action, interrupteurs, champs, sélecteurs                            |
| Écoute              | L'écran de reconnaissance garde la rosace validée (D27, D29)                                                                                                            |
| Lancement           | La marque calligraphique sur l'eau profonde `#0B3C44` (`#072C33` en sombre) : écart 98                                                                                  |
| Jardin              | Vraie 3D qu'on fait tourner (D4) ; les images de D35 pour les vignettes et en repli                                                                                     |

**Un seul système de design.** Toutes les valeurs vivent dans `src/ui/tokens.ts` : la palette
unique `palette` (un rôle, une valeur ; sombre et contraste élevé compris), les dégradés
`backdropGradients`, les ombres `elevation`, les mesures `pieceSizes`, `radius`, `readerShapes`,
`listeningShape`. Les écrans les lisent par `useColors()` (couleurs dynamiques sur iOS) ou
`useColorValues()` (valeurs simples pour SVG et dégradés), et se composent des pièces partagées de
`src/ui/components` (`Card`, `ActionButton`, `Avatar`, `DottedProgress`, `ProgressRing`,
`SectionHeader`, `Pill`, `IconTile`…). Une nouvelle pièce va dans `src/ui`, pas dans une
fonctionnalité.

Historique : la charte avait proposé trois directions (A, l'eau, système d'abord ; B, le mushaf,
crème et or ; C, la nuit) et appliquait A. Les maquettes validées l'ont remplacée ; les tableaux de
la section 3 restent pour les rôles que la palette n'a pas (papier et encre du mushaf, ornements,
eau de la rosace, couleurs système).

## 3. Jetons (direction A)

### Couleurs

Fonds, textes, séparateurs et remplissages : **couleurs sémantiques d'iOS**
(`dark-mode.md › Dark Mode colors`, `color.md › System colors`), jamais leurs valeurs en
dur. Elles suivent seules le mode sombre et le contraste élevé. Pas de réglage
d'apparence dans l'appli (`dark-mode.md › Best practices`).

Quatre couleurs seulement appartiennent à l'appli. Une couleur, un seul sens
(`color.md › Best practices`).

| Rôle            | Sert à                                                                                                                     | Clair                                       | Contraste                                                             | Sombre                                      | Contraste                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| `accent` (eau)  | L'action principale de l'écran, l'onglet choisi, « arrosé »                                                                | `#0E6B78`                                   | 6,19:1 sur blanc ; 5,55:1 sur `#F2F2F7` ; libellé blanc dessus 6,19:1 | `#5CC8D6`                                   | 10,69:1 sur noir ; 8,66:1 sur `#1C1C1E` ; libellé noir dessus 10,69:1 |
| `growth` (vert) | L'état du jardin quand il va bien, dans le contenu seulement                                                               | `#1F6B4A`                                   | 6,44:1 sur blanc                                                      | `#63C794`                                   | 10,13:1 sur noir                                                      |
| `paper` / encre | La page du mushaf, et elle seule ; l'encre secondaire (`inkSecondary`, encre à 65 %) pour la ligne de repère sur le papier | `#FBF7EC` / `#1C1C1E`, secondaire `#6A6966` | 15,89:1 ; secondaire 5,13:1                                           | `#1B1915` / `#EFE8D8`, secondaire `#A5A094` | 14,38:1 ; secondaire 6,73:1                                           |
| `ornament` (or) | Les ornements du mushaf, dans le contenu seulement                                                                         | `#8F611A`                                   | 5,04:1 sur papier                                                     | `#D9A441`                                   | 7,80:1 sur papier sombre                                              |

Contraste élevé (`color.md › Best practices` : les couleurs doivent tenir en clair, en
sombre et en contraste augmenté) : quand la personne active « augmenter le contraste »,
les couleurs de l'appli passent à ces valeurs.

| Rôle       | Clair     | Contraste         | Sombre    | Contraste                 |
| ---------- | --------- | ----------------- | --------- | ------------------------- |
| `accent`   | `#0A4F59` | 9,23:1 sur blanc  | `#8FE0EA` | 14,02:1 sur noir          |
| `growth`   | `#164F36` | 9,52:1 sur blanc  | `#8FE0B4` | 13,49:1 sur noir          |
| `ornament` | `#6A470F` | 7,78:1 sur papier | `#EBC272` | 10,44:1 sur papier sombre |

Deux rôles de plus, hors des tableaux, ajoutés avec l'écran d'écoute validé par le
propriétaire (D27, D29 ; écart 33 du registre). `ornamentLine` : les filets d'ornement
dessinés fin, jamais un mot ni une icône ; clair `#CE9A3C` (2,36:1 sur papier : une
décoration qui ne porte aucune information), sombre `#D9A441` (celui de `ornament`), contraste
élevé `#6A470F` / `#EBC272` (la ligne `ornament` ci-dessus). `accentStrong` : l'eau à sa valeur
de contraste élevé dans tous les réglages, `#0A4F59` clair, `#8FE0EA` sombre, pour l'étoile du
cœur de la rosace ; elle n'a pas de variante à elle.

**Palette des maquettes validées** (D39). Les couleurs des maquettes vivent dans `palette`
(`src/ui/tokens.ts`), relevées sur les images ; un gris trop pâle y est foncé jusqu’à 4,5:1, sa
valeur d’origine notée à côté. Les quatre palettes d'avant (accueil, lecteur, Proches, suivi de la
voix) y sont fusionnées : un rôle, une valeur (écart 97). **La couleur d’action de toute l’appli est
le vert forêt** : `action` `#1F5C45` de jour, `#2E7A5B` la nuit, pour tout bouton plein, capsule ou
bouton proéminent du système, libellé blanc ; `actionTint` (`#7FCCA6` la nuit) pour un mot ou un
symbole vert. Le bleu d’eau (`accent`, `water`) ne garde que le sens « eau, arrosage ». Les tableaux
ci-dessus gardent les rôles de la charte que la palette n'a pas.

Soif et alerte : orange système, pour l'icône et la jauge seulement ; le mot qui
l'accompagne reste dans la couleur du texte, parce que l'orange n'est pas assez lisible
sur fond clair (`accessibility.md › Vision`). Action destructive : rouge système. Aucune information
ne passe par la couleur seule (`accessibility.md › Vision`) : toujours une
icône et un mot avec.

Pourquoi l'accent n'est pas vert : le contenu (le jardin) est vert, et `tab-bars.md` comme
`color.md › Liquid Glass color` demandent une couleur d'accent qui se distingue du contenu.
L'eau est aussi le geste de l'appli : le bouton principal dit « Lire et arroser ».

### Typographie

Deux familles (`typography.md` ; SwiftUI Design, règles 1 et 5) : **Fraunces** (demi-gras,
embarquée, licence OFL) pour les titres, comme sur les maquettes validées (décision du
propriétaire, 25 novembre 2026 ; écart 71), **San Francisco** pour le reste. New York ne sert plus
qu’au titre de l’écran d’écoute (Display Title). Les autres polices embarquées ne servent qu'au
texte du Coran. Quatre tailles au plus par écran (l’accueil des maquettes en compte plus :
écart 72). Tailles
d'Apple, qui suivent le réglage de taille de texte de la personne :

| Style              | Taille / interligne          | Usage                                                              |
| ------------------ | ---------------------------- | ------------------------------------------------------------------ |
| Large Title        | 34 / 41, demi-gras, Fraunces | Titre d'écran                                                      |
| Display Title      | 36 / 40, normal, New York    | Le mot d'un écran immersif (écran d’écoute ; écart 33 du registre) |
| Title 1            | 28 / 34, demi-gras, Fraunces | Message d’un écran ou d’une feuille (maquettes ; écart 72)         |
| Title 2            | 22 / 28, demi-gras, Fraunces | Titre de page du premier lancement, de carte                       |
| Figure             | 24 / 30, gras                | Chiffre lu d’abord : bilan d’une khatma (maquettes ; écart 72)     |
| Title 3            | 20 / 25, gras                | Valeur d’une carte : « 5 pages sur 8 » (maquettes ; écart 72)      |
| Headline           | 17 / 22, demi-gras           | Libellé important                                                  |
| Body               | 17 / 22                      | Texte                                                              |
| Callout            | 16 / 21, demi-gras           | Nom dans une carte (maquettes ; écart 72)                          |
| Subhead            | 15 / 20                      | Texte secondaire                                                   |
| Subhead Emphasized | 15 / 20, demi-gras           | Libellé court qui ouvre une carte (maquettes ; écart 72)           |
| Footnote           | 13 / 18                      | Notes, légendes                                                    |

Minimum 11 points, pas de graisse fine (`typography.md › Ensuring legibility`).

### Espacement, formes, cibles

Grille de 8 : 4, 8, 16, 24, 32, 48. Marges d'écran de 16. Rayons 8, 12, 16. Cibles de
44 × 44 points, 12 points entre deux contrôles (`accessibility.md › Mobility`).

### Matière

Liquid Glass sur la couche qui flotte seulement (onglets, barres, bouton posé sur le
contenu), jamais sur le contenu (`liquid-glass.md › Where the material belongs`). Un bouton
coloré par écran, deux au plus (`liquid-glass.md › Review checklist`). Les composants système prennent la matière
tout seuls : on ne l'ajoute à la main que sur un contrôle flottant maison, avec un repli
opaque quand « réduire la transparence » est actif.

### Mouvement

Un seul moment orchestré : le jardin qui change quand on tourne une page du premier
lancement ou qu'on valide une lecture. Bref, annulable, coupé par « réduire les
animations » (`motion.md › Best practices`). Rien d'autre que les animations du système.

### Icônes et images

SF Symbols, de la graisse du texte voisin (`sf-symbols.md › Weights and scales`). Pas d'emoji, pas
d'illustration dessinée en code. Le jardin est la seule image : des rendus de modèles 3D (D35). L'icône de l'appli est le nom calligraphié (plus bas, « Icône »). Image manquante = emplacement
neutre et nommé.

### Voix

Phrases courtes, tutoiement, verbes simples, jamais de reproche. Un bouton dit ce qu'il
fait et garde le même nom tout le long (Apple Design, angle 5). Majuscules : en français,
en début de phrase seulement ; en anglais, celles des titres pour les boutons et les
titres, comme le système.

### Icône

Décision D38, version 6. Sources : `app-icons.md` (Apple Design : `› Design`, `› Layer design`,
`› Icon shape`, `› Visual effects`, `› Appearances`), skill Frontend design (une seule idée forte),
et le choix du propriétaire du 25 novembre 2026 : le mot جنتك en calligraphie, d'où sort une pousse
ou de l'eau. Fichiers produits par `tools/app-icon/make_icon.py` (contours du mot :
`tools/app-icon/word.svg`).

**L'idée.** Le nom, جنتك, en nastaliq. Le long trait montant du kaf traverse l'icône et finit en
feuille : le mot fait pousser le jardin. Les points des lettres sont de l'eau, de sa couleur. Les
lettres sont celles de la police Gulzar (licence OFL), mises en forme par HarfBuzz, sans retouche :
ni redessinées, ni déformées, points gardés, lecture de droite à gauche. Le kaf final est le kaf
arabe (ك) : son petit signe intérieur (la « sharta ») vient de Noto Nastaliq Urdu (OFL), au trait
de Gulzar ; choix du propriétaire, 25 novembre 2026 (D38). La feuille part de
l'intérieur de la fin du trait, qui s'y prolonge ; elle cache la pointe du trait (le levé de la
plume), rien d'autre.

Pourquoi le nastaliq : c'est la seule écriture essayée dont un trait de lettre monte comme une tige
(le trait du kaf), et son mot tient dans un carré, donc reste grand à 29 pixels. Les points de
Gulzar ont déjà une forme de goutte.

**Couleurs, par rôle** (les mêmes en apparence claire et sombre, sauf le fond).

| Rôle           | Où         | Valeur                                                                                              |
| -------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| Eau (fond)     | Fond       | Eau profonde `#0B3C44` → `#05222A` (choix du propriétaire) ; apparence sombre `#072C33` → `#02151A` |
| Lettres        | Le mot     | `#F6FBF9`, blanc froid (ni papier, ni crème)                                                        |
| Eau (`accent`) | Les points | `#8FE0EA`, la valeur de l'`accent` en sombre et contraste élevé                                     |
| Jardin         | La feuille | `#8FDB6B`, un vert jeune, plus jaune que l'eau pour ne pas se confondre avec les points (écart 51)  |

Aucun reflet, aucune ombre, aucun dégradé dans les couches : le système les fait
(`app-icons.md › Visual effects`).

**Couches** (`assets/expo.icon`, format Icon Composer, `app-icons.md › Layer design` : préférer
le vectoriel, texte converti en contours). Le fond est le dégradé d'Icon Composer lui-même (clair et
sombre). Trois groupes, chacun une couche PNG d'une seule couleur, tirée des formes vectorielles (l'actool de Xcode 26.6 plante sur des couches SVG), du dessus vers le dessous : la
feuille, l'eau (translucidité 0,3), le mot. En teinté et en transparent, l'eau est à 70 % pour rester
d'un ton plus clair que le mot et la feuille.

**Composition** (`app-icons.md › Icon shape` : contenu centré). La boîte du mot et de la feuille
fait 78 % du côté ; centrée, puis déplacée de 2,5 % vers la gauche et 3 % vers le haut, à mi-chemin
de son centre de masse (le jim et les points pèsent en bas à droite). Le point le plus proche d'un
coin reste loin du masque. À 29 pixels : la masse du mot, son grand trait et une tache verte au bout.
Sur Android, tout le mot tient dans le cercle de sécurité de 66 dp (31,7 dp du centre).

**Écran de lancement** : une couleur unie, sans logo (`launching.md › Launch screens`) ;
`splash-icon.png` existe mais n'est pas affiché.

**Écarté, et pourquoi** (aperçus : voir D38) :

- Versions 1 à 5 : le plan du jardin (une fleur autour de l'étoile générique), la parcelle en
  vectoriel (une puce électronique), l'arbre sur une île (une icône de jeu mobile), l'arbre au
  ruisseau en rendu 3D (un brocoli d'un coup d'œil, éclairage dans l'image).
- Pour la version 6, quatre écritures : le roqaa (Aref Ruqaa) avec une pousse sur la hampe du kaf
  (la boucle du kaf et sa feuille font une pomme) ; le coufique (Reem Kufi), feuille au bout du biseau
  du kaf (un mot très large : un trait à 29 pixels) ; le naskh (Amiri), l'eau dans la coupe du kaf
  final (élégant, mais un mot-logo dans un carré, l'eau invisible en petit) ; le nastaliq, retenu.
- Sur le nastaliq : deux feuilles en V, ou une feuille de plus plus bas (en une seule teinte,
  elles font une boucle qui se lit comme une lettre de plus, « م ») ; une feuille dressée (une
  flamme, une torche) ; une feuille posée sur la pointe du trait (en équilibre sur une aiguille,
  collée).

## 4. Ce qui manque encore

- Le jardin en vraie 3D qu'on fait tourner et le jardin d'un proche à visiter (D4, D39), en
  cours par un autre agent ; les images de D35 restent pour les vignettes et en repli.
  Les jardins des autres niveaux (D23). Le jardin en images est celui du niveau 1.
- La présentation du texte du Coran : à revoir avec le propriétaire.
- Version iPad (largeur « regular ») : lot ultérieur ; le lot 1 vise l'iPhone.

## 5. Critique du plan

Apple Design, étape 3 : « aurais-je produit ce même plan pour un autre produit ? »

- La première version (fond crème, vert, or, serif embarqué) : **oui**. C'est le défaut du
  genre, et l'un des trois looks que le skill signale. Écartée.
- La direction A tient à ce produit par deux choix : l'accent est l'eau, parce que lire
  c'est arroser ; et l'interface n'a presque pas de couleur, pour que le jardin soit la
  seule chose colorée à l'écran. Une autre appli de Coran n'aurait aucune raison de faire
  ces deux choix.
- Ce qu'on retire (« enlève un accessoire ») : l'or hors du mushaf, les cartes ombrées, la
  police d'affichage embarquée.

Révision du 25 novembre 2026 (D39) : le propriétaire a validé des maquettes qui reprennent ce que
cette critique retirait (crème, vert, Fraunces, cartes ombrées, bouton dessiné). Elles font foi ;
ce qui les distingue du « look générique » tient au jardin, à l'eau qui garde son sens et à la
calligraphie de l'icône. La critique reste ici comme trace du raisonnement.
