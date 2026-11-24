# Spécification — interface du lot 1 (fondations, premier lancement, accueil)

**iOS d'abord**, selon les règles d'Apple (Human Interface Guidelines, édition 2026).
Android viendra ensuite sur la même base de code.

Tout ce document applique [la règle des skills](../design/SKILLS.md) et
[la charte](../design/brand-spec.md) : les lire d'abord. Les renvois du type
`toggles.md › Mobile (iOS, iPadOS)` désignent les pages d'Apple du skill Apple Design.
Référence de comportement pour le premier lancement :
`docs/design/premier-lancement-prototype.html` (son **aspect** n'est pas une référence).

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
3. **Premier lancement.**
   - _Rôle_ : faire comprendre en quelques gestes que lire arrose le jardin, puis prendre
     deux réglages.
   - _Signature_ : la scène du jardin, qui change à chaque page.
   - Un pageur horizontal natif, **un geste = une page**. Ni « Continuer » ni « Passer »
     (décision du propriétaire). Indicateur de pages du système, centré en bas, non coloré
     (`page-controls.md › Best practices` et `› Customizing indicators`).
   - **Les pages sont des données** : une liste ordonnée `{ id, scène, titre, texte }`.
     Changer leur nombre ou leur ordre ne touche pas au code du pageur.

   ```
   ┌──────────────────────┐
   │                      │
   │   scène du jardin    │  emplacement nommé
   │   (hizb 8)           │  « Jardin au hizb 8 »
   │                      │
   ├──────────────────────┤
   │ Lis, et l'eau coule. │  Title 2, New York
   │ Une phrase.          │  Body, secondaire
   │                      │
   │        • • ● • •     │  indicateur système
   └──────────────────────┘
   ```

   - Pages (version vue par le propriétaire, 16) : terre nue ; hizb 8, 20, 30, 40, 60 ;
     3, 6, 10 et 14 jours sans lecture ; « une page suffit pour le faire revivre » ; lecture
     à voix haute ; « d'où vient ce passage ? » ; avec tes proches ; ton objectif du jour ;
     tes rappels.
   - _Objectif du jour_ : liste groupée, ligne « Pages par jour » avec sa valeur et le
     sélecteur − / + (`steppers.md › Best practices` : la valeur modifiée est visible),
     de 1 à 60, valeur par défaut déjà posée. Pas de boutons de repères : sous la
     ligne, une note donne l'équivalence et la durée (« 5 pages par jour, soit un demi-hizb :
     une khatma en 121 jours »), qui change quand on touche au sélecteur
     (`onboarding.md › Best practices` : apprendre en faisant).
   - _Rappels_ : liste groupée d'interrupteurs (`toggles.md › Mobile (iOS, iPadOS)` : un
     interrupteur vit dans une ligne de liste) — rappel du jour et son heure (sélecteur
     d'heure compact, `pickers.md`), « mon jardin a soif », vendredi : sourate Al-Kahf.
     Un seul bouton en bas. La demande d'autorisation du système le suit si un rappel est
     activé ; le libellé du bouton et l'écran respectent
     `privacy.md › Pre-alert screens, windows, or views` (un seul bouton, qui annonce la demande ; aucune
     autre sortie).
   - **Deux points à trancher par le propriétaire**, inscrits au registre des écarts :
     16 pages et pas de « Passer », contre les règles d'Apple. Une liste de 10 pages est
     prête dans les données (`ONBOARDING_PAGES_SHORT`) : terre nue, hizb 20, hizb 60,
     soif, terre morte, revivre, voix, d'où vient ce passage, objectif, rappels.
   - **Deux pages non validées** : _lecture à voix haute_ et _rappels_. Elles sont codées
     avec les composants du système, sans effet. Leur design sera exploré avec le skill
     Wireframe (cinq options en noir et blanc) avant d'être refait.

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
