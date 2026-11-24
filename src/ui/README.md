# `src/ui` : fondations d'interface

Tout ce qu'un écran affiche passe par ici. Règle : [docs/design/SKILLS.md](../../docs/design/SKILLS.md).
Valeurs : [docs/design/brand-spec.md](../../docs/design/brand-spec.md). Un écran n'écrit ni
couleur, ni taille, ni espacement, ni chaîne visible : il importe depuis `@/ui` et reçoit ses
libellés de la couche de traduction.

## Jetons

| Besoin          | Comment                                                                                                                                                                                                          | Règle suivie                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Couleur         | **Une seule porte : `useColors()`**, qui rend une couleur par rôle. Les composants d'ici prennent le nom du rôle (`color="secondaryLabel"`).                                                                     | `color.md › System colors`, `dark-mode.md › Dark Mode colors`                            |
| Texte           | `<AppText variant="…">` : `largeTitle`, `title2` (New York), `headline`, `body`, `subhead`, `footnote` (San Francisco). Quatre styles au plus par écran. La taille suit le réglage de la personne, sans plafond. | `typography.md › Using system fonts`, `› Supporting Dynamic Type`                        |
| Alignement      | `align="start"` par défaut : à droite en arabe. Jamais `left` ni `right`, jamais `marginLeft` : `start`, `end`, rangées.                                                                                         | `right-to-left.md › Text alignment`                                                      |
| Espacement      | `spacing` (4, 8, 16, 24, 32, 48), `layout.screenMargin` (16), `layout.controlGap` (12), `radius` (8, 12, 16).                                                                                                    | charte, section 3                                                                        |
| Cible tactile   | `layout.touchTarget` : 44 points sur iOS, 48 sur Android. En hauteur **minimale**, jamais fixe.                                                                                                                  | `accessibility.md › Mobility`                                                            |
| Écran           | `<Screen>` : fond système et zones sûres. `background="groupedBackground"` avec une liste groupée ; `scroll` pour que le contenu reste atteignable aux grandes tailles de texte.                                 | `layout.md › Guides and safe areas`, `› Adaptability`, `color.md › Mobile (iOS, iPadOS)` |
| Image absente   | `<Placeholder name="Jardin au hizb 8">` : surface neutre et nommée. Ni dessin, ni emoji.                                                                                                                         | SwiftUI Design, principe 4                                                               |
| Sens d'écriture | `getWritingDirection()` lit `I18nManager` (fixé au lancement). React Native retourne seul les rangées et `start`/`end`.                                                                                          | `right-to-left.md › Controls`                                                            |

Rôles de couleur. Système (dynamiques sur iOS, jamais en dur) : `background`,
`secondaryBackground`, `groupedBackground`, `secondaryGroupedBackground`, `label`,
`secondaryLabel`, `tertiaryLabel` (contenu non essentiel seulement), `separator`, `fill`,
`warning`, `destructive`. Appli : `accent`, `onAccent`, `growth`, `paper`, `ink`, `ornament`.
Une couleur, un seul sens : `growth` et `ornament` restent dans le contenu, `paper` et `ink`
sur la page du mushaf. `warning` et `destructive` colorent une icône ou un texte gras, toujours
avec un mot : jamais un texte courant, jamais seuls (`accessibility.md › Vision`).

Hors iOS, les rôles système ont des équivalents provisoires (`fallbackSystemColors`) choisis
selon le thème de l'appareil. Le test des jetons recalcule chaque contraste écrit dans la
charte et échoue si la charte et les jetons divergent.

## Contrôles natifs (`native/`)

Chaque contrôle a les mêmes props partout (`native/types.ts`) et deux réalisations : `ios/`
affiche le composant du système (SwiftUI, par Expo UI) ; `default/` sert Android, le web et
les tests, selon les usages de Material, sans imiter iOS.

