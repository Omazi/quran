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
- **On n'écrit jamais un numéro de khatma à la main.** `recordPageRead` reçoit
  `{ page, date }` et range la page dans la khatma en cours (la première non terminée).
  Ainsi une appli qui aurait gardé un vieux numéro ne peut pas perdre une lecture.
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
   seule khatma est en cours à la fois : la khatma `n + 1` commence à la première page
   enregistrée après la fin de `n`.
5. **Aujourd'hui** : nombre d'entrées datées du jour (pages lues pour la première fois dans
   leur khatma), comparé à l'objectif. **L'objectif est choisi par l'utilisateur** : un
   nombre de pages par jour, entier ≥ 1, toujours passé en paramètre (pas de valeur par
   défaut dans le domaine ; l'interface proposera des repères comme « un demi-hizb »,
   « un hizb », « un juz »). On compte les entrées, toutes khatmas confondues : le jour où
   l'on termine une khatma et où l'on commence la suivante, une même page peut compter
   deux fois, une fois dans chacune. C'est voulu.
6. **Jour arrosé** : un jour avec au moins `minPagesPerWateredDay` nouvelles pages
   (défaut 1).
7. **Série** : nombre de jours arrosés consécutifs se terminant aujourd'hui, ou hier si
   aujourd'hui n'est pas encore arrosé (la journée en cours ne casse pas la série). Un jour
   en pause ne casse pas la série et ne la fait pas avancer.
8. **Date de fin estimée** : on suppose que la part du jour sera lue aujourd'hui. Le
   rythme est l'objectif du jour ou, si demandé, la moyenne des 7 derniers jours
   **complets** (aujourd'hui n'en fait pas partie). Reste du jour = rythme moins les pages
   déjà lues aujourd'hui, jamais négatif. Si les pages restantes tiennent dans le reste du
   jour, la fin est aujourd'hui ; sinon, aujourd'hui + (pages restantes − reste du jour)
   divisé par le rythme, arrondi au jour supérieur. `null` si le rythme est nul. Exemple :
   10 pages restantes, 5 pages par jour, rien de lu aujourd'hui → demain.

9. **Badge de khatma** : chaque khatma terminée donne un badge
   `{ khatm, startedOn, completedOn, daysTaken }`, dérivé du journal : `startedOn` est la
   date la plus ancienne des entrées de cette khatma, `completedOn` la plus récente,
   `daysTaken` le nombre de jours de l'une à l'autre, les deux comprises (les pauses ne
   sont pas déduites). La liste des badges est ordonnée par numéro de khatma et peut
   devenir très longue (des centaines) : le calcul reste linéaire. L'image du jardin
   associée au badge vient du module jardin (même numéro de cycle).

10. **Ce que reçoit le jardin** (`getGardenFeed`) : le numéro de khatma, le nombre de hizb
    terminés (0 à 60), la fraction du hizb en cours, la date de la première page (`null`
    tant qu'aucune page n'est lue), les jours arrosés depuis cette date,
    `firstHizbCompletedOn` (le jour où un premier hizb de cette khatma a été terminé,
    `null` sinon) et `completedOn` (le jour où elle a été terminée, `null` sinon). Le
    jour où un hizb est terminé est la date la plus récente parmi ses pages. **Le jardin
    complet reste affiché** : quand une khatma vient d'être terminée et que la suivante
    n'a encore aucune page, le jardin reçoit la khatma terminée, avec ses 60 hizb. Il ne
    passe au nouveau jardin qu'à la première page de la khatma suivante.

## API attendue (noms indicatifs)

`recordPageRead`, `getCurrentKhatm`, `getReadPages`, `isPageRead`, `getGardenFeed`,
`getKhatmProgress`, `getTodayProgress`, `getWateredDays`, `getStreak`,
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
