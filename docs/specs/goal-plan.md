# Spécification — plan d'objectif et moment de lecture

Périmètre : `src/domain/goal-plan` (pur), `src/store` (réglages `goalKind`, actions
`setReadingGoal` et `setReadingMoment`). Sert les pages « Ton objectif du jour » et « Tes
rappels » du premier lancement (`docs/design/premier-lancement-voix`, pages 15 et 16).

## Objectif

Quatre choix : `'1-month' | '3-months' | '1-year' | 'own-pace'`.

```ts
computeGoalPlan(goal: Goal, today: LocalDate): GoalPlan
// Goal = { kind: GoalKind; pagesPerDay?: number }   (pagesPerDay : seulement pour 'own-pace')
// GoalPlan = { kind, pagesPerDay, readingDays, endDate, hizbAfter30Days }
```

- **Pages par jour** : 604 pages sur la durée, arrondi au supérieur. Un mois = 30 jours, 3 mois = 90,
  un an = 365. Donc 21, 7 et 2 pages par jour. `own-pace` : le nombre choisi, 5 par défaut ; entier de
  1 à 604 (le magasin n'accepte que 1 à 60, `DAILY_GOAL_RANGE`).
- **Date de fin** : on lit `pagesPerDay` pages **chaque jour, aujourd'hui compris**. C'est
  l'estimation du module khatm (`estimateFinishDate`, journal vide, rythme `daily-goal`) : pas de
  deuxième règle. `readingDays` = jours de lecture, aujourd'hui compris. 7 pages par jour finissent
  en 87 jours, pas en 90 : à partir du 25 novembre 2026, le 19 février 2027 (le prototype affiche
  « 25 février 2027 », qui est une date écrite à la main : l'écran doit afficher `endDate`).
- **Hizb après 30 jours** : `floor(min(604, pagesPerDay × 30) × 60 / 604)`. Un hizb ne compte qu'une
  fois fini (le prototype : 7 pages par jour, « Dans un mois : 20 hizb »). 60 au plus.
- Erreurs : `TypeError` pour un objectif inconnu, `RangeError` pour un rythme qui n'est pas un entier
  de 1 à 604. `goalPagesPerDay(goal)` donne les pages sans date.

## Moment de lecture

`'after-fajr' | 'midday' | 'evening' | 'before-sleep'`, à des heures locales fixes (il n'existe pas
encore de calcul des heures de prière) : **06:30, 12:30, 19:00, 22:00**
(`READING_MOMENT_TIMES`). Après Fajr suivra Fajr le jour où l'appli connaîtra les heures de prière.

Le moment n'est pas un réglage de plus : c'est **l'heure du rappel quotidien**
(`settings.reminders.dailyTime`), que le planificateur des rappels (`planReminders`) lit déjà. Le
moment s'en relit par `readingMomentAt(time)` (`null` pour une heure choisie à la main dans les
réglages). Pas de champ à garder en accord avec l'heure, donc pas de désaccord possible entre deux
téléphones.

- `remindersForReadingMoment(moment, { fridayKahf, thirstyGarden })` : le changement à donner à
  `updateReminders` : rappel quotidien activé à l'heure du moment, Al-Kahf du vendredi et « jardin
  assoiffé » activés **par défaut** (`DEFAULT_REMINDERS_CHOICES`) sauf si la personne les coupe
  (les deux interrupteurs de la page 16). Le vendredi garde son heure (`fridayTime`, 09:00).
- Tous les rappels de lecture (quotidien et jardin) sortent à l'heure du moment, comme le dit
  `reminders.md`. Un test le vérifie avec le vrai planificateur.

## Magasin

- Nouveau réglage `settings.goalKind` (comment l'objectif a été choisi). `dailyGoalPages` reste
  l'objectif du module khatm ; une durée le fixe à ses pages.
- `setReadingGoal(goal)` : écrit `goalKind` et `dailyGoalPages` ensemble. `setDailyGoalPages` (le
  stepper des réglages) remet `goalKind` à `'own-pace'`. `setReadingMoment(moment)` : active le rappel
  quotidien à l'heure du moment.
- **Synchronisation** : `goalKind` voyage (`SYNC_RULES`, règle `latest`, valeur vérifiée), avec
  `dailyGoalPages`.
- **Version du document : 6 → 7.** `goalKind` est obligatoire ; un document de version 6 prend
  `own-pace` (ce qu'était son objectif). Une ancienne version de l'appli lit encore un document 7
  (elle ignore le champ en trop).

## Tests

`src/domain/goal-plan/__tests__` (pages, dates, hizb, moments, et accord avec `estimateFinishDate` et
`planReminders`), `src/store/__tests__/reading-goal.test.ts` (actions, synchronisation, migration).
