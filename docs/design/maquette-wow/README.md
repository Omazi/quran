# Jannatuk : la nouvelle expérience (maquette animée, 27 novembre 2026)

> Mises à jour après les retours du propriétaire (27 novembre) :
> - le lecteur ne montre plus du tout le jardin ; la goutte tombe dans une pastille en verre ;
>   l'arbre pousse au retour dans le jardin ;
> - au retour, la caméra va jusqu'au grenadier **seulement si une page a compté** depuis la
>   dernière fois ; un toucher l'interrompt (l'arbre prend aussitôt sa nouvelle taille) ;
> - la vie du jardin : dès le début, des lucioles la nuit et quelques feuilles qui volent au vent ;
>   les oiseaux (hizb 27, 37, 57) et les papillons (hizb 47) se gagnent. Au hizb 25 de la maquette,
>   ni oiseaux ni papillons. Le choix « Vie du jardin » du panneau montre hizb 27+ et 47+ ;
> - comparaison de la pastille en bas / en haut : `review/compare-pastille-jour.png` et
>   `review/compare-pastille-nuit.png` (la goutte qui tombe, puis « a grandi »).

**Pour voir :** double-clique sur `index.html` (Chrome, Safari ou Edge sur un ordinateur). Tout est
dans le dossier, sans serveur ni Internet. À gauche, le panneau de commandes ; à droite, l'iPhone
(393 × 852). Sur un téléphone, ou dans une fenêtre étroite, l'iPhone prend tout l'écran.

- `review/demo.webm` : la vidéo de tous les parcours d’affilée (73 s, 15 images/s).
- `shots/` : chaque écran et le milieu de chaque transition, en 390 × 844 à 2x. `00-planche.png`
  montre la page entière avec le panneau.

Rien n'est une image : le jardin est le vrai jardin 3D de l'appli (`garden.glb` du niveau 1), lu
par une copie en JavaScript du lecteur de l'appli (`garden3d/glb.ts`, `garden-model.ts`) et dessiné
avec three.js, avec la même caméra isométrique et la même lumière que dans l'appli.

## L'idée en une phrase

L'appli devient **un seul monde** : le jardin vivant sous le vrai ciel. Les écrans ne remplacent
plus le jardin, ils se posent dessus en verre, et chaque passage d'un écran à l'autre est un
mouvement de ce monde (on entre dans le jardin pour lire, la rosace naît du bouton, le jardin d'un
proche remplace le tien par une vague de lumière).

## Ce que montre chaque écran

