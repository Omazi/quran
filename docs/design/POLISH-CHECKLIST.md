# Contrôle de finition : ce qu'un écran doit passer avant d'être montré

Le 27 novembre 2026, le propriétaire a vu un défaut que nous avions laissé passer : dans le
lecteur, le titre « سُورَةُ ٱلْكَهْفِ » n'était pas au milieu de son cadre doré (9,8 points trop bas
dans la maquette, l'encre sortait du cadre). Ce document existe pour que cela n'arrive plus.

**La règle : on mesure, on ne regarde pas seulement.** Aucune maquette, aucun écran n'est montré au
propriétaire sans être passé par les trois contrôles ci-dessous, et sans que la liste plus bas soit
cochée. Elle complète la règle 6 de `SKILLS.md` (« on ne montre rien de moche »). Source :
Apple Design › 16. Design foundations › Craft (« nothing is random : every spacing, timing, and
alignment value is a deliberate choice you can defend ») et typography › Rule 2 (les écritures
hautes, dont l'arabe, demandent plus d'interligne).

## Les trois contrôles

Les outils sont dans `tools/design-qa/`. Il faut Python, Pillow (avec libraqm), fontTools et
Playwright. Leurs propres tests : `python3 -m unittest discover -s tools/design-qa -p "test_*.py"`.

### 1. La maquette (HTML)

```bash
python3 tools/design-qa/audit.py mockup /chemin/de/la/maquette --out /tmp/audit --no-shots
```

L'outil ouvre chaque état de la liste `SHOTS` de la maquette (`tools/shoot.py`), mesure, et finit
en erreur s'il reste un défaut. Avec `--no-shots` le jardin 3D n'est pas dessiné : une soixantaine
d'états en un quart d'heure (les états qui ont besoin du jardin, comme l'écoute, ne sont alors pas
mesurés). Sans cette option il photographie aussi chaque état (très lent sans carte graphique).

### 2. L'appli, rendue pour le web

```bash
npx expo export --platform web --output-dir /tmp/dist
python3 tools/design-qa/audit.py app /tmp/dist /reader/2 /reader/255 /quran --scheme dark --out /tmp/audit
```

Toujours l'export, jamais le serveur de développement : celui-ci pose un bandeau rouge d'avertissement
sur l'image (visible sur les anciennes images de `maquette-wow/rendu-web-2026-11-27/`).
Options : `--scheme light|dark`, `--locale ar-SA`, `--settings '{"readerScript":"imlaei"}'`.

Ce que ce rendu **ne dit pas** : la police du téléphone (San Francisco) n'existe pas sur nos
machines, donc tout texte en police système est dessiné dans une autre police. L'outil le classe
« à voir », pas « défaut » : sa place se mesure sur la photo iOS. La barre d'onglets du web n'est
pas celle de l'iPhone. Les polices que l'appli embarque (Fraunces, Amiri, police du Complexe du roi
Fahd, symboles) sont, elles, exactes.

### 3. Les photos iOS (branche `ci-screens`)

Une photo n'a pas de structure : on donne un point dans le bouton, l'outil trouve la boîte autour
et l'encre dedans.

```python
import ink
from PIL import Image
photo = Image.open("ecran-proches-fr-clair.png")
boite = ink.container_at(photo, (864, 1911))          # un point dans le bouton « Refuser »
encre, ligne_de_base = ink.band_of_label(photo, boite)
```

Une photo fait 3 pixels par point. Regarder **toutes** les photos, en français, en arabe, en clair
et en sombre, avant une version : c'est là que se voient les défauts que le web ne montre pas.

## Comment on mesure le centrage d'un texte

La boîte d'une ligne de texte ne dit pas où sont les lettres. Une police garde de la place
au-dessus et au-dessous pour ses signes, et les polices arabes en gardent beaucoup :

