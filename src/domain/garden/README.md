# Jardin

Règles métier du jardin : ce que la lecture a fait pousser, et dans quel état il est
aujourd'hui. Spécification : `docs/specs/garden.md` ; décisions D9, D10 et D12 de
`docs/DECISIONS.md`.

TypeScript pur, fonctions pures, temps injecté (`today` est toujours un paramètre). Le
module ne dessine rien : il produit un `GardenState`, une valeur simple (nombres, chaînes,
listes, compatible JSON) qu'un moteur de rendu affiche sans connaître aucune règle. Tout
passe par `index.ts`.

## Utilisation

```ts
import {
  completedGardenState,
  computeGardenState,
  displayableVerse,
  forecastGardenWithoutReading,
  gardenVariant,
} from '@/domain/garden';

// Un jardin par khatma : même cycle et même graine d'utilisateur, même jardin.
const variant = gardenVariant(cycle, userSeed); // { cycle, themeId, seed }

// Le jardin d'aujourd'hui.
const state = computeGardenState({
  hizbCompleted, // 0..60, dans la khatma affichée
  currentHizbProgress, // 0..1, pages lues du hizb en cours
  wateredDays, // Set<LocalDate> des jours où une nouvelle page a été lue
  firstHizbCompletedOn, // jour du premier hizb terminé, null tant qu'aucun ne l'est
  completedOn, // jour où la khatma a été terminée, null sinon
  today,
  pauses, // [{ from, to }], bornes incluses
  variant,
});

// Le jardin « si rien n'est lu » pour chacun des 30 prochains jours (rappels) :
// forecast[0] est demain. Un seul parcours de la vie du jardin, quel que soit le nombre de jours.
const forecast = forecastGardenWithoutReading(input, 30); // [{ date, state }, ...]

// Le jardin complet d'une khatma terminée, pour son badge.
const badge = completedGardenState(gardenVariant(finishedCycle, userSeed));

// Un verset ne s'affiche que s'il est validé par un enseignant (aucun ne l'est encore).
const verse = state.lastUnlocked ? displayableVerse(state.lastUnlocked) : null;
```

Ce que le jardin attend de la progression de lecture est déclaré ici, dans le type
`GardenKhatmInput` (`hizbCompleted`, `currentHizbProgress`, `wateredDays`,
`firstHizbCompletedOn`, `completedOn`) : le module ne dépend pas de `domain/khatm`. Le
numéro de la khatma va à `gardenVariant`.

## Modèle

Deux idées indépendantes :

- **ce qui est acquis** : un élément par hizb terminé (`lastUnlocked`), jamais perdu, et
  l'élément suivant qui pousse au fil des pages (`nextElement.growth`) ;
- **ce qui est vivant** : les jours de sécheresse (`droughtDays`, entier de 0 à 14), + 1
  par jour manqué, − 3 par jour arrosé, comptés depuis le jour du premier hizb. La santé
  (`1 − droughtDays / 14`), la phase et le nombre d'éléments visibles s'en déduisent. L'eau,
  elle, suit la suite de jours manqués.

Fichiers : `catalog.ts` (les 60 éléments, donnée), `variant.ts` (un jardin par khatma),
`config.ts` (les nombres de la spécification), `day-history.ts` (les dates deviennent une
liste de jours), `drought.ts` (l'effet d'un jour), `garden-state.ts` (l'assemblage).

## Décisions

Lectures retenues là où la spécification est floue ou muette. Chacune est couverte par un
test.

1. **Configuration en jours entiers.** `droughtDaysToDeath` (14),
   `droughtDaysRecoveredPerWateredDay` (3), `thirstyMinDroughtDays` (3),
   `wiltingMinDroughtDays` (6), `dyingMinDroughtDays` (10), `dryWaterMinMissedDays` (3).
   Il faut `thirsty < wilting < dying < mort`, sinon `RangeError`. Le « 5 » de la règle des
   éléments visibles n'est pas un réglage de plus : il vaut `mort − dying + 1`, pour que le
   jardin mourant perde toujours ses éléments en parts égales. La part est arrondie vers le
   haut : un jardin qui n'est pas mort montre toujours au moins un élément.
2. **Lire pendant une pause compte.** Un jour à la fois en pause et arrosé est un jour
   arrosé : la pause pardonne un jour sans lecture, elle n'efface pas une lecture.
3. **Aucune date n'est « trop tard ».** Un jour arrosé, une pause, `firstHizbCompletedOn`
   ou `completedOn` postérieurs au jour décrit ne sont pas encore atteints : ils sont
   ignorés, sans erreur. Si `today` tombe avant le premier hizb, le jardin est décrit comme
   à sa naissance. Seules les dates mal formées lèvent une `RangeError`.
4. **Terre nue** (`hizbCompleted` = 0) : sécheresse 0, aucun jour manqué, eau `dry`, que
   la personne lise ou non. `daysSinceLastWatered` reste renseigné : il décrit la lecture,
   pas le jardin.
5. **Le jour du premier hizb est un jour comme un autre** : il compte s'il est arrosé (cas
   normal), et devient un jour manqué s'il ne figure pas dans `wateredDays`.
