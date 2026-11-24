# Spécification — progression de lecture (khatm)

Périmètre : `src/domain/khatm`.

## But

À partir du journal de lecture, calculer la progression de la khatma, l'objectif du jour,
les jours « arrosés » et la série.

## Modèle

- Le **journal** est la seule source de vérité : une liste d'entrées
  `{ khatm: number, page: number, date: LocalDate }`. Tout le reste en est dérivé.
- Une entrée est unique par `(khatm, page, date)`. Relire une page un autre jour ajoute une
  entrée (la relecture compte comme lecture du jour) mais ne change pas la progression.
- Les pages peuvent être lues dans n'importe quel ordre.
- Les plages de pages des hizb sont **injectées** (`HizbPageRange[]`, 60 éléments) : le
  module ne charge aucune donnée.

## Règles

1. **Page lue** : une page est lue pour une khatma dès qu'une entrée existe.
2. **Hizb terminé** : toutes les pages de `firstPage` à `lastPage` sont lues. Une page
   partagée entre deux hizb compte pour les deux.
3. **Progression** : nombre de pages lues, fraction (0 à 1), nombre de hizb terminés,
   premier hizb non terminé et sa fraction de pages lues, première page non lue.
4. **Khatma terminée** : les 604 pages sont lues. La suivante porte le numéro `n + 1` ; ses
   pages repartent de zéro. Les hizb d'une khatma terminée ne sont jamais retirés.
5. **Aujourd'hui** : nombre de pages distinctes lues à la date du jour, toutes khatmas
   confondues, comparé à l'objectif (`dailyGoalPages`, entier ≥ 1) : lues, restantes,
   objectif atteint.
6. **Jour arrosé** : un jour avec au moins `minPagesPerWateredDay` pages (défaut 1).
7. **Série** : nombre de jours arrosés consécutifs se terminant aujourd'hui, ou hier si
   aujourd'hui n'est pas encore arrosé (la journée en cours ne casse pas la série). Un jour
   en pause ne casse pas la série et ne la fait pas avancer.
8. **Date de fin estimée** : pages restantes divisées par le rythme (objectif du jour, ou
   moyenne des 7 derniers jours si demandé), arrondi au jour supérieur ; `null` si le
   rythme est nul.

## API attendue (noms indicatifs)

`recordPageRead`, `getKhatmProgress`, `getTodayProgress`, `getWateredDays`, `getStreak`,
`estimateFinishDate`, plus les types et la configuration par défaut. Fonctions pures,
journal immuable (une fonction renvoie un nouveau journal).

## Entrées invalides

Page hors de 1..604, khatma < 1, date invalide, objectif < 1, plages de hizb incomplètes :
erreur explicite.

## Cas à tester en priorité

Journal vide ; page relue le même jour ; page relue un autre jour ; hizb à page partagée ;
série avec aujourd'hui non lu ; série à cheval sur une pause ; passage d'année ; khatma
terminée puis nouvelle khatma ; 604 pages lues en désordre.
