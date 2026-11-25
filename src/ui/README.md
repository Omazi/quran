# `src/ui` : fondations d'interface

Tout ce qu'un écran affiche passe par ici. Règle : [docs/design/SKILLS.md](../../docs/design/SKILLS.md).
Valeurs : [docs/design/brand-spec.md](../../docs/design/brand-spec.md). Un écran n'écrit ni
couleur, ni taille, ni espacement, ni chaîne visible : il importe depuis `@/ui` et reçoit ses
libellés de la couche de traduction.

## Jetons

| Besoin          | Comment                                                                                                                                                                                                                                                                              | Règle suivie                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Couleur         | **Une seule porte : `useColors()`**, qui rend une couleur par rôle. Les composants d'ici prennent le nom du rôle (`color="secondaryLabel"`).                                                                                                                                         | `color.md › System colors`, `dark-mode.md › Dark Mode colors`               |
| Texte           | `<AppText variant="…">` : `largeTitle`, `displayTitle` (36 pt, graisse normale, écran immersif : écart 33), `title2` (New York), `headline`, `body`, `subhead`, `footnote` (San Francisco). Quatre styles au plus par écran. La taille suit le réglage de la personne, sans plafond. | `typography.md › Using system fonts`, `› Supporting Dynamic Type`           |
| Alignement      | `align="start"` par défaut : à droite en arabe. Jamais `left` ni `right`, jamais `marginLeft` : `start`, `end`, rangées.                                                                                                                                                             | `right-to-left.md › Text alignment`                                         |
| Espacement      | `spacing` (4, 8, 16, 24, 32, 48), `layout.screenMargin` (16), `layout.controlGap` (12), `radius` (8, 12, 16).                                                                                                                                                                        | charte, section 3                                                           |
| Cible tactile   | `layout.touchTarget` : 44 points sur iOS, 48 sur Android. En hauteur **minimale**, jamais fixe.                                                                                                                                                                                      | `accessibility.md › Mobility`                                               |
| Écran           | `<Screen>` : fond système et zones sûres. `background="groupedBackground"` avec une liste groupée. Avec `scroll`, le contenu défile et, sur iOS, passe sous les barres, que le système dégage seul.                                                                                  | `layout.md › Guides and safe areas`, `› Visual hierarchy`, `› Adaptability` |
| Image absente   | `<Placeholder name="Jardin au hizb 8">` : surface neutre et nommée. Ni dessin, ni emoji.                                                                                                                                                                                             | SwiftUI Design, principe 4                                                  |
| Sens d'écriture | `getWritingDirection()` lit `I18nManager` (fixé au lancement). React Native retourne seul les rangées et `start`/`end`.                                                                                                                                                              | `right-to-left.md › Controls`                                               |
| Mouvement       | `useReducedMotion()` : vrai quand la personne a demandé de réduire les animations. Tout ce que l'appli anime elle-même doit alors apparaître sans bouger. Rien dans `src/ui` n'est animé par l'appli.                                                                                | `accessibility.md › Cognitive`, `motion.md › Best practices`                |

Rôles de couleur. Système (dynamiques sur iOS, jamais en dur) : `background`,
`secondaryBackground`, `groupedBackground`, `secondaryGroupedBackground`, `label`,
`secondaryLabel`, `tertiaryLabel` (contenu non essentiel seulement), `separator`, `fill`,
`warning`, `destructive`. Appli : `accent`, `onAccent`, `growth`, `paper`, `ink`, `ornament`.
Une couleur, un seul sens : `growth` et `ornament` restent dans le contenu, `paper` et `ink`
sur la page du mushaf.

Une couleur système garde son sens (`color.md › System colors`), et le type le vérifie :

- `AppText` refuse les fonds, `separator`, `fill`, `paper` et `warning` (`TextColorRole`).
- `Icon` refuse les fonds, `separator`, `fill` et `paper` (`IconColorRole`).
- **`warning` (orange) ne colore jamais un mot** : une icône ou le remplissage d'une jauge
  (`tone="warning"`), avec à côté un mot en couleur de libellé. `destructive` (rouge) colore le
  libellé d'un bouton destructif.

