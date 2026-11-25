# Onglet Proches (`src/features/friends`)

Connexion, proches et leurs jardins, page d'un proche, ajout d'un proche (D36) par le nom, par
un code ou par un QR code, groupes et classements. Sur les fausses données de `src/data/social`
(D33) : la liste le dit une fois, sous le titre de l'onglet, tant que `isDemonstration` est vrai
(et l'écran de connexion dit que la connexion est une démonstration). Spécification : `docs/specs/social.md` ; décisions D23, D33, D36, D37.

## Pièces

| Fichier                            | Rôle                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `friends-kit.tsx`                  | Ce que le système de design partagé n'a pas : la page sous son ciel, la ligne d'une carte, la paire de boutons qui s'empile aux grandes tailles de texte, le champ de texte des maquettes (`docs/design/visite.png`, `bienvenue.png`). Cartes, boutons, avatars, soixante points, textes et symboles : les composants de `src/ui`, dans la palette unique (`palette`, D39) |
| `friend-avatar.ts`                 | La couleur d'un proche (toujours la même, tirée de son identifiant) et son initiale                                                                                                                                                                                                                                                                                        |
| `friend-garden.ts`                 | Résumé publié → `GardenState` pour `GardenScene` (la santé publiée, relue par la règle du module jardin) ; jours depuis l'arrosage                                                                                                                                                                                                                                         |
| `friends-model.ts`                 | Modèles purs des écrans : liste, page d'un proche, groupe                                                                                                                                                                                                                                                                                                                  |
| `social-store.tsx`                 | Le client (démonstration de l'appli par défaut, un autre dans les tests), le compteur qui fait relire les écrans, le code et les encouragements de la session                                                                                                                                                                                                              |
| `use-session.ts`, `use-friends.ts` | Les hooks : session et connexion ; liste, proche, ajout, groupe, nouveau groupe                                                                                                                                                                                                                                                                                            |
| `friends-pages.tsx`                | Hook + écran pour chaque page, avec chargement, échec, et l'écran de connexion quand personne n'est connecté                                                                                                                                                                                                                                                               |
| `scan-invite-screen.tsx`           | Le scanner : aperçu de la caméra (`expo-camera`, QR seulement), consignes, refus ; caméra refusée → réglages ; jamais demandée → un seul bouton « Continuer »                                                                                                                                                                                                              |
| `test-support/camera.tsx`          | Un faux `expo-camera` pour les tests : permission qui répond comme le système, aperçu dont on déclenche la lecture                                                                                                                                                                                                                                                         |
| `*-screen.tsx`                     | Écrans de présentation : ils reçoivent un modèle et des actions                                                                                                                                                                                                                                                                                                            |

Routes : `src/app/(tabs)/friends/` est une pile propre à l'onglet (`_layout.tsx`) : la racine de
l'onglet (`index.tsx`), un proche (`[id].tsx`), ajouter (`add.tsx`), scanner (`scan.tsx`),
nouveau groupe (`new-group.tsx`), un groupe (`group/[id].tsx`). La barre d'onglets reste visible
sur chacune (`tab-bars.md › Best practices` ; l'écart 50 est résolu). Le lien
`quranapp://invite/<CODE>` (`src/app/invite/[code].tsx`) ouvre « Ajouter un proche » avec le code
dans son champ, sans l'accepter seul.

## Apparence (règle du propriétaire, 25 novembre 2026)

Les maquettes validées sont la référence. La page d'un proche suit `docs/design/visite.png` : le
jardin dans le ciel, puis la carte blanche (initiale, nom, « 38 hizb sur 60, arrosé depuis 21
jours », soixante points, « Encourager » et « Lire et arroser »). Les « … » de la barre sont le
menu Plus du système (iOS et Android ; sur le web, les deux boutons rouges restent en bas de la
page). La liste, l'ajout, les groupes, la connexion et le scanner reprennent les cartes de
`accueil.png` et les boutons de `bienvenue.png`. Restent ceux du système : la barre d'onglets, la
barre de navigation et son retour, le menu, les feuilles d'action, le partage, la caméra et le
contrôle segmenté.

## QR code (D36)

- **Le mien** : `QrCode` (`src/ui`) dessine `inviteLink(code)` avec `uqr` (matrice) et
  `react-native-svg`, noir sur blanc dans les deux apparences, marge de quatre modules (écart 56).
- **Le sien** : « Scanner un QR code » pose la question de la caméra au toucher, et seulement là
  (`privacy.md › Requesting permission`), puis ouvre le scanner. Le texte lu passe par
  `parseInviteLink`, puis par la même acceptation qu'un code tapé. Une page poussée dans la pile,
  barre d'onglets visible (écart 57).
- **Texte d'autorisation** (iOS) : `app.json`, réglages du module `expo-camera`
  (`cameraPermission`, en français, la langue de repli de l'appli) et `locales` (fr, en, ar,
  fichiers `assets/app-metadata/*.json`). Le micro n'est pas demandé (`microphonePermission:
false`, `recordAudioAndroid: false`).
- **Licences** : `NOTICE.txt` à la racine (MIT pour `uqr` et `expo-camera` ; le scanner web
  d'`expo-camera` embarque aussi du code Apache-2.0 et BSD-3-Clause).

## Ce qui manque

- **Pas vérifié sur un iPhone** : l'aperçu de la caméra, la lecture réelle d'un QR code, le
  texte d'autorisation affiché par iOS dans chaque langue, le retour depuis Réglages.
- **Image du jardin dans le classement d'un groupe** : non faite (un membre qui n'est pas mon
  proche ne montre pas son jardin, règle 4 : à décider avec le modèle du groupe).
- **Mentions des licences dans l'appli** : aucune page ne les montre encore (`NOTICE.txt`).
- **Bouton « Continuer avec Apple » du système** : `expo-apple-authentication`, non installé (écart 46).
- **Encouragements reçus** : le dépôt les donne (`listReceivedNudges`), aucun écran ne les montre.
- Déconnexion et suppression du compte : à l'onglet Profil.
