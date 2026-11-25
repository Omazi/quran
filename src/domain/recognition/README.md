# Reconnaissance de versets (cœur texte, sans audio)

Spécification : `docs/specs/recognition.md`, dont la dernière section (« Précisions ») fait
référence. Ce module reçoit du **texte arabe imparfait** (la sortie du moteur vocal) et fait
deux choses : retrouver quel passage est récité (« Shazam du Coran ») et suivre une lecture
mot à mot. TypeScript pur, aucune dépendance, le texte du Coran est injecté. Tout passe par
`index.ts`.

## Utilisation

```ts
import { createVerseIndex, createFollowSession, normalizeArabic } from '@/domain/recognition';

// 1. Retrouver un passage. L'index se construit une fois (0,1 s), avec les versets uthmani.
const index = createVerseIndex(verses); // { surah, verse, text }[] dans l'ordre du mushaf
const result = index.search(transcript.split(' ')); // mots bruts ou déjà normalisés

if (result.status === 'found') result.candidates[0]; // { start, end, score, confidence }
if (result.status === 'ambiguous') result.candidates.slice(0, result.tiedCount); // tous les lieux
if (result.status === 'not-found') result.reason; // 'too-few-words' | 'no-match'
if (result.truncated) result.tiedCount; // liste incomplète : voir « ex æquo » plus bas
if (result.inputTruncated) {
  // plus de 300 mots donnés : seuls les 300 derniers ont été cherchés
}

// 2. Suivre une lecture. Un mot attendu par entrée, tel qu'affiché.
const session = createFollowSession(expectedWords);
const { statuses, currentIndex, unmatchedStreak } = session.feed(newWords); // nouveaux mots seulement
```

| Fonction                        | Rôle                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `normalizeArabic(text)`         | Texte → mots comparables (`string[]`). Idempotent.                                          |
| `toAccentKey(word)`             | Seconde clé d'un mot, tolérante à l'accent.                                                 |
| `createVerseIndex(verses)`      | Index du corpus. `search(words, { minWords?, minScore?, maxAlternatives? })`.               |
| `createFollowSession(expected)` | Suivi. `feed(words)` et `snapshot()` rendent `{ statuses, currentIndex, unmatchedStreak }`. |
| `RECOGNITION_CONFIG`            | Tous les seuils, chacun avec sa raison (`config.ts`).                                       |

Entrées invalides (y compris des options `null` ou du mauvais type) : `TypeError` ou
`RangeError`, avec le nom de ce qui ne va pas. Une entrée vide ou non arabe n'est pas une
erreur : la recherche répond `not-found`, le suivi ne change pas.

## Comment ça marche

**Normalisation** (`normalize.ts`). On garde ce que les deux écritures ont en commun :
signes et tatweel retirés ; toute hamza, quel que soit son support, et l'alif initial
s'écrivent `ء` ; l'alif **à l'intérieur** d'un mot est retiré (l'uthmani l'écrit souvent en
petit alif suscrit, l'imlâ'î en lettre pleine, sans règle pour savoir lequel) ; l'alif final
est gardé, sauf l'alif muet après un wâw final ; un wâw ou un yâ' qui ne fait que porter un
alif suscrit (`ٱلصَّلَوٰةَ`, `هُدَىٰهُمۡ`) vaut cet alif ; `ى` → `ي`, `ة` → `ه`.
Toute espace Unicode sépare les mots ; les caractères de mise en forme (trait d'union
conditionnel, liant de mots, marques de sens) sont ignorés dans un mot ; un signe seul
n'est pas un mot. La clé d'accent regroupe ح/ه, ع/ء, ق/ك, ص/س/ث, ض/د, ط/ت, ذ/ز/ظ.

**Comparaison de deux mots** (`comparable-word.ts`) : 1 si identiques, 0,9 si seules les
lettres confondues diffèrent, sinon la part de lettres communes. À partir de 0,7 c'est le
même mot avec du bruit (une lettre fausse dès 4 lettres, deux dès 7). Un « mot » de plus de
30 lettres ne ressemble à rien, pas même à lui-même.

