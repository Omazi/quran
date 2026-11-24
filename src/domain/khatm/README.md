# Progression de lecture (khatm)

Règles métier de la progression : journal de lecture, progression d'une khatma, objectif du
jour, jours arrosés, série, date de fin estimée. Spécification : `docs/specs/khatm.md`.

TypeScript pur, fonctions pures, temps injecté (`today` est toujours un paramètre). Tout
passe par `index.ts`.

## Utilisation

```ts
import {
  EMPTY_JOURNAL,
  recordPageRead,
  getCurrentKhatm,
  getKhatmProgress,
  getTodayProgress,
  getWateredDays,
  getStreak,
  estimateFinishDate,
} from '@/domain/khatm';

const khatm = getCurrentKhatm(journal);
const next = recordPageRead(journal, { khatm, page: 12, date: today });

const progress = getKhatmProgress(next, khatm, hizbPageRanges); // plages injectées
const todayProgress = getTodayProgress(next, today, config);
const streak = getStreak(next, today, pauses, config);
const finish = estimateFinishDate(next, khatm, today, 'recent-average', config);
```

Valeurs attendues par le jardin, sans transformation :

| Entrée du jardin      | Source                                      |
| --------------------- | ------------------------------------------- |
| `hizbCompleted`       | `getKhatmProgress(...).hizbCompleted`       |
| `currentHizbProgress` | `getKhatmProgress(...).currentHizbProgress` |
| `wateredDays`         | `getWateredDays(journal, config)`           |

## Décisions

Lectures retenues là où la spécification est floue. Chacune est couverte par un test.

1. **Journal.** `ReadingJournal` est un tableau en lecture seule d'entrées
   `{ khatm, page, date }`. `recordPageRead(journal, entry)` reçoit le numéro de khatma
   explicitement. Une entrée déjà présente (même khatma, même page, même jour) ne change
   rien : la fonction renvoie **le même journal** (même référence). Il n'existe aucune
   fonction de suppression.
2. **Khatma en cours.** `getCurrentKhatm` renvoie le plus grand numéro présent dans le
   journal, ou le suivant si celle-ci est terminée ; `1` pour un journal vide.
   `recordPageRead` n'impose pas que la khatma `n` soit terminée avant d'écrire dans la
   `n + 1` : le journal reste une simple liste de faits (import, fusion, synchronisation
   future). C'est à l'appelant d'utiliser `getCurrentKhatm`.
3. **Hizb jamais retirés (règle 4).** Chaque khatma est calculée à partir de ses seules
   entrées : commencer la khatma `n + 1` ne modifie pas la progression de la khatma `n`.
4. **Hizb en cours (règle 3).** C'est le premier hizb non terminé dans l'ordre du mushaf,
   pas le dernier ouvert. Khatma terminée : `currentHizb` vaut `null` et
   `currentHizbProgress` vaut `0`.
5. **Pages d'un jour (règles 5, 6 et 8).** Une seule définition partout : nombre de numéros
   de page distincts lus ce jour-là, toutes khatmas confondues. La même page lue le même
   jour dans deux khatmas compte donc **une fois**. Une page relue un autre jour compte pour
   cet autre jour (objectif, jour arrosé, rythme récent), sans changer la progression.
6. **Série et pause (règle 7).** Un jour arrosé compte toujours, même pendant une pause : la
   pause pardonne un jour sans lecture, elle n'efface pas une lecture réelle (même choix que
   le module jardin). Un jour en pause non lu est sauté : il ne casse pas la série et ne
   l'allonge pas. Aujourd'hui non lu est sauté, en pause ou non. Les jours postérieurs à
   `today` sont ignorés.
7. **La série repose sur les jours arrosés**, pas sur l'objectif atteint : avec les réglages
   par défaut, une page par jour suffit à l'entretenir.
8. **Date de fin estimée (règle 8).** `today + ceil(pages restantes / rythme)`, sans tenir
   compte de ce qui a déjà été lu aujourd'hui ni des pauses. Rythme `recent-average` :
   pages des 7 jours qui se terminent aujourd'hui (aujourd'hui inclus), divisées par 7 ; un
   jour sans lecture compte pour zéro. Renvoie `null` si le rythme est nul **ou si la khatma
   est déjà terminée** (il n'y a plus rien à estimer).
9. **Plages de hizb.** Le type `HizbPageRange` est déclaré ici pour ne pas dépendre de
   l'implémentation du module Coran. Les plages sont validées à chaque appel : 60 éléments,
   numérotés de 1 à 60 dans l'ordre, de la page 1 à la page 604, chaque hizb commençant sur
   la dernière page du précédent (page partagée) ou sur la suivante. Sinon : `RangeError`.
10. **Journal relu à chaque calcul.** Chaque fonction vérifie les entrées qu'elle parcourt
    (un journal chargé depuis le stockage peut être corrompu) et lève une `RangeError`. Des
    doublons dans un journal construit à la main sont tolérés : ils ne changent aucun
    résultat.
11. **Dates futures.** `recordPageRead` ne connaît pas la date du jour et accepte toute date
    valide. Une entrée datée après `today` compte pour la progression, mais pas pour
    l'objectif du jour, la série ni le rythme récent.
12. **Objectif par défaut.** `dailyGoalPages = 20` (environ un juz par jour, une khatma par
    mois). Valeur provisoire : le vrai objectif est choisi par l'utilisateur.
