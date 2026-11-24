# Progression de lecture (khatm)

Règles métier de la progression : journal de lecture, progression d'une khatma, objectif du
jour, jours arrosés, série, date de fin estimée, badges, et ce que le jardin reçoit.
Spécification : `docs/specs/khatm.md` ; décisions produit D8, D9 et D10 dans
`docs/DECISIONS.md`.

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
  getStreak,
  estimateFinishDate,
  getBadges,
  getGardenFeed,
} from '@/domain/khatm';

// Écrire : la page et le jour, jamais de numéro de khatma. Le module range la page dans la
// khatma en cours. Une page déjà lue rend le même journal (===).
const next = recordPageRead(journal, { page: 12, date: today });

// Lire : tout est dérivé du journal. L'objectif du jour vient des réglages de l'utilisateur.
const khatm = getCurrentKhatm(next);
const progress = getKhatmProgress(next, khatm, hizbPageRanges); // plages injectées
const todayProgress = getTodayProgress(next, today, dailyGoalPages);
const streak = getStreak(next, today, pauses);
const finish = estimateFinishDate(next, khatm, today, { kind: 'daily-goal', dailyGoalPages });
const badges = getBadges(next); // un par khatma terminée
const feed = getGardenFeed(next, hizbPageRanges); // jardin à afficher
```

## Ce que reçoit le jardin

`getGardenFeed` (règle 10) rend en un appel les entrées de `docs/specs/garden.md` qui
viennent du journal, pour le jardin à afficher. Le jardin ajoute `today`, les pauses et ses
propres réglages.

| Champ                  | Entrée du jardin                                                           |
| ---------------------- | -------------------------------------------------------------------------- |
| `khatm`                | numéro de cycle du jardin (un jardin par khatma, D9)                       |
| `hizbCompleted`        | `hizbCompleted`, de 0 à 60 (60 : jardin complet)                           |
| `currentHizbProgress`  | `currentHizbProgress`, avance à chaque nouvelle page ; 0 au jardin complet |
| `startDate`            | `startDate` ; `null` tant qu'aucune page n'a jamais été lue : terre nue    |
| `wateredDays`          | `wateredDays`, à partir de `startDate` seulement                           |
| `firstHizbCompletedOn` | jour où un premier hizb de cette khatma a été terminé ; `null` sinon       |
| `completedOn`          | jour où cette khatma a été terminée (celui du badge) ; `null` si en cours  |

**Le jardin complet reste affiché.** Tant que la khatma en cours a au moins une page, c'est
elle que décrit le flux. Quand une khatma vient d'être terminée et que la suivante n'a
encore aucune page, le flux décrit la khatma terminée, avec ses 60 hizb, sa date de début et
ses jours arrosés ; il passe au nouveau jardin à la première page de la khatma suivante.

Le badge d'une khatma terminée porte son numéro (`KhatmBadge.khatm`) : c'est le numéro de
cycle avec lequel le module jardin retrouve l'image du jardin complet.

## Décisions

Lectures retenues là où la spécification est floue. Chacune est couverte par un test.

1. **Une entrée par (khatma, page).** La première lecture **enregistrée** fixe la date ;
   relire la page, le même jour ou un autre (même avec une date antérieure), rend **le même
   journal** (même référence). Il n'existe aucune fonction de suppression ni de correction.
2. **Une khatma à la fois (règle 4).** L'appelant ne donne jamais de numéro de khatma :
   `recordPageRead(journal, { page, date })` range la page dans la khatma en cours, la
   première non terminée (`1` pour un journal vide, `n + 1` dès que la 604ᵉ page de `n` est
   lue). La première page enregistrée après la fin de `n` ouvre donc `n + 1`, **même si
   c'est une page relue le jour même** : le module ne sait pas distinguer une relecture d'un
   nouveau départ. Un champ `khatm` passé par un appelant non typé est ignoré.
3. **Journal vérifié à chaque appel.** `recordPageRead` ne produit que des journaux valides,
   mais un journal relu depuis le stockage peut être abîmé. Chaque fonction relit donc le
   journal en une passe (`journal-summary.ts`) et lève une `RangeError` s'il contient une
   entrée invalide, deux entrées pour la même (khatma, page), ou une entrée dans une khatma
   située après la khatma en cours. L'ordre des entrées est libre.
4. **Hizb jamais retirés (règle 4).** Chaque khatma est calculée à partir de ses seules
   entrées : commencer la khatma `n + 1` ne modifie pas la progression de la khatma `n`.
5. **Hizb en cours (règle 3).** C'est le premier hizb non terminé dans l'ordre du mushaf,
   pas le dernier ouvert. Khatma terminée : `currentHizb` vaut `null` et
   `currentHizbProgress` vaut `0`. Une khatma sans entrée (pas encore commencée) est à zéro.
6. **Pages d'un jour (règles 5, 6 et 8).** Une seule définition partout : le nombre
   d'entrées datées de ce jour, toutes khatmas confondues. La fin d'une khatma et le début
   de la suivante s'additionnent ; la même page lue ce jour-là pour finir la khatma `n` puis
   dans la khatma `n + 1` compte **deux fois**, une fois dans chacune (voulu, règle 5).
7. **Objectif du jour (règle 5, D10).** Toujours passé en paramètre, entier ≥ 1, sans valeur
   par défaut ni maximum. Il n'est pas dans la configuration du module.
8. **Série et pause (règle 7).** Un jour arrosé compte toujours, même pendant une pause : la
   pause pardonne un jour sans lecture, elle n'efface pas une lecture réelle (même choix que
   le module jardin). Un jour en pause non lu est sauté : il ne casse pas la série et ne
   l'allonge pas. Aujourd'hui non lu est sauté, en pause ou non. Les jours postérieurs à
   `today` sont ignorés. La série continue d'une khatma à la suivante.
9. **La série repose sur les jours arrosés**, pas sur l'objectif atteint : avec les réglages
   par défaut, une nouvelle page par jour suffit à l'entretenir.
10. **Date de fin estimée (règle 8).** On suppose que la part du jour sera lue aujourd'hui.
    Reste du jour = rythme − pages déjà lues aujourd'hui, jamais négatif ; « lues
    aujourd'hui » = les nouvelles pages du jour, toutes khatmas confondues, comme pour
    l'objectif. Si les pages restantes tiennent dans le reste du jour, la fin est
    aujourd'hui ; sinon `today + ceil((pages restantes − reste du jour) / rythme)`. Les
    pauses sont ignorées. Le rythme est explicite : `{ kind: 'daily-goal', dailyGoalPages }`
    ou `{ kind: 'recent-average' }`. Moyenne récente : nouvelles pages des 7 derniers jours
    **complets** (d'hier à il y a 7 jours, aujourd'hui exclu), toutes khatmas confondues,
    divisées par 7 ; un jour sans lecture compte pour zéro. **Moyenne fractionnaire** : elle
    n'est jamais arrondie (10 pages en 7 jours restent 10/7 de page par jour, y compris
    comme part du jour) ; le calcul se fait en nombres entiers et seul le nombre de jours
    est arrondi, au jour supérieur. Renvoie `null` si le rythme est nul **ou si la khatma
    est déjà terminée** (sa vraie date de fin est dans son badge).
11. **Badges (règle 9).** `startedOn` et `completedOn` sont la date la plus ancienne et la
    plus récente des entrées de la khatma (les entrées ne sont pas forcément dans l'ordre
    des dates). `daysTaken` compte les jours du calendrier, les deux bouts compris : une
    khatma lue en un jour vaut 1. Les jours en pause ne sont pas retirés. Calcul linéaire :
    une passe sur le journal, puis un pas par khatma, sans tri.
12. **Jardin à afficher (règle 10, D9, D10).** Le jardin commence le jour de la première
    page de sa khatma. Un jour est arrosé ou non pour toutes les khatmas ensemble : le jour
    où une khatma se termine et où la suivante commence est un seul jour arrosé. Les jours
    arrosés vont de `startDate` en avant, sans borne de fin.
    **Jour où un hizb est terminé** : la date la plus récente parmi ses pages, page partagée
    comprise (elle compte pour ses deux hizb). `firstHizbCompletedOn` est le plus ancien de
    ces jours parmi les hizb terminés, quel que soit leur rang dans le mushaf. Ce sont les
    dates qui comptent, pas l'ordre d'enregistrement : un hizb terminé après coup pour un
    jour passé peut donc faire reculer `firstHizbCompletedOn`. `completedOn` est la date la
    plus récente des entrées de la khatma, comme sur son badge ; il n'est renseigné que
    lorsque le flux porte une khatma terminée (60 hizb). On a toujours
    `startDate ≤ firstHizbCompletedOn ≤ completedOn`.
13. **Plages de hizb.** Le type `HizbPageRange` est déclaré ici pour ne pas dépendre de
    l'implémentation du module Coran. Les plages sont validées à chaque appel : 60 éléments,
    numérotés de 1 à 60 dans l'ordre, de la page 1 à la page 604, chaque hizb commençant sur
    la dernière page du précédent (page partagée) ou sur la suivante. Sinon : `RangeError`.
14. **Dates futures.** `recordPageRead` ne connaît pas la date du jour et accepte toute date
    valide. Une entrée datée après `today` compte pour la progression, mais pas pour
    l'objectif du jour, la série ni le rythme récent.

## Limites connues

- **Coût.** Chaque appel relit tout le journal : linéaire, environ 80 ms pour 300 khatmas
  (181 200 entrées) sur un poste de développement, 3 ms pour 10 khatmas. Non mesuré sur
  téléphone. Si un écran appelle plusieurs fonctions à chaque rendu, mémoriser leurs
  résultats côté interface tant que le journal ne change pas.
- **Première page datée après `today`** (changement de fuseau, horloge modifiée) :
  `startDate` est alors après `today`. Ce cas est traité côté jardin, pas ici.
- **Jardin complet.** Aucune page ne peut l'arroser : la première page lue après la fin
  d'une khatma ouvre le jardin suivant. Ce qu'il devient les jours sans lecture relève des
  règles du module jardin.
- **Journal strict.** Une seule entrée invalide bloque toutes les fonctions. Une future
  fusion de journaux (synchronisation, lot 3) devra rétablir « une entrée par page » et
  « une khatma à la fois » avant d'appeler ce module.
