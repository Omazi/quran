# Spécification — le jardin en images (premier lancement et accueil)

Demande du propriétaire, 24 novembre 2026, après la première installation : « Mets le jardin
comme il doit ressembler. » Jusqu'ici `GardenScene` affichait un emplacement neutre (D12).
Décision D35 : en attendant un moteur 3D sur le téléphone (D4), le jardin s'affiche en
**images calculées à l'avance** à partir des modèles 3D que le propriétaire a choisis (D22 :
plantes Quaternius, architecture Kenney). Ce ne sont pas des dessins faits en code : D12
reste vrai.

Tout ce document applique [la règle des skills](../design/SKILLS.md) et
[la charte](../design/brand-spec.md) : les lire d'abord.

## Périmètre

`src/features/garden/**`, le rendu de scène du premier lancement dans
`src/features/onboarding/**` (le strict nécessaire pour y montrer le jardin),
`assets/images/garden/**`, `tools/garden-pictures/**`. Les règles du jardin
(`src/domain/garden`) ne changent pas : l'écran ne décide rien, il montre un `GardenState`.

## 1. Les images

Rendues hors du dépôt (`/home/claude/gen/garden3d`, script `tool/render_app.py`), avec une
seule caméra : deux états se superposent exactement.

- **Le jardin à sec**, `base/hNN-fF.webp` : `NN` = nombre d'éléments visibles, de 00 à 60
  (les premiers du catalogue) ; `F` = feuillage, de 0 à 3 : 0 en pleine feuille, 1 herbe et
  fleurs ternies, 2 la moitié des arbres nus, 3 tous les arbres nus et les fleurs fanées.
  `h00-f3` est la terre morte. 244 images.
- **L'eau**, `water/hNN-fF-wW.webp` : ce que l'eau change, à poser sur l'image à sec. `W` =
  1 eau basse, 2 l'eau coule. Un jardin sans canal n'a pas d'image d'eau. 488 images au
  plus.
- 1200 × 900 points, fond transparent : l'image se pose sur le fond du système, clair ou
  sombre.

## 2. De l'état du jardin à l'image

Une fonction pure, testée, dans `src/features/garden` : `gardenPicture(state)`.

| Ce que dit `GardenState`             | Ce qu'on montre                                           |
| ------------------------------------ | --------------------------------------------------------- |
| `visibleElements.length`             | `NN`                                                      |
| `droughtDays` 0 à 2                  | feuillage 0                                               |
| `droughtDays` 3 à 5                  | feuillage 1                                               |
| `droughtDays` 6 à 7                  | feuillage 2                                               |
| `droughtDays` 8 et plus              | feuillage 3                                               |
| `water` : coule, immobile, à sec     | eau 2, eau 1, pas d'eau                                   |
| aucun élément visible et jardin mort | `h00-f3`                                                  |
| `nextElement` avec sa croissance     | l'image `NN + 1` par-dessus, opaque à hauteur de `growth` |

Les seuils viennent de la configuration du jardin et de `docs/specs/garden.md`, « Ce qu'on
voit, étape par étape » : ils ne sont pas recopiés en dur. L'élément qui pousse ne se montre
que si tous les éléments débloqués sont visibles (même règle que le domaine). Une image
absente du jeu donne l'emplacement neutre, jamais une image cassée ni une erreur.

## 3. À l'écran

- `GardenScene` reste le seul point d'entrée du jardin (D12). Il reçoit un `GardenState` et
  une taille. L'image garde ses proportions et tient entière dans l'espace donné.
- Son libellé d'accessibilité ne change pas : il dit l'état en mots.
- **On ne passe jamais d'un coup d'un état à un autre** (D26) : entre deux états, un fondu ;
  si l'état saute plusieurs étapes (retour après une absence, lecture qui fait remonter le
  jardin), on passe par les images intermédiaires, dans l'ordre, la reprise plus vite que le
  dessèchement. Avec « réduire les animations », on montre l'état final.
- Premier lancement : chaque page de jardin montre l'image de son état, calculé par
  `previewGardenState`. Les pages qui présentent une autre fonctionnalité gardent leur
  emplacement.
- Seules les images utiles à l'état en cours sont chargées.

## 4. L'outil

`tools/garden-pictures` : copie les images rendues dans `assets/images/garden/level-1/`,
vérifie que le jeu est complet et que les noms sont ceux attendus, et écrit la table des
images que l'appli charge. Il s'arrête sur un jeu incomplet. Un `NOTICE.txt` à côté des
images dit d'où viennent les modèles et sous quelle licence (CC0 pour les deux, lu sur les
pages des auteurs ; les fichiers ont été pris sur des miroirs GitHub : voir
`/home/claude/gen/garden3d/NOTES.md`).

## 5. Limites à dire

- Le jardin ne tourne pas : ce sont des images. La visite en 3D du jardin d'un proche
  demande le moteur 3D (D4).
- Un seul jardin, celui du niveau 1. Les jardins des autres niveaux (D23) n'existent pas
  encore.
- Les images ajoutent une vingtaine de mégaoctets à l'appli.
- Oiseaux, papillons, treille et pupitre n'ont de modèle dans aucun des deux packs : ces
  éléments du catalogue ne se voient pas.

## 6. Tests et vérification

- `gardenPicture` : chaque ligne du tableau, les bornes de chaque seuil, la terre morte, la
  croissance, le jeu d'images incomplet.
- Rendu de `GardenScene` : les couches attendues pour quelques états, avec et sans
  « réduire les animations ».
- Le premier lancement montre une image de jardin sur chaque page de jardin.
- `npm run check` ; `npx expo export --platform ios --output-dir <dossier temporaire>`.
- L'aspect réel sur iPhone n'est **pas vérifié** ici. L'écran passe la revue de design avant
  d'être montré au propriétaire (D28).
