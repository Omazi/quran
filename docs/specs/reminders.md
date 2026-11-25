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

Le plan se déduit du jardin : on demande au module jardin l'état de chacun des jours à
venir « si rien n'est lu » (`forecastGardenWithoutReading`), et on place un rappel aux
changements d'état. Aucune règle du jardin n'est réécrite ici.

## Entrées

L'entrée du jardin (voir `garden.md`), la date et l'heure locales du moment, l'objectif du
jour et les pages lues aujourd'hui, les pauses, et les réglages
`{ dailyEnabled, dailyTime, thirstyGardenEnabled, fridayKahfEnabled, fridayTime, quietHours }`.

## Types de rappel

Rappels de lecture, envoyés à `dailyTime` :

1. `daily-goal` — chaque jour, **seulement si l'objectif du jour n'est pas encore atteint**
   (dépend de `dailyEnabled`).
2. `water-stopped` — le lendemain d'un premier jour sans lecture : l'eau ne coule plus.
3. `thirsty` — le jour où le jardin passe à « assoiffé ».
4. `wilting` — le jour où il passe à « fané ».
5. `dying` — le jour où il passe à « mourant » : les éléments commencent à disparaître.
6. `last-chance` — la veille du jour où le jardin serait mort.
7. `dead` — une seule fois, le jour où il est desséché.
8. `come-back` — après la mort du jardin, une fois par semaine pendant quatre semaines
   (7, 14, 21 et 28 jours après), puis plus rien.

Les types 2 à 8 dépendent de `thirstyGardenEnabled`.

Rappel du calendrier, envoyé à `fridayTime` (par défaut 9 h) :

9. `friday-kahf` — chaque vendredi, si l'option est activée. Il ne dépend pas du jardin :
   il continue quel que soit son état, et un rappel de lecture ne le remplace jamais.

## Règles

- **Au plus un rappel de lecture par jour.** Priorité : `last-chance` > `dead` > `dying` >
  `wilting` > `thirsty` > `water-stopped` > `come-back` > `daily-goal`. Le rappel du
  vendredi s'ajoute, à son heure.
- **Silence après la mort du jardin** : à partir du lendemain de `dead`, plus de
  `daily-goal` ni de rappel de jardin ; seulement les quatre `come-back`, puis plus rien
  jusqu'à une lecture. Envoyer chaque jour un rappel à quelqu'un qui ne répond plus depuis
  deux semaines, c'est du harcèlement.
- **Pas de rappel pendant une pause** (aucun type). Un rappel qui tombe un jour de pause
  est abandonné, pas reporté.
- **Heures calmes** : un rappel qui y tombe est décalé à leur fin, le même jour.
- **Lire aujourd'hui** fait recalculer le plan : le rappel de jardin du jour disparaît et
  les suivants reculent ; le `daily-goal` du jour disparaît si l'objectif est atteint.
- Terre nue et jardin complet : aucun rappel de jardin.
- Un rappel dont l'heure est déjà passée aujourd'hui n'est pas dans le plan.
- Horizon du plan : 30 jours. Même entrée, même plan.

## Sortie

`ReminderPlan` : liste ordonnée de `{ date, time, kind, params }`. Les textes ne sont pas
dans le domaine : `kind` sert de clé de traduction, et `params` reste vide.

## Texte des notifications

Règles d'Apple (`notifications.md`, `managing-notifications.md`) :

- **Informer, pas ordonner.** Le texte dit l'état du jardin (« L'eau de ton jardin s'est
  arrêtée. »), il ne dit pas quoi faire dans l'appli.
- **Rien de sensible sur un écran verrouillé.** Le texte parle du jardin, jamais de la
  pratique religieuse de la personne, du nombre de pages lues ni du nombre de jours sans
  lecture. C'est pour cela que `params` est vide. Le rappel du vendredi, que la personne a
  elle-même activé, nomme la sourate ; un texte générique est prévu quand les aperçus sont
  masqués.
- Jamais deux notifications pour la même chose : chaque rappel de jardin marque un
  changement d'état différent.
- Phrases complètes et courtes, majuscule en début de phrase, sans le nom de l'appli.
- Aucun rappel « urgent » : niveau d'interruption normal.
- Tous les rappels se règlent dans l'appli (onglet Réglages).

## Programmation (notifications locales)

Le plan devient des notifications locales (`expo-notifications`, aucun serveur) :

- **Une notification par créneau et par jour.** Identifiant stable `reminder.<date>.reading`
  ou `reminder.<date>.friday` : reprogrammer remplace, ne double jamais. Au plus 60
  notifications en attente (iOS en garde 64) ; on garde les plus proches.
- **Idempotent.** La couche de données compare ce que le téléphone détient (identifiant +
  signature `type@heure@langue`) à ce que le plan demande, annule l'obsolète, programme le
  manquant. Seules les notifications dont l'identifiant commence par `reminder.` sont touchées.
- **On recalcule** : réglage modifié (rappels, heure, objectif, pauses, langue) ; page lue
  (le rappel du jour disparaît dès que l'objectif est atteint, ceux du jardin reculent) ;
  retour de l'appli au premier plan ; réponse à la demande d'autorisation ; changement de
  jour ou de fuseau appli ouverte (contrôle chaque minute). Rien avant la fin de la
  présentation.
- **Sans autorisation**, ou tous rappels coupés : tout est annulé ; les rappels reviennent
  d'eux-mêmes quand l'autorisation est donnée.
- **Rappel de jardin et rappel du jour ne se cumulent pas** (priorité ci-dessus) : une
  notification de soif remplace le rappel du jour, au plus une par jour.
- **Heures.** Rappel de lecture à `dailyTime` (20 h 30 par défaut), vendredi à `fridayTime`
  (9 h par défaut, éteint par défaut car il nomme une sourate). Moment absolu à l'heure du
  téléphone au moment du calcul ; un changement de fuseau est repris à l'ouverture suivante.
- **Toucher une notification** : `daily-goal`, `water-stopped`, `thirsty`, `wilting`,
  `dying`, `last-chance` ouvrent le lecteur à la page de reprise (lue au moment du toucher) ;
  `friday-kahf` ouvre la page 293 (Al-Kahf) ; `dead` et `come-back` ouvrent l'accueil.
- **Premier plan** : une notification reçue appli ouverte n'est pas affichée.
- **Textes** : espace de noms `notifications` (fr, en, ar), voix du jardin, sans nombre ni
  reproche ; le rappel du vendredi a un texte de remplacement pour les aperçus masqués (iOS).
- **Android** : canal `reminders`, icône `assets/images/notification-icon.png`, couleur
  d'action `#1F5C45` (plugin `expo-notifications` dans `app.json`).

Code : `src/domain/reminders/notification-schedule.ts`, `src/data/notifications`,
`src/features/reminders`.

## À tester

Chaque type ; la priorité quand deux rappels tombent le même jour ; le vendredi en plus
d'un rappel de lecture ; lecture en cours de journée ; pause ; heures calmes à cheval sur
minuit ; jardin déjà mort ; les quatre `come-back` puis le silence ; terre nue et jardin
complet (seuls `daily-goal` et `friday-kahf` existent) ; horizon.
