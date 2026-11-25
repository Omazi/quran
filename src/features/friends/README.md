# Onglet Proches (`src/features/friends`)

Connexion, proches et leurs jardins, page d'un proche, ajout d'un proche (D36), groupes et
classements. Sur les fausses données de `src/data/social` (D33) : chaque écran le dit tant que
`isDemonstration` est vrai. Spécification : `docs/specs/social.md` ; décisions D23, D33, D36, D37.

## Pièces

| Fichier                            | Rôle                                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `friend-garden.ts`                 | Résumé publié → `GardenState` pour `GardenScene` (la santé publiée, relue par la règle du module jardin) ; jours depuis l'arrosage                            |
| `friends-model.ts`                 | Modèles purs des écrans : liste, page d'un proche, groupe                                                                                                     |
| `social-store.tsx`                 | Le client (démonstration de l'appli par défaut, un autre dans les tests), le compteur qui fait relire les écrans, le code et les encouragements de la session |
| `use-session.ts`, `use-friends.ts` | Les hooks : session et connexion ; liste, proche, ajout, groupe, nouveau groupe                                                                               |
| `friends-pages.tsx`                | Hook + écran pour chaque page, avec chargement, échec, et l'écran de connexion quand personne n'est connecté                                                  |
| `*-screen.tsx`                     | Écrans de présentation : ils reçoivent un modèle et des actions                                                                                               |

Routes : `src/app/(tabs)/friends.tsx` (l'onglet), `src/app/friends/*` (les pages, dans la pile
principale, comme le lecteur : écart 38 de `docs/design/SKILLS.md`).

## Ce qui manque

- **Dessin du QR code** : un emplacement nommé. Bibliothèque proposée, non installée : `uqr`
  (licence MIT d'après le registre npm, 79 Ko décompressés, aucune dépendance) ; elle rend une
  matrice que `react-native-svg` (déjà dans l'appli) dessinerait. Autres : `qrcode` (MIT, 135 Ko,
  trois dépendances dont `pngjs` et `yargs`), `react-native-qrcode-svg` (MIT, 979 Ko, dépend de
  `qrcode`). À valider par l'architecte, licence à relire dans le paquet à l'installation.
- **Scan** : bouton désactivé. Il demande `expo-camera` (MIT selon `docs/specs/social.md`, section 6),
  le texte d'autorisation de la caméra en trois langues, et la route `quranapp://invite/<CODE>`.
- **Bouton « Continuer avec Apple » du système** : `expo-apple-authentication`, non installé (écart 34).
- **Encouragements reçus** : le dépôt les donne (`listReceivedNudges`), aucun écran ne les montre.
- Déconnexion et suppression du compte : à l'onglet Profil.
