# Sources des données du Coran

Ce document dit, pour chaque fichier source, d'où il vient et sous quelle licence, **dans la
limite de ce qui a pu être établi**. Ce qui n'a pas pu l'être est écrit comme tel : voir
« Risques ouverts ». Rien ici n'est supposé.

Dernière vérification : 24 novembre 2026. Outil : `tools/quran-data`. Spécification :
[specs/quran.md](specs/quran.md).

## Résumé

| Fichier source               | Sert à                                       | Origine établie                                                             | Licence annoncée par l'origine                               |
| ---------------------------- | -------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `quran.json`                 | Texte uthmani, noms des sourates             | Paquet npm `quran-json@3.1.2`                                               | **Contradictoire** : CC BY 4.0 ou CC BY-SA 4.0               |
| `tanzil_simple.json`         | Second texte, contrôle croisé                | Paquet npm `@muslims-community/quran@1.1.0`, qui reprend un texte de Tanzil | Texte : CC BY 3.0 et conditions de Tanzil, d'après le paquet |
| `qpages/001.json`…`604.json` | Mise en page : pages, lignes, place des mots | Paquet npm `quran-qcf4@1.1.0`                                               | MIT pour les données, d'après le paquet                      |
| paquet npm `quran-meta`      | Début des 60 hizb, contrôles croisés         | Registre npm, version 7.0.0, `devDependency`                                | MIT                                                          |

« Origine établie » veut dire : le fichier est identique, octet pour octet, à un fichier d'un
paquet publié, téléchargé et comparé. Cela ne dit pas d'où le paquet tient lui-même ses
données : ce point est traité source par source.

Les trois fichiers viennent du dossier des essais de maquette, hors dépôt. Ils sont copiés
tels quels, compressés, dans `tools/quran-data/sources/`. L'empreinte SHA-256 de chaque
fichier d'origine est dans `tools/quran-data/sources/SHA256SUMS` ; la génération refuse un
fichier dont l'empreinte diffère.

**Constat important : le fichier `tanzil_simple.json` n'est pas de l'écriture simple.**
C'est le texte « Uthmani Minimal » de Tanzil. Il est livré sous son vrai nom,
`uthmani-minimal`. L'appli n'a pas encore de texte en écriture simple (imlâ'î).

## Détail par source

### 1. `quran.json` : texte uthmani

- **Empreinte SHA-256** : `d8a8adff387f60ce3ff7dbe3238dd9b27120bfe29d8fcb07ad2e89cad37cefd4`
- **Origine établie** : identique, octet pour octet, à `dist/quran.json` du paquet npm
  [`quran-json`](https://www.npmjs.com/package/quran-json) version 3.1.2 (auteur déclaré :
  Risan Bagja Pradana ; dépôt déclaré : `github.com/risan/quran-json`). Vérifié avec
  `npm pack quran-json@3.1.2` (somme SHA-1 de l'archive
  `6cfe0249dc0db413cf582358925717a74a934d7d`).
- **Origine du texte lui-même** : le README du paquet dit que le texte uthmani vient de
  « The Noble Qur'an Encyclopedia » (quranenc.com). **Non vérifié** : quranenc.com était
  inaccessible depuis l'environnement de travail (refus du proxy). L'éditeur d'origine du
  texte n'est donc pas établi.
- **Licence** : le paquet se contredit. Son `package.json` déclare `CC-BY-4.0` ; son
  `LICENSE.txt` et son README déclarent CC BY-SA 4.0 (partage dans les mêmes conditions).
  Les conditions de quranenc.com pour le texte arabe ne sont pas connues.
- **Obligations** : dans les deux cas, créditer la source. Si CC BY-SA s'applique, les
  données dérivées doivent être partagées sous la même licence. À trancher : voir
  « Risques ouverts ».
- **Utilisé** : le texte de chaque verset, sans le moindre changement, et pour chaque
  sourate le nom arabe, la translittération, le nombre de versets et le lieu de révélation.

### 2. `tanzil_simple.json` : texte « Uthmani Minimal » de Tanzil

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
  mot 4 puis verset 2:3 mot 5 : texte uthmani `ٱلۡعَٰلَمِينَ` et `ٱلصَّلَوٰةَ`, ce
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
  `assets/data/NOTICE.txt`. Les champs `juz` et `sajdah` servent seulement de contrôle croisé.

### 3. `qpages/` : mise en page du mushaf

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

### 4. Paquet npm `quran-meta` (outil de génération seulement)

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

## Incohérences entre sources

Chacune est déclarée dans `tools/quran-data/lib/declared.mjs` et contrôlée à chaque
génération. La génération échoue si une déclaration est fausse, manquante ou devenue
inutile. Il n'y a aucun repli.

### Les vingt versets qui ne s'alignaient pas

L'alignement mot à mot entre la mise en page et le texte uthmani échouait sur vingt
versets, pour deux causes distinctes.

**Quinze versets : le signe de sajda.** La mise en page compte le signe ۩ comme un mot de
plus, avec le texte `#1969`. Le texte uthmani colle le signe au dernier mot du verset
(7:206 se termine par `يَسۡجُدُونَۤ۩`). Le signe n'est pas un mot : il est
retiré de la mise en page et reste dans le texte, là où la source l'écrit. Versets : 7:206,
13:15, 16:50, 17:109, 19:58, 22:18, 22:77, 25:60, 27:26, 32:15, 38:24, 41:38, 53:62, 84:21,
96:19. Les quatre sources donnent la même liste.

**Cinq versets : deux mots écrits sans espace dans le texte uthmani.**

| Verset | Rang du mot | Texte uthmani (un mot) | Texte de Tanzil (deux mots) |
| ------ | ----------- | ---------------------- | --------------------------- |
| 15:7   | 1           | لَّوۡمَا                   | لَو ما                       |
| 27:20  | 4           | مَالِيَ                   | ما لِىَ                       |
| 36:22  | 1           | وَمَالِيَ                  | وَما لِىَ                      |
| 37:164 | 1           | وَمَامِنَّآ                 | وَما مِنّا                     |
| 41:47  | 25          | مَامِنَّا                  | ما مِنّا                      |

La mise en page et le texte de Tanzil comptent deux mots ; le texte uthmani n'en écrit
qu'un. **Décision** : le texte est gardé tel que la source le publie, sans ajouter d'espace.
Le mot occupe les deux places voisines de la mise en page, qui sont toujours sur la même
ligne. Il compte pour un seul mot : dans ces cinq versets, le texte uthmani a un mot de
moins que le texte de Tanzil. On ne sait pas si l'absence d'espace vient de l'éditeur
d'origine ou d'une étape intermédiaire.

**À décider par le propriétaire** : garder ce choix (fidélité à la source) ou insérer
l'espace (fidélité à la mise en page et à Tanzil, au prix d'une modification du texte). Le
suivi de récitation mot à mot devra tenir compte de ces cinq mots.