6. **Jardin complet.** À partir de `completedOn`, le jardin est montré en pleine santé
   (sécheresse 0, aucun jour manqué, les 60 éléments, l'eau coule) et ne change plus : c'est
   exactement le jardin du badge. `daysSinceLastWatered` et `isPausedToday` restent ceux du
   jour de fin. Avant ce jour (possible seulement après un changement de fuseau), il sèche
   normalement. Un jardin de 60 hizb **sans** `completedOn` est accepté et continue de
   vivre : les aperçus en ont besoin.
7. **Champ oublié.** `firstHizbCompletedOn` ou `completedOn` absents (`undefined`) : erreur.
   Seul `null` veut dire « pas encore ».
8. **Élément en cours de pousse.** `nextElement.isVisible` est vrai tant que tous les
   éléments débloqués sont visibles : jusqu'à `wilting` compris, et sur la terre nue. À
   cause de l'arrondi vers le haut, c'est aussi le cas d'un tout jeune jardin mourant (1 à 4
   éléments à 10 jours de sécheresse, 1 ou 2 à 11, 1 seul à 12 et 13). Sa croissance, elle,
   ne dépend que des pages lues.
9. **Variante.** `{ cycle, themeId, seed }`. Le thème avance d'un cran à chaque khatma à
   partir d'un thème propre à l'utilisateur : deux khatmas de suite n'ont jamais le même, et
   un thème ne revient qu'après tous les autres. La graine (0 à 4 294 967 295) est
   différente à chaque cycle. Le cycle des espèces d'arbres est décalé de `seed % 6` ;
   identifiants, ordre et autres éléments ne changent jamais. `userSeed` : entier de 0 à
   2^53 − 1. Quatre thèmes neutres, `theme-1` à `theme-4` (D12). **Figé après publication** :
   un test épingle des valeurs calculées hors du module.
10. **Versets.** `verse` vaut `{ key, validatedByTeacher }`. Tout est à `false`. L'interface
    passe par `displayableVerse(element)`, qui renvoie `null` tant que le verset n'est pas
    validé. Un catalogue dont un verset n'a pas de drapeau est refusé.
11. **Badge.** `completedGardenState(variant)` : les 60 éléments, aucune sécheresse, eau
    qui coule. Sans date : il ne change plus.
12. **Prévision.** `forecastGardenWithoutReading(input, n)` renvoie, pour chacun des `n`
    jours à venir, exactement `computeGardenState` avec la même entrée et `today` déplacé.
    Un jour déjà lu mais daté après `today` (changement de fuseau) compte donc quand son
    tour vient. `n` de 0 à 366.
13. **Catalogue fourni par l'appelant** (`input.catalog`) : utilisé tel quel, sans décalage
    des arbres.

## Arbitrages rendus

Points contestés pendant le développement, tranchés par l'architecte. Un test fige chacun.

1. **Khatma terminée après une absence.** Elle laissait un jardin complet mais mourant,
   impossible à arroser. Désormais, terminer la khatma montre le jardin en pleine santé
   (décision 6).
2. **Un jardin qui existe peut mourir.** Terminer son premier hizb plus tôt expose le
   jardin plus tôt : deux personnes lisent le jour 0, s'absentent trois semaines et relisent
   le jour 22 ; celle qui avait fini son premier hizb le jour 0 retrouve un jardin mourant,
   celle à qui il manquait une page le voit naître en pleine santé. C'est voulu. En
   revanche le retour doit se **voir** : l'arrondi vers le haut fait toujours revenir au
   moins un élément à la première lecture après la mort.
3. **60 hizb sans `completedOn`**, champ oublié, état gelé d'un jardin complet : lectures
   acceptées (décisions 6 et 7).

## Question ouverte, pour le propriétaire

**Seuil entre un jour sur quatre et un jour sur cinq.** Un jour arrosé reprend exactement
trois jours manqués (`droughtDaysRecoveredPerWateredDay`). Lire un jour sur quatre garde
donc le jardin `thriving` ou `thirsty` pour toujours ; lire un jour sur cinq le mène à
`dying`, et à la terre morte deux matins sur cinq. C'est la nature du modèle ; la valeur de
la constante est un réglage à confirmer (avec 4, un jour sur cinq suffirait).
