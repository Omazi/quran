# Spécification — reconnaissance de versets (cœur, sans audio)

Périmètre : `src/domain/recognition`.

## But

Le moteur vocal (lot 2) transforme la voix en mots arabes approximatifs. Ce module fait le
reste, sans audio : retrouver **quel passage** est récité et **suivre** une lecture mot à
mot. Il doit tolérer les erreurs du moteur, une récitation sans tajwid et un accent non
arabophone.

## Entrées de référence

Les versets en uthmani (`assets/data/verses/uthmani.json`, forme
`{ "<sourate>": [versets] }`, produits par le module de données et lus par un unique
fichier d'aide de test). La sortie d'un
moteur vocal ressemble plutôt à de l'écriture simple (imlâ'î) avec des erreurs : la
normalisation doit rapprocher les deux écritures.

## 1. Normalisation

`normalizeArabic(text)` → suite de mots comparables :

- retire les signes de vocalisation, les marques d'annotation coraniques, le tatweel ;
- unifie les formes de alif et de hamza, yâ'/alif maqsûra, tâ' marbûta ;
- traite l'alif suscrit et les autres différences uthmani/imlâ'î de façon que les deux
  écritures d'un même mot donnent la même forme dans la grande majorité des cas ;
- ne fusionne ni ne coupe jamais de mots.
  Mesurer et rapporter, sur les 6 236 versets, le taux de versets dont l'uthmani normalisé
  est identique à l'imlâ'î normalisé, et la distance moyenne pour les autres.

Une seconde clé, **tolérante à l'accent**, regroupe les lettres que les non-arabophones
confondent (ح/ه, ع/ء, ق/ك, ص/س, ض/د, ط/ت, ذ/ز/ظ, ث/س).

## 2. Recherche d'un passage

`createVerseIndex(verses)` puis `index.search(words, options)` → candidats classés.

- L'entrée peut commencer et finir au milieu d'un verset et couvrir plusieurs versets.
- Tolère des mots faux, manquants ou en trop.
- Chaque candidat : verset et mot de début, verset et mot de fin, score entre 0 et 1.
- **Ambiguïté** : si plusieurs passages expliquent l'entrée aussi bien (passage répété
  dans plusieurs sourates), le résultat le dit et les liste tous. Il ne choisit jamais au
  hasard.
- En dessous d'un score minimal ou d'un nombre minimal de mots, le résultat est « pas
  trouvé » plutôt qu'une mauvaise réponse.
- Budget : construction de l'index en moins de 2 s et recherche de 12 mots en moins de
  150 ms sur un poste de développement (un téléphone ancien sera plus lent : viser large).

## 3. Suivi mot à mot

`createFollowSession(expectedWords)` puis `session.feed(recognizedWords)` → statut de
chaque mot attendu : `read`, `current`, `upcoming`, `skipped`, `mistake`.

- **Un mot marqué en rouge à tort est pire qu'une erreur ratée.** `mistake` n'est posé que
  si le lecteur a clairement dépassé le mot (les mots suivants correspondent) et que le
  mot entendu à cette place ne correspond pas, même avec la clé tolérante à l'accent.
- Un mot simplement non entendu, alors que la suite correspond, est `skipped`.
- Le lecteur peut se répéter ou revenir en arrière de quelques mots sans créer d'erreur.
- Les statuts ne régressent pas tout seuls : un mot `read` le reste.

## Jeux d'essai

- Un échantillon imlâ'î (Tanzil, licence CC BY 3.0, à créditer) sert de substitut de
  sortie vocale dans les tests ; garder l'échantillon petit dans le dépôt.
- Erreurs simulées : substitution de lettres confondues, mot supprimé, mot ajouté,
  mot remplacé.
- Cas imposés : un passage unique ; un passage répété à l'identique dans une sourate
  (55:13 et suivants) ; un début de verset commun à plusieurs sourates ; une entrée trop
  courte ; une entrée sans rapport avec le Coran.

## Mesures à rapporter

Sur un tirage aléatoire reproductible de passages de 6 à 12 mots avec 0, 1, 2 et 3 erreurs
simulées : taux de bon premier résultat, taux d'ambiguïté correctement signalée, taux de
faux positifs sur des entrées sans rapport, temps de recherche.
