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
- `firstHizbCompletedOn` : jour où le premier hizb a été terminé, `null` tant qu'aucun ne
  l'est. C'est le jour où le jardin commence à vivre.
- `completedOn` : jour où la khatma a été terminée, `null` sinon.
- `today` : `LocalDate`.
- `pauses` : périodes `{ from, to }` incluses (maladie, voyage…).
- `variant` : le jardin de cette khatma (`gardenVariant(cycle, userSeed)`).
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
de l'arbre n : cycle `pomegranate, date-palm, olive, fig, cypress, orange`, décalé selon la
variante (pour la variante de référence des tests, sans décalage : arbre 1 = grenadier,
l'arbre 12, au hizb 25, est un oranger
et l'arbre 13, au hizb 26, un grenadier).

Versets associés (facultatifs, **à valider par un enseignant avant affichage**) :
`channels` 2:25 · `springs` 55:66 · `pomegranate` et `date-palm` 55:68 · `olive` et `fig`
95:1 · `trellis` 56:30 · `waterfall` 56:31 · `cushions` 88:15 · `carpets` 88:16.
Le jardin _s'inspire_ de ces versets ; il ne prétend pas représenter le Paradis.

## Sécheresse et santé

Une seule grandeur : les **jours de sécheresse**, un entier de 0 à 14
(`droughtDaysToDeath`). La santé s'en déduit : `santé = 1 − sécheresse / 14`.

On parcourt les jours de `firstHizbCompletedOn` à `today`, en partant de 0 :

- **Jour manqué** : sécheresse + 1, plafonnée à 14.
- **Jour arrosé** : sécheresse − 3 (`droughtDaysRecoveredPerWateredDay`), jamais sous 0.
- **Jour en pause** : rien ne change, et la suite de jours manqués n'est ni allongée ni
  remise à zéro.
- **La journée en cours ne pénalise jamais** : `today` compte s'il est arrosé, sinon il est
  ignoré (il ne devient un jour manqué que le lendemain).
- **Avant le premier hizb**, le jardin n'existe pas encore : rien ne peut sécher. Les
  jours d'avant `firstHizbCompletedOn` ne comptent pas.
- **Jardin complet** : à partir de `completedOn`, le jardin est montré **en pleine santé**
  (sécheresse 0, tous les éléments, l'eau coule) et plus rien ne change jusqu'à la khatma
  suivante. Finir le Coran est une fête : on ne montre pas un jardin mourant à ce
  moment-là, et le badge de la même khatma montre lui aussi un jardin complet.

Pourquoi ce modèle : lire ne doit **jamais** nuire. Avec un coût qui dépendait du rang du
jour manqué, lire une page au milieu d'une absence faisait mourir le jardin un jour plus
tôt. Ici, chaque jour applique à la sécheresse une règle croissante, et un jour arrosé
donne toujours moins de sécheresse qu'un jour manqué : remplacer un jour manqué par un
jour arrosé ne peut donc rien aggraver, ni ce jour-là ni plus tard.

Repères, depuis un jardin en pleine santé : 3 jours sans lecture → il a soif ; 6 → il
fane ; 10 → il meurt, les éléments disparaissent ; 14 → terre morte. Depuis la terre
morte, cinq jours de lecture le ramènent à la pleine santé, et le premier le fait déjà
revivre.

## Eau

`flowing` si aujourd'hui est arrosé ou si aucun jour n'est manqué ; `still` après 1 ou 2
jours manqués consécutifs ; `dry` à partir de 3. Arroser fait revenir l'eau le jour même.
Sur la terre nue (aucun hizb), il n'y a pas encore d'eau : `dry`, et aucun jour manqué.

## Phases

`bare` (aucun hizb) · `thriving` (sécheresse 0 à 2) · `thirsty` (3 à 5) · `wilting`
(6 à 9) · `dying` (10 à 13) · `dead` (14).

## Éléments visibles

- Jusqu'à `wilting` compris : tous les éléments débloqués.
- `dying` : `ceil(débloqués × (14 − sécheresse) / 5)` éléments, les premiers du catalogue
  (les derniers arrivés disparaissent en premier) : 80 %, 60 %, 40 %, 20 %. Arrondi vers le
  haut : tant que le jardin n'est pas mort, il reste au moins un élément, et la première
  lecture après la mort en fait toujours revenir un.
- `dead` : aucun.
- Quand la sécheresse recule, ils reviennent selon la même règle.
- L'élément en train de pousser n'est visible que si tous les éléments débloqués le sont.

## Sortie `GardenState`

`hizbCompleted`, `droughtDays`, `health`, `phase`, `water`, `missedDaysInARow`,
`daysSinceLastWatered` (ou `null`), `visibleElements`, `lastUnlocked` (ou `null`),
`nextElement` avec sa croissance (`currentHizbProgress`), `isComplete` (60 hizb),
`isPausedToday`, `variant`.

Prévision : `forecastGardenWithoutReading(input, dayCount)` donne l'état de chacun des
jours à venir si rien n'est lu (utilisé par les rappels).

## Un jardin par khatma

`gardenVariant(cycle, userSeed)` → `{ cycle, themeId, seed }`, déterministe, différent
d'un cycle au suivant. Les thèmes sont pour l'instant des identifiants neutres : le style
des jardins n'est pas décidé (D12). `completedGardenState(variant)` donne le jardin complet
d'un badge. **Une fois l'appli publiée, la façon de tirer une variante ne doit plus
changer** : elle changerait les jardins et les badges déjà gagnés.

## Entrées invalides

`hizbCompleted` hors 0..60, fraction hors 0..1, `firstHizbCompletedOn` absent alors qu'un
hizb est terminé (ou présent alors qu'aucun ne l'est), `completedOn` présent sans les 60
hizb, pause avec `to` avant `from`, configuration incohérente : erreur explicite.

**Jamais d'erreur pour une date « dans le futur »** : après un changement de fuseau
horaire, `today` peut tomber avant `firstHizbCompletedOn` ou avant un jour arrosé. Ces
jours-là sont simplement ignorés ; l'écran d'accueil ne doit pas planter pour cela.

## Propriétés à garantir par les tests

- La sécheresse reste dans 0..14 et la santé dans [0, 1], quel que soit l'historique.
- **Lire ne nuit jamais** : dans tout historique, remplacer un jour manqué par un jour
  arrosé (ou par une pause) ne fait monter la sécheresse d'aucun jour suivant. À vérifier
  sur tous les historiques possibles d'une longueur donnée, pas sur quelques exemples.
- Le nombre d'éléments visibles ne dépasse jamais le nombre débloqué.
- Même entrée, même sortie (aucune dépendance à l'horloge).
- La prévision d'un jour égale le calcul direct fait ce jour-là.
- Scénarios : hizb 24 arrosé 12 jours de suite → `thriving`, eau `flowing`, dernier
  élément `springs`, prochain `tree-12` oranger ; 3 jours manqués → `thirsty`, eau `dry`,
  sécheresse 3 ; 6 → `wilting` ; 10 → `dying`, 80 % des éléments (20 sur 24) ; 14 → `dead`, aucun
  élément, `hizbCompleted` toujours 24 ; puis un jour de lecture → sécheresse 11, eau
  `flowing`.
- Un seul hizb, terminé après un mois d'absence : le jardin naît en pleine santé.
- Jardin complet, puis un mois sans lecture : inchangé.
- Khatma terminée après une absence : jardin complet en pleine santé, pas mourant.
- Un seul élément, jardin mort, puis un jour de lecture : l'élément est de nouveau visible.