**Alignement** (`align.ts`), commun aux deux fonctions : meilleure chaîne de paires de mots
entre ce qui est entendu et le texte, avec mots faux, manquants, en trop, et **deux mots
pour un** (`يا أيها` entendu, `يَـٰٓأَيُّهَا` écrit ; ou mots collés par le moteur, y compris
quand le second commence par l'article : `لغيرالله`).

**Recherche** (`verse-index.ts`). Trois sources de lieux, puis un classement :

1. **Lieux exacts** : tous les endroits où les mots entendus se suivent à l'identique (aux
   lettres confondues près). Trouvés sans alignement, sans aucune borne.
2. **Lieux probables** : chaque mot entendu « vote » pour le lieu où le passage
   commencerait, les mots rares pèsent plus. Sont alignés mot à mot les lieux assez lourds,
   et ceux qui ont tous les mots entendus sauf un à leur place.
3. **Lieux jumeaux** : pour chaque meilleur lieu, tous les autres endroits du corpus qui
   portent exactement les mêmes mots. Ils reçoivent le même score, quel que soit le bruit.

Score = mots expliqués ÷ (mots entendus + mots du passage non entendus). Deux lieux à moins
d'un demi-mot d'écart (et jamais plus de 15 % de l'entrée) sont **ex æquo** : le résultat
est `ambiguous` et les liste tous, dans l'ordre du mushaf, jusqu'à 300 ; au-delà,
`truncated` est vrai et `tiedCount` donne le total. `confidence` = score, partagé entre les
lieux concurrents (trois ex æquo parfaits : un tiers chacun).
Coût : occurrences des mots entendus dans le corpus, plus, par lieu aligné, (mots
entendus) × (2 × tolérance + 1). L'entrée est limitée à ses 300 derniers mots, la tolérance
à 30 mots, le travail d'alignement à 30 000 comparaisons (5 lieux au moins) : le temps
croît avec la longueur de l'entrée, pas avec son carré.

**Suivi** (`follow-session.ts`). Le mot entendu est le mot courant : il est lu. Sinon, on
aligne les derniers mots entendus autour de la position pour savoir si le lecteur répète
(derrière) ou a passé des mots (devant). Un mot n'est déclaré passé qu'après 2 mots
reconnus à sa suite (4 pour un saut de plus de 2 mots). Il est `mistake` seulement si un mot
**clairement différent** (moins de la moitié des lettres communes, même sur la clé d'accent)
a été entendu à sa place, quelle que soit sa position, premier mot compris ; sinon
`skipped`, ou `read` au bénéfice du doute. Un statut ne régresse jamais ; un mot `skipped`
ou `mistake` relu correctement devient `read`.

## Décisions prises là où la spécification est floue

1. **Mots comparables = chaînes.** `normalizeArabic` rend des `string[]` ; `search` et
   `feed` renormalisent chaque entrée (c'est idempotent), on peut donc leur passer des mots
   bruts ou normalisés, ou des morceaux de texte.
2. **`feed` reçoit les nouveaux mots**, pas toute la transcription. Si le moteur révise des
   mots déjà émis, l'appelant ne doit donner que les mots stabilisés.
3. **L'alif interne est retiré**, donc `قال` = `قل`, `كان` = `كن`, `والله` = `ولله` (2 % des
   mots du texte, mesure du testeur). C'est le prix pour que l'uthmani et une orthographe
   moderne sans signes donnent la même forme. Conséquences : une voyelle longue mal lue
   n'est pas vue par le suivi, et deux passages qui ne diffèrent que par là sont ex æquo.
4. **Wâw ou yâ' devant un alif suscrit : support ou consonne ?** Le texte du Complexe
   distingue les deux par une voyelle (`ٱلصَّلَوٰةَ` / `ٱلسَّمَٰوَٰتِ`), le second texte livré avec
   l'appli (Uthmani Minimal) ne l'écrit pas (`الصَّلوٰةَ` / `السَّمٰوٰتِ`). Règle : le yâ' avec
   ses deux points est une consonne, le yâ' sans points un support ; le wâw n'est un
   support que devant `ة`, dans `الربوٰا` et dans `صلوٰتك`. Les mots du texte du Complexe et
   ceux de l'imlâ'î n'en sont pas changés (vérifié sur les 77 430 mots).
5. **Les mots coupés différemment** (`يا أيها`, 370 mots environ) ne sont pas traités par la
   normalisation, qui ne fusionne jamais, mais par l'alignement (« deux mots pour un »,
   à l'identique ou aux lettres confondues près, sans autre bruit).
6. **Formules d'ouverture.** L'isti'âdha en tête est toujours écartée. La basmala en tête
   est d'abord du texte : seule, elle est cherchée telle quelle (1:1 et 27:30, ex æquo) ;
   suivie d'autres mots, si le meilleur lieu de la suite vient juste après une basmala dans
   le corpus (1:2, 27:31), le passage commence à cette basmala, qui explique alors tous les
   mots entendus ; sinon le résultat est le début de sourate, la basmala n'est pas comptée.
   Dans le suivi, une isti'âdha ou une basmala entière dite avant le passage n'est jamais
   prise pour un mot dit à la place du premier mot attendu.
7. **Ex æquo.** Demi-mot d'écart au plus, plafonné à 15 % de l'entrée (avec un seul mot,
   seule une lettre confondue par l'accent fait encore un ex æquo). Tous les ex æquo sont
   rendus, quel que soit `maxAlternatives`, qui ne compte que les lieux moins bons.
8. **Deux scores minimaux.** 0,6 en général ; 0,8 pour 5 mots ou moins, car trois mots
   courants dans le bon ordre se trouvent par hasard (mesuré : 3 % de faux positifs à 0,6,
   0,3 % à 0,8). Un `minScore` passé par l'appelant remplace les deux.
9. **`truncated`** est présent seulement quand il est vrai, dans deux cas : plus de 300
   lieux ex æquo (`tiedCount` donne le total, 300 sont listés), ou des lieux probables
   laissés sans examen par la borne de travail (mots très courants : 4 entrées sur 22 000).
   Dans le second cas tous les lieux exacts et jumeaux sont quand même listés.
10. **`inputTruncated`** : au-delà de 300 mots, seuls les 300 derniers sont cherchés, et le
    résultat est exactement celui de ces 300 mots.
11. **`not-found` ne rend aucun candidat**, même faible. Les candidats non ex æquo
    (`maxAlternatives`, 5 par défaut) ne sont donnés qu'au-dessus du score minimal, et
    seulement parmi les lieux examinés : ce n'est pas une liste exhaustive.
12. **Un passage peut enjamber deux versets ou deux sourates** (le corpus est une seule
    suite de mots). Deux lieux qui se chevauchent n'en font qu'un, le meilleur.
13. **Plus de 30 lettres, ce n'est pas un mot** : jamais reconnu dans une recherche, jamais
    `read` dans le suivi, refusé (`RangeError`) dans le corpus ou les mots attendus. Le mot
    le plus long du Coran normalisé a 10 lettres.
14. **Le mot courant ne recule pas** quand le lecteur revient en arrière : les mots répétés
    sont des mots en trop, sans effet.
15. **Les derniers mots attendus** ne peuvent pas devenir `mistake` ou `skipped` : rien ne
    les suit pour confirmer. Donner à la session quelques mots au-delà de ce qu'on affiche.
16. **Fenêtre du suivi** : 16 mots en arrière, 24 en avant. Au-delà, la session ne suit
    plus ; `unmatchedStreak` monte, et c'est à l'appelant de relocaliser avec `search`.
17. **Une partie de mot entendue** (`يا` pour `يَـٰٓأَهۡلَ`) donne `skipped`, pas `mistake`.
18. **`confidence` n'est pas une probabilité calibrée** : elle suppose qu'un mot transcrit
    sur huit est faux (`oddsPerExplainedWord`), hypothèse non mesurée.

## Points contestés

- **Premier mot `mistake`** (Précisions, « Suivi ») contre « un mot marqué en rouge à tort
  est pire qu'une erreur ratée ». La règle est appliquée. Son prix : si le lecteur dit
  autre chose avant le passage (fin du verset précédent, un mot d'annonce) et que le premier
  mot attendu n'est pas entendu, ce premier mot est rouge alors qu'il est seulement sauté.
  Le texte seul ne permet pas de trancher. Seules l'isti'âdha et la basmala entières sont
  reconnues comme préambule (décision 6).
- **« Sûr à tort » selon le testeur, cas restant** : 14:23 récité sans `من` donne
  `جنات تجري تحتها الأنهار`, qui se trouve mot pour mot en 9:100 et nulle part ailleurs. Le
  module répond 9:100 (score 1, confiance 0,17, cinq autres lieux listés à 0,80). La
  spécification demande l'ex æquo pour des mots « à l'identique en plusieurs endroits » :
  ici ils ne le sont qu'en un. Pour rendre ex æquo un lieu auquel il manque un mot entier,
  il faudrait une marge d'un mot, qui rendrait ambigus presque tous les passages courts.
- **« Donne le nombre total »** : vrai pour les lieux ex æquo trouvés. Quand `truncated`
  vient de la borne de travail, le total des lieux _approchants_ n'est pas connu sans les
  examiner ; les lieux exacts, eux, sont toujours tous comptés.
- **Règle `mistake`** : la spécification dit « ne correspond pas, même avec la clé
  d'accent ». Appliquée à la lettre, elle marquerait en rouge tout mot transcrit avec une
  lettre de travers. Une zone de doute est gardée (entre la moitié et 70 % de lettres
  communes : `read`). Effet : des fautes d'une lettre (`يعلمون` / `تعلمون`) ne sont pas
  signalées.
- **Échantillon imlâ'î** : l'appli n'a pas de texte imlâ'î (`docs/DATA_SOURCES.md`).
  L'échantillon de `__fixtures__` et les mesures viennent d'un fichier du poste de
  développement dont l'origine n'est pas établie ; il ne sert qu'aux tests.

## Mesures

Corpus : les 6 236 versets de `assets/data/verses/uthmani.json` (texte du Complexe du roi
Fahd, 77 430 mots, 14 154 mots comparables distincts). « Moteur vocal » simulé : un texte
imlâ'î des mêmes versets, avec des erreurs simulées, tirage reproductible (graine fixe).
Machine : Xeon 2,1 GHz, Node 22, code compilé hors Jest (sous Jest, 3 à 10 fois plus lent).
Refaire : `RECOGNITION_IMLAEI_CORPUS=<fichier> RECOGNITION_MEASURE_PASSAGES=2000
RECOGNITION_PRINT_MEASURES=1 npx jest src/domain/recognition/__tests__/full-corpus.test.ts`.
Les mesures du testeur indépendant sont imprimées par `__tests__/acceptance`.

**Normalisation.** 5 737 versets sur 6 236 (92,0 %) ont exactement les mêmes mots en
uthmani et en imlâ'î ; pour les 499 autres, 1,8 modification de mot en moyenne (un mot
écrit en deux en compte deux), 1,2 % des mots au total, presque toujours `يا`. Les deux
textes livrés avec l'appli : 6 227 versets identiques sur les 6 233 comparables (5 030
avant la décision 4) ; restent 6 mots (cinq pluriels `صلوٰت`, un mot de 17:7) et 3 versets
coupés autrement (15:7, 27:20, 36:22).

**Jamais sûr à tort : contrôles exhaustifs.**

- Les 14 991 suites de 3 à 6 mots qui se trouvent à plusieurs endroits (6 434 de 3 mots,
  4 131 de 4, 2 669 de 5, 1 757 de 6 ; jusqu'à 89 lieux) : toutes `ambiguous`, tous les
  lieux listés du premier au dernier mot. C'est un test (`full-corpus.test.ts`).
- Un mot courant seul (`minWords: 1`) : `الله`, 2 155 lieux comptés, 300 listés, `truncated`.
- Lieux à une lettre près (un seul mot diffère, d'une lettre) : sur 1 500 fenêtres de 3
  mots, 139 ont un tel voisin ; il manquait à la liste pour 14 d'entre elles (9 rendues
  `found`), il manque encore pour 1 (rendue `ambiguous`). De 4 à 8 mots : 1 sur 6 000.
- 55 569 fenêtres de 3 à 8 mots du texte imlâ'î, sans erreur : 3 répondues ailleurs avec
  certitude, toutes au même endroit (7:19 entendu à partir du milieu de `وَيَٰٓـَٔادَمُ`, qui
  est un seul mot en uthmani, rendu en 2:35).
- Mesures du testeur : 0 réponse sûre et fausse sur tous ses tirages de passages uniques ;
  821 entrées abîmées de passages répétés, 0 lieu jumeau oublié ; 1 cas contesté (plus haut).

**Recherche**, 2 000 passages de 6 à 12 mots (1 969 uniques, 31 répétés sans erreur) :

| Erreurs simulées | Bon passage (seul ou parmi les ex æquo) | Mauvaise réponse | Pas trouvé | Répétés signalés ambigus, bon lieu listé |
| ---------------- | --------------------------------------- | ---------------- | ---------- | ---------------------------------------- |
| 0                | 100 % (2 000)                           | 0                | 0          | 31 sur 31                                |
| 1                | 99,9 % (1 998)                          | 1                | 1          | 48 sur 49                                |
| 2                | 98,0 % (1 959)                          | 1                | 40         | 45 sur 46                                |
| 3                | 92,3 % (1 845)                          | 1                | 154        | 42 sur 50                                |

Une « mauvaise réponse » ici est un passage dont un mot remplacé donne le texte d'un autre
lieu. Parmi les passages uniques, 0,2 % (sans erreur) à 1,5 % (3 erreurs) sont rendus
`ambiguous` avec le bon lieu dans la liste. Avec 3 erreurs sur 6 ou 7 mots, 72 % sont
retrouvés ; sur 10 à 12 mots, 99,9 %.

Passages de 3 à 5 mots : 99,4 % sans erreur (dont 18 % `ambiguous`), 60 % avec une erreur ;
le reste est « pas trouvé », par la décision 8 : une entrée courte doit être expliquée
presque entièrement, les mots suivants trancheront. Mesures du testeur sur 3 à 5 mots :
particule tombée 54 %, mot doublé 67 %, deux mots collés 68 %, aucune réponse fausse.

Passages longs dont des mots manquent (40, 100, 200 et 300 mots ; 0 à 10 mots tombés au
hasard ; 6 000 passages) : tous retrouvés à leur place. Avant correction, 1 à 5 % étaient
« pas trouvés » dès 6 mots tombés.

Bruit sur tous les mots (20 % de mots avec une lettre confondue, 10 % avec une lettre
fausse, 5 % de mots perdus, 3 % de mots collés), 2 000 passages : 98,3 % sur 8 mots, 99,8 %
sur 12, 99,7 % sur 20. Bruit plus fort (30 %, 25 %, 10 %, 5 %) : 86 %, 94 %, 94 %. Bruit
très fort (40 %, 40 %, 15 %, 8 %) : 62 %, 67 %, 64 %. Le reste est presque toujours « pas
trouvé » : 0,6 % de mauvaises réponses au plus.

**Faux positifs**, mots du Coran tirés au hasard selon leur fréquence (le cas le plus
dur) : 0 sur 2 000 pour 6 à 12 mots (meilleur score 0,56 ; 99 % sous 0,47), 0 sur 2 000
pour 12 à 20 mots, 28 sur 10 000 pour 3 à 5 mots (des suites qui existent, à une lettre
près). Douze phrases d'arabe courant écrites pour les tests : aucune trouvée.

**Temps.** Construction de l'index : 0,09 à 0,22 s (budget 2 s). Recherche de 6 à 12 mots :
0,2 à 0,5 ms en moyenne, 15 ms au pire sur 8 000 (budget 150 ms). Les 12 mots les plus
courants, sans passage : 4 ms ; 300 de ces mots : 20 ms. 300 mots d'arabe courant : 12 ms
(borne de la spécification : 1 s). Passage de 60 mots : 1 ms ; 300 mots : 4 ms ; 2 000 mots
(coupés à 300) : 6 ms. Un « mot » de 65 536 lettres : 14 ms. Suivi : 0,01 à 0,02 ms par mot.

**Suivi**, 400 lectures simulées de 60 mots (27 000 mots attendus par scénario) :

| Scénario                          | Lus     | `mistake`                | `skipped`                 |
| --------------------------------- | ------- | ------------------------ | ------------------------- |
| Lecture correcte                  | 99,99 % | 0                        | 2 mots                    |
| Lettres bruitées (20 % + 10 %)    | 99,8 %  | 12 mots (0,4 pour 1 000) | 7 mots                    |
| 5 % de mots perdus par le moteur  | —       | 0                        | 1 271 (1 312 mots perdus) |
| 5 % de mots remplacés             | —       | 1 190 sur 1 308 (91 %)   | 6 mots                    |
| Le lecteur répète 4 mots, souvent | 100 %   | 0                        | 1 mot                     |

Mesures du testeur (200 lectures de 8 à 30 mots, 3 847 mots, une altération par lecture) :
aucun `mistake` ni `skipped` sans altération, avec lettres confondues, mot doublé, mot
étranger inséré, mot coupé en deux ; deux mots collés : 1 `mistake`, 18 `skipped`.

## Limites : ce qui n'est pas prouvé

- **Aucun audio, aucune vraie transcription.** Tout ce qui précède mesure du texte abîmé
  par des erreurs inventées. Les seuils (0,7 ; 0,5 ; 0,6 ; 0,8) n'ont pas vu un vrai
  lecteur. Un moteur réel hallucine, répète, « corrige » vers le texte qu'il connaît : rien
  de cela n'est simulé. À reprendre dès que le moteur existe, avec la voix du propriétaire.
  _Premières vraies transcriptions (D42, 25 novembre 2026)_ : Whisper tiny affiné sur le
  Coran, 28 lecteurs ordinaires récitant 83:1–3 au téléphone : passage trouvé pour 16 sur 28
  avec tous les mots, 19 sur 28 avec les derniers mots cherchés seuls aussi
  (`domain/listening/heard-search.ts`), jamais un autre passage ; les seuils n'ont pas changé.
  Les bons passages non trouvés expliquent 0,3 à 0,59 de l'entrée : sous le seuil de 0,6,
  dans la zone des entrées au hasard (moins de 0,47 pour 99 %, jusqu'à 0,56). Baisser le
  seuil ne serait donc pas sûr ; le gain doit venir de la transcription.
- **Téléphone.** Temps mesurés sur un poste, avec un moteur JavaScript à compilation. Sur
  téléphone (Hermes), prévoir nettement plus lent : non mesuré.
- **Entrées courtes abîmées** (3 à 5 mots avec un mot faux, tombé, doublé ou collé) : un
  tiers à la moitié ne sont pas trouvées tant que d'autres mots n'arrivent pas. C'est voulu
  (décision 8) : baisser le seuil donnerait des réponses sûres et fausses.
- **Un bruit qui donne le texte d'un autre lieu** (un mot remplacé, une particule tombée)
  mène à cet autre lieu : le texte seul ne permet pas de le savoir. Seuls les lieux à une
  lettre près ou identiques sont rendus ex æquo.
- **Lettres isolées** (`الٓمٓ`, `حمٓ`, `يسٓ`… en tête de 29 sourates) : un moteur écrira le
  nom des lettres (« ألف لام ميم »). Non traité : ces mots resteront `skipped`.
- **Un mot remplacé par le moteur** alors que le lecteur a bien lu sera marqué `mistake` :
  le texte seul ne permet pas de le savoir.
- **Transcription sans hamza au milieu des mots** (`وان` pour `وأن`, `الارض`) : les mots
  de quatre lettres et plus sont reconnus comme proches, ceux de trois lettres non. Ils ne
  sont pas marqués en rouge, mais chacun coûte un mot au score de la recherche.
- **Autres lectures que Hafs**, formule de clôture (« صدق الله العظيم »), verset répété
  plusieurs fois pendant une recherche : comptés comme du bruit, le score baisse.
- **Mots très différents entre écritures** (environ 1 % des mots) : `ٱلَّيۡلِ` / `الليل` est
  reconnu comme proche (0,8) ; `رَءَا` / `رأى` ne l'est pas ; `يَبۡنَؤُمَّ` (trois mots en
  imlâ'î) reste `skipped`.