Hors iOS, les rôles système ont des équivalents provisoires (`fallbackSystemColors`) choisis
selon le thème de l'appareil. Le test des jetons recalcule chaque contraste écrit dans les deux
tableaux de la charte et échoue si la charte et les jetons divergent.

Contraste élevé (`color.md › Best practices`) : `accent`, `growth` et `ornament` ont les
valeurs du second tableau de la charte (`highContrastAppColors`). Rien à faire dans un écran :
`useColors()` s'en charge.

- **iOS** : chaque couleur dynamique porte ses valeurs de contraste élevé ; le système les
  choisit quand « Augmenter le contraste » est actif, sans nouveau rendu.
- **Android** : React Native n'expose qu'un réglage, « Texte à contraste élevé », et ses
  changements. `useColors()` le suit. Le niveau de contraste du système n'est pas exposé.
- **Web** : React Native n'expose rien ; les valeurs normales restent.

`onAccent`, `paper` et `ink` n'ont pas de valeur de contraste élevé dans la charte, ni les
équivalents système hors iOS : ils ne changent pas.

## Contrôles natifs (`native/`)

Chaque contrôle a les mêmes props partout (`native/types.ts`) et deux réalisations : `ios/`
affiche le composant du système (SwiftUI, par Expo UI) ; `default/` sert Android, le web et
les tests, selon les usages de Material, sans imiter iOS.

