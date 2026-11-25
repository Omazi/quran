# Sources des données du Coran

Ce document dit, pour chaque fichier source, d'où il vient et sous quelle licence, **dans la
limite de ce qui a pu être établi**. Ce qui n'a pas pu l'être est écrit comme tel : voir
« Risques ouverts ». Rien ici n'est supposé.

Dernière vérification : 24 novembre 2026 ; écriture simple ajoutée le 25 novembre 2026 (D41). Outil : `tools/quran-data`. Spécification :
[specs/quran.md](specs/quran.md). Décision sur le texte et la police : D19.

## Résumé

| Fichier source                            | Sert à                                           | Origine établie                                                                             | Licence annoncée par l'origine                                                                               |
| ----------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `hafsData_v18.json`                       | Texte uthmani ; texte simple (colonne imlâ'î)    | Données Hafs du complexe du roi Fahd, version 0.18, copie du miroir GitHub `ibnhazm/kfgqpc` | Aucun texte de licence trouvé pour ce fichier                                                                |
| Police `KFGQPC HAFS Uthmanic Script` 0.18 | Affichage du texte uthmani                       | Même miroir, même version                                                                   | Licence portée par la police : gratuite, usage, copie et diffusion permis ; vente et modification interdites |
| `tanzil_simple.json`                      | Second texte, noms des sourates, contrôle croisé | Paquet npm `@muslims-community/quran@1.1.0`, qui reprend un texte de Tanzil                 | Texte : CC BY 3.0 et conditions de Tanzil, d'après le paquet                                                 |
| `qpages/001.json`…`604.json`              | Mise en page : pages, lignes, place des mots     | Paquet npm `quran-qcf4@1.1.0`                                                               | MIT pour les données, d'après le paquet                                                                      |
| paquet npm `quran-meta`                   | Début des 60 hizb, contrôles croisés             | Registre npm, version 7.0.0, `devDependency`                                                | MIT                                                                                                          |
| `ara-quransimple.json`                    | Jeux d'essai de la reconnaissance, rien d'autre  | **Non identifiée**                                                                          | Inconnue                                                                                                     |

« Origine établie » veut dire : le fichier est identique, octet pour octet, à un fichier
publié (paquet npm ou dépôt GitHub à un commit donné), téléchargé et comparé. Cela ne dit
pas d'où ce paquet ou ce dépôt tient lui-même ses données : ce point est traité source par
source.

Les sources sont copiées telles quelles, compressées, dans `tools/quran-data/sources/`.
L'empreinte SHA-256 de chaque fichier d'origine est dans
`tools/quran-data/sources/SHA256SUMS` ; la génération refuse un fichier dont l'empreinte
diffère.

**Le texte uthmani et sa police vont ensemble.** Ils viennent du même éditeur et de la même
version (0.18). Ne jamais changer l'un sans l'autre : voir « Texte et police ».

**Le fichier `tanzil_simple.json` n'est pas de l'écriture simple.** C'est le texte « Uthmani
Minimal » de Tanzil. Il est livré sous son vrai nom, `uthmani-minimal`. L'écriture simple
(imlâ'î) du lecteur vient du fichier du Complexe, colonne `aya_text_emlaey` (section 1, D41).

## Détail par source

### 1. `hafsData_v18.json` : texte uthmani du complexe du roi Fahd

- **Empreinte SHA-256** : `5d8bb91726e482839d0057633cb1973031e4d706fa9604eea5e08892f20ba140` (3 582 144 octets). Les notes de version de l'éditeur sont
  archivées à côté (`hafsData_v18.README.md`, empreinte
  `3dc7b9d964ef7ffa268ba8f0ccea96cf9ca9b39a0bf2789b2bf97bd3abab25bf`).
- **Origine établie** : fichier `hafs/data/hafsData_v18.json` du dépôt GitHub
  `ibnhazm/kfgqpc`, commit `25f2f8886d6ad0b47190f252d9d7fb1e296f3231`. Ce dépôt se présente
  comme une copie de la page pour développeurs du complexe du roi Fahd
  (`qurancomplex.gov.sa/en/techquran/dev/`). Les notes jointes disent : « KFGQPC Hafs Uthmanic
  Data, Version: 0.18, Date: 2021-10-25 ».
- **Non vérifié** : que ce fichier est identique à celui que le Complexe distribue. Le site
  du Complexe est inaccessible depuis l'environnement de travail. Indice de cohérence : les
  textes de quatre autres versions (0.13, 2.0, 2.1, 2.2), pris dans un second dépôt
  (`nuqayah/qpc-fonts`), ne diffèrent de celui-ci que sur des points précis et peu nombreux.
- **Licence** : aucun texte de licence n'accompagne le fichier de données dans le dépôt. La
  police distribuée avec lui porte la licence du Complexe (section 2). La page officielle n'a
  pas pu être relue ; la décision D19 en rapporte le contenu : gratuité, interdiction de
  modifier et de vendre, rien sur l'intégration dans une appli.
- **Ce qui est extrait, et rien d'autre.** Le texte d'un verset vient de la colonne
  `aya_text`, qui donne le verset tel que l'éditeur l'imprime. Deux retraits exactement,
  écrits dans `tools/quran-data/lib/texts.mjs` (`verseTextOf`) :
  1. à la fin, l'espace insécable (U+00A0) et le numéro du verset en chiffres arabes
     (U+0660 à U+0669) : 6 236 versets, et le numéro est contrôlé contre celui du verset ;
  2. au début, l'espace insécable qui suit le signe de quart de hizb ۞ : 199 versets. Le
     signe est gardé.
     La génération échoue s'il reste une espace insécable ou un chiffre ailleurs. `data:verify`
     refait ces deux retraits avec un code distinct et compare caractère par caractère ; un
     test remet en place ce qui a été retiré et retrouve `aya_text` à l'identique pour les
     6 236 versets.
- **Texte simple (D41)** : la colonne `aya_text_emlaey` donne le même verset en écriture
  courante (imlâ'î), **sans voyelles** ; les notes de l'éditeur la disent faite « for search
  purpose » et précisent que la version 0.18 en a retiré les kashidas. Elle est copiée **sans
  aucun changement** dans `assets/data/verses/imlaei.json` : pas de retrait, pas de
  normalisation. Ses mots sont séparés par une seule espace (contrôlé à la génération) ; 61
  versets n'ont pas le même nombre de mots que le texte uthmani (orthographes différentes), ce
  qui ne gêne pas le lecteur, qui affiche le verset entier. `data:verify` compare chaque verset à
  la colonne, caractère pour caractère. Licence : celle du fichier (ci-dessus), déjà assumée par
  D19 et D21 pour le texte uthmani. **Non vérifié** : la relecture par une personne compétente.
- **Autres colonnes** : `sora` et `aya_no` identifient le verset. `page` sert de contrôle :
  elle donne le même premier verset que la mise en page pour les 604 pages. Les noms de
  sourate servent de contrôle. `jozz` n'est pas lue : elle place 3:92 et 9:93 dans le
  mauvais juz, alors que le signe ۞ du texte lui-même est en 3:93 et 9:93.

### 2. Police `KFGQPC HAFS Uthmanic Script`, version 0.18

- **Fichier** : `assets/fonts/KFGQPC-HAFS-Uthmanic-Script-v0.18.ttf`, 242 368 octets,
  SHA-256 `a0636e68e375af9552470d67773936f54d536e6586ce2608311b2fe7f9cbec3a`. Seul le nom du
  fichier a changé ; le contenu est celui de `hafs/font/hafs.18.ttf` du même dépôt, même
  commit. Un test contrôle cette empreinte.
- **Licence portée par le fichier lui-même** (table des noms, recopiée en entier dans
  `assets/fonts/NOTICE.txt`) : copyright 2010 du complexe du roi Fahd ; « Permission is hereby
  granted, Free of Cost, to any person obtaining a copy of this Font accompanying this
  license, the rights to Use, Copy, Distribute », à condition de ne pas la vendre, la
  modifier, l'altérer ni en faire l'ingénierie inverse. Le champ d'intégration `fsType` vaut 0
  (aucune restriction déclarée).
- **Non établi** : si le Complexe considère l'intégration dans une appli comme une
  « diffusion » permise. Le fichier ne le dit pas ; la décision D19 assume ce point. La
  mention du Complexe est à faire figurer dans les crédits.
- **Interdits qui en découlent** : ne pas convertir la police (woff, sous-ensemble), ne pas
  la retoucher, ne pas la vendre.

### 3. `tanzil_simple.json` : texte « Uthmani Minimal » de Tanzil

- **Empreinte SHA-256** : `a93b85d35660b1fbcce78a17fc50196845a0029e066aef77b2ff93ebee52ec5d`
- **Origine établie** : identique, octet pour octet, à `dist/quran.json` du paquet npm
  [`@muslims-community/quran`](https://www.npmjs.com/package/@muslims-community/quran)
  version 1.1.0 (auteur déclaré : Muslims Community ; dépôt déclaré :
  `github.com/Muslims-Community/quran-data-js`). Vérifié avec
  `npm pack @muslims-community/quran@1.1.0` (somme SHA-1 de l'archive
  `fea2d0951207aed154a89b3d970f7cea6288866e`).
- **Ce que dit le paquet** : son README donne pour source « Tanzil Project - Uthmani
  Minimal, Version 1.1 ». Le fichier porte les champs `source` « Tanzil Project -
  https://tanzil.net », `version` « 1.1 », `copyright` « Copyright (C) 2007-2025 Tanzil
  Project », `license` « Creative Commons Attribution 3.0 ».
- **Ce n'est pas de l'écriture simple**, malgré le nom donné au fichier pendant les
  maquettes. Le texte suit l'orthographe uthmani, avec moins de signes. Exemples, verset 1:2
  mot 4 puis verset 2:3 mot 5 : texte du Complexe `ٱلۡعَٰلَمِينَ` et `ٱلصَّلَوٰةَ`, ce
  fichier `العٰلَمينَ` et `الصَّلوٰةَ`, là où l'écriture simple mettrait un alif.
  Mot pour mot, ses consonnes sont celles du texte uthmani sur les 6 236 versets : ce
  contrôle est refait à chaque génération.
- **Licence du texte**, telle que le paquet la rapporte dans son fichier `LICENSE` :
  - « The Quranic text is licensed under Creative Commons Attribution 3.0 » ;
  - « Permission is granted to copy and distribute verbatim copies of the text, but CHANGING
    IT IS NOT ALLOWED » ;
  - « The text can be used in any website or application, provided that its source (Tanzil
    Project) is clearly indicated, and a link is made to tanzil.net » ;
  - « This copyright notice shall be included in all verbatim copies of the text ».
- **Non vérifié** : ces conditions n'ont pas pu être relues sur tanzil.net (page de
  téléchargement inaccessible depuis l'environnement de travail), et la conformité du
  fichier au texte publié par Tanzil n'a pas pu être contrôlée. La FAQ de tanzil.net,
  consultée le 24 novembre 2026, dit des ressources du site : « They are available for
  non-commercial purposes ». Le code du paquet est sous licence MIT ; cette licence ne
  couvre pas le texte.
- **Défaut connu du fichier** : son champ `hizb` est faux. Il ne prend que les valeurs
  impaires 1, 3, 5… 59 (deux fois le juz, moins un). Il n'est jamais lu.
- **Utilisé** : le texte de chaque verset, sans le moindre changement, livré dans
  `assets/data/verses/uthmani-minimal.json`, accompagné de l'avis de Tanzil dans
  `assets/data/NOTICE.txt`. Les champs `juz` et `sajdah` servent seulement de contrôle croisé. Le nom arabe, la
  translittération et le lieu de révélation des sourates viennent aussi de ce fichier (le
  fichier du Complexe n'a pas de lieu de révélation et écrit ses noms pour sa police) ; les
  noms arabes sont contrôlés lettre à lettre contre ceux du Complexe, le lieu de révélation
  et le nombre de versets contre `quran-meta`.

### 4. `qpages/` : mise en page du mushaf

- **Empreintes SHA-256** : une par fichier dans `SHA256SUMS`. Empreinte de l'ensemble
  (SHA-256 des 604 lignes `<empreinte>  qpages/NNN.json` de ce fichier) :
  `4a75ae3a1dd6d14d5b135a496b1b2abc834854736983b577302fee516d48dff6`
- **Origine établie** : les 604 fichiers sont identiques, octet pour octet, aux fichiers
  `pages/NNN.json` du paquet npm [`quran-qcf4`](https://www.npmjs.com/package/quran-qcf4)
  version 1.1.0 (auteur déclaré : Mohamad Hajj Rabee ; dépôt déclaré :
  `github.com/MohamadHajjRabee/quran-qcf4`). Vérifié avec `npm pack quran-qcf4@1.1.0`
  (somme SHA-1 de l'archive `76bd6d9591ac1022a7efc3d9223af95b931000fb`).
- **Ce que dit le paquet** : mise en page du mushaf de Médine, édition 1441 H, 604 pages de
  15 lignes, décrite mot par mot avec les codes de glyphes des polices « QCF4 » du complexe
  du roi Fahd.
- **Licence** : d'après le `LICENSE.md` du paquet, les données JSON (dont `pages/`) sont
  sous licence MIT, « Copyright (c) 2026 Mohamad Hajj Rabee ». Les polices du paquet ne
  sont **pas** couvertes par cette licence : elles ne sont ni copiées ni utilisées ici.
- **Non établi** : d'où l'auteur tire ces données, et si le complexe du roi Fahd fait valoir
  des droits sur la mise en page elle-même. La licence MIT est celle que l'auteur du paquet
  donne à sa compilation.
- **Utilisé** : uniquement la place des mots (page, ligne, verset, rang), les lignes de
  titre de sourate et de basmala, et les signes de quart de hizb et de sajda. Les codes de
  glyphes et les noms de police ne sont pas lus. Le champ `text` de chaque mot (écriture
  courante, avec des restes d'entités HTML comme `&#1756;`) n'est jamais affiché : il sert
  à contrôler que chaque mot de la mise en page est bien le mot du texte placé à cet
  endroit.

### 5. Paquet npm `quran-meta` (outil de génération seulement)

- **Version** : 7.0.0, épinglée dans `package.json` (`devDependencies`) ; intégrité de
  l'archive dans `package-lock.json`.
- **Licence** : MIT, « Copyright (c) 2020 Quran-Center ».
- **Origine de ses données**, d'après son README : métadonnées de Tanzil, données des
  polices Hafs du complexe du roi Fahd et extraits de quranpedia.net. Non vérifié.
- **Utilisé** : la liste des 240 quarts de hizb, dont on tire le premier verset des 60 hizb
  et des 30 juz. Les autres listes (juz, sajda, sourates, pages) servent de contrôle croisé.
  Rien de ce paquet n'est embarqué dans l'appli, hormis ces 90 débuts de hizb et de juz.
- **Pourquoi une dépendance** : les sources de la maquette ne permettent pas de connaître
  les hizb qui commencent avec une sourate (7:1, 20:1, 22:1, 55:1, 62:1, 72:1, 87:1). Le
  mushaf n'imprime le signe ۞ qu'à l'intérieur des sourates, et le champ `hizb` du fichier
  Tanzil est faux.

### 6. `ara-quransimple.json` : utilisé dans des jeux d'essai seulement, provenance à confirmer

- **Où** : sur la machine de développement, hors dépôt. Il n'est ni copié dans
  `tools/quran-data/sources/`, ni lu par la génération, ni livré dans `assets/data`.
- **Empreinte SHA-256** : `e430798cdda553f703b54f5601835bbbd8e9a81dce3db42c7e6f09314a4ec3cb`
  (1 912 135 octets).
- **Usage** : 80 versets en sont extraits dans
  `src/domain/recognition/__fixtures__/imlaei-sample.ts`, comme substitut de sortie vocale
  pour les tests du module de reconnaissance.
- **Origine non identifiée.** Le fichier ne porte aucune mention de source ni de licence, et
  il n'a pas pu être rattaché à un paquet publié (une seule piste essayée sur le registre
  npm, sans résultat). Les jeux d'essai le disent tiré du texte
  « Simple » de Tanzil (CC BY 3.0, copie conforme) : **non vérifié**.
- **Constats** : forme `{ "quran": [{ "chapter", "verse", "text" }] }`, 6 236 versets,
  orthographe courante (verset 2:3 mot 5 : `الصَّلَاةَ`, avec alif). Le premier verset de
  chaque sourate, sauf la 9, y commence par la basmala (pour la sourate 1, c'est le verset
  lui-même). Les fichiers voisins du même dossier, de
  14 octets, contiennent « 404: Not Found » : il s'agit de téléchargements depuis une
  adresse web qui n'est pas connue.
- **À faire avant tout usage hors des tests** : retrouver l'origine, comparer avec le texte
  publié par Tanzil et relire ses conditions.

### Source retirée : `quran.json` du paquet npm `quran-json@3.1.2`

Jusqu'au 24 novembre 2026, le texte uthmani venait de ce paquet (empreinte
`d8a8adff387f60ce3ff7dbe3238dd9b27120bfe29d8fcb07ad2e89cad37cefd4`), qui l'attribue à
quranenc.com. Il n'est plus utilisé nulle part. Il a été retiré parce qu'il ne correspondait
exactement au texte d'aucune version de la police : 1 117 tatweel en plus, une espace fine
(U+2009) sans glyphe dans 2:72, deux espaces en moins (37:164 et 41:47), et le signe U+065C
en 11:41, dont le dessin change selon la version. 974 versets ont changé avec la nouvelle
source ; aucune lettre ne change (contrôle des consonnes mot à mot contre le texte de
Tanzil, avant et après).

## Texte et police : ne jamais mélanger les versions

Le Complexe a changé le sens de certains points de code d'une version à l'autre de sa
police. Constat fait en comparant les dessins des glyphes de six versions (0.09, 0.13, 0.18,
2.0, 2.1, 2.2) :

- le dessin que la version 0.13 donne à U+065C (le point de l'imâla de 11:41) est celui que
  les versions 0.18 et suivantes donnent à U+06EA ; à partir de 0.18, U+065C dessine un
  autre signe. Le texte 0.13 écrit 11:41 avec U+065C, le texte 0.18 avec U+06EA ;
- le mot de 2:72 est écrit autrement à partir de 0.18 (notes de version de l'éditeur) ;
- les trois formes de tanwin (U+0656, U+0657, U+065E), U+06EC et U+06E4 ont le même dessin
  de 0.13 à 2.2.

Un texte d'une version affiché avec la police d'une autre montre donc un signe faux en
11:41. **Règle : le texte et la police se remplacent ensemble, par le texte et la police
d'une même version, jamais séparément.** Le test
`tools/quran-data/__tests__/font-coverage.test.js` échoue si la police n'est pas le fichier
vérifié, ou si un point de code du texte n'a pas de glyphe dans la police.

Rendus de contrôle faits avec Chromium (hors dépôt) : ils montrent les signes attendus avec
la police 0.18 et des signes différents avec Amiri Quran. **Une personne qui lit le Coran
doit confirmer les dessins, sur un appareil** : le moteur de texte du téléphone n'est pas
celui du navigateur.

## Caractères du texte uthmani

Le texte emploie des points de code avec le sens que leur donne la police du Complexe, qui
n'est pas toujours leur sens Unicode. Comptes vérifiés sur
`assets/data/verses/uthmani.json` (72 points de code distincts, tous présents dans la
police livrée) :

| Point de code | Nom Unicode                                 | Occurrences | Emploi constaté dans ce texte                                                                    |
| ------------- | ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| U+0657        | ARABIC INVERTED DAMMA                       | 2 901       | Tanwin : le texte de Tanzil porte un tanwin fatha (U+064B) sur le même mot, 2 901 fois sur 2 901 |
| U+065E        | ARABIC FATHA WITH TWO DOTS                  | 1 807       | Tanwin : Tanzil porte un tanwin damma (U+064C), 1 807 sur 1 807                                  |
| U+0656        | ARABIC SUBSCRIPT ALEF                       | 1 935       | Tanwin : Tanzil porte un tanwin kasra (U+064D), 1 935 sur 1 935                                  |
| U+06EA        | ARABIC EMPTY CENTRE LOW STOP                | 1           | 11:41 mot 6 (imâla)                                                                              |
| U+06EC        | ARABIC ROUNDED HIGH STOP WITH FILLED CENTRE | 2           | 12:11 mot 6 et 41:44 mot 9                                                                       |
| U+06E4        | ARABIC SMALL HIGH MADDA                     | 26          | Trait au-dessus des mots de prosternation, dans 15 versets                                       |

Les trois premiers font 6 643 signes de tanwin ; le texte porte aussi les tanwin habituels
(U+064B 734 fois, U+064C 578, U+064D 599). Les versets qui portent U+06E4 sont 7:206, 13:15,
16:49, 17:107, 19:58, 22:18, 22:77, 25:60, 27:25, 32:15, 38:24, 41:37, 53:62, 84:21 et
96:19 : onze portent aussi le signe ۩, quatre (16:49, 17:107, 27:25, 41:37) précèdent le
verset qui le porte. Le texte contient 568 tatweel (U+0640), aucune espace autre que
l'espace ordinaire, et aucun U+065C.

**Avec une autre police, ces signes sont faux** : Amiri Quran dessine une damma inversée
pour U+0657, un alif souscrit pour U+0656 et n'a pas de glyphe pour U+065E. C'est la raison
de la décision D19. **Le texte stocké n'est jamais modifié** pour une police.

**Le texte n'est pas en forme NFC et ne doit jamais être normalisé.** 5 722 des 6 236 versets
du texte uthmani et 5 019 de ceux du texte de Tanzil changeraient sous
`String.prototype.normalize('NFC')` : l'ordre des signes serait modifié, l'empreinte ne
correspondrait plus et le texte ne serait plus celui de la source. La comparaison de textes
se fait sur des clés à part.

## Incohérences entre sources

Chacune est déclarée dans `tools/quran-data/lib/declared.mjs` et contrôlée à chaque
génération. La génération échoue si une déclaration est fausse, manquante ou devenue
inutile. Il n'y a aucun repli.

### Les versets qui ne s'alignaient pas avec la mise en page

**Quinze versets : le signe de sajda.** La mise en page compte le signe ۩ comme un mot de
plus, avec le texte `#1969`. Le texte uthmani colle le signe au dernier mot du verset
(7:206 se termine par `يَسۡجُدُونَۤ۩`). Le signe n'est pas un mot : il est
retiré de la mise en page et reste dans le texte, là où l'éditeur l'écrit. Versets : 7:206,
13:15, 16:50, 17:109, 19:58, 22:18, 22:77, 25:60, 27:26, 32:15, 38:24, 41:38, 53:62, 84:21,
96:19. Les quatre sources donnent la même liste.

**Trois versets : deux mots que l'éditeur écrit sans espace.**

| Verset | Rang du mot | Texte du Complexe (un mot) | Texte de Tanzil (deux mots) |
| ------ | ----------- | -------------------------- | --------------------------- |
| 15:7   | 1           | لَّوۡمَا                       | لَو ما                       |
| 27:20  | 4           | مَالِيَ                       | ما لِىَ                       |
| 36:22  | 1           | وَمَالِيَ                      | وَما لِىَ                      |

La mise en page et le texte de Tanzil comptent deux mots ; le Complexe n'en écrit qu'un,
dans toutes les versions de son texte qui ont été comparées (0.13, 0.18, 2.0, 2.1, 2.2).
C'est donc l'écriture de l'éditeur. Le texte est gardé tel quel. Le mot occupe les deux
places voisines de la mise en page, toujours sur la même ligne, et compte pour un seul mot :
dans ces trois versets, le texte uthmani a un mot de moins que le texte de Tanzil. Le suivi
de récitation mot à mot doit en tenir compte. (L'ancienne source collait aussi 37:164 et
41:47 ; le Complexe les sépare.)

Après cela, chaque mot de la mise en page a les mêmes consonnes que le mot du texte placé au
même endroit, pour les 77 430 mots, et chaque mot du texte uthmani a les mêmes consonnes que
le ou les mots correspondants du texte de Tanzil.

### Autres écarts

- **Quart de hizb en 15:49 ou 15:50.** `quran-meta` place un quart de hizb en 15:50 ; la
  mise en page et le texte uthmani portent le signe ۞ en 15:49. Les deux sources du mushaf
  l'emportent. Aucun début de hizb ou de juz n'est concerné, et les quarts de hizb ne sont
  pas livrés dans les données.
- **Colonne `jozz` du fichier du Complexe.** Elle place 3:92 dans le juz 4 et 9:93 dans le
  juz 10. Le signe ۞ du même fichier, `quran-meta` et le fichier Tanzil donnent 3:93 et 9:93
  comme débuts des juz 4 et 11. La colonne n'est pas utilisée.
- **Début de 25 pages.** La mise en page et la liste de pages de `quran-meta` ne font pas
  commencer 25 pages au même verset. Les pages de l'appli suivent la mise en page. Le
  fichier du Complexe (colonne `page`) donne le même premier verset que la mise en page pour
  les 604 pages : c'est l'édition de 1441 H, retenue par le propriétaire. Conséquence : sur
  ces pages, le numéro de page d'un verset peut différer de celui d'autres applis et du
  mushaf de Médine classique. **Rien de cela n'a été comparé à un mushaf imprimé** : une
  personne doit le faire avant publication, pour ces 25 pages au moins.

| Page | Premier verset, mise en page et Complexe | Premier verset, `quran-meta` |
| ---- | ---------------------------------------- | ---------------------------- |
| 121  | 5:78                                     | 5:77                         |
| 122  | 5:84                                     | 5:83                         |
| 123  | 5:91                                     | 5:90                         |
| 145  | 6:131                                    | 6:132                        |
| 532  | 55:19                                    | 55:17                        |
| 533  | 55:42                                    | 55:41                        |
| 534  | 55:70                                    | 55:68                        |
| 565  | 68:17                                    | 68:16                        |
| 568  | 69:36                                    | 69:35                        |
| 570  | 70:41                                    | 70:40                        |
| 576  | 74:19                                    | 74:18                        |
| 584  | 79:17                                    | 79:16                        |
| 586  | 80:41                                    | 81:1                         |
| 588  | 83:5                                     | 83:7                         |
| 589  | 83:34                                    | 83:35                        |
| 590  | 84:25                                    | 85:1                         |
| 592  | 87:11                                    | 87:16                        |
| 593  | 88:23                                    | 89:1                         |
| 594  | 89:23                                    | 89:24                        |
| 595  | 90:19                                    | 91:1                         |
| 596  | 92:10                                    | 92:15                        |
| 597  | 94:3                                     | 95:1                         |
| 598  | 96:13                                    | 97:1                         |
| 599  | 98:6                                     | 98:8                         |
| 600  | 100:6                                    | 100:10                       |

- **Index du paquet `quran-qcf4`.** Son fichier `index.json` donne, pour six sourates (80,
  84, 88, 90, 94, 96), une dernière page qui contredit ses propres fichiers de pages. Ce
  fichier n'est pas utilisé.

## Données générées

`npm run data:build` écrit dans `assets/data` :

- `verses/uthmani.json`, `verses/uthmani-minimal.json` et `verses/imlaei.json`, de la forme
  `{ "<sourate>": ["verset 1", ...] }` ;
- `pages/pages-001-020.json` … `pages-601-604.json` : la mise en page, par tranches de
  20 pages. Chaque ligne est un titre de sourate, une basmala, ou une suite de segments
  `[verset, premier mot, dernier mot]`. Le texte n'y est pas répété ;
- `structure.json` : sourates, premier verset de chaque page, de chaque juz, de chaque hizb ;
- `integrity.json` : compteurs, empreinte de chaque fichier, empreinte des sources et
  empreinte du texte canonique (une ligne `<sourate>|<verset>|<texte>` par verset, UTF-8) ;
- `NOTICE.txt` : origine et avis de licence de chaque fichier, à garder avec les données.

Empreintes SHA-256 du texte canonique :

- uthmani : `f0cb43235f1ebb96cc5fa5de33c2043c04c3a68d7a11c63626fa7e4f0f2bb687`
- uthmani minimal : `432e8775149564af0cf0420b0b427eb90cb25d5d9f2118dc396afd2192814b4b`
- imlâ'î (écriture simple) : `177f2aeabdbde65193126fc402af2700cc81df7288eae9869e469a31dc493d6a`
  (77 491 mots)

Le texte uthmani compte 77 430 mots. Il contient, comme sa source, le signe ۞ collé au
premier mot de 199 versets, le signe ۩ collé au dernier mot de 15 versets, et les signes de
pause.

## Régénérer et vérifier

```bash
npm run data:build    # régénère tout assets/data ; deux exécutions donnent les mêmes fichiers
npm run data:verify   # revérifie sans rien écrire
```

`data:verify` contrôle les compteurs, les empreintes, que chaque mot de chaque verset est
placé une fois et dans l'ordre, que le texte est celui des sources caractère pour caractère
(aux deux retraits documentés près), et que les fichiers sont exactement ceux que la
génération produirait.

Les fichiers de `assets/data` ne se modifient jamais à la main. Pour refaire la copie des
sources : `node tools/quran-data/import-sources.mjs <dossier des sources>`.

Pour revérifier l'origine d'une source : cloner le dépôt au commit indiqué, ou télécharger
le paquet (`npm pack @muslims-community/quran@1.1.0`, `npm pack quran-qcf4@1.1.0`), puis
comparer l'empreinte SHA-256 des fichiers avec `SHA256SUMS`.

## Risques ouverts

1. **Licence du texte et de la police du Complexe.** La police porte une licence qui permet
   l'usage, la copie et la diffusion gratuits, et interdit la vente et la modification. Aucun
   texte de licence n'a été trouvé pour le fichier de données, et la page officielle n'a pas
   pu être relue. L'intégration dans une appli n'est pas traitée explicitement : la décision
   D19 l'assume, dans une appli gratuite, avec la mention du Complexe.
2. **Copie prise sur un miroir.** Texte et police viennent d'un dépôt GitHub tiers. Leur
   identité avec les fichiers du Complexe n'a pas pu être contrôlée à la source. À faire
   avant publication : télécharger sur le site du Complexe et comparer les empreintes.
3. **Texte de Tanzil reçu par un intermédiaire.** Le fichier vient d'un paquet tiers, dont
   un champ est faux. Sa conformité au texte publié par Tanzil et les conditions
   d'utilisation n'ont pas pu être relues à la source (dont la mention « non-commercial » de
   la FAQ).
4. **Écriture simple sans voyelles.** Le second texte (Tanzil) est de l'uthmani à signes
   réduits et n'est pas présenté comme de l'écriture simple. L'écriture simple du lecteur est la
   colonne imlâ'î du Complexe (D41), qui n'a pas de voyelles. Une écriture simple voyellée
   demanderait une autre source dont la licence passe la règle du propriétaire ; le
   propriétaire a décidé de garder le texte sans voyelles (D41).
5. **Droits sur la mise en page.** La licence MIT couvre la compilation de l'auteur du
   paquet. La position du Complexe sur la réutilisation de la mise en page n'est pas établie.
6. **Édition du mushaf.** Édition de 1441 H, choisie par le propriétaire. Sur 25 pages (121 à
   123, 145, 532 à 534, 565, 568, 570, 576, 584, 586, 588 à 590, 592 à 600), le premier verset
   diffère de celui du mushaf de Médine classique. À comparer avec un mushaf imprimé par une
   personne avant publication.
7. **Rendu sur appareil.** Les dessins n'ont été vus que dans un navigateur. Une personne
   compétente doit relire le rendu sur téléphone. Le texte n'est pas en forme NFC et ne doit
   jamais être normalisé.
8. **Fichier `ara-quransimple.json`.** Origine non identifiée ; utilisé dans des jeux
   d'essai seulement. À ne pas embarquer dans l'appli sans en avoir établi l'origine.
9. **Aucune relecture humaine du texte.** Les contrôles sont automatiques : empreintes,
   comparaison de deux textes d'éditeurs différents, comparaison avec la mise en page. Ils
   ne remplacent pas la validation par une personne compétente.

## Mentions à prévoir dans l'appli

À afficher dans un écran de crédits, sous réserve des points ci-dessus :

- texte uthmani, texte simple et police : complexe du roi Fahd pour l'impression du Noble Coran
  (King Fahd Glorious Quran Printing Complex), Médine ;
- police de l'écriture simple : Amiri, The Amiri Project Authors (SIL Open Font License 1.1) ;
- second texte : Tanzil Project, avec un lien vers tanzil.net et son avis de copyright ;
- mise en page : paquet `quran-qcf4` de Mohamad Hajj Rabee (MIT), d'après le mushaf de
  Médine du complexe du roi Fahd ;
- structure : paquet `quran-meta` de Quran-Center (MIT).

Le texte complet des avis est dans `assets/data/NOTICE.txt` et `assets/fonts/NOTICE.txt`.

## Annexe : avis de licence MIT

La licence MIT demande de reproduire l'avis de copyright et le texte de permission. Les
deux paquets portent le même texte, avec leur ligne de copyright :

- `quran-qcf4`, données JSON : Copyright (c) 2026 Mohamad Hajj Rabee
- `quran-meta` : Copyright (c) 2020 Quran-Center

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
