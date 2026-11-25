# Rappels

Plan des rappels à venir, déduit du jardin. Spécification : `docs/specs/reminders.md` ;
décisions D2 et D13 de `docs/DECISIONS.md`.

TypeScript pur, fonctions pures, temps injecté. Le module n'envoie rien : il calcule une
liste « quel rappel, quel jour, à quelle heure » que la couche de données programme en
notifications locales, en **remplaçant** tout ce qui était programmé. Tout passe par
`index.ts`.

## Utilisation

```ts
import { planReminders } from '@/domain/reminders';

const plan = planReminders({
  garden, // l'entrée du jardin, sans `today` (les pauses sont les siennes)
  now: { date, time: { hour: 8, minute: 0 } }, // date et heure locales du téléphone
  dailyGoalPages, // objectif du jour (khatm)
  pagesReadToday, // nouvelles pages lues aujourd'hui (khatm)
  settings: {
    dailyEnabled,
    dailyTime: { hour: 20, minute: 30 },
    thirstyGardenEnabled,
    fridayKahfEnabled,
    fridayTime: { hour: 9, minute: 0 },
    quietHours: null, // ou { from, to }
  },
});
// [{ date: '2026-11-24', time: { hour: 20, minute: 30 }, kind: 'daily-goal', params: {} }, ...]
```

## Modèle

Pour chaque jour du plan (aujourd'hui et les 29 suivants), le module demande au jardin
son état « si rien n'est lu » et compare ce jour avec la veille et le lendemain. Aucune
règle du jardin n'est réécrite ici : seuils, pauses, eau et phases viennent de
`forecastGardenWithoutReading`.

Rappels de lecture, à `dailyTime`, **au plus un par jour** :

| Rappel          | Jour                                                                |
| --------------- | ------------------------------------------------------------------- |
| `water-stopped` | l'eau ne coule plus alors qu'elle coulait la veille                 |
| `thirsty`       | le jardin entre dans la phase `thirsty` en séchant                  |
| `wilting`       | il entre dans la phase `wilting` en séchant                         |
| `dying`         | il entre dans la phase `dying` en séchant                           |
| `last-chance`   | la veille du jour où il entre dans la phase `dead`                  |
| `dead`          | le jour où il entre dans la phase `dead`                            |
| `come-back`     | 7, 14, 21 et 28 jours après ce jour-là                              |
| `daily-goal`    | chaque jour ; aujourd'hui seulement si l'objectif n'est pas atteint |

Quand plusieurs tombent le même jour, le premier de `REMINDER_PRIORITY` est gardé, les
autres sont abandonnés. À partir du lendemain de la mort, seuls les `come-back` restent.

Rappel du calendrier, à `fridayTime` : `friday-kahf`, chaque vendredi. Il ne dépend pas du
jardin et **s'ajoute** au rappel de lecture du jour : un vendredi peut porter deux rappels.

Aucun rappel, d'aucun type, un jour en pause.

Fichiers : `types.ts` (vocabulaire), `config.ts` (nombres et priorité), `time-of-day.ts`
(heures et heures calmes), `calendar.ts` (vendredi, pause), `garden-days.ts` (le jardin
jour par jour), `plan-reminders.ts` (l'assemblage), `validation.ts` (entrées).

## Programmation

`notification-schedule.ts` : `buildNotificationSlots` (identifiants stables, 60 au plus),
`notificationTargetOf` (où mène le toucher), `notificationSignature` et `diffNotifications`
(ce qu'il faut annuler et programmer). Spécification : « Programmation » de `reminders.md`.

## Décisions

Lectures retenues là où la spécification est floue ou muette. Chacune a un test.

1. **Une seule horloge.** `now` porte la date et l'heure ; l'entrée du jardin est prise
   sans `today`, pour qu'un décalage à minuit entre deux « aujourd'hui » soit impossible.
2. **Horizon.** 30 jours : aujourd'hui et les 29 suivants.
3. **Heure déjà passée.** Un rappel d'aujourd'hui n'est dans le plan que si son heure est
   strictement à venir. À l'heure exacte ou après, il a été délivré par le plan précédent
   ou il est trop tard : il n'est pas reporté à demain. Chaque rappel est comparé à sa
   propre heure : un vendredi midi, le rappel de 9 h est sorti du plan, celui du soir y est.
4. **Heures calmes** `[from, to[`, appliquées à l'heure de chaque rappel. Une heure qui y
   tombe devient `to`, le même jour : avec 23:30 et des heures calmes de 22:00 à 07:00,
   chaque jour reçoit son rappel à 07:00, avec le contenu **de ce matin-là** (jamais la
   « dernière chance » le matin où le jardin est déjà mort). `from` = `to` : période vide.
5. **Ordre.** Par jour, puis par heure. À la même heure, le rappel de lecture vient avant
   celui du vendredi ; les deux sont gardés.
6. **Pause.** Les jours en pause, bornes incluses. Un rappel qui tombe un jour en pause
   est abandonné, pas rejoué à la reprise. La pause est lue dans la liste des pauses, pas
   dans `isPausedToday` (un jardin complet ne suit plus le calendrier).
7. **Lire aujourd'hui.** « Lu » = le jour figure dans `wateredDays`. Le rappel de jardin
   du jour disparaît et les suivants reculent, sans être effacés : un jour lu ne reprend
   que trois jours de sécheresse. `friday-kahf` reste (lire n'est pas lire Al-Kahf).
8. **Silence après la mort.** Le jour de la mort est un jour ordinaire (il porte `dead`).
   Dès le lendemain : ni `daily-goal` ni rappel de jardin, seulement les `come-back`. La
   règle suit l'état du jardin : `daily-goal` s'arrête même si `thirstyGardenEnabled` est
   faux (et il n'y a alors pas de `come-back`). Les semaines sont des semaines de
   calendrier, comptées depuis le jour de la mort, même s'il était en pause.
9. **`dead` une seule fois** par mort. Un jardin ranimé puis de nouveau mort reçoit un
   nouveau `dead` et quatre nouveaux `come-back`.
10. **`dying` seulement en séchant.** Un jardin mort qui redevient `dying` parce qu'on a
    lu ne déclenche rien.
11. **Terre nue, jardin complet.** Leur état ne change pas : aucun rappel de jardin, pas
    de silence. C'est le module jardin qui dit qu'un jardin de 60 hizb est complet.
12. **`params` est vide**, pour tous les types (section « Texte des notifications »).
13. **Entrées invalides** : `TypeError` ou `RangeError`, y compris quand tous les rappels
    sont désactivés ; les deux heures sont vérifiées même si leur rappel est désactivé.
    L'entrée du jardin est vérifiée par le module jardin.

## Arbitrages rendus par l'architecte

1. Nouveau type `dying` ; nouveau type `come-back` pour le rappel hebdomadaire après la
   mort, lié à `thirstyGardenEnabled`.
2. Le rappel du vendredi est indépendant du jardin, a son heure (`fridayTime`), et
   s'ajoute au rappel de lecture au lieu d'être remplacé par lui.
3. « Lire aujourd'hui » fait recalculer le plan : il ne promet plus d'effacer les rappels.

## À savoir pour l'intégration

- Le plan s'arrête au 30e jour : sans ouverture de l'appli pendant un mois, plus aucune
  notification n'est programmée, vendredi compris.
- Un plan contient au plus 34 ou 35 rappels (30 de lecture, 4 ou 5 vendredis).