| Contrôle                      | Sur iOS                                                                                                                 | Règle suivie                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `Button` `primary`            | style proéminent du système                                                                                             | `buttons.md › Style` : un par écran, deux au plus                                         |
| `Button` `secondary`, `plain` | styles bordé et sans bordure, 44 points au moins dans les deux sens                                                     | `buttons.md › Style`, `› Best practices`                                                  |
| `Button` `role="destructive"` | rôle destructif du système, en rouge ; refusé sur `primary`                                                             | `buttons.md › Role`                                                                       |
| `GroupedList`, `ListSection`  | `Form` et `Section`, avec titre et note de bas de section                                                               | `lists-and-tables.md › Style`                                                             |
| `ListRow`                     | ligne de texte ; avec `onPress`, indicateur de navigation                                                               | `lists-and-tables.md › Mobile (iOS, iPadOS, visionOS)`                                    |
| `LabelRow`                    | `Label` : un symbole puis des mots, une seconde ligne au besoin                                                         | `lists-and-tables.md › Style`, `labels.md › Best practices`                               |
| `ButtonRow`                   | le `Button` comme ligne : la ligne entière, à la largeur de la ligne                                                    | `buttons.md › Style`, `› Best practices`                                                  |
| `ContentRow`                  | contenu React Native dans une ligne nue, à la hauteur du contenu                                                        | aucune (voir l'écart 15)                                                                  |
| `SwitchRow`                   | `Toggle` dans une ligne, gardé dans le vert du système                                                                  | `toggles.md › Mobile (iOS, iPadOS)`                                                       |
| `StepperRow`                  | `Stepper` à côté de sa valeur écrite (`valueLabel`)                                                                     | `steppers.md › Best practices`                                                            |
| `ChoiceRow`                   | `Picker` en menu : le bouton à choix du système                                                                         | `pop-up-buttons.md › Best practices`                                                      |
| `TimePickerRow`               | `DatePicker` compact, heures et minutes                                                                                 | `pickers.md › Mobile (iOS, iPadOS)`                                                       |
| `SegmentedChoice`             | `Picker` segmenté, libellé gardé pour VoiceOver ; seul ou dans une liste                                                | `segmented-controls.md › Best practices`, `› Content`, `› Mobile`                         |
| `DetailRow`                   | bouton : libellé, ligne de détail, valeur, `chevron.forward`                                                            | `lists-and-tables.md › Mobile`, `labels.md › Best practices` (voir l'écart 1)             |
| `TextFieldRow`                | `TextField` dans une ligne : clavier, majuscules et suggestions selon `kind` ; `search` ajoute la loupe et l'effacement | `text-fields.md › Best practices`, `› Mobile`, `search-fields.md` (voir l'écart 35)       |
| `ProgressIndicator`           | `ProgressView` : barre si `value`, indicateur d'activité sinon                                                          | `progress-indicators.md › Best practices`                                                 |
| `Gauge`                       | `Gauge` linéaire de capacité, libellés de valeur et de bornes, `tone`                                                   | `gauges.md › Anatomy`, `› Best practices`, `color.md › Best practices`                    |
| `ContentUnavailable`          | `ContentUnavailableView` (iOS 17) ; réalisation par défaut sur iOS 16                                                   | SwiftUI Pro, `design.md › Standard system styling`                                        |
| `Icon`                        | SF Symbol dessiné par SwiftUI dans le style et la graisse du texte voisin                                               | `sf-symbols.md › Weights and scales`, `typography.md › Supporting Dynamic Type`           |
| `Pager`                       | `TabView` paginé de SwiftUI, avec l'indicateur de pages du système                                                      | `page-controls.md › Best practices`, `› Customizing indicators`, `› Mobile`               |
| `PageIndicator`               | n'est pas utilisé : `Pager` montre celui du système                                                                     | hors iOS : `page-controls.md › Best practices`, `› Mobile`, `accessibility.md › Mobility` |

À savoir :

- **L'accent est donné une seule fois**, à l'hôte SwiftUI (`native/ios/swiftui-host.tsx`) : le
  système le pose où il met un accent (fond du bouton principal, libellé des autres boutons,
  valeur d'un choix ou d'une heure, progression). Seul l'interrupteur garde, exprès, le vert du
  système.
- **Les lignes et les sections vivent dans `GroupedList`.** Hors d'une liste, `ListSection`,
  `ListRow`, `LabelRow`, `ButtonRow`, `ContentRow`, `SwitchRow`, `StepperRow`, `ChoiceRow` et
  `TimePickerRow` lèvent une erreur, dans les deux réalisations : sur iOS rien d'autre ne
  pourrait les afficher. Un `Button`, une `Gauge`, un `ProgressIndicator` ou une `Icon` vont
  partout, dans une liste aussi. La liste défile seule et remplit la place donnée : un écran
  qui a une liste n'a pas d'autre zone qui défile, ce qui précède les lignes entre dans la
  liste par `ContentRow`.
- **`ContentRow`** met du contenu React Native (une scène, un titre de page) dans la liste. Il
  reçoit la largeur de la ligne et prend la hauteur qu'il lui faut ; la ligne n'a ni marge, ni
  fond, ni séparateur. À placer **seul dans sa `ListSection`** (une ligne sans fond casserait le
  bloc arrondi d'une section qui a d'autres lignes) et **sans marge latérale propre** : sur iOS
  la liste en donne déjà une, la réalisation par défaut donne celle des autres lignes. Dedans,
  on n'est plus dans la liste : une ligne y est refusée, un contrôle y reçoit son propre hôte.
  `accessibilityLabel` sert au contenu que le lecteur d'écran ne sait pas lire (une scène
  dessinée) : la ligne devient un seul élément, son contenu n'est plus lu morceau par morceau.
  `isEdgeToEdge` fait courir le contenu d'un bord à l'autre de l'écran, sans la marge des
  autres lignes : pour une image qui est la signature de l'écran (le jardin de l'accueil) ; le
  contenu garde alors ses propres marges. On le pose dans une `ListSection isBare`, qui ne
  dessine ni filet ni espace autour de ses lignes nues (sur iOS, le système n'en dessine pas
  non plus). Sur iOS la ligne a la largeur que la liste donne à une ligne, avec sa marge
  latérale : **non vérifié sur un iPhone** (voir l'écart 30 de `docs/design/SKILLS.md`).
- **`LabelRow`** : `tone` colore le symbole seul (`accent` par défaut, `growth`, `warning`,
  `secondaryLabel`), jamais les mots, qui disent toujours ce que la couleur dit
  (`color.md › Inclusive color`). Le symbole est décoratif, le lecteur d'écran lit les mots.
- **`ButtonRow`** a les props de `Button` sauf `fullWidth` : il occupe toujours la ligne. Le
  bouton `plain` est la ligne de la liste, parmi les autres. `primary` et `secondary`
  remplacent la ligne (ni marge ni fond) et gardent la grande taille du système, au-dessus de
  44 points : comme `ContentRow`, à placer seuls dans leur `ListSection`.
- **`Gauge` et `tone`** (`accent`, `growth`, `warning`) : deux jauges d'un même écran qui ne
  mesurent pas la même chose ne portent pas la même couleur (`color.md › Best practices`).
  Dans une liste, la jauge de la réalisation par défaut prend la marge des autres lignes.
- **`Pager`** remplit la place donnée ; `renderPage(i)` dessine la page `i` en React Native.
  Sur iOS, l'indicateur du système recouvre le bas des pages : chaque page réserve 44 points en
  bas. Ailleurs, c'est la liste paginée de la plateforme avec `PageIndicator` dessous.
  **Non essayé sur un iPhone** : si le pageur d'iOS se comporte mal, mettre
  `IOS_USES_SYSTEM_PAGER` à `false` dans `native/ios/pager-settings.ts` ; iOS prend alors la
  réalisation par défaut, celle que les tests exercent.
- Une tâche qui avance prend `ProgressIndicator` ; un niveau qui dure (santé du jardin, hizb
  lus) prend `Gauge`. Les indicateurs de progression sont transitoires (`progress-indicators.md`).
- Aucun verre ajouté à la main : les composants du système le prennent seuls, et rien ici ne
  flotte (`liquid-glass.md › Where the material belongs`).
- Une valeur invalide (progression hors de 0 à 1, bornes inversées, heure ou page impossible,
  bouton principal destructif) lève une erreur : rien n'est corrigé en silence.

### Confirmer une action

`confirmAction({ title, message, confirmLabel, cancelLabel, isDestructive, onConfirm })` : sur iOS
la feuille d'actions du système (le choix destructif en premier et en rouge, « Annuler » en bas :
`action-sheets.md › Best practices`, `alerts.md › Mobile`) ; sur Android la boîte de dialogue de
la plateforme ; sur le web la confirmation du navigateur. Aucun libellé à elle : l'appelant les
traduit. Un hook la reçoit en dépendance, pour que les tests répondent à sa place.

