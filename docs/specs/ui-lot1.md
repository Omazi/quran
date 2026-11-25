# Spécification — interface du lot 1 (fondations, premier lancement, accueil)

**iOS d'abord**, selon les règles d'Apple (Human Interface Guidelines, édition 2026).
Android viendra ensuite sur la même base de code.

Tout ce document applique [la règle des skills](../design/SKILLS.md) et
[la charte](../design/brand-spec.md) : les lire d'abord. Les renvois du type
`toggles.md › Mobile (iOS, iPadOS)` désignent les pages d'Apple du skill Apple Design.
Référence du premier lancement, pour le comportement **et pour l'aspect** :
`docs/design/premier-lancement-prototype.html` et la maquette `docs/design/bienvenue.png`
(règle du propriétaire du 25 novembre 2026 : « Même le onboarding doit ressembler à ce qu'on
avait prévu »). Là où le prototype et les règles d'Apple divergent, l'écart est inscrit au
registre (écarts 118 à 122) et soumis au propriétaire, qui tranche au cas par cas.

## Règles de conception

1. **Composants du système.** Bouton, interrupteur, sélecteur − / +, sélecteur d'heure,
   liste groupée, barre d'onglets, indicateur de progression : ceux d'iOS, par Expo UI et
   les onglets natifs d'Expo Router (`branding.md › Best practices`). Chaque contrôle est
   enveloppé dans `src/ui/native/` avec une variante iOS (composant système) et une
   variante par défaut pour Android, le web et les tests ; la variante par défaut suit les
   usages d'Android, elle n'imite pas iOS (`cross-platform.md`).
2. **Couleurs sémantiques**, clair et sombre, sans réglage d'apparence dans l'appli
   (`dark-mode.md`). Sur iOS : couleurs système dynamiques ; ailleurs : équivalents
   selon le thème de l'appareil.
3. **Texte** : styles d'Apple de la charte, taille suivant le réglage de la personne ; les
   écrans tiennent à la plus grande taille (`typography.md`, `layout.md › Adaptability`).
4. **Liquid Glass** seulement sur ce qui flotte ; un bouton coloré par écran, deux au plus
   (`liquid-glass.md`).
5. **SF Symbols** ; ni emoji, ni illustration dessinée en code. Image manquante :
   emplacement neutre et nommé (SwiftUI Design, principe 4).
6. **Mouvement** utile, bref, annulable, coupé par « réduire les animations »
   (`motion.md`).
7. **Cibles** de 44 points, état pressé visible, libellé d'accessibilité sur tout contrôle
   sans texte (`accessibility.md`).
8. **Droite à gauche** : en arabe, l'écran est en miroir, pagination comprise
   (`right-to-left.md`) ; le texte du Coran ne change pas.
9. **Lancement** instantané, écran de lancement sans texte ni logo (`launching.md`).
10. **Une signature par écran, le reste discret** (SwiftUI Design, étape 4).

## Règles de code

- Les écrans de `src/app` composent. Chaque écran est un composant de présentation qui
  reçoit un **modèle** et des **actions** ; un hook à part fabrique le modèle.
- Aucune valeur de style en dur dans `src/features` : uniquement les jetons de `src/ui`.
- Aucune chaîne visible en dur : `useTranslation` (français de référence, anglais et arabe
  complets).
- Le lot 1 fonctionne sans compte et sans réseau.

## 0. Fondations d'interface

Périmètre : `src/ui/**`.

1. **Jetons** (`tokens.ts`) : les rôles de couleur de la charte (système + `accent`,
   `growth`, `paper`, `ornament`), clair et sombre ; les styles de texte ; la grille
   d'espacement ; les rayons. Le test des jetons recalcule les contrastes de la charte.
2. **Texte** (`AppText`) : un style de texte par variante, taille dynamique, alignement
   qui suit le sens d'écriture.
3. **Contrôles natifs** (`src/ui/native/`) : bouton (principal, secondaire, simple),
   interrupteur en ligne de liste, sélecteur − / +, choix parmi quelques valeurs,
   sélecteur d'heure, liste groupée et ses sections, progression, icône (SF Symbol),
   indicateur de pages.
4. **Emplacement** (`Placeholder`) : surface neutre, nommée, avec un libellé
   d'accessibilité, pour toute image qui n'existe pas encore.
5. Les anciens composants maison (bouton dessiné, carte ombrée) disparaissent.

## A. Socle et premier lancement

Périmètre : `src/store`, `src/data/storage`, `src/data/notifications`,
`src/features/onboarding`, `src/features/settings`, `src/app/_layout.tsx`,
`src/app/index.tsx`, `src/app/onboarding/**`, `src/app/(tabs)/_layout.tsx`,
`src/app/(tabs)/quran.tsx`, `src/app/(tabs)/settings.tsx`, `src/i18n/index.ts`, espaces de
noms `common`, `onboarding`, `settings`.

