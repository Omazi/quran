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

## 2. Trois directions

SwiftUI Design, principe 3 : proposer deux ou trois directions distinctes, pas une réponse
finale. **Le choix revient au propriétaire.** La direction A est appliquée en attendant,
parce que c'est la seule qui passe la critique de la section 5.

|        | A. L'eau                                         | B. Le mushaf                                                                                              | C. La nuit                                                              |
| ------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| École  | Minimal chaleureux, système d'abord              | Éditorial                                                                                                 | Expressif                                                               |
| Fonds  | Couleurs système d'iOS, clair et sombre          | Papier crème partout                                                                                      | Sombre en permanence                                                    |
| Accent | Bleu d'eau : lire, c'est arroser                 | Vert profond, or                                                                                          | Or sur nuit                                                             |
| Titres | New York (serif système)                         | New York, ornements                                                                                       | New York, très grands                                                   |
| Pour   | Natif, laisse le vert au jardin, lisible partout | Familier pour une appli de Coran                                                                          | Spectaculaire avec un jardin lumineux                                   |
| Contre | Sobre tant que le jardin n'a pas ses images      | C'est le look « crème + serif » que les skills signalent comme générique, et celui des maquettes refusées | `dark-mode.md` réserve le sombre permanent aux applis de média immersif |

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

Soif et alerte : orange système, pour l'icône et la jauge seulement ; le mot qui
l'accompagne reste dans la couleur du texte, parce que l'orange n'est pas assez lisible
sur fond clair (`accessibility.md › Vision`). Action destructive : rouge système. Aucune information
ne passe par la couleur seule (`accessibility.md › Vision`) : toujours une
icône et un mot avec.

Pourquoi l'accent n'est pas vert : le contenu (le jardin) est vert, et `tab-bars.md` comme
`color.md › Liquid Glass color` demandent une couleur d'accent qui se distingue du contenu.
L'eau est aussi le geste de l'appli : le bouton principal dit « Lire et arroser ».

### Typographie

Deux familles, toutes deux du système (`typography.md` ; SwiftUI Design, règles 1 et 5) :
**New York** pour les grands titres, **San Francisco** pour le reste. Les polices
embarquées ne servent qu'au texte du Coran. Quatre tailles au plus par écran. Tailles
d'Apple, qui suivent le réglage de taille de texte de la personne :

| Style         | Taille / interligne       | Usage                                                              |
| ------------- | ------------------------- | ------------------------------------------------------------------ |
| Large Title   | 34 / 41, gras, New York   | Titre d'écran                                                      |
| Display Title | 36 / 40, normal, New York | Le mot d'un écran immersif (écran d’écoute ; écart 33 du registre) |
| Title 2       | 22 / 28, gras, New York   | Titre de page du premier lancement, de carte                       |
| Headline      | 17 / 22, demi-gras        | Libellé important                                                  |
| Body          | 17 / 22                   | Texte                                                              |
| Subhead       | 15 / 20                   | Texte secondaire                                                   |
| Footnote      | 13 / 18                   | Notes, légendes                                                    |

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
d'illustration dessinée en code. Le jardin est la seule image : des rendus de modèles 3D (D35). Image manquante = emplacement
neutre et nommé.

### Voix

Phrases courtes, tutoiement, verbes simples, jamais de reproche. Un bouton dit ce qu'il
fait et garde le même nom tout le long (Apple Design, angle 5). Majuscules : en français,
en début de phrase seulement ; en anglais, celles des titres pour les boutons et les
titres, comme le système.

## 4. Ce qui manque encore

- Le moteur 3D du jardin : faire tourner le jardin et visiter celui d'un proche (D4, D35).
  Les jardins des autres niveaux (D23). Le jardin en images est celui du niveau 1.
- La présentation du texte du Coran : à revoir avec le propriétaire.
- Le nom de l'appli et son icône.
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
