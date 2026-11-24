# Reconnaissance de versets (cœur texte, sans audio)

Spécification : `docs/specs/recognition.md`. Ce module reçoit du **texte arabe imparfait**
(la sortie du moteur vocal) et fait deux choses : retrouver quel passage est récité
(« Shazam du Coran ») et suivre une lecture mot à mot. TypeScript pur, aucune dépendance,
le texte du Coran est injecté. Tout passe par `index.ts`.

## Utilisation

```ts
import { createVerseIndex, createFollowSession, normalizeArabic } from '@/domain/recognition';

// 1. Retrouver un passage. L'index se construit une fois (0,15 s), avec les versets uthmani.
const index = createVerseIndex(verses); // { surah, verse, text }[] dans l'ordre du mushaf
const result = index.search(transcript.split(' ')); // mots bruts ou déjà normalisés

if (result.status === 'found') result.candidates[0]; // { start, end, score, confidence }
if (result.status === 'ambiguous') result.candidates.slice(0, result.tiedCount); // tous les lieux
if (result.status === 'not-found') result.reason; // 'too-few-words' | 'no-match'

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

Entrées invalides : `TypeError` ou `RangeError`. Une entrée vide ou non arabe n'est pas une
erreur : la recherche répond `not-found`, le suivi ne change pas.

## Comment ça marche

**Normalisation** (`normalize.ts`). On garde ce que les deux écritures ont en commun :
signes et tatweel retirés ; toute hamza, quel que soit son support, et l'alif initial
s'écrivent `ء` ; l'alif **à l'intérieur** d'un mot est retiré (l'uthmani l'écrit souvent en
petit alif suscrit, l'imlâ'î en lettre pleine, sans règle pour savoir lequel) ; l'alif final
est gardé, sauf l'alif muet après un wâw final ; un wâw ou un yâ' qui ne fait que porter un
alif suscrit (`ٱلصَّلَوٰةَ`) vaut cet alif ; `ى` → `ي`, `ة` → `ه`.
La clé d'accent regroupe ح/ه, ع/ء, ق/ك, ص/س/ث, ض/د, ط/ت, ذ/ز/ظ.

**Comparaison de deux mots** (`comparable-word.ts`) : 1 si identiques, 0,9 si seules les
lettres confondues diffèrent, sinon la part de lettres communes. À partir de 0,7 c'est le
même mot avec du bruit (une lettre fausse dès 4 lettres, deux dès 7).

**Alignement** (`align.ts`), commun aux deux fonctions : meilleure chaîne de paires de mots
entre ce qui est entendu et le texte, avec mots faux, manquants, en trop, et **deux mots
pour un** (`يا أيها` entendu, `يَـٰٓأَيُّهَا` écrit ; ou mots collés par le moteur).

**Recherche** (`verse-index.ts`). 1) Chaque mot entendu présent dans le corpus « vote » pour
le lieu où le passage commencerait ; les mots rares pèsent plus. 2) Les lieux assez lourds
sont alignés mot à mot. Score = mots expliqués ÷ (mots entendus + mots du passage non
entendus). Deux lieux à moins d'un demi-mot d'écart sont **ex æquo** : le résultat est
`ambiguous` et les liste tous, dans l'ordre du mushaf. `confidence` = score, partagé entre
les lieux concurrents (trois ex æquo parfaits : un tiers chacun).
Coût : occurrences des mots entendus dans le corpus, plus, par lieu examiné,
(mots entendus) × (mots entendus + tolérance). Travail total borné (`maxVerifiedComparisons`).

**Suivi** (`follow-session.ts`). Le mot entendu est le mot courant : il est lu. Sinon, on
aligne les derniers mots entendus autour de la position pour savoir si le lecteur répète
(derrière) ou a passé des mots (devant). Un mot n'est déclaré passé qu'après 2 mots
reconnus à sa suite (4 pour un saut de plus de 2 mots). Il est `mistake` seulement si un mot
**clairement différent** (moins de la moitié des lettres communes, même sur la clé d'accent)
a été entendu à sa place, entre des mots reconnus ; sinon `skipped`, ou `read` au bénéfice
du doute. Un statut ne régresse jamais ; un mot `skipped` ou `mistake` relu correctement
devient `read`.

## Décisions prises là où la spécification est floue

1. **Mots comparables = chaînes.** `normalizeArabic` rend des `string[]` ; `search` et
   `feed` renormalisent chaque entrée (c'est idempotent), on peut donc leur passer des mots
   bruts ou normalisés, ou des morceaux de texte.
2. **`feed` reçoit les nouveaux mots**, pas toute la transcription. Si le moteur révise des
   mots déjà émis, l'appelant ne doit donner que les mots stabilisés.
3. **L'alif interne est retiré**, donc `قال` = `قل`, `كان` = `كن`, `والله` = `ولله`. C'est le
   prix pour que l'uthmani et une orthographe moderne sans signes donnent la même forme.
   Conséquence : une voyelle longue mal lue n'est pas vue par le suivi.
4. **Les mots coupés différemment** (`يا أيها`, 370 mots environ) ne sont pas traités par la
   normalisation, qui ne fusionne jamais, mais par l'alignement (« deux mots pour un »,
   à l'identique ou aux lettres confondues près, sans autre bruit).
5. **Formules d'ouverture.** L'isti'âdha en tête est toujours écartée (ce n'est pas un
   verset). La basmala en tête est écartée si au moins `minWords` mots la suivent ; si le
   passage trouvé suit une basmala dans le corpus (Fâtiha, 27:30), elle lui est rattachée.
   Seule, elle est cherchée telle quelle (1:1).
6. **Deux scores minimaux.** 0,6 en général ; 0,8 pour 5 mots ou moins, car trois mots
   courants dans le bon ordre se trouvent par hasard (mesuré : 2 à 4 % de faux positifs
   sinon). Un `minScore` passé par l'appelant remplace les deux.
7. **`not-found` ne rend aucun candidat**, même faible. Les candidats non ex æquo
   (`maxAlternatives`, 5 par défaut) ne sont donnés qu'au-dessus du score minimal, et
   seulement parmi les lieux examinés : ce n'est pas une liste exhaustive.
8. **Un passage peut enjamber deux sourates** (le corpus est une seule suite de mots).
9. **Répétitions très proches** (`كلا سوف تعلمون ثم كلا سوف تعلمون`) : les deux lieux sont
   listés tant qu'ils sont à plus de 3 mots l'un de l'autre.
10. **Le mot courant ne recule pas** quand le lecteur revient en arrière : les mots répétés
    sont des mots en trop, sans effet.
11. **Les derniers mots attendus** ne peuvent pas devenir `mistake` ou `skipped` : rien ne
    les suit pour confirmer. Donner à la session quelques mots au-delà de ce qu'on affiche.
12. **Fenêtre du suivi** : 16 mots en arrière, 24 en avant. Au-delà, la session ne suit
    plus ; `unmatchedStreak` monte, et c'est à l'appelant de relocaliser avec `search`.
13. **Une partie de mot entendue** (`يا` pour `يَـٰٓأَهۡلَ`) donne `skipped`, pas `mistake`.
14. **`confidence` n'est pas une probabilité calibrée** : elle suppose qu'un mot transcrit
    sur huit est faux (`oddsPerExplainedWord`), hypothèse non mesurée.

## Points de la spécification contestés

- **« Échantillon imlâ'î (Tanzil) »** : le fichier fourni sous ce nom
  (`tanzil_simple.json`) est de l'« Uthmani Minimal », pas de l'imlâ'î
  (`docs/DATA_SOURCES.md` le constate aussi). L'échantillon du dossier `__fixtures__` et
  les mesures viennent d'une copie du texte Tanzil Simple trouvée sur le poste de
  développement, dont la version et la conformité n'ont pas été vérifiées. L'appli n'a pas
  de texte imlâ'î : à ajouter aux sources si l'on veut refaire les mesures dans le dépôt.
- **Règle `mistake`** : la spécification dit « ne correspond pas, même avec la clé
  d'accent ». Appliquée à la lettre, elle marquerait en rouge tout mot transcrit avec une
  lettre de travers. J'ai ajouté une zone de doute (voir plus haut), au nom de la première
  phrase de la même règle. Effet : des fautes d'une lettre (`يعلمون` / `تعلمون`) ne sont
  pas signalées.
- **« Ne choisit jamais au hasard / les liste tous »** : vrai dans la limite du travail
  borné. Vérifié sur les deux passages les plus répétés (31 et 89 lieux) ; une entrée de
  2 mots très courants (si l'appelant baisse `minWords`) pourrait avoir plus de lieux que
  la borne n'en examine.

## Mesures

Corpus : les 6 236 versets de `assets/data/verses/uthmani.json` (77 428 mots).
« Moteur vocal » simulé : le texte Tanzil Simple des mêmes versets, avec des erreurs
simulées, tirage reproductible (graine fixe). Machine : Xeon 2,1 GHz, 2 cœurs, Node 22,
code compilé hors Jest (sous Jest, compter 3 à 10 fois plus lent).
Refaire : `RECOGNITION_IMLAEI_CORPUS=<fichier> RECOGNITION_MEASURE_PASSAGES=2000
RECOGNITION_PRINT_MEASURES=1 npx jest src/domain/recognition/__tests__/full-corpus.test.ts`.

**Normalisation.** 5 735 versets sur 6 236 (92,0 %) ont exactement les mêmes mots en
uthmani et en imlâ'î. Pour les 501 autres : 1,8 modification de mot en moyenne (un mot
écrit en deux en compte deux) ; 1,2 % des mots diffèrent au total. Pour les trois quarts
de ces versets, la seule différence est un mot coupé autrement, presque toujours `يا`.

**Recherche**, 2 000 passages de 6 à 12 mots (1 969 uniques, 31 répétés sans erreur) :

| Erreurs simulées | Bon passage (seul ou parmi les ex æquo) | Mauvaise réponse | Pas trouvé | Répétés signalés ambigus, bon lieu listé |
| ---------------- | --------------------------------------- | ---------------- | ---------- | ---------------------------------------- |
| 0                | 100 % (2 000)                           | 0                | 0          | 31 sur 31                                |
| 1                | 99,9 % (1 998)                          | 1                | 1          | 48 sur 49                                |
| 2                | 98,0 % (1 959)                          | 1                | 40         | 45 sur 46                                |
| 3                | 92,3 % (1 845)                          | 1                | 154        | 42 sur 50                                |

Parmi les passages uniques, 0,2 % (sans erreur) à 1,5 % (3 erreurs) sont rendus
`ambiguous` avec le bon lieu dans la liste : un autre passage n'en diffère que d'une
lettre. Avec 3 erreurs sur 6 ou 7 mots, 72 % seulement sont retrouvés ; sur 10 à 12 mots,
99,9 %. Passages de 3 à 5 mots : 99,4 % sans erreur, 60 % avec une erreur (le reste « pas
trouvé », par la décision 6).

Bruit sur tous les mots (20 % de mots avec une lettre confondue, 10 % avec une lettre
fausse, 5 % de mots perdus, 3 % de mots collés), 1 000 passages : 98,1 % sur 8 mots, 99,8 %
sur 12 et sur 20 mots. Bruit plus fort (30 %, 25 %, 10 %, 5 %) : 86 %, 93 %, 95 %. Bruit
très fort (40 %, 40 %, 15 %, 8 %) : 61 %, 68 %, 66 %. Le reste est presque toujours « pas
trouvé » : 0,6 % de mauvaises réponses au plus.

**Faux positifs**, mots du Coran tirés au hasard selon leur fréquence (le cas le plus
dur) : 0 sur 2 000 pour 6 à 12 mots (meilleur score atteint 0,53 ; 99 % sous 0,46), 0 sur
2 000 pour 12 à 20 mots, 3 sur 2 000 pour 3 à 5 mots (des suites qui existent vraiment).
Douze phrases d'arabe courant écrites pour les tests : aucune trouvée.

**Temps.** Construction de l'index : 0,12 à 0,19 s (budget 2 s). Recherche de 6 à 12
mots : 0,5 ms en moyenne, 20 ms au pire sur 8 000 recherches (budget 150 ms). Entrée de
mots très courants sans passage : 5 à 8 ms. 60 mots : 4 ms ; 184 mots : 16 ms (le coût
croît avec le carré de la longueur). Suivi : 0,02 à 0,04 ms par mot.

**Suivi**, 400 lectures simulées de 60 mots (27 000 mots attendus par scénario) :

| Scénario                          | Lus     | `mistake`                | `skipped`                 |
| --------------------------------- | ------- | ------------------------ | ------------------------- |
| Lecture correcte                  | 99,99 % | 0                        | 2 mots                    |
| Lettres bruitées (20 % + 10 %)    | 99,7 %  | 10 mots (0,4 pour 1 000) | 25 mots                   |
| 5 % de mots perdus par le moteur  | —       | 0                        | 1 271 (1 312 mots perdus) |
| 5 % de mots remplacés             | —       | 1 171 sur 1 308 (90 %)   | 26 mots                   |
| Le lecteur répète 4 mots, souvent | 100 %   | 0                        | 1 mot                     |

## Limites : ce qui n'est pas prouvé

- **Aucun audio, aucune vraie transcription.** Tout ce qui précède mesure du texte abîmé
  par des erreurs inventées. Les seuils (0,7 ; 0,5 ; 0,6 ; 0,8) n'ont pas vu un vrai
  lecteur. Un moteur réel hallucine, répète, « corrige » vers le texte qu'il connaît : rien
  de cela n'est simulé. À reprendre dès que le moteur existe, avec la voix du propriétaire.
- **Téléphone.** Temps mesurés sur un poste, avec un moteur JavaScript à compilation. Sur
  téléphone (Hermes), prévoir nettement plus lent : non mesuré. Passer à `search` les 30 à
  60 derniers mots plutôt qu'une longue transcription.
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
