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
3. **Premier lancement** (direction « voix », choisie par le propriétaire le 25 novembre 2026).
   Référence, pour l'aspect et pour le mouvement : `docs/design/premier-lancement-voix/index.html`
   (et ses captures `shots/01–17.png`). Elle remplace `premier-lancement-prototype.html` et
   `bienvenue.png` pour le premier lancement.
   - _Rôle_ : faire comprendre en quelques gestes que lire arrose le jardin, montrer la voix et
     l'écoute, puis prendre l'objectif et les rappels.
   - _Signature_ : tout est lié au doigt. **Un glissement vertical = une page** (`SwipePager`,
     `axis="vertical"`, `pageMotion="still"`, ressort critique au relâcher) ; la position du pageur
     (valeur partagée, fil de l'interface) pilote chaque animation, et revenir en arrière la joue à
     l'envers. Ni « Passer » ni « Suivant » (décision du propriétaire).
   - **Pages et textes** : ceux du prototype, dans son ordre (`src/features/onboarding/pages.ts`,
     16 pages) : terre nue ; hizb 8, 20, 30, 40, 60 ; 3, 6, 10, 14 jours sans lecture ; la
     reprise ; la voix (la page du mushaf) **avant** la reconnaissance ; les proches ; l'objectif ;
     les rappels et « Créer mon jardin ».
   - **La scène** : le jardin en images (les images livrées, pas de GL dans le pageur) ; à chaque
     hizb, ce que l'étape ajoute monte du sol (`rise/new-hNN-f0.webp`, produites par
     `tools/garden-pictures/rise-layers.py`) avant que l'image entière se pose ; la caméra tourne
     de quelques degrés par page. Sécheresse : feuilles qui tombent, voix qui se tait et grisonne,
     terre qui se craquelle. Reprise : l'eau revient de la fontaine en anneaux, le vert la suit.
   - **Le fil de la voix** : 36 barres sous le verset, qui bougent avec la vitesse du doigt et la
     voix simulée ; il entre dans la barre « J'écoute » de la page du mushaf puis s'en va.
   - **Al-Fâtiha 1:1–7** s'allume mot à mot sous le jardin pendant les cinq pages de croissance :
     texte uthmani de la page 1 de la couche de données, police KFGQPC Hafs.
   - **La voix** : la page 1 du mushaf, de nuit ; les mots s'allument, « نَسۡتَعِينُ » passe en rouge
     avec « Relis ce mot : », puis est relu. **Pas de bouton de lecture** : l'appli n'a pas encore
     de récitation sous licence, et le propriétaire interdit de livrer une fonction inachevée.
     **TODO** : quand une récitation audio sous licence permissive existe, ajouter le bouton
     « Écouter la récitation » du prototype (`.follow .play`) sur la barre, lecture au toucher
     seulement, et faire suivre les mots par l'audio.
   - **L'écoute** : la rosace validée (`features/listening/rosette`, valeurs de nuit), puis la
     carte « Passage reconnu », Al-Kahf 18:10 (texte de la couche de données).
   - **Les proches** : trois jardins, un cœur qui va du jardin de Taghread à celui, assoiffé, de
     Sarah, qui devient « Encouragée » ; une khatma en famille.
   - **L'objectif** : 1 mois, 3 mois, 1 an, À mon rythme ; pages par jour et date de fin calculées
     en direct par le domaine `goal-plan` (`computeGoalPlan`), aperçu du jardin dans un mois.
   - **Les rappels** : moment (Après Fajr, À midi, Le soir, Avant de dormir), aperçu de la
     notification, vendredi Al-Kahf activé par défaut, « Quand mon jardin a soif ».
   - **« Créer mon jardin »** enregistre l'objectif (`setReadingGoal`), le moment
     (`setReadingMoment`) et les deux interrupteurs (`updateReminders`), marque le parcours fini,
     demande l'autorisation des notifications (premier lancement, un rappel actif), puis ouvre
     l'accueil avec `?welcome=1`. Retour léger (sélection) à chaque page posée, succès sur le bouton.
   - **Réduire les animations** : fondus seulement (pas de translation, de montée, de rotation, de
     particules ; la page du mushaf reste sur le mot à relire). **Sombre** : valeurs crépuscule.
   - **Accessibilité** : chaque page décrit sa scène en mots (élément image), puis son titre
     (en-tête) et sa phrase ; les points sont un élément réglable qui tourne les pages.
   - **Contrôle des écrans** : `?page=N` (ou `-screenCheckPage N`) ouvre toujours la page N ; le
     balayage automatique pilote le pageur vertical par ses propres `begin / move / end`.

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