Après ces deux corrections, chaque mot de la mise en page a les mêmes consonnes que le mot
du texte placé au même endroit, pour les 77 428 mots.

### Autres écarts

- **Espace fine dans 2:72.** Le quatrième mot du verset contient une espace fine (U+2009) à
  l'intérieur du mot, dans la source. Elle est conservée. Les mots se séparent uniquement
  sur l'espace ordinaire (U+0020), avec `splitVerseWords`. Couper sur « tout blanc »
  donnerait onze mots au lieu de dix.
- **Quart de hizb en 15:49 ou 15:50.** `quran-meta` place un quart de hizb en 15:50 ; la
  mise en page et le texte uthmani portent le signe ۞ en 15:49. Les deux sources du mushaf
  l'emportent. Aucun début de hizb ou de juz n'est concerné, et les quarts de hizb ne sont
  pas livrés dans les données.
- **Début de 25 pages.** La mise en page (édition 1441 H) et la liste de pages de
  `quran-meta` ne font pas commencer 25 pages au même verset. Les pages de l'appli suivent
  la mise en page, puisque c'est elle qu'on affiche ; la liste de `quran-meta` n'est pas
  utilisée. Conséquence : sur ces pages, le numéro de page d'un verset peut différer de
  celui d'autres applis.

| Page | Premier verset, mise en page | Premier verset, `quran-meta` |
| ---- | ---------------------------- | ---------------------------- |
| 121  | 5:78                         | 5:77                         |
| 122  | 5:84                         | 5:83                         |
| 123  | 5:91                         | 5:90                         |
| 145  | 6:131                        | 6:132                        |
| 532  | 55:19                        | 55:17                        |
| 533  | 55:42                        | 55:41                        |
| 534  | 55:70                        | 55:68                        |
| 565  | 68:17                        | 68:16                        |
| 568  | 69:36                        | 69:35                        |
| 570  | 70:41                        | 70:40                        |
| 576  | 74:19                        | 74:18                        |
| 584  | 79:17                        | 79:16                        |
| 586  | 80:41                        | 81:1                         |
| 588  | 83:5                         | 83:7                         |
| 589  | 83:34                        | 83:35                        |
| 590  | 84:25                        | 85:1                         |
| 592  | 87:11                        | 87:16                        |
| 593  | 88:23                        | 89:1                         |
| 594  | 89:23                        | 89:24                        |
| 595  | 90:19                        | 91:1                         |
| 596  | 92:10                        | 92:15                        |
| 597  | 94:3                         | 95:1                         |
| 598  | 96:13                        | 97:1                         |
| 599  | 98:6                         | 98:8                         |
| 600  | 100:6                        | 100:10                       |

- **Index du paquet `quran-qcf4`.** Son fichier `index.json` donne, pour six sourates (80,
  84, 88, 90, 94, 96), une dernière page qui contredit ses propres fichiers de pages. Ce
  fichier n'est pas utilisé.