| Police                          | Au-dessus de la ligne de base | Au-dessous | Bande des lettres (haut / bas) | Décalage si on centre par la boîte   |
| ------------------------------- | ----------------------------- | ---------- | ------------------------------ | ------------------------------------ |
| Amiri Quran (maquette)          | 1,815                         | 0,634      | 0,766 / 0,297                  | 0,356 em trop bas (10,7 pt à 30 pt)  |
| Amiri Bold (titres de l'appli)  | 1,124                         | 0,634      | 0,740 / 0,292                  | 0,021 em trop bas (0,7 pt à 33,6 pt) |
| Amiri Regular (écriture simple) | 1,124                         | 0,634      | 0,750 / 0,282                  | 0,011 em trop bas                    |
| Police du Complexe du roi Fahd  | 1,172                         | 0,586      | 0,670 / 0,265                  | 0,090 em trop bas (2,5 pt à 28 pt)   |

(en multiples de la taille de la police ; `python3 tools/design-qa/font_band.py <police.ttf>`)

On centre donc **la bande des lettres** : du haut de l'alif-lam au creux du ra et du waw pour
l'arabe, la hauteur des capitales pour le latin. Pas l'encre totale : un mim final ou une hamza ne
doivent pas faire monter ou descendre le titre d'une sourate à l'autre.

- **Dans l'appli** : `centredLine()` (`src/ui/ink-centre.ts`) donne la hauteur de ligne et le petit
  décalage ; les mesures de chaque police y sont écrites et un test les compare aux fichiers de
  police. La ligne n'est jamais plus courte que la police : sur iOS, une ligne plus courte coupe le
  haut du texte au lieu de le centrer.
- **Dans une maquette** : `line-height` assez grand pour les signes, puis `position: relative;
top: -0.356em` (Amiri Quran), ou un `padding` plus grand en bas qu'en haut de `0.712em`.
- **La preuve** : l'outil cache le texte, reprend l'image, et compare. La différence est l'encre
  réelle (`ink.difference_box`). C'est cette mesure sur les pixels qui fait foi.

## La liste

Tolérances en points (1 point = 1 pixel CSS = 3 pixels d'une photo iOS).

1. **Texte au milieu de son cadre** (pastille, bouton, cartouche) : la bande des lettres à 1 point
   au plus du milieu, en hauteur. Seul dans un bouton : 1,5 point au plus, en largeur.
2. **L'encre ne touche jamais le cadre** : 2 points au moins entre l'encre (signes compris) et le
   bord ; 3 points pour un filet. À vérifier sur le texte **le plus haut et le plus profond** qui
   peut y apparaître (pour les sourates : « الأنعام » et « القلم »), pas sur un seul exemple.
3. **Icône et texte** : le milieu de l'icône sur le milieu de la bande du texte, à 1 point près.
   Une image n'a pas de ligne de base : jamais d'icône dans une rangée alignée sur les lignes de base.
4. **Pile icône + libellé, ou deux lignes dans une pastille** : le bloc entier au milieu.
5. **Textes côte à côte** (« 5 /8 », arabe et latin mêlés) : une seule ligne de base. Un écart de
   0,75 à 4 points est un défaut.
6. **Rien de tronqué** : aucun libellé coupé ni réduit à « … », dans les trois langues, et en
   grande taille de texte. Un segment sans libellé est un libellé tronqué.
7. **Rien de coupé, rien qui se chevauche** : ni par un bord, ni par un masque, ni par un voisin.
   Sur iOS, toute vue tournée en 3D (`rotateX`, `rotateY`, `perspective`) doit être seule dans un
   parent réellement dessiné, sinon une moitié disparaît.
8. **La grille** : les titres des onglets au même endroit (`layout.tabTitle`), les cartes sur la
   même marge (`layout.screenMargin`). Deux valeurs voisines de 1 à 4 points sur un même bord sont
   un défaut.
9. **Les retours à la ligne** : pas de mot seul sur la dernière ligne d'un texte court (« 2026 »,
   « 60 »).
10. **Le verre** : même liseré, même rayon, même flou pour les surfaces de même rôle ; texte
    lisible dessus (4,5:1, 3:1 pour un grand texte), de jour comme de nuit.
11. **Les zones de toucher** : 44 × 44 points au moins. Le web ne voit pas la zone élargie
    (`hitSlop`) : chaque cible « à voir » de l'outil se vérifie dans le code.
12. **L'arabe** : la mise en page est en miroir ; un chiffre seul reste écrit de gauche à droite,
    donc jamais d'espace tapée après un chiffre pour l'écarter du mot suivant (un `gap` de la
    rangée) ; les pluriels sont justes.
13. **Les images montrées** : prises sur l'export, sans bandeau de développement, sans panneau
    d'essai, à l'heure voulue.

## Les pièges déjà rencontrés (27 novembre 2026)

| Ce qu'on a vu                                                                   | La cause                                                                      |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Titre de sourate bas et hors du cadre (maquette)                                | Amiri Quran centrée par sa boîte ; cadre de 42 points pour 45 points d'encre  |
| Le mim de « ابراهيم » traverse le filet (appli)                                 | Cadre calculé sur la ligne du texte, pas sur l'encre du titre le plus profond |
| La goutte 14 points plus bas que « 3 /5 » (iPhone)                              | Une icône dans une rangée alignée sur les lignes de base                      |
| « Uthmani / Simple » sans libellés (iPhone)                                     | `flex: 1` gardé à côté de `flexBasis: 'auto'` : base de 0                     |
| Moitié du jardin et du nom « Jannatuk » absente, pages 1 à 9 (iPhone)           | Vue tournée en 3D au milieu de ses voisines                                   |
| « 7صفحة » collés (iPhone, arabe)                                                | Espace tapée après le chiffre                                                 |
| « Proches » 28 points plus bas que « Profil », « Coran » 4 points plus à gauche | Chaque onglet avait ses propres marges                                        |
| Bandeau rouge sur les images du rendu web                                       | Images prises sur le serveur de développement                                 |

## Limites connues

- Le rendu web ne remplace pas l'iPhone : le correctif d'un défaut vu seulement sur iOS n'est
  « vérifié » qu'après les photos suivantes de `ci-screens`.
- L'outil ne juge ni la beauté ni la hiérarchie : la relecture design (seuil 7 sur 10) reste due.
- Le contraste et le verre se contrôlent encore à l'œil et au calcul, pas par l'outil.
