# Spécification — invitation à créer un compte

Périmètre : `src/features/home` (`account-invitation.tsx`, `account-invitation-sheet.tsx`,
`dismissible-sheet.tsx`), la route `src/app/(tabs)/index.tsx`. Maquette :
`docs/design/premier-lancement-voix` (la feuille « Ton jardin est prêt. », `shots/17.png`).

## Comportement

- La page d'accueil s'ouvre avec `?welcome=1` (« Créer mon jardin », fin du premier lancement). Le
  jardin apparaît ; **0,8 s plus tard** (`ACCOUNT_INVITATION_DELAY_MS`), une feuille monte par-dessus.
- Texte : titre « Ton jardin est prêt. », « Crée un compte pour le retrouver sur tous tes appareils. »
  (trois langues, espace de noms `home`, clés `invitation.*`).
- Boutons, dans l'ordre de l'écran de connexion de l'onglet Proches : **Apple** (noir, avec le logo sur
  iPhone), **Google** (contour), **Continuer avec un e-mail** (texte vert) ; puis « Plus tard », un
  lien discret.
- **Aucun code de connexion en double.** La feuille appelle `useSignIn` (onglet Proches) :
  mêmes actions, mêmes refus (affichés sous les boutons), mêmes libellés. Apple et Google se font dans
  la feuille. L'e-mail demande une adresse puis un code : la feuille se ferme et mène à l'écran de
  connexion de l'onglet Proches (`/friends`), où ce parcours existe déjà.
- Se connecter ferme la feuille (la session change). Quelqu'un déjà connecté ne la voit pas.
- **Une seule fois** : « vu » est gardé (`account-invitation-seen`, stockage de l'appareil) dès que la
  feuille s'affiche. « Plus tard », le glisser vers le bas (seuil `pieceSizes.sheetDismissDistance`),
  un toucher à côté, le bouton retour d'Android et le repère du haut (bouton « Fermer » pour VoiceOver)
  la ferment. Elle ne revient pas dans la session si le jardin quitte l'écran puis revient (le lecteur
  s'ouvre par-dessus). Mouvement réduit : elle apparaît sans glisser.
- Un stockage illisible veut dire « pas d'invitation », jamais une invitation à chaque lancement.

## Drapeau `accountInvitation`

`app.json › expo.extra.features.accountInvitation`, **`false`**. Le propriétaire n'envoie pas une
fonction inachevée : tant que les fournisseurs (Apple, Google, e-mail) ne sont pas configurés et que
la vraie connexion n'est pas branchée (`docs/AUTH-SETUP.md`, `docs/specs/sync.md` § 7), la
connexion ne peut pas réussir (l'appli tourne sur la démonstration de `src/data/social`). Drapeau
éteint : la feuille est construite et testée mais **jamais montrée** ; rien n'est lu (ni session ni
stockage) et rien n'est enregistré.

Seul un vrai `true` allume le drapeau (`readAccountInvitationFlag`). Un test garde `false` dans
`app.json` : celui qui l'allume change cette ligne exprès, après `docs/AUTH-SETUP.md`.

## Mise en commun

`DismissibleSheet` (feuille, repère, glisser pour fermer) est partagée avec `ArrivalSheet` (hizb
terminé) : le comportement de glisser est écrit une fois.

## Tests

`src/features/home/__tests__/` : `account-invitation.test.tsx` (drapeau, délai, une fois, déjà
connecté, stockage), `account-invitation-sheet.test.tsx` (textes, boutons, actions de connexion,
glisser), `home-route-welcome.test.tsx` (la route, avec drapeau allumé et éteint).