1. **Démarrage** : polices du Coran, réglages enregistrés, langue (choix enregistré, sinon
   langue de l'appareil, sinon français), sens d'écriture. Premier lancement → parcours ;
   sinon → onglets, à l'endroit où la personne s'était arrêtée
   (`launching.md › Best practices`).
2. **Magasin** (zustand) : réglages `{ language, dailyGoalPages, onboardingCompleted,
userSeed, pauses, reminders }` et journal de lecture (type du domaine). `reminders` =
   `{ dailyEnabled, dailyTime, thirstyGardenEnabled, fridayKahfEnabled }`. Persistance par
   AsyncStorage derrière une interface déclarée côté magasin. Tout ce qui est relu du
   stockage est **validé** (version de schéma, types, bornes) : un contenu corrompu est
   écarté sans plantage. `userSeed` est tiré une fois.
3. **Premier lancement.** Aspect : celui du prototype validé (voir plus haut).
   - _Rôle_ : faire comprendre en quelques gestes que lire arrose le jardin, puis prendre
     deux réglages.
   - _Signature_ : la scène du jardin, qui change à chaque page **sous le doigt**.
   - La langue est celle du téléphone (aucune page de langue).
   - **Composition** (prototype, mesures dans `storyLayout`, `src/ui/tokens.ts`) : le nom de
     l'appli en haut (serif Fraunces) ; la scène au milieu, sur 48 % de la hauteur ; sous le
     jardin, une légende courte (« Hizb 8 », « 3 jours sans lecture ») ; le titre (Large Title,
     Fraunces) et sa phrase en bas ; les points de page centrés tout en bas.
   - **Le ciel** : le dégradé chaud de `bienvenue.png`, qui pâlit vers le gris puis la
     poussière pendant la sécheresse, devient lever de soleil au jardin complet, vert profond
     à étoiles pour l'écoute et ciel pâle pour les proches ; crépuscule la nuit.
   - **Le geste** (`SwipePager`, `src/ui`) : un geste = une page ; les pages glissent sous le
     doigt de droite à gauche (de gauche à droite en arabe) ; le ciel, la scène et la légende
     restent en place et changent avec la position, de sorte que le jardin pousse, sèche et
     revit à la vitesse où l'on glisse, sans rien attendre. Ni « Continuer » ni « Passer »
     (décision du propriétaire). Les points de page du prototype, dans une capsule de verre
     sur iOS 26 (`PageDots`) ; un toucher d'un côté ou de l'autre tourne la page, et VoiceOver
     les tourne par l'élément réglable. « Réduire les animations » : la page vient sans
     glissement quand elle est demandée par les points, et toutes les démonstrations
     s'arrêtent.
   - **Les pages sont des données** (`pages.ts`) : une liste ordonnée `{ id, scène, titre,
texte, ciel, couleur des mots, taille de la scène }`. Changer leur nombre ou leur ordre ne
     touche pas au code du pageur.

   ```
   ┌──────────────────────┐
   │       Jannatuk       │  nom de l'appli, Fraunces
   │                      │
   │   scène du jardin    │  images des modèles 3D (D35)
   │      ( Hizb 8 )      │  légende
   │                      │
   │ Lis, et l'eau coule. │  Large Title, Fraunces
   │ Une phrase.          │  Body, gris
   │      ( ●━ • • • )     │  points de page, capsule de verre
   └──────────────────────┘
   ```

   - Pages (16 aujourd'hui) : terre nue (avec l'indication « Glisse ») ; hizb 8, 20, 30, 40,
     60 (jardin complet, qui ne sèche plus) ; 3, 6, 10 et 14 jours sans lecture, sur un jardin
     encore en chemin (l'eau s'en va d'abord, puis les feuilles, puis les éléments) ; « une page
     suffit pour le faire revivre » ; « d'où vient ce passage ? » (démonstration de l'écoute :
     la vraie rosace de l'écoute (D27, D29) sur son papier, qui bat avec une voix simulée, puis
     la carte « Passage reconnu » Al-Kahf 18:10 monte sous la rosace réduite, texte tiré des
     données) ; « lecture à voix haute » (la page du lecteur et la barre verte de `voix.png`,
     vraies pièces de `features/listening/follow` : les mots récités passent à l'encre, le mot
     courant sur l'or, un mot oublié en rouge sur rose avec « Relis ce mot » ; mots tirés des
     données ; « réduire les animations » : état final fixe) ; avec tes proches (Mustapha, Sarah, Taghread, D25) ; ton objectif du jour ; tes
     rappels. Les pages des fonctions dépendent de `SHIPPED_FEATURES` : retirer une fonction de
     l'ensemble retire sa page.
   - _Objectif du jour_ : sous la terre nue, en petit ; liste groupée du système posée sur le
     ciel, ligne « Pages par jour » avec sa valeur et le sélecteur − / +
     (`steppers.md › Best practices`), de 1 à 60, valeur par défaut déjà posée. Pas de boutons
     de repères (le propriétaire ne veut pas de grands boutons de choix sur les dernières
     pages) : sous la ligne, une note donne l'équivalence et la durée, qui change quand on
     touche au sélecteur (`onboarding.md › Best practices` : apprendre en faisant).
   - _Rappels_ : en haut, les notifications que l'appli enverra, chacune montrée ou retirée
     avec son interrupteur (masquées aux grandes tailles de texte et sur les écrans courts),
     avec les mots que les rappels envoient vraiment (`notifications.json`, et non ceux du
     prototype) ;
     puis la liste groupée du système posée sur le ciel — rappel du jour et son heure,
     « mon jardin a soif », vendredi : sourate Al-Kahf (activé par défaut depuis le 25 novembre 2026, écart 23). Un seul bouton,
     « Créer mon jardin », à la place des points ; la demande d'autorisation du système le suit
     si un rappel est activé, annoncée par la phrase placée juste avant lui
     (`privacy.md › Pre-alert screens, windows, or views`, écart 120). Les valeurs choisies sont
     celles que le module des rappels programme.
   - **Points à trancher par le propriétaire**, inscrits au registre : 16 pages et pas de
     « Passer » (écart 3) ; le libellé du bouton (écart 120) ; le pageur et les points dessinés
     (écart 118). Une liste courte est prête dans les données (`ONBOARDING_PAGES_SHORT`).

4. **Onglets natifs** : Jardin, Coran, Réglages — un mot et un SF Symbol plein chacun,
   jamais masqués (`tab-bars.md › Best practices`). « Coran » : écran d'attente du système
   (`ContentUnavailableView`). « Réglages » : liste groupée — langue, objectif, rappels
   (`managing-notifications.md` : réglables dans l'appli), revoir la présentation
   (`onboarding.md` : facile à retrouver). Peu de réglages, rien que le système règle déjà
   (`settings.md › Best practices`).
5. **Notifications** : `src/data/notifications` expose une interface (demander
   l'autorisation, connaître son état), implémentée avec `expo-notifications`, avec une
   version inerte pour le web et les tests.

## B. Accueil et scène du jardin

Périmètre : `src/features/garden`, `src/features/home`, `src/app/(tabs)/index.tsx`,
espaces de noms `home` et `garden`.

1. **`GardenScene`** : le seul point d'entrée du jardin à l'écran. Il reçoit un
   `GardenState` et une taille, rien d'autre. Au lot 1 son rendu est un **emplacement
   neutre** (D12) : pas de dessin. Son libellé d'accessibilité résume l'état
   (« Jardin, 24 hizb sur 60, l'eau coule »).
2. **État du jardin en clair**, pour que les règles restent visibles et vérifiables sans
   image : progression « n hizb sur 60 » (jauge du système, `gauges.md` : un indicateur de
   progression est réservé à une attente), santé (jauge), eau
   (icône et mot : coule, immobile, à sec), prochain élément et sa croissance, dernier
   élément acquis. Le dessèchement se lit dans ces valeurs, jour après jour ; il se
   **verra** quand les modèles existeront, et `GardenScene` reçoit déjà tout ce qu'il
   faut pour cela (santé continue de 0 à 1, croissance, éléments visibles).
3. **Accueil.**
   - _Rôle_ : « où en est mon jardin, et que lire maintenant ? »
   - _Signature_ : la scène du jardin.

   ```
   ┌──────────────────────┐
   │ Jardin        série 5│  Large Title
   │ ┌──────────────────┐ │
   │ │  scène du jardin │ │
   │ └──────────────────┘ │
   │ 24 hizb sur 60  ▓▓▓░ │
   │ ◍ L'eau coule        │
   │ ── Aujourd'hui ───── │  liste groupée
   │ 3 pages sur 5        │
   │ Reprendre page 212   │
   │ [ Lire et arroser ]  │  seul bouton coloré
   └──────────────────────┘
   ```

   - États : terre nue (premier jour), florissant, a soif (bandeau avec icône et mot),
     desséché (rappelle que les hizb lus restent acquis et qu'une page fait revenir
     l'eau). États vides et d'erreur écrits selon `writing.md`.
   - Le verset lié au dernier élément n'apparaît que si le contenu est marqué validé.

4. Le composant d'accueil reçoit un `HomeModel` ; un hook `useHomeModel` le fabrique.
   Tant que les données du mushaf ne sont pas intégrées, il s'appuie sur une source de
   démonstration isolée et nommée comme telle, avec des préréglages (terre nue, hizb 24
   florissant, assoiffé, desséché).

## Revue et vérification

- Chaque écran passe la **revue de design** (`docs/TEAM.md`) : revue d'Apple Design puis
  note en cinq critères ; en dessous de 7 sur 10, retour au développeur.
- Tests de rendu pour chaque écran et chaque état, en clair et en sombre, en français et
  en arabe.
- `npx expo export --platform ios --output-dir <dossier temporaire propre à l'agent>` doit
  réussir.
- Aucun simulateur ni iPhone n'est disponible dans l'environnement de développement :
  l'aspect réel sur iOS n'est **pas vérifié** tant que le propriétaire n'a pas lancé
  l'appli sur son téléphone. Tout rapport doit le dire.