| # | Écran | Ce qu'on voit | Images |
| --- | --- | --- | --- |
| 1 | **Accueil = le jardin** | Le jardin plein écran, sans un mot dessus. Le ciel suit l'heure réelle (aube, jour, coucher, nuit étoilée avec lune et étoiles filantes). L'eau coule du bassin vers les canaux et reflète la couleur du ciel ; les arbres et les fleurs bougent dans le vent, quelques feuilles volent ; lucioles la nuit ; ombre douce sous l'île. Oiseaux (un petit vol en silhouette, hizb 27+) et papillons (hizb 47+) se gagnent. La lumière et les ombres suivent le téléphone (ici : la souris ; seule, elle « respire » doucement comme un téléphone tenu en main). En verre : date et titre, série (flamme), un raccourci vers les proches, puis une carte : « Un grenadier pousse, 3 pages sur 10 du hizb 25 » avec son anneau, l'arrosage du jour (5 sur 8), « Lire et arroser » et « Reconnaître ». Un halo doré au pied du jeune arbre montre ce qui pousse. Glisser pour tourner (avec élan), pincer ou molette pour zoomer, double-clic pour s'approcher. Toucher la ligne du grenadier : la caméra va jusqu'à l'arbre. | `01` à `05` |
| 2 | **Une page compte** | Dans le lecteur (sans jardin), un fil d'eau se remplit dans la marge à mesure qu'on lit la page. Au bout de la page, une petite pastille en verre apparaît en bas (« Une goutte pour le grenadier », avec un mini-anneau) ; une seule goutte se forme au bout du fil, tombe (gravité, étirement) dans l'anneau de la pastille, qui rebondit : « Le grenadier a grandi, 4 pages sur 10 du hizb 25 », l'anneau avance, le compteur passe de 5 à 6. **L'arbre grandit pour de vrai au retour** : en revenant à l'accueil, la caméra glisse jusqu'au grenadier, qui pousse d'un cran (onde, lumière), puis revient à la vue du jardin. Les étiquettes violettes montrent où jouent le son et la vibration. | `20` à `25` |
| 3a | **Lire et arroser → lecteur** | La caméra entre dans le jardin et le flou monte ; la page naît du bouton en verre dépoli (on voit le jardin flou à travers), s'élargit à tout l'écran et devient opaque ; le texte monte ligne après ligne. Le lecteur final ne montre plus le jardin. Retour : la page redevient verre et rentre dans le bouton, le jardin se dé-floute (et l'arbre pousse s'il y a eu des pages lues). | `10` à `13` |
| 3b | **Reconnaître → écoute** | Le vert de l'écoute s'ouvre en cercle depuis le bouton ; la petite rosace du bouton grandit jusqu'à sa place (centre, 38 % de la hauteur, géométrie validée de `rosette-geometry.ts`) et tourne d'un huitième, ce qui la fait retomber exactement sur elle-même. Puis elle « écoute » : les lignes s'allument et des pétales or et eau partent à chaque souffle (voix simulée). Au bout de 4 s, la carte « Passage reconnu » monte. | `30` à `33` |
| 3c | **Un proche → son jardin** | Toucher « Mostapha a arrosé ce matin » : le jardin tourne d'un quart de tour et une vague de lumière part du bassin et change ton jardin en celui de Mostapha (hizb 38, avec ses murs). Sa carte en verre : série, pages ce mois, niveau, « Encourager » (un cœur part dans son jardin, onde rose) et « Lire avec lui ». Retour : la vague repart à l'envers. | `40` à `44` |
| 4 | **Lecteur** | Texte continu (Al-Kahf, pages 293 à 297 du mushaf de Médine, avec les repères de page), en Amiri Quran ; papier crème le jour, page de nuit chaude le soir (elle suit le ciel). Le haut du texte s'efface sous la barre de verre. Commandes en verre : retour, titre et page en cours, taille du texte (curseur), et en bas Uthmani | Simple, le compteur d'arrosage et le micro vert. Le jardin vivant reste au pied de la page, son arbre en train de pousser au centre. | `14` à `16` |
| 5 | **Hizb terminé, khatma** | Hizb : l'arbre finit de pousser d'un coup, lumière, pétales, et la carte avec l'étoile dorée « 25 » remplace la carte d'accueil ; « Continuer » : l'arbre reste, le suivant commence. Khatma : le jardin se complète depuis le centre (vague dorée), des rayons tournent, les pétales tombent, puis le jardin entre dans son badge (l'étoile dorée à huit branches validée, numéro de khatma), dont le reflet suit le téléphone ; « Khatma terminée », l'invocation, 60 / 604 / 64, Partager et Nouvelle khatma. | `50` à `54` |
| 6 | **Jardin d'un proche** | Voir 3c : son jardin plein écran dans le même ciel, sa carte en verre. | `42`, `44` |

## Ce que tu dois choisir

1. ~~Papillons et oiseaux~~ : tranché (gagnés au hizb 27 et 47 ; lucioles et feuilles dès le début).
2. **La barre d'onglets sur l'accueil.** Gardée ici (Jardin, Coran, Proches, Profil). Sans elle, le
   jardin gagne environ 80 points de hauteur.
3. **Le lecteur suit le ciel** (papier le jour, page de nuit le soir) ou reste toujours sur le
   papier ?
4. **La pastille en bas ou en haut** : voir les deux images de comparaison dans `review/`.
   En bas, la goutte tombe (sens naturel) près du pouce et des commandes ; en haut, elle doit
   monter vers la pastille (elle est « aspirée » comme une perle), mais la pastille est près du
   titre et de la page en cours. Mon conseil : en bas.
