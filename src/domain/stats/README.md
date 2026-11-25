# Compteurs de lecture (stats)

Pages, mots, versets, lettres et hasanat (estimation) lus, par période ou par khatma, et temps
passé dans l'appli. Spécification : `docs/specs/stats.md` ; décision D37 dans
`docs/DECISIONS.md`. TypeScript pur, temps injecté (`today` est toujours un paramètre).

## Utilisation

```ts
import {
  buildPageStatsTable,
  getReadingStats,
  getKhatmStats,
  getDailyReadingStats,
  getSecondsInPeriod,
} from '@/domain/stats';

// Une fois (au premier affichage) : les 604 pages du mushaf, telles que le lecteur les lit
// (`quranRepository.getPage`). La table garde par page ses mots, ses lettres et les versets
// qui y finissent ; le texte n'est plus relu ensuite.
const table = buildPageStatsTable(pages);

const week = getReadingStats(journal, table, 'week', today); // pages, words, verses, letters, hasanatEstimate
const khatma = getKhatmStats(journal, table, khatm);
const chart = getDailyReadingStats(journal, table, from, to); // un jour par entrée, zéros compris
const time = getSecondsInPeriod(state.timeSpent, 'month', today); // { app, reader } en secondes
```

## Règles

- Une entrée du journal = une page lue pour la première fois dans sa khatma. Ses mots et ses
  lettres comptent le jour de l'entrée.
- Un verset compte quand **toutes** les pages qui portent un mot de lui ont une entrée dans la
  **même** khatma, le jour de la dernière de ces entrées.
- Périodes : aujourd'hui ; la semaine du lundi à aujourd'hui ; le mois du 1er à aujourd'hui ;
  depuis le début (sans borne : une entrée datée après aujourd'hui n'y compte que là).
- Hasanat = lettres × 10 (`HASANAT_PER_LETTER`), une estimation.
- La règle des lettres est écrite en tête de `letters.ts` ; **à faire valider** par une
  personne qualifiée.

## Totaux de contrôle (données de l'appli)

Une khatma complète : 604 pages, 6 236 versets, 77 430 mots, 325 882 lettres, 3 258 820 hasanat
(estimation). Testé dans `__tests__/whole-quran.test.ts`, les lettres comptées de deux façons.

## Fait connu des données

Aucun verset n'est coupé entre deux pages dans ce mushaf (chaque page commence par un verset
nouveau). La règle du verset coupé est quand même écrite et testée sur de petits mushafs.