- **Substitution de caractère des maquettes.** Les maquettes remplaçaient le signe U+065E
  par U+064C pour la police Amiri Quran. Les données ne font aucune substitution : un
  ajustement de police se fait au rendu.

## Données générées

`npm run data:build` écrit dans `assets/data` :

- `verses/uthmani.json` et `verses/uthmani-minimal.json`, de la forme
  `{ "<sourate>": ["verset 1", ...] }` ;
- `pages/pages-001-020.json` … `pages-601-604.json` : la mise en page, par tranches de
  20 pages. Chaque ligne est un titre de sourate, une basmala, ou une suite de segments
  `[verset, premier mot, dernier mot]`. Le texte n'y est pas répété ;
- `structure.json` : sourates, premier verset de chaque page, de chaque juz, de chaque hizb ;
- `integrity.json` : compteurs, empreinte de chaque fichier, empreinte des sources et
  empreinte du texte canonique (une ligne `<sourate>|<verset>|<texte>` par verset, UTF-8) ;
- `NOTICE.txt` : origine et avis de licence de chaque fichier, à garder avec les données.

Empreintes SHA-256 du texte canonique :

- uthmani : `7b2b07124666739062f6992d914f2dc14fda010780aba524467cc56972d5bb0d`
- uthmani minimal : `432e8775149564af0cf0420b0b427eb90cb25d5d9f2118dc396afd2192814b4b`

Le texte uthmani contient, comme sa source, le signe ۞ collé au premier mot de 199 versets,
le signe ۩ collé au dernier mot de 15 versets, et les signes de pause.

## Régénérer et vérifier

```bash
npm run data:build    # régénère tout assets/data ; deux exécutions donnent les mêmes fichiers
npm run data:verify   # revérifie sans rien écrire
```

`data:verify` contrôle les compteurs, les empreintes, que chaque mot de chaque verset est
placé une fois et dans l'ordre, que le texte est identique à celui des sources caractère
pour caractère, et que les fichiers sont exactement ceux que la génération produirait.

Les fichiers de `assets/data` ne se modifient jamais à la main. Pour refaire la copie des
sources : `node tools/quran-data/import-sources.mjs <dossier des sources>`.

Pour revérifier l'origine d'une source : télécharger le paquet (`npm pack quran-json@3.1.2`,
`npm pack @muslims-community/quran@1.1.0` ou `npm pack quran-qcf4@1.1.0`), puis comparer
l'empreinte SHA-256 de ses fichiers avec `SHA256SUMS`.

## Risques ouverts

1. **Licence du texte uthmani.** Le paquet `quran-json` annonce deux licences différentes,
   et les conditions de l'éditeur d'origine ne sont pas connues. À clarifier avant
   publication. Si CC BY-SA s'applique, décider comment partager les données dérivées.
2. **Texte de Tanzil reçu par un intermédiaire.** Le fichier vient d'un paquet tiers, dont
   un champ est faux. Sa conformité au texte publié par Tanzil et les conditions
   d'utilisation n'ont pas pu être relues à la source. Avant publication : télécharger le
   texte sur tanzil.net, comparer, relire les conditions (dont la mention « non-commercial »
   de la FAQ).
3. **Pas d'écriture simple.** Le second texte est de l'uthmani à signes réduits. Si l'appli
   doit proposer une écriture imlâ'î, il faut une autre source, par exemple le texte
   « Simple » de Tanzil. Ce texte-ci ne doit pas être présenté comme de l'écriture simple.
4. **Droits sur la mise en page.** La licence MIT couvre la compilation de l'auteur du
   paquet. La position du complexe du roi Fahd sur la réutilisation de la mise en page du
   mushaf n'est pas établie. Voir aussi la décision D6 sur ses polices.
5. **Cinq mots collés** dans le texte uthmani : décision ci-dessus à confirmer.
6. **Édition du mushaf.** La mise en page suit l'édition 1441 H d'après le paquet. Sur
   25 pages, le premier verset diffère de la liste de `quran-meta`.
7. **Aucune relecture humaine du texte.** Les contrôles sont automatiques : empreintes,
   comparaison de deux textes d'éditeurs différents, comparaison avec la mise en page. Ils
   ne remplacent pas la validation par une personne compétente.

## Mentions à prévoir dans l'appli

À afficher dans un écran de crédits, sous réserve des points ci-dessus :

- texte uthmani : paquet `quran-json` de Risan Bagja Pradana, texte attribué par ce paquet à
  The Noble Qur'an Encyclopedia (quranenc.com), avec la licence retenue ;
- second texte : Tanzil Project, avec un lien vers tanzil.net et son avis de copyright ;
- mise en page : paquet `quran-qcf4` de Mohamad Hajj Rabee (MIT), d'après le mushaf de
  Médine du complexe du roi Fahd ;
- structure : paquet `quran-meta` de Quran-Center (MIT).

Le texte complet des avis est dans `assets/data/NOTICE.txt`.

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
