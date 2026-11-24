# Spécification — le jardin

Périmètre : `src/domain/garden`.

## But

Décrire l'état du jardin à afficher. Le module ne dessine rien : il produit un
`GardenState` que n'importe quel moteur de rendu (2D, 3D) peut afficher.

## Idée

Le jardin part d'une **terre nue**. Chaque hizb terminé débloque un élément : 60 hizb,
60 éléments, jardin complet. Chaque jour sans lecture abîme le jardin, jusqu'à redevenir
une terre morte. Reprendre la lecture le fait revivre. Les hizb lus ne sont jamais perdus.

## Entrées (toutes injectées)

- `hizbCompleted` : entier 0..60.
- `currentHizbProgress` : fraction 0..1 du hizb en cours.
- `wateredDays` : ensemble des `LocalDate` où l'utilisateur a lu.
- `startDate` : jour de création du jardin.
- `today` : `LocalDate`.
- `pauses` : périodes `{ from, to }` incluses (maladie, voyage…).
- `config` : toutes les constantes ci-dessous, avec valeurs par défaut.

## Catalogue (provisoire, contenu à faire valider)

Liste ordonnée de 60 éléments `{ hizb, id, kind, verse? }`. Le moteur ne dépend que de
l'ordre et de la longueur ; le contenu est une donnée dans `catalog.ts`.

Éléments hors arbres (hizb → id) :
1 `channels` · 2 `paving` · 3 `bed-1` · 4 `bed-2` · 6 `bed-3` · 8 `bed-4` · 10 `stepping-stones`
· 12 `flowers-1` · 15 `flowers-2` · 18 `flowers-3` · 20 `fountain` · 22 `flowers-4`
· 24 `springs` · 27 `birds-1` · 30 `wall-north` · 31 `wall-west` · 34 `trellis`
· 37 `birds-2` · 40 `gate-north` · 41 `gate-west` · 44 `lanterns` · 47 `butterflies`
· 50 `pavilion` · 52 `carpets` · 54 `cushions` · 56 `lectern` · 57 `birds-3` · 58 `roses`
· 59 `waterfall` · 60 `full-bloom`.

Les 30 autres hizb débloquent chacun un arbre (`tree-1` … `tree-30`, dans l'ordre). Espèce
de l'arbre n : cycle `pomegranate, date-palm, olive, fig, cypress, orange` (arbre 1 =
grenadier ; l'arbre 13, au hizb 25, est donc un grenadier).

Versets associés (facultatifs, **à valider par un enseignant avant affichage**) :
`channels` 2:25 · `springs` 55:66 · `pomegranate` et `date-palm` 55:68 · `olive` et `fig`
95:1 · `trellis` 56:30 · `waterfall` 56:31 · `cushions` 88:15 · `carpets` 88:16.
Le jardin _s'inspire_ de ces versets ; il ne prétend pas représenter le Paradis.

## Santé (0 à 1)

Simulation jour par jour, de `startDate` à `today`, santé initiale 1.

- **Jour arrosé** : santé + `recoveryPerWateredDay` (0,20), plafonnée à 1.
- **Jour manqué** : santé − coût, selon le rang `n` du jour dans la suite de jours manqués
  consécutifs : n = 1 → 0,10 ; n = 2 ou 3 → 0,15 ; n = 4 à 6 → 0,07 ; n ≥ 7 → 0,05.
  Plancher 0. Depuis une santé de 1, le jardin est mort au 14ᵉ jour manqué.
- **Jour en pause** : rien ne change, et la suite de jours manqués n'est ni allongée ni
  remise à zéro.
- **La journée en cours ne pénalise jamais** : `today` compte s'il est arrosé, sinon il est
  ignoré (il ne devient un jour manqué que le lendemain).
- Tant que `hizbCompleted` vaut 0, il n'y a rien à abîmer : santé 1.

## Eau

`flowing` si aujourd'hui est arrosé ou si aucun jour n'est manqué ; `still` après 1 ou 2
jours manqués consécutifs ; `dry` à partir de 3. Arroser fait revenir l'eau le jour même.

## Phases

`bare` (aucun hizb) · `thriving` (santé ≥ 0,75) · `thirsty` (≥ 0,50) · `wilting` (≥ 0,25)
· `dying` (> 0) · `dead` (0, avec au moins un hizb).

## Éléments visibles

- Santé ≥ 0,25 : tous les éléments débloqués.
- Santé < 0,25 : `floor(débloqués × santé / 0,25)` éléments, les premiers du catalogue (les
  derniers arrivés disparaissent en premier). Santé 0 : aucun.
- Quand la santé remonte, ils reviennent selon la même règle.

## Sortie `GardenState`

`hizbCompleted`, `health`, `phase`, `water`, `missedDaysInARow`, `daysSinceLastWatered`
(ou `null`), `visibleElements`, `lastUnlocked` (ou `null`), `nextElement` avec sa
croissance (`currentHizbProgress`), `isComplete` (60 hizb), `isPausedToday`.

## Entrées invalides

`hizbCompleted` hors 0..60, fraction hors 0..1, `today` avant `startDate`, pause avec
`to` avant `from`, configuration incohérente : erreur explicite.

## Propriétés à garantir par les tests

- La santé reste dans [0, 1] quel que soit l'historique.
- Ajouter un jour arrosé à un historique ne fait jamais baisser la santé du jour.
- Le nombre d'éléments visibles ne dépasse jamais le nombre débloqué.
- Même entrée, même sortie (aucune dépendance à l'horloge).
- Scénarios de la maquette : hizb 24 arrosé 12 jours de suite → `thriving`, eau `flowing`,
  dernier élément `springs`, prochain `tree-13` grenadier ; 3 jours manqués → eau `dry`,
  santé 0,60 ; 14 jours manqués → `dead`, aucun élément, `hizbCompleted` toujours 24.
