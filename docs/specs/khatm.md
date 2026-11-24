# Spécification — progression de lecture (khatm)

Périmètre : `src/domain/khatm`.

## But

À partir du journal de lecture, calculer la progression de la khatma, l'objectif du jour,
les jours « arrosés » et la série.

## Modèle

- Le **journal** est la seule source de vérité : une liste d'entrées
  `{ khatm: number, page: number, date: LocalDate }`. Tout le reste en est dérivé.
- Une entrée est unique par `(khatm, page)` : elle garde la date de la **première** lecture
  de la page dans cette khatma. **Relire une page déjà lue dans la même khatma ne compte
  pas** : ni pour la progression, ni pour l'objectif du jour, ni comme jour arrosé, ni pour
  la série (décision produit : relire toujours la même page serait de la triche).
  `recordPageRead` sur une page déjà lue renvoie le journal inchangé.
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
   pages repartent de zéro. Les hizb d'une khatma terminée ne sont jamais retirés. Une
   seule khatma est en cours à la fois : on n'écrit dans `n + 1` qu'une fois `n` terminée.
5. **Aujourd'hui** : nombre d'entrées datées du jour (pages lues pour la première fois dans
   leur khatma), comparé à l'objectif. **L'objectif est choisi par l'utilisateur** : un
   nombre de pages par jour, entier ≥ 1, toujours passé en paramètre (pas de valeur par
   défaut dans le domaine ; l'interface proposera des repères comme « un demi-hizb »,
   « un hizb », « un juz »).
6. **Jour arrosé** : un jour avec au moins `minPagesPerWateredDay` nouvelles pages
   (défaut 1).
7. **Série** : nombre de jours arrosés consécutifs se terminant aujourd'hui, ou hier si
   aujourd'hui n'est pas encore arrosé (la journée en cours ne casse pas la série). Un jour
   en pause ne casse pas la série et ne la fait pas avancer.
8. **Date de fin estimée** : pages restantes divisées par le rythme (objectif du jour, ou
   moyenne des 7 derniers jours si demandé), arrondi au jour supérieur ; `null` si le
   rythme est nul.

9. **Badge de khatma** : chaque khatma terminée donne un badge
   `{ khatm, startedOn, completedOn, daysTaken }`, dérivé du journal (`completedOn` = date
   de la dernière page lue). La liste des badges est ordonnée par numéro de khatma et peut
   devenir très longue (des centaines) : le calcul reste linéaire. L'image du jardin
   associée au badge vient du module jardin (même numéro de cycle).

## API attendue (noms indicatifs)

`recordPageRead`, `getKhatmProgress`, `getTodayProgress`, `getWateredDays`, `getStreak`,
`estimateFinishDate`, `getBadges`, plus les types et la configuration par défaut. Fonctions pures,
journal immuable (une fonction renvoie un nouveau journal).

## Entrées invalides

Page hors de 1..604, khatma < 1, date invalide, objectif < 1, plages de hizb incomplètes :
erreur explicite.

## Cas à tester en priorité

Journal vide ; page relue le même jour ; page relue un autre jour (aucun effet) ; un jour
fait uniquement de relectures (non arrosé, série cassée) ; hizb à page partagée ;
série avec aujourd'hui non lu ; série à cheval sur une pause ; passage d'année ; khatma
terminée puis nouvelle khatma ; badges de plusieurs khatmas ; 604 pages lues en désordre.