## Tests

Jest résout les fichiers comme iOS, mais une vue SwiftUI y est une coquille sans texte ni rôle.
Sous Jest, `@/ui` rend donc la réalisation **par défaut** : un test d'écran interroge par rôle
et par texte (`getByRole('switch', { name })`).

`test-support/environment.tsx` fournit le reste :

- `setDeviceConditions({ os, scheme, highContrast, reducedMotion, rightToLeft, fontScale })`
  puis `afterEach(resetDeviceConditions)` ; `changeHighContrast`, `changeReducedMotion`.
- **`renderOnIOS(<Écran />)`** rend le même arbre avec la réalisation iOS et échoue si une vue
  SwiftUI n'a pas d'hôte au-dessus d'elle : l'écran resterait vide sur un iPhone alors que les
  autres tests passent. À faire une fois par écran.
- `directionDependentStyles`, `fixedHeightsAroundText`, `touchTargetHeight` repèrent ce qui ne
  se retourne pas, ce qui coupe le texte, ce qui est trop petit. `LARGEST_FONT_SCALE` est le
  plus grand coefficient que React Native reçoit d'un iPhone (3,571).

**Non vérifié** : l'aspect et le comportement réels sur iOS. Aucun simulateur n'était
disponible ; les tests vérifient quel composant système est demandé, avec quel style, pas ce
qu'iOS dessine.

### À essayer d'abord sur un iPhone

Du plus risqué au moins risqué :

