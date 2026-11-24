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

| N°  | Ce que dit le skill                                                                                             | Ce qu'on fait                                                                                                                                     | Pourquoi                                                                                                                                  | Décidé par                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | SwiftUI Design, SwiftUI Expert, SwiftUI Pro : code en SwiftUI                                                   | React Native (Expo) avec les composants natifs par Expo UI                                                                                        | Une seule base pour iOS puis Android ; les contrôles restent ceux du système                                                              | Propriétaire (choix de la stack)                                              |
| 2   | SwiftUI Design › Color Rules : ni blanc pur ni noir pur                                                         | Fonds et textes = couleurs système d'iOS (blanc et noir compris)                                                                                  | `dark-mode.md › Dark Mode colors` et `accessibility.md › Vision` demandent les couleurs système, qui s'adaptent seules au contraste élevé | Architecte, règle 4                                                           |
| 3   | `onboarding.md` : parcours bref et facultatif ; `page-controls.md` : pas plus d'environ 10 points               | Parcours de 16 pages, sans bouton « Passer »                                                                                                      | Demandé ainsi par le propriétaire, qui a vu le prototype                                                                                  | Propriétaire — **à reconfirmer** : la version conforme tient en 10 pages      |
| 4   | `onboarding.md` : reporter les réglages non essentiels                                                          | L'objectif du jour et les rappels sont choisis dans le parcours                                                                                   | Demandé par le propriétaire ; des valeurs par défaut sont proposées, on peut passer sans rien toucher                                     | Propriétaire                                                                  |
| 5   | `page-controls.md › Mobile (iOS, iPadOS)` : toucher d'un côté ou de l'autre du point courant, ou glisser dessus | Sur iOS, le pageur et l'indicateur sont ceux du système. Ailleurs (et en repli sur iOS), l'indicateur est dessiné : on ne peut pas glisser dessus | Pas d'indicateur de pages standard hors d'iOS ; le repli existe parce que le pageur du système n'a pas pu être vérifié sur un iPhone      | Architecte, après la revue de design                                          |
| 6   | `buttons.md › Style` : bouton proéminent tel que le système le dessine                                          | En sombre, le libellé du bouton principal est noir                                                                                                | Le libellé blanc du système sur l'accent sombre ne fait que 1,96:1 ; en noir, 10,69:1 (`accessibility.md › Vision`)                       | Développeur d'interface, confirmé par le relecteur — à vérifier sur un iPhone |
| 7   | `lists-and-tables.md › Mobile` : indicateur de détail du système                                                | Une ligne cliquable est un bouton terminé par le symbole `chevron.forward`                                                                        | Le système ne dessine le sien que dans une pile de navigation SwiftUI, que l'appli n'utilise pas                                          | Développeur d'interface                                                       |
| 8   | `branding.md › Best practices` : garder la couleur de marque hors de la plupart des contrôles                   | L'accent est posé une fois sur l'hôte et teinte aussi les libellés secondaires, les valeurs des sélecteurs et la progression                      | C'est le mécanisme d'accent d'iOS ; le poser contrôle par contrôle en oubliait certains                                                   | Architecte, après la revue de design                                          |
| 9   | SwiftUI Design `anti-ai-slop.md › Rule 9` : tout teinter, interrupteurs compris                                 | L'interrupteur reste vert système                                                                                                                 | `toggles.md › Mobile (iOS, iPadOS)` l'emporte (règle 4)                                                                                   | Architecte                                                                    |
| 10  | `page-controls.md › Mobile` : fond permanent de l'indicateur seulement s'il est la navigation principale        | Le pageur iOS le demande toujours                                                                                                                 | Vrai pour le premier lancement, seul usage actuel ; à revoir s'il sert ailleurs                                                           | Développeur d'interface                                                       |
| 11  | `cross-platform.md › Conventions to check` : décider plateforme par plateforme                                  | Android reprend les six styles de texte et les gris d'iOS                                                                                         | Une seule charte tant que le lot Android n'a pas commencé                                                                                 | Architecte — provisoire                                                       |
| 12  | SwiftUI Design `typography-color.md` : orange `#FF9500`                                                         | Hors d'iOS, l'orange clair est `#CC7700`                                                                                                          | `#FF9500` ne fait que 2,20:1 sur blanc                                                                                                    | Développeur d'interface                                                       |
| 13  | `sf-symbols.md › Weights and scales` : graisse du symbole = graisse du texte                                    | Sur Android, les icônes restent en graisse normale                                                                                                | Chaque graisse est un fichier de police de plus                                                                                           | Développeur d'interface                                                       |
| 14  | `typography.md › Supporting Dynamic Type` : les icônes grandissent comme le texte                               | Quand iOS utilise le repli (iOS 16, pageur de repli), l'icône dépasse le texte de 14,5 % à la plus grande taille                                  | Limite de React Native hors des composants SwiftUI                                                                                        | Développeur d'interface                                                       |
| 15  | SwiftUI Pro `design.md › Standard system styling` : préférer `ContentUnavailableView`                           | Écran vide composé à la main sur iOS 16                                                                                                           | Le composant n'existe qu'à partir d'iOS 17                                                                                                | Développeur d'interface                                                       |
| 16  | `right-to-left.md › Text alignment` : un long paragraphe s'aligne selon sa langue                               | Le texte s'aligne toujours au début de l'interface ; l'appelant peut passer un alignement                                                         | Simplicité ; aucun long paragraphe d'une autre langue au lot 1                                                                            | Développeur d'interface                                                       |
| 17  | SwiftUI Pro `design.md › Ensuring designs work for everyone` : laisser le système choisir le gras               | Les styles de texte fixent les graisses 600 et 700                                                                                                | React Native n'a pas d'équivalent                                                                                                         | Développeur d'interface                                                       |
| 18  | `color.md › Best practices` : une variante à contraste élevé par couleur de l'appli                             | `onAccent`, le papier, l'encre et les couleurs système hors d'iOS n'en ont pas                                                                    | Ils sont déjà au-dessus de 10:1, ou la plateforme n'expose pas le réglage                                                                 | Développeur d'interface                                                       |
| 19  | SwiftUI Design : interligne de 1,4 et 1,2 ; `dark-mode.md › Dark Mode colors` : viser 7:1                       | Interlignes d'Apple ; couleurs de l'appli entre 5,04 et 6,44:1 en réglage normal (au-dessus de 7:1 en contraste élevé)                            | Les styles de texte d'Apple l'emportent (règle 4) ; 7:1 est atteint quand la personne le demande                                          | Architecte                                                                    |

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