| Contrôle                      | Sur iOS                                                               | Règle suivie                                                                    |
| ----------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `Button` `primary`            | style proéminent du système, teinté par l'accent                      | `buttons.md › Style` : un par écran, deux au plus                               |
| `Button` `secondary`, `plain` | styles bordé et sans bordure                                          | `buttons.md › Style`, `› Best practices` (44 points, état pressé)               |
| `GroupedList`, `ListSection`  | `Form` et `Section`, avec titre et note de bas de section             | `lists-and-tables.md › Style`                                                   |
| `ListRow`                     | ligne de texte ; avec `onPress`, indicateur de navigation             | `lists-and-tables.md › Mobile (iOS, iPadOS, visionOS)`                          |
| `SwitchRow`                   | `Toggle` dans une ligne, couleur du système                           | `toggles.md › Mobile (iOS, iPadOS)`                                             |
| `StepperRow`                  | `Stepper` à côté de sa valeur écrite (`valueLabel`)                   | `steppers.md › Best practices`                                                  |
| `ChoiceRow`                   | `Picker` en menu : le bouton à choix du système                       | `pop-up-buttons.md › Best practices`                                            |
| `TimePickerRow`               | `DatePicker` compact, heures et minutes                               | `pickers.md › Mobile (iOS, iPadOS)`                                             |
| `ProgressIndicator`           | `ProgressView` : barre si `value`, indicateur d'activité sinon        | `progress-indicators.md › Best practices`                                       |
| `Gauge`                       | `Gauge` linéaire de capacité, libellés de valeur et de bornes         | `gauges.md › Anatomy`, `› Best practices`                                       |
| `ContentUnavailable`          | `ContentUnavailableView` (iOS 17) ; réalisation par défaut sur iOS 16 | SwiftUI Pro, `design.md › Standard system styling`                              |
| `Icon`                        | SF Symbol ; Material Symbol ailleurs ; taille du texte voisin         | `sf-symbols.md › Weights and scales`, `typography.md › Supporting Dynamic Type` |
| `PageIndicator`               | points dessinés (voir écarts)                                         | `page-controls.md › Best practices`, `accessibility.md › Mobility`              |

À savoir :

- Une tâche qui avance prend `ProgressIndicator` ; un niveau qui dure (santé du jardin, hizb
  lus) prend `Gauge`. Les indicateurs de progression sont transitoires (`progress-indicators.md`).
- Les lignes vivent dans `GroupedList` › `ListSection`. Un `Button`, une `Gauge` ou un
  `ProgressIndicator` y fonctionnent aussi. La liste défile seule et remplit la place donnée.
- Aucun verre ajouté à la main : les composants du système le prennent seuls, et rien ici ne
  flotte (`liquid-glass.md › Where the material belongs`). Aucune animation non plus.
- Une valeur invalide (progression hors de 0 à 1, bornes inversées, heure impossible) lève une
  erreur : rien n'est corrigé en silence.

## Tests

Jest résout les fichiers comme iOS, mais une vue SwiftUI y est une coquille sans texte ni rôle.
Sous Jest, `@/ui` rend donc la réalisation **par défaut** : un test d'écran interroge par rôle
et par texte (`getByRole('switch', { name })`). La réalisation iOS a ses propres tests
(`__tests__/native-ios.test.tsx`). `test-support/environment.ts` règle la plateforme, le thème,
le sens d'écriture et la taille du texte, et repère les styles qui ne se retournent pas.

**Non vérifié** : l'aspect réel sur iOS. Aucun simulateur n'était disponible ; les tests
vérifient quel composant système est demandé, avec quel style, pas ce qu'iOS dessine.

## Écarts aux skills

| Ce que dit le skill                                                              | Ce qu'on fait                                                                                     | Pourquoi                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page-controls.md` : l'indicateur de pages du système                            | `PageIndicator` est dessiné en React Native sur toutes les plateformes                            | Expo UI n'expose pas ce contrôle seul : il n'existe que dans un `TabView` paginé de SwiftUI, c'est-à-dire un second pageur. Les règles de la page sont suivies ; le vrai contrôle demande un module natif, donc l'architecte. |
| `buttons.md › Style` : le style proéminent tel que le système le dessine         | Son libellé prend `onAccent` (blanc en clair, noir en sombre)                                     | Le libellé blanc du système sur l'accent du mode sombre donne 1,96:1 ; la charte demande le noir (10,69:1).                                                                                                                   |
| SwiftUI Design, `typography-color.md` : orange `#FF9500`                         | Hors iOS, l'orange du thème clair est `#CC7700`                                                   | `#FF9500` sur blanc donne 2,20:1 ; la même teinte à 80 % est la première valeur au-dessus de 3:1.                                                                                                                             |
| `sf-symbols.md › Weights and scales` : graisse du symbole égale à celle du texte | Vrai sur iOS ; sur Android le symbole reste en graisse normale                                    | Chaque graisse de Material Symbols est un fichier de police de plus à embarquer.                                                                                                                                              |
| `typography.md` : une icône grandit comme le style de texte voisin               | `Icon` grandit selon le réglage général (celui du corps de texte), et n'accompagne pas les titres | React Native ne donne au JavaScript que ce coefficient ; l'écart avec les styles de texte courant reste sous 11 %.                                                                                                            |

Jugements sans source dans les skills : le rôle `fill` (remplissage système le plus marqué),
les valeurs de repli hors iOS, les états pressé et désactivé de la réalisation par défaut
(usages de Material).
