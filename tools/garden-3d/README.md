# Le jardin en 3D : la cuisson du modèle

Fabrique `assets/models/garden/level-1/garden.glb`, le jardin du niveau 1 que l'appli fait
tourner (décision D40, `src/features/garden/garden3d`).

    python3 -I tools/garden-3d/bake.py [--source /home/claude/gen/garden3d]

Le dossier source contient les packs de modèles (`packs/`) et leurs textures préparées
(`tool/cache/`), ceux qui ont servi aux images du jardin (D35) ; il n'est pas dans le dépôt.
Il faut Python avec Playwright et son Chromium : les chargeurs FBX et glTF de three.js ont
besoin d'un navigateur. Rien des packs n'est exécuté, ils sont seulement lus.

## Ce que fait l'outil

`bake-scene.js` reprend le constructeur des images (`garden.js` de l'outil des images : mêmes
modèles, même aménagement `source/layout.json`, même pack `source/pack.json`, même matière, même
dessèchement) et l'exécute pour chacune des 732 étapes du jardin (0 à 60 éléments, 3 niveaux
d'eau, 4 états du feuillage), sans rien dessiner : chaque morceau est noté avec les étapes où il
paraît (`lib/visibility.mjs`). Les morceaux sont ensuite fusionnés par matière, ou dessinés par
instances quand un même modèle revient plusieurs fois (arbres, fleurs, herbes, murs), puis écrits
dans un GLB standard (`lib/glb.mjs`) : positions quantifiées (KHR_mesh_quantization), instances
(EXT_mesh_gpu_instancing), textures en pixels bruts (pas d'image à décoder sur le téléphone),
étapes de chaque morceau dans les `extras`. Le JSON est en ASCII seul.

Le fichier contient aussi des pièces hors étapes, que l'appli place elle-même (`PROPS`) : la butte
de terre et la pousse d'un arbre qui commence (D44), nœuds marqués `extras.prop`.

L'appli lit ce fichier sans chargeur glTF (`garden3d/glb.ts`, `garden3d/garden-model.ts`) :
montrer une étape, c'est choisir des plages de triangles et des instances.

## Vérifier

- `npx jest tools/garden-3d` : l'encodage des étapes et l'écriture du GLB.
- `npx jest src/features/garden/garden3d` : la lecture du fichier livré, ce que chaque étape
  montre (terre nue, arbres nus, couleurs de l'eau), le nombre de dessins.
- À l'œil : l'export web de l'appli et la comparaison avec les images (rapport de D40).
