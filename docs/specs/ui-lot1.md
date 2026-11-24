# Spécification — interface du lot 1 (socle, premier lancement, accueil)

Référence visuelle : `docs/design/`. Jetons et composants de base : `src/ui`.
Traductions : `src/i18n` (un espace de noms par fonctionnalité ; français de référence,
anglais et arabe complets, arabe de droite à gauche).

## Règles communes

- Les écrans de `src/app` ne font que composer. Chaque écran est un composant de
  présentation qui reçoit un **modèle** (données prêtes à afficher) et des **actions** ;
  un hook à part fabrique le modèle à partir du magasin et du domaine. Le composant de
  présentation se teste sans stockage.
- Aucune valeur de style en dur dans `src/features` : uniquement les jetons de `src/ui`.
- Aucune chaîne visible en dur : tout passe par `useTranslation`.
- Accessibilité : rôle et libellé sur chaque contrôle, cibles d'au moins 44 points, texte
  qui supporte l'agrandissement, animations coupées si « réduire les animations ».
- Le lot 1 fonctionne sans compte et sans réseau.

## A. Socle et premier lancement

Périmètre : `src/store`, `src/data/storage`, `src/features/onboarding`,
`src/app/_layout.tsx`, `src/app/onboarding/**`, `src/app/index.tsx` (aiguillage),
`src/i18n/index.ts`, espaces de noms `common` et `onboarding`.

1. **Démarrage** : chargement des polices (`appFonts`), lecture des réglages enregistrés,
   langue (choix enregistré, sinon langue de l'appareil, sinon français), sens d'écriture.
   Écran d'attente tant que ce n'est pas prêt. Premier lancement → parcours d'accueil ;
   sinon → onglets.
2. **Magasin** (zustand) : réglages `{ language, dailyGoalPages, onboardingCompleted,
userSeed, pauses }` et journal de lecture (`ReadingJournal` du domaine). Persistance par
   AsyncStorage derrière une interface déclarée côté magasin et implémentée dans
   `src/data/storage`. Les données relues du stockage sont **validées** (version de schéma,
   types, bornes) : un contenu corrompu ne fait pas planter l'appli, il est écarté et
   signalé. `userSeed` est tiré une fois, au premier lancement.
3. **Parcours de premier lancement**, trois écrans :
   - _Bienvenue_ : la terre nue (emplacement d'illustration fourni par le rendu du jardin),
     le titre « Une terre nue. Soixante hizb pour en faire un jardin. », un bouton
     « Commencer ».
   - _Comment ça marche_ : trois idées courtes — lire arrose le jardin ; chaque hizb
     terminé y ajoute un élément ; chaque jour sans lecture l'abîme, et relire une page
     déjà lue ne compte pas.
   - _Ton objectif du jour_ : choix libre du nombre de pages, avec des repères (2 pages,
     un demi-hizb = 5, un hizb = 10, un juz = 20) et un réglage fin de 1 à 60. Modifiable
     plus tard dans les réglages.
     Fin du parcours : réglages enregistrés, arrivée sur l'accueil. On peut revenir en
     arrière à chaque étape.
4. **Onglets** : Jardin, Coran, Réglages. Au lot 1, « Coran » et « Réglages » peuvent être
   des écrans d'attente propres ; « Réglages » permet au moins de changer la langue et
   l'objectif.

## B. Jardin (rendu 2D provisoire) et accueil

Périmètre : `src/features/garden`, `src/features/home`, `src/app/(tabs)/index.tsx`,
espaces de noms `home` et `garden`.

1. **`GardenView`** : composant `react-native-svg` qui dessine un `GardenState` en vue
   isométrique. Entrées : l'état, une taille. Il affiche les éléments visibles, la
   croissance de l'élément suivant (graine, pousse, forme presque complète selon
   `growth`), l'eau (`flowing`, `still`, `dry`), et les teintes selon la phase (herbe
   verte, jaunie, sèche ; arbres verts, couleurs d'automne, nus). Terre nue craquelée
   quand rien n'est visible. Types d'éléments inconnus du rendu : ignorés sans erreur.
   Un libellé d'accessibilité résume l'état. Le rendu est remplaçable (3D plus tard) :
   rien d'autre dans l'appli ne dépend de sa façon de dessiner.
2. **Accueil** (`accueil.png`, `soif.png`, `mort.png`) : date, titre, série ; le jardin ;
   le compteur « n hizb sur 60 » avec ses 60 segments et l'état de l'eau ; la carte
   d'arrosage du jour (pages lues sur l'objectif, reprise à la bonne page, bouton
   « Lire et arroser ») ; le dernier élément acquis (son verset n'est affiché que si le
   contenu est marqué comme validé) ; un bandeau quand le jardin a soif ; l'écran
   « jardin desséché » quand la santé est à zéro, qui rappelle que les hizb lus restent
   acquis. La section « jardins voisins » est hors lot 1.
3. Le composant d'accueil reçoit un `HomeModel` ; un hook `useHomeModel` le fabrique.
   Tant que le magasin et les données du mushaf ne sont pas intégrés, le hook s'appuie
   sur une source de démonstration clairement isolée et nommée comme telle.

## Vérification

Tests de rendu avec `@testing-library/react-native` pour chaque écran et chaque état
(jardin florissant, assoiffé, desséché, terre nue ; premier lancement complet). L'essai
visuel se fait à l'intégration (export web et captures), puis sur appareil.