1. **`ContentRow` : du contenu React Native dans une ligne de liste SwiftUI.** À regarder : la
   ligne suit-elle la hauteur du contenu, au premier affichage puis quand elle change (taille
   du texte, rotation) ; le contenu reçoit-il bien la largeur de la ligne ; les touches
   arrivent-elles aux contrôles placés dedans ; le défilement reste-t-il fluide ; la ligne
   est-elle bien sans fond ni séparateur ; un contenu de moins de 44 points de haut (la hauteur
   minimale d'une ligne) est-il bien placé ; VoiceOver lit-il le contenu, ou le libellé donné.
2. **`Pager`** : pages React Native dans le `TabView`, indicateur visible, 44 points réservés.
   Repli : `IOS_USES_SYSTEM_PAGER`.
3. **`ButtonRow` `primary` et `secondary`** : le bouton couvre-t-il la largeur de la ligne nue,
   sans fond de ligne visible autour, et l'espace avec les sections voisines est-il juste.
4. **`LabelRow` avec `tone`** : le symbole coloré a-t-il la taille et la colonne du symbole que
   le système dessine lui-même (`tone` par défaut), et sa couleur remplace-t-elle bien l'accent
   de la liste ; la seconde ligne s'aligne-t-elle sous la première.
5. Le reste : teinte de l'hôte, vert de l'interrupteur, rouge du bouton destructif, alignement
   de `Icon` à côté d'un texte React Native, chevron de `ListRow`, lecture de `StepperRow`.

## Écarts aux skills

Tout ce qui, dans `src/ui`, ne fait pas ce qu'un skill décrit.

1. **Indicateur de navigation composé à la main.** `lists-and-tables.md › Mobile` : une ligne
   qui mène ailleurs porte l'indicateur de navigation du système. `ListRow` avec `onPress` est
   un bouton SwiftUI terminé par le symbole `chevron.forward`. Le système ne dessine le sien que
   pour son lien de navigation, qui exige une pile de navigation SwiftUI ; la navigation est
   celle d'Expo Router.
2. **Libellé du bouton principal.** `buttons.md › Style` : le style proéminent tel que le
   système le dessine. Son libellé prend `onAccent` (blanc en clair, noir en sombre) : le blanc
   du système sur l'accent du mode sombre donne 1,96:1, la charte demande le noir (10,69:1).
3. **L'accent sur tous les contrôles teintés.** `branding.md › Best practices` et
   `liquid-glass.md › Color on glass` : garder la couleur de marque hors de la plupart des
   contrôles. L'accent est la teinte de l'hôte : le système le pose aussi sur le libellé des
   boutons secondaires et simples, la valeur d'un choix ou d'une heure, les progressions, le
   symbole d'une `LabelRow`. C'est le mécanisme d'accent d'iOS (`pickers.md › Mobile`,
   `color.md › Liquid Glass color`).
4. **Tout teinter, interrupteur compris.** SwiftUI Design, `anti-ai-slop.md › Rule 9` : teinter
   toute l'appli, interrupteurs compris. L'interrupteur garde le vert du système
   (`toggles.md › Mobile` ; pour les contrôles, la règle d'Apple l'emporte).
5. **Fond de l'indicateur de pages.** `page-controls.md › Mobile` : fond permanent seulement
   quand le contrôle est le principal moyen de naviguer. Le `Pager` d'iOS le demande toujours :
   c'est vrai du premier lancement, sans bouton ; à revoir pour un autre usage.
6. **Indicateur dessiné hors iOS** (et sur iOS si `IOS_USES_SYSTEM_PAGER` est coupé).
   `page-controls.md › Mobile` : toucher d'un côté ou de l'autre du point courant, ou balayer
   le contrôle. `PageIndicator` se touche des deux côtés du point courant mais ne se balaie
   pas, et le point courant lui-même ne réagit pas. Il ne distingue la page courante que par la
   luminosité, comme celui du système (`accessibility.md › Vision`) ; la position est dite aux
   lecteurs d'écran.
7. **Échelle de texte d'Apple et gris d'iOS sur Android.** `cross-platform.md › Conventions to
check` : décider, par composant, entre l'usage de chaque plateforme et un dessin commun, et
   le dire. Android reçoit les six styles de texte d'Apple et des gris repris d'iOS et de
   SwiftUI Design, pas l'échelle ni les couleurs de Material. Une seule charte pour l'instant ;
   à revoir avec le lot Android. `color.md › System colors` (pas de valeur système en dur) ne
   peut être suivi que sur iOS.
8. **Orange hors iOS.** SwiftUI Design, `typography-color.md › Color Palette Structure` :
   `#FF9500`. Dans le thème clair, `#CC7700` : `#FF9500` donne 2,20:1 sur blanc ; assombri par
   pas de 1 %, 80 % est la première valeur au-dessus de 3:1 sur le fond groupé `#F2F2F7`
   (3,03:1 ; 3,38:1 sur blanc).
9. **Graisse des icônes sur Android.** `sf-symbols.md › Weights and scales` : graisse du
   symbole égale à celle du texte. Vrai sur iOS ; sur Android le symbole reste en graisse
   normale : chaque graisse de Material Symbols est un fichier de police de plus.
10. **Taille des icônes quand iOS prend la réalisation par défaut** (état vide sur iOS 16,
    pageur de repli). `typography.md › Supporting Dynamic Type` : l'icône grandit comme le texte
    voisin. Là seulement, elle grandit selon le coefficient général de React Native : +14,5 % à
    la plus grande taille pour le corps de texte, bien plus pour un titre. Partout ailleurs sur
    iOS, SwiftUI la dessine dans le style du texte.
11. **État vide sur iOS 16.** SwiftUI Pro, `design.md › Standard system styling` : préférer
    `ContentUnavailableView`. Il n'existe qu'à partir d'iOS 17 : sur iOS 16, icône, titre et
    texte sont composés à la main.
12. **Alignement des paragraphes.** `right-to-left.md › Text alignment` : un paragraphe de
    trois lignes ou plus s'aligne selon sa langue, pas selon l'interface. `AppText` aligne
    toujours sur le début de l'interface ; l'appelant passe `align` pour un paragraphe dans une
    autre écriture.
13. **Graisses fixes.** SwiftUI Pro, `design.md › Ensuring designs work for everyone` : laisser
    le système choisir la graisse du gras. Les styles de texte fixent 600 et 700, faute
    d'équivalent dans React Native ; l'effet du réglage « Texte en gras » n'est pas vérifié.
14. **Contraste élevé incomplet.** `color.md › Best practices` : une variante de contraste
    élevé par couleur. `onAccent`, `paper`, `ink` et les équivalents système hors iOS n'en ont
    pas (déjà au-dessus de 9:1 pour les trois premiers).
15. **Contenu autre que du texte dans une liste.** `lists-and-tables.md › Best practices` :
    préférer du texte dans une liste, et une collection quand les éléments sont de tailles très
    différentes. `ContentRow` met une scène ou un titre de page dans une ligne nue de la liste.
    Sans cela, l'écran empile deux zones qui défilent (ce qui précède la liste, puis la liste) :
    une seule zone de défilement vaut mieux, et une ligne nue ne se présente pas comme une
    ligne. Décision de l'architecte après la revue de design des écrans.

Relèvent de la charte, pas de ce dossier : l'interligne d'Apple au lieu de 1,4 et 1,2 (SwiftUI
Design, `typography-color.md › Typography Rules`), et des couleurs d'appli entre 5,04:1 et
6,44:1 là où `dark-mode.md › Dark Mode colors` invite à viser 7:1.

Jugements sans source dans les skills : le rôle `fill` (le remplissage système le plus
marqué), les valeurs de repli hors iOS, les états pressé et désactivé et le rouge du bouton
destructif de la réalisation par défaut (usages de Material), les 44 points réservés en bas des
pages du pageur d'iOS, la seconde ligne d'une `LabelRow` en `subheadline` (`labels.md` ne donne
que sa couleur), le bouton bordé qui remplace sa ligne dans `ButtonRow` (les skills ne disent
rien d'un bouton dans une liste), la marge latérale de `ContentRow` dans la réalisation par
défaut.
