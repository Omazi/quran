# Spécification — rappels

Périmètre : `src/domain/reminders` (planification, pure) puis, à l'intégration,
`src/data/notifications` (envoi par notifications locales).

## But

Prévenir l'utilisateur **avant** que son jardin ne s'abîme, et l'aider à tenir son
objectif, sans le harceler ni le culpabiliser.

## Principe

Les notifications sont **locales** : programmées sur le téléphone, sans serveur ni compte.
Le domaine ne programme rien lui-même. Il calcule un **plan** : la liste des rappels à
venir, chacun avec sa date, son heure et son type. La couche de données remplace les
notifications programmées par ce plan à chaque changement (page lue, réglage modifié,
ouverture de l'appli).

Le plan se déduit du jardin : comme le temps est injecté, on calcule l'état du jardin
« si rien n'est lu » pour chacun des jours à venir, et on place un rappel aux changements
d'état.

## Entrées

L'entrée du jardin (voir `garden.md`), la date et l'heure locales du moment, l'objectif du
jour et les pages lues aujourd'hui, les réglages
`{ dailyEnabled, dailyTime, thirstyGardenEnabled, fridayKahfEnabled, quietHours }`, les
pauses.

## Types de rappel

1. `daily-goal` — chaque jour à l'heure choisie, **seulement si l'objectif du jour n'est
   pas encore atteint**.
2. `water-stopped` — le lendemain d'un premier jour sans lecture : l'eau ne coule plus.
3. `thirsty` — le jour où le jardin passe à « assoiffé ».
4. `wilting` — le jour où il passe à « fané ».
5. `last-chance` — la veille du jour où le jardin serait mort.
6. `dead` — une seule fois, le jour où il est desséché : rappelle que les hizb lus restent
   acquis et qu'une page suffit pour faire revenir l'eau.
7. `friday-kahf` — le vendredi, si l'option est activée.

Les types 2 à 6 dépendent de `thirstyGardenEnabled`.

## Règles

- **Au plus un rappel par jour.** Priorité : `last-chance` > `dead` > `wilting` >
  `thirsty` > `water-stopped` > `friday-kahf` > `daily-goal`.
- **Silence après la mort du jardin** : après `dead`, plus de rappel de jardin ; au plus
  un rappel doux par semaine pendant quatre semaines, puis plus rien.
- **Pas de rappel pendant une pause**, ni pendant les heures calmes (un rappel qui y
  tombe est décalé à leur fin).
- Lire aujourd'hui annule les rappels de jardin en attente, et le `daily-goal` du jour si
  l'objectif est atteint.
- Horizon du plan : 30 jours. Même entrée, même plan.

## Sortie

`ReminderPlan` : liste ordonnée de `{ date, time, kind, params }`. Les textes ne sont pas
dans le domaine : `kind` et `params` servent de clé de traduction. Ton : chaleureux,
court, jamais culpabilisant.

## À tester

Chaque type ; la priorité quand deux rappels tombent le même jour ; lecture en cours de
journée ; pause ; heures calmes à cheval sur minuit ; jardin déjà mort ; terre nue (seuls
`daily-goal` et `friday-kahf` existent) ; horizon.