5. ~~Caméra au retour~~ : tranché (seulement si une page a compté ; un toucher l'interrompt).
6. **L'écoute** : vert opaque (charte, montré ici) ou vert légèrement transparent pour laisser le
   jardin briller dessous, très flou ?
7. **Le passage vers un proche** : la vague et le quart de tour te plaisent-ils, ou préfères-tu
   un fondu plus simple ?
8. **Le raccourci vers les proches** sous le titre (« Mostapha a arrosé ce matin ») : à garder à
   cet endroit ?
9. **Le son.** Les sons de la maquette sont fabriqués dans la page (pas de fichier), pour montrer
   où et quand ils jouent : goutte, éclaboussure, ouverture, carillon, succès, accord de khatma.
   Pour l'appli, il faudra de vrais sons (une création à commander, ou des sons CC0 vérifiés).
   Ils sont coupés par défaut ; case « Son » dans le panneau.

## Les commandes du panneau

- **Heure du ciel** : curseur de 0 h à 24 h, raccourcis Aube, Jour, Coucher, Nuit, Heure réelle, et
  « Faire défiler une journée ».
- **Parcours** : chaque bouton joue un passage ; « Tout voir d'affilée » joue la vidéo en direct.
- **Options** : son, étiquettes son/vibration, réduire les animations.

## Ce qui est vérifié, et ce qui ne l'est pas

- **Vérifié** : la page s'ouvre sans erreur dans Chromium (Playwright, WebGL logiciel) ; chaque
  écran et le milieu de chaque transition ont été photographiés (`shots/`), regardés un par un,
  puis corrigés (page qui se refermait vers le mauvais coin, lune sous la carte, carte du hizb posée sur la carte d'accueil, raccourci « Reconnaître »
  qui ressemblait à un engrenage…). La vidéo a été enregistrée image par image depuis la page.
- **Pas vérifié** : rien n'a tourné sur un iPhone, ni sur une vraie carte graphique. Ici, le dessin
  3D est logiciel, autour de 5 images par seconde : la fluidité réelle (60 images/s visées) reste à
  mesurer sur un téléphone. Le texte de l'interface s'affiche ici en Inter ; sur un Mac ou un
  iPhone, en SF Pro. Le flou du verre (backdrop-filter) imite Liquid Glass, il n'est pas Liquid
  Glass. Les sons n'ont pas été écoutés (machine sans haut-parleur) : seul leur déclenchement est
  vérifié. Les vibrations sont indiquées, pas jouées (le navigateur de l'iPhone ne vibre pas).
  Je n'ai pas recalculé les contrastes du texte sur le verre à toutes les heures (le coucher de
  soleil est le cas le plus délicat).
- Le texte uthmani vient des données de l'appli, faites pour la police KFGQPC ; affiché ici en
  Amiri Quran, quelques signes peuvent différer légèrement de l'appli.

## Accessibilité et mouvement

- « Réduire les animations » (réglage du système ou case du panneau) : plus de balancement, d'eau
  qui coule, de papillons ni de pétales ; les transitions deviennent des fondus courts ; la goutte
  est remplacée par la mise à jour directe du compteur.
- Le verre devient opaque si « Réduire la transparence » est activé.
- Tout ce qui bouge passe par `transform` et `opacity` (ou la caméra 3D) ; les animations suivent
  les courbes des skills (ease-out fort, ease-in-out, courbe de tiroir iOS) ; toutes partagent une
  même horloge, qu'on peut ralentir ou arrêter pour les photographier.

## Pour la suite (idées d'implémentation dans l'appli)

- Eau qui coule, balancement des feuilles, vague de passage : quelques lignes ajoutées aux
  matériaux de `garden-three.ts` (`onBeforeCompile`), sans changer le fichier `garden.glb`.
- Ciel : une table d'images-clés par heure (couleurs du ciel, lumière du soleil ou de la lune),
  `js/sky.js`.
- La goutte, la rosace, le badge : `js/fx.js`, `js/rosette.js`.
- La pousse au retour : `growOnReturn()` dans `js/app.js` (la pousse est mise en attente pendant la lecture).

## Sources et licences

| Élément | Source | Licence |
| --- | --- | --- |
| three.js r187 | `quran/node_modules/three` (`three.module.js` + `three.core.js`, regroupés et minifiés en `js/vendor/three.min.js` pour s'ouvrir sans serveur) | MIT, `js/vendor/three-LICENSE.txt` |
| Jardin 3D | `quran/assets/models/garden/level-1/garden.glb`, intégré en base64 dans `assets/garden.glb.js` | Modèles CC0 (Quaternius, Kenney), voir `assets/fallback/NOTICE-garden.txt` |
| Images de repli (sans WebGL) | 3 images de `quran/assets/images/garden/level-1/base` | Idem |
| Fraunces SemiBold | `onb-styles/voice/fonts` | OFL, `fonts/Fraunces-OFL.txt` |
| Amiri Quran | `onb-styles/cinematic/fonts` | OFL, `fonts/AmiriQuran-OFL.txt` |
| Inter (repli de SF Pro) | maquettes du 26 novembre | OFL, `fonts/Inter-LICENSE.txt` |
| Texte du Coran | `quran/assets/data/verses` (uthmani, imlaei), Al-Kahf 1 à 34, par `tools/extract_text.py` | Données de l'appli, voir `quran/assets/data/NOTICE.txt` |
| Sons | Fabriqués dans la page (WebAudio), aucun fichier | Code du projet |

La police KFGQPC de l'appli n'est pas reprise (sa licence n'en permet pas la diffusion).
GLTFLoader n'a pas été copié : le fichier du jardin est un format « cuit » propre à l'appli, lu par
la copie de son propre lecteur (`js/garden-model.js`), comme dans l'appli.

## Refaire les images et la vidéo

```
python3 tools/shoot.py              # toutes les images de shots/
python3 tools/shoot.py lire khatma  # seulement celles dont le nom contient ces mots
python3 tools/record.py             # review/demo.webm, image par image (≈ 10 min ici)
python3 tools/extract_text.py       # js/quran-text.js depuis les données de l'appli
python3 tools/compare.py            # review/compare-pastille-*.png (pastille en bas / en haut)
```
