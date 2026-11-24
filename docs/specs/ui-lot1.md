# Spécification — interface du lot 1 (socle, premier lancement, accueil)

**iOS d'abord.** L'interface suit les règles de conception d'Apple (Human Interface
Guidelines, édition 2026, matériau Liquid Glass). Android viendra ensuite, sur la même
base de code. Référence visuelle : `docs/design/` ; le prototype du premier lancement est
`docs/design/premier-lancement-prototype.html` (à ouvrir dans un navigateur).

## Règles de conception (obligatoires)

Tirées des règles d'Apple et des guides de design fournis par le propriétaire.

1. **Composants natifs d'abord.** Interrupteurs, sélecteur − / +, contrôle segmenté,
   sélecteur d'heure, listes groupées, barre d'onglets, feuilles : on utilise les
   composants du système (Expo UI, onglets natifs d'Expo Router), pas des imitations.
   Chaque contrôle natif est enveloppé dans un petit composant de `src/ui/native/`, avec
   une variante iOS (composant système) et une variante par défaut (composant React
   Native de base) pour Android, le web et les tests.
2. **Liquid Glass seulement sur ce qui flotte** : barres, onglets, boutons posés au-dessus
   du contenu. Jamais sur les cartes, les listes ou le fond.
3. **Couleur avec retenue** : un seul bouton coloré (action principale) par écran, deux au
   plus. Les libellés des barres restent monochromes.
4. **Typographie système** : San Francisco pour l'interface, New York (serif système) pour
   les grands titres, avec les styles de texte du système et le texte agrandi (Dynamic
   Type). Aucune police d'interface embarquée. Les polices embarquées ne servent qu'au
   texte du Coran.
5. **Icônes : SF Symbols.** Aucun emoji en guise d'icône.
6. **Pas d'illustration dessinée à la main dans le code** pour décorer. Quand une image
   manque, on met un emplacement neutre et nommé. Seule exception : le rendu provisoire
   du jardin (voir B), isolé et remplaçable.
7. **Mouvement utile, bref, annulable**, et coupé si « réduire les animations » est actif.
   Aucune information ne dépend d'une animation.
8. **Cibles de toucher d'au moins 44 points**, état pressé visible sur tout contrôle.
9. **Lancement instantané** : l'écran de lancement ressemble au premier écran, sans texte
   ni logo.
10. **Autorisations au bon moment** : une demande système n'arrive qu'après avoir expliqué
    à quoi elle sert, déclenchée par un bouton unique au libellé neutre.
11. **Un détail soigné par écran, le reste discret.** Chaque écran passe la revue de
    design (voir `docs/TEAM.md`) avant d'être accepté.
12. **Droite à gauche** : en arabe, tout l'écran est en miroir, sens de la pagination
    compris ; le texte du Coran ne change pas.

## Règles de code

- Les écrans de `src/app` ne font que composer. Chaque écran est un composant de
  présentation qui reçoit un **modèle** et des **actions** ; un hook à part fabrique le
  modèle à partir du magasin et du domaine.
- Aucune valeur de style en dur dans `src/features` : uniquement les jetons de `src/ui`.
- Aucune chaîne visible en dur : tout passe par `useTranslation` (français de référence,
  anglais et arabe complets).
- Le lot 1 fonctionne sans compte et sans réseau.

## A. Socle et premier lancement

Périmètre : `src/store`, `src/data/storage`, `src/data/notifications`, `src/ui/native`,
`src/features/onboarding`, `src/features/settings`, `src/app/_layout.tsx`,
`src/app/index.tsx`, `src/app/onboarding/**`, `src/app/(tabs)/_layout.tsx`,
`src/app/(tabs)/quran.tsx`, `src/app/(tabs)/settings.tsx`, `src/i18n/index.ts`, espaces de
noms `common`, `onboarding`, `settings`.

1. **Démarrage** : polices du Coran (`appFonts`), réglages enregistrés, langue (choix
   enregistré, sinon langue de l'appareil, sinon français), sens d'écriture. Premier
   lancement → parcours ; sinon → onglets.
2. **Magasin** (zustand) : réglages `{ language, dailyGoalPages, onboardingCompleted,
userSeed, pauses, reminders }` et journal de lecture (type du domaine). `reminders` =
   `{ dailyEnabled, dailyTime, thirstyGardenEnabled, fridayKahfEnabled }`. Persistance par
   AsyncStorage derrière une interface déclarée côté magasin et implémentée dans
   `src/data/storage`. Tout ce qui est relu du stockage est **validé** (version de schéma,
   types, bornes) : un contenu corrompu est écarté sans plantage. `userSeed` est tiré une
   fois.
3. **Premier lancement** : un pageur horizontal natif, **un geste = une page**, sans bouton
   « Continuer » ni « Passer ». En haut, une scène commune (le jardin) qui change avec la
   page ; en bas, le titre et une phrase ; un indicateur de pages façon iOS, dont les
   points éloignés rétrécissent. Seize pages, dans cet ordre :
   - _Une terre nue_ ; _Hizb 8_ ; _Hizb 20_ ; _Hizb 30_ ; _Hizb 40_ ; _Hizb 60_ (le jardin
     pousse, une image par page) ;
   - _3 jours_, _6 jours_, _10 jours_, _14 jours sans lecture_ (le jardin se dessèche) ;
   - _Une page suffit pour le faire revivre_ ;
   - _Lis à voix haute, l'appli te suit_ ; _D'où vient ce passage ?_ ; _Avec tes proches_ ;
   - _Ton objectif du jour_ : ligne « Pages par jour » avec le sélecteur − / + du système
     (1 à 60) et un contrôle segmenté de repères (2 pages, ½ hizb = 5, 1 hizb = 10,
     1 juz = 20) ;
   - _Tes rappels_ : rappel du jour avec son heure, alerte « mon jardin a soif », rappel
     du vendredi pour la sourate Al-Kahf ; puis le bouton « Créer mon jardin », qui
     remplace l'indicateur de pages. La demande d'autorisation de notification du système
     suit ce bouton si au moins un rappel est activé.
     Les textes exacts sont dans le prototype. La scène du jardin est fournie par un
     composant injecté (le rendu du jardin, section B) ; tant qu'il n'est pas branché, un
     emplacement neutre le remplace.
     **Design non validé** : les pages _Lis à voix haute_ et _Tes rappels_ n'ont pas
     convaincu le propriétaire. On les code simplement, avec les composants natifs, de façon
     qu'on puisse les redessiner sans toucher au reste du parcours. Tout le parcours sera
     retravaillé plus tard : privilégier une structure claire à des effets.
4. **Onglets natifs** : Jardin, Coran, Réglages (libellés et SF Symbols). « Coran » peut
   être un écran d'attente propre ; « Réglages » permet de changer la langue, l'objectif
   et les rappels, et de revoir le parcours de présentation.
5. **Notifications** : `src/data/notifications` expose une interface (demander
   l'autorisation, connaître son état) implémentée avec `expo-notifications`, avec une
   version inerte pour le web et les tests. La programmation des rappels arrive avec le
   module `domain/reminders`.

## B. Jardin (rendu 2D provisoire) et accueil

Périmètre : `src/features/garden`, `src/features/home`, `src/app/(tabs)/index.tsx`,
espaces de noms `home` et `garden`.

1. **`GardenView`** : composant `react-native-svg` qui dessine un `GardenState` en vue
   isométrique. C'est un **rendu provisoire** : le style final du jardin n'est pas choisi
   et sera fait de vrais modèles 3D. Il sert à faire vivre et à vérifier les règles du
   jardin. Rien d'autre dans l'appli ne dépend de sa façon de dessiner.
   Il affiche les éléments visibles, la croissance de l'élément suivant (graine, pousse,
   forme presque complète selon `growth`), l'eau (`flowing`, `still`, `dry`) et la santé.
   **Le dessèchement se voit, progressivement** : le rendu suit la santé en continu (0 à
   1), pas seulement trois teintes. Quand elle baisse : les couleurs glissent du vert au
   jaune puis au brun, les feuillages s'éclaircissent, les fleurs disparaissent, les
   fruits tombent, les arbres finissent nus, la terre se craquelle. Quand elle remonte,
   le chemin inverse. Terre nue craquelée quand rien n'est visible. Types d'éléments
   inconnus : ignorés sans erreur. Dessin déterministe. Un libellé d'accessibilité résume
   l'état.
2. **Accueil** (`accueil.png`, `soif.png`, `mort.png`, à adapter aux règles iOS
   ci-dessus) : grand titre, série ; le jardin ; « n hizb sur 60 » avec ses 60 segments et
   l'état de l'eau ; l'arrosage du jour (pages lues sur l'objectif choisi, reprise à la
   bonne page, action principale « Lire et arroser ») ; le dernier élément acquis (son
   verset n'est affiché que si le contenu est marqué comme validé) ; un bandeau quand le
   jardin a soif ; l'état « jardin desséché », qui rappelle que les hizb lus restent
   acquis. Pas de « jardins voisins » au lot 1.
3. Le composant d'accueil reçoit un `HomeModel` ; un hook `useHomeModel` le fabrique.
   Tant que le magasin et les données du mushaf ne sont pas intégrés, il s'appuie sur une
   source de démonstration isolée et nommée comme telle, avec des préréglages (terre nue,
   hizb 24 florissant, assoiffé, desséché).

## Vérification

- Tests de rendu (`@testing-library/react-native`) pour chaque écran et chaque état.
- `npx expo export --platform ios --output-dir <dossier temporaire propre à l'agent>` doit
  réussir : c'est la preuve que le code se compile pour iOS.
- Aucun simulateur ni iPhone n'est disponible dans l'environnement de développement :
  l'aspect réel sur iOS n'est **pas vérifié** tant que le propriétaire n'a pas lancé
  l'appli sur son téléphone. Tout rapport doit le dire.
