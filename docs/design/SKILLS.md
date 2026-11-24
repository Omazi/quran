# Skills de design : la règle et le registre

## La règle

Décision du propriétaire (24 novembre 2026) :

> On ne sort rien de sa tête. On suit toujours les skills. On ne s'en écarte que si l'on
> pense faire mieux, et dans ce cas on se confronte à ce que le skill décrit.

En pratique, pour tout ce qui touche à l'interface :

1. **Lire avant de faire.** On ouvre la page du skill qui traite du sujet. On ne cite
   jamais une règle de mémoire.
2. **Citer.** Chaque choix de design renvoie à sa source (`fichier › titre`). Un choix sans
   source est signalé comme « jugement », et il doit être rare.
3. **S'écarter, c'est l'écrire.** Tout écart est inscrit dans le registre plus bas : ce que
   dit le skill, ce qu'on fait, pourquoi c'est mieux, qui l'a décidé. Pas d'écart
   silencieux.
4. **Quand deux skills se contredisent**, la règle d'Apple l'emporte pour tout ce qui est
   navigation, contrôles, couleurs système et accessibilité ; les autres skills
   l'emportent pour l'identité (ton, signature, contenu).
5. **Une décision explicite du propriétaire l'emporte sur un skill**, mais l'écart est
   inscrit et lui est signalé.

## Les skills

| Skill                                                                          | Source                          | Ce qu'il gouverne ici                                                                                                                                      |
| ------------------------------------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple Design                                                                   | `dickwu/apple-design-skill`     | Les règles d'Apple (123 pages), la méthode de revue en cinq angles, le mode « amélioration » (plan de jetons, critique du plan)                            |
| SwiftUI Design                                                                 | `Wholiver/swiftui-design-skill` | Les six principes, la charte (`brand-spec`), les 2 ou 3 directions à proposer, la liste des tics « généré par IA », la revue en cinq critères notés sur 10 |
| Wireframe                                                                      | `Magdoub/wireframe`             | L'exploration d'un écran : 5 maquettes fil de fer en noir et blanc (1 sûre, 4 exploratoires) avant toute couleur                                           |
| SwiftUI Expert                                                                 | `AvdLee/SwiftUI-Agent-Skill`    | Quels composants et quelles API SwiftUI employer (Liquid Glass, listes, mises en page adaptables)                                                          |
| SwiftUI Pro                                                                    | `twostraws/SwiftUI-Agent-Skill` | Idem, avec ses pages `design.md`, `accessibility.md`, `localization.md`                                                                                    |
| Design critique, Design system, Accessibility review, UX copy, Frontend design | skills de la session            | Critique d'écran, cohérence des jetons, audit d'accessibilité, textes d'interface                                                                          |

Les fichiers des skills ne sont **pas** dans ce dépôt (le skill Apple reprend le texte
d'Apple). Ils sont installés à côté, dans `ext/<auteur>_<dépôt>/`. Les noms de dépôt
ci-dessus sont déduits des noms de dossier.

### Limite à connaître

Les trois skills « SwiftUI » sont écrits pour une appli codée en Swift. La nôtre est codée
en React Native (Expo), choix validé pour avoir iOS puis Android sur une seule base, et
elle affiche les **vrais composants d'iOS** par Expo UI. Leurs règles de design et de
choix de composants s'appliquent telles quelles ; leurs règles d'écriture du code Swift ne
s'appliquent pas. C'est le premier écart du registre.

## Qui lit quoi

- **Architecte** : écrit la charte et les spécifications d'écran avec le mode
  « amélioration » d'Apple Design (étapes 1 à 3) et le protocole de charte de SwiftUI
  Design.
- **Développeur d'interface** : avant chaque composant, lit sa page Apple
  (`references/hig/<composant>.md`), `references/cross-platform.md` et, pour le verre,
  `references/hig/liquid-glass.md` et `references/code-audit.md`.
- **Relecteur design** : applique la revue d'Apple Design (pages « toujours chargées »,
  8 à 12 pages par revue, cinq angles, sévérités) puis la note en cinq critères de
  SwiftUI Design. Seuil : 7 sur 10 partout.
- **Exploration d'un écran non validé** : skill Wireframe d'abord, en noir et blanc.

## Registre des écarts

| N°  | Ce que dit le skill                                                                               | Ce qu'on fait                                                                                                | Pourquoi                                                                                                                                  | Décidé par                                                                    |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | SwiftUI Design, SwiftUI Expert, SwiftUI Pro : code en SwiftUI                                     | React Native (Expo) avec les composants natifs par Expo UI                                                   | Une seule base pour iOS puis Android ; les contrôles restent ceux du système                                                              | Propriétaire (choix de la stack)                                              |
| 2   | SwiftUI Design › Color Rules : ni blanc pur ni noir pur                                           | Fonds et textes = couleurs système d'iOS (blanc et noir compris)                                             | `dark-mode.md › Dark Mode colors` et `accessibility.md › Vision` demandent les couleurs système, qui s'adaptent seules au contraste élevé | Architecte, règle 4                                                           |
| 3   | `onboarding.md` : parcours bref et facultatif ; `page-controls.md` : pas plus d'environ 10 points | Parcours de 16 pages, sans bouton « Passer »                                                                 | Demandé ainsi par le propriétaire, qui a vu le prototype                                                                                  | Propriétaire — **à reconfirmer** : la version conforme tient en 10 pages      |
| 4   | `onboarding.md` : reporter les réglages non essentiels                                            | L'objectif du jour et les rappels sont choisis dans le parcours                                              | Demandé par le propriétaire ; des valeurs par défaut sont proposées, on peut passer sans rien toucher                                     | Propriétaire                                                                  |
| 5   | `page-controls.md` : l'indicateur de pages du système                                             | Indicateur dessiné, qui suit les règles de la page (centré, non coloré, points éloignés réduits, accessible) | Expo UI n'offre pas ce composant seul ; le vrai demande un module natif qu'on ne peut ni compiler ni vérifier ici                         | Architecte — **provisoire**, à remplacer dès qu'on compile sur un Mac         |
| 6   | `buttons.md › Style` : bouton proéminent tel que le système le dessine                            | En sombre, le libellé du bouton principal est noir                                                           | Le libellé blanc du système sur l'accent sombre ne fait que 1,96:1 ; en noir, 10,69:1 (`accessibility.md › Vision`)                       | Développeur d'interface, confirmé par l'architecte — à vérifier sur un iPhone |

### Écarts corrigés (on est revenu au skill)

- **Jardin dessiné en code.** SwiftUI Design, principe 4 et liste des tics : pas
  d'illustration SVG dessinée par une IA ; un emplacement neutre vaut mieux qu'une mauvaise
  image. Les jardins dessinés en code ont tous été refusés par le propriétaire : le skill
  avait raison. Le jardin est donc un **emplacement neutre** jusqu'à l'arrivée de vrais
  modèles (voir D12).
- **Fond crème, vert et serif.** Apple Design, angle 3 : « crème chaud, serif contrasté »
  est l'un des trois looks que tout le monde génère ; `tab-bars.md` et `color.md`
  déconseillent une couleur d'accent proche de celle du contenu. Voir la charte.
- **Police d'affichage embarquée (Fraunces).** `typography.md` et SwiftUI Design
  (deux familles au plus, New York pour les titres) : retirée.
- **Bouton maison.** `branding.md › Best practices` : exprimer la marque avec les
  composants familiers. Les boutons deviennent ceux du système.
