# Spécification — comptes et proches (lot 3), d'abord sur de fausses données

Décision du propriétaire, 24 novembre 2026 : « Pour l'inscription et les amis, pour l'instant
on peut juste avoir des fausses données. C'est plus tard que je vais créer Supabase. Mais au
moins tu auras les modèles, toute la logique pour la base de données, les tables nécessaires,
les interactions. » (D33)

Décision du propriétaire, 25 novembre 2026 (D36) : trois façons d'ajouter un proche (code,
recherche par nom, scan d'un QR code) ; dans un groupe, tout membre voit les noms et les pages de
tous les membres ; on ajoute quelqu'un à un groupe sans son accord. Voir la règle 11, la règle 6
(lien du QR) et la section 6.

Trois livrables, qui partent du même modèle (section 2) :

| Livrable                    | Périmètre de fichiers                          | Qui                 |
| --------------------------- | ---------------------------------------------- | ------------------- |
| A. Règles et modèles        | `src/domain/social/**`                         | développeur domaine |
| B. Fausses données          | `src/data/social/**`                           | développeur domaine |
| C. Tables et règles d'accès | `supabase/**`, `docs/specs/social-database.md` | développeur base    |

Les écrans (inscription, onglet Proches, profil) viennent ensuite, sur B. Le jour où
Supabase existe, on écrit une seconde mise en œuvre des mêmes interfaces : aucun écran ne
change.

## 1. Principes

- **Le moins de données possible** (`docs/SECURITY.md`). Un proche voit un résumé du jardin,
  jamais le journal de lecture : ni les numéros de page, ni les heures.
- **Le serveur ne fait jamais confiance à l'appli.** Toute table a ses règles d'accès par
  ligne, refus par défaut. Les règles sont testées.
- **Les entrées venues d'ailleurs** (code d'invitation, nom saisi, données du serveur) sont
  validées avant usage.
- **Le temps est injecté** ; les jours sont des `LocalDate` (`docs/ARCHITECTURE.md`).
- Prénoms des fausses données : Omar, Mostapha, Sarah, Taghread (D25).

## 2. Le modèle

Les noms ci-dessous sont ceux du code (anglais). Les tables portent les mêmes noms, en
`snake_case`.

- **Profile** : `id` (celui du compte), `displayName`, `showGarden` (vrai par défaut),
  `showLevel` (vrai par défaut), `gender` (`male`, `female` ou rien ; rien par défaut, D47),
  `createdOn`.
  Décision du propriétaire : niveau et jardin visibles par défaut, avec un réglage pour les
  cacher (D23). Le genre n'est vu que **par les amis** (jamais par un inconnu ni dans la
  recherche) : il sert uniquement à accorder les phrases (« Lire avec lui », « avec elle »).
- **GardenSummary**, une ligne par personne, publiée par son appli : `level` (numéro de la
  khatma en cours, 1 pour la première), `hizbCompleted` (0 à 60), `health` (0 à 1),
  `lastWateredOn` (jour, ou rien), `streakDays`, `badgeCount`, `updatedOn`. C'est tout ce
  qu'un proche peut voir du jardin.
- **Friendship** : `requesterId`, `addresseeId`, `status` (`pending`, `accepted`,
  `declined`), `createdOn`, `respondedOn`. Une seule ligne par paire de personnes, quel que
  soit le sens.
- **Block** : `blockerId`, `blockedId`, `createdOn`.
- **Invite** : `code`, `ownerId`, `createdOn`, `expiresOn`. Sert à ajouter un proche sans
  chercher son nom. Le code se donne tel quel, ou sous forme de lien dans un QR code (règle 6).
- **Nudge** (encouragement entre proches) : `fromId`, `toId`, `kind` (`encourage`,
  `congratulate`), `sentOn`.
- **Group** : `id`, `name`, `ownerId`, `createdOn`. **GroupMember** : `groupId`, `userId`,
  `role` (`owner`, `member`), `joinedOn`.
- **DailyReading** : `userId`, `day`, `newPages` : le nombre de pages lues **pour la
  première fois** dans leur khatma ce jour-là. Relire une page ne compte pas (D8) ; ce
  nombre vient du journal local, par le module `khatm`. Sert aux classements des groupes.
- **Badge** : `userId`, `khatmNumber`, `completedOn`.
- **ReadingBackup** : `userId`, le journal de lecture complet, `updatedOn`. Lisible et
  modifiable **par son propriétaire seulement**. Sert à retrouver sa progression sur un
  autre téléphone (D16). _À confirmer par le propriétaire avant toute mise en service : le
  journal révèle une pratique religieuse._

## 3. Les règles (livrable A)

Chaque règle a au moins un test qui porte son nom.

1. **Nom affiché** : 1 à 30 caractères une fois les espaces de bord retirés ; ni saut de
   ligne ni caractère de contrôle. Un nom refusé donne une erreur explicite, jamais une
   valeur corrigée en silence.
2. **Demande d'amitié.** On ne s'ajoute pas soi-même. Une seule relation par paire : une
   demande vers quelqu'un qui en a déjà envoyé une l'accepte. Seul le destinataire accepte
   ou refuse. Chacun des deux peut retirer une amitié acceptée. Une demande refusée peut
   être renvoyée après `friendRequestCooldownDays` jours (configuration, 7 au départ).
3. **Blocage.** Bloquer retire l'amitié. Une personne bloquée ne peut ni envoyer de demande,
   ni voir le jardin, ni encourager, ni inviter dans un groupe. Le blocage ne se voit pas de
   l'autre côté.
4. **Ce qu'un autre voit de moi** (`viewOf(owner, viewer, relation)`) : moi-même, tout ; un
   proche accepté et non bloqué, mon nom, mon jardin si `showGarden`, mon niveau et mes
   badges si `showLevel` ; tout autre, mon nom seulement, et rien du tout si l'un bloque
   l'autre.
5. **Résumé du jardin** (`toGardenSummary`) : fabriqué à partir de valeurs fournies par les
   autres modules (hizb terminés, santé, dernier jour arrosé, série, nombre de badges,
   numéro de khatma). Il ne contient aucun numéro de page ni aucune heure.
6. **Code d'invitation** : forme fixe (`inviteCodeLength` caractères d'un alphabet sans
   caractères ambigus) ; refusé s'il est mal formé, expiré, ou si c'est le sien. Accepter un
   code crée une amitié acceptée, sauf blocage. **Lien du QR code** (D36) : le QR porte
   `quranapp://invite/<CODE>` (`inviteLink`) ; `parseInviteLink` accepte exactement cette forme,
   ou un code seul valide, et refuse tout le reste (majuscule au schéma, chemin ou paramètre en
   plus, espace autour : rien n'est corrigé). Un code lu par scan suit ensuite les mêmes règles
   qu'un code tapé, y compris les essais limités du serveur.
7. **Encouragement** : seulement vers un proche accepté ; un par proche et par jour local au
   plus.
8. **Groupe** (accepté par le propriétaire, D36 : tout membre voit les noms et les pages de tous
   les membres, et on est ajouté sans donner son accord) : nom validé comme un nom affiché ; le créateur en est le propriétaire ; on y
   entre par invitation d'un membre qui est son proche ; `maxGroupMembers` membres au plus
   (configuration, 50 au départ) ; le propriétaire ne quitte pas un groupe qui a d'autres
   membres sans le confier à l'un d'eux.
9. **Classement d'un groupe** sur une période (une semaine du lundi au dimanche, ou un
   mois) : somme des `newPages` de chaque membre sur la période ; rang 1 au plus grand ; les
   égalités partagent le même rang ; un membre qui n'a rien lu figure avec 0. Un `newPages`
   négatif ou supérieur à 604 est une donnée invalide, refusée.
10. **Suppression du compte** : supprime le profil, le résumé, les amitiés, les blocages,
    les invitations, les encouragements, les appartenances, les lectures du jour, les badges
    et la sauvegarde. Un groupe dont le propriétaire part passe au plus ancien membre, ou
    disparaît s'il était seul.

11. **Recherche par nom** (D36 ; `parseSearchQuery`, `searchPeople`). La requête est rognée,
    de `searchMinLength` (2) à 30 caractères (points de code), sans caractère de contrôle, et
    reste d'au moins 2 caractères une fois normalisée (une requête faite de seuls accents ou
    traits d'union ne trouve pas tout le monde). Comparaison **sans casse ni accents** ; l'arabe
    est normalisé (voyelles brèves et tatweel ignorés, toutes les formes de l'alef = ا, ى = ي,
    ة = ه, ی = ي, ک = ك). Un nom correspond si la requête est le **début d'un de ses mots**, ou
    de plusieurs mots à la suite (« al s » trouve « Omar Al-Sayed ») ; jamais le milieu d'un
    mot. Les mots sont séparés par les espaces, le trait d'union, le point, la virgule, le tiret
    bas et les apostrophes. Un résultat n'est **jamais soi-même, ni une personne bloquée dans un
    sens ou dans l'autre** (rien ne distingue une personne bloquée d'un nom que personne ne
    porte) ; il n'y a pas de réglage « ne pas me trouver » pour l'instant (D36, option pour plus
    tard : colonne `profiles.discoverable`). Un résultat montre **le nom et la relation
    seulement** (`friend`, `request-sent`, `request-received`, `none` ; une demande refusée
    donne `none`, l'expéditeur n'est pas prévenu). Au plus `searchMaxResults` (20) résultats,
    classés par nom normalisé puis identifiant. Le serveur compte les recherches : au plus 30 par
    minute et par compte (`searchesPerMinute`), puis `too-many-searches`.

## 4. Les interfaces (livrable A) et les fausses données (livrable B)

Le domaine déclare ce dont il a besoin ; `src/data/social` le met en œuvre.

- `AuthGateway` : session en cours, connexion avec Apple, avec Google, par e-mail,
  déconnexion, suppression du compte. Rappels des boutiques (`docs/SECURITY.md`) : Google
  proposé ⇒ Apple proposé aussi sur iOS ; compte créé dans l'appli ⇒ suppression possible
  dans l'appli.
- `SocialRepository` : mon profil et ses réglages ; mes proches et les demandes en attente ;
  le résumé du jardin d'un proche ; **chercher une personne par son nom** (`searchPeople`,
  règle 11) ; envoyer, accepter, refuser, retirer ; bloquer et
  débloquer ; créer et accepter un code ; encourager ; mes groupes, leurs membres, leur
  classement ; publier mon résumé et ma lecture du jour.

Les fausses données :

- Une mise en œuvre **en mémoire**, nommée comme une démonstration dans le code, qui
  applique les règles de la section 3 par les fonctions du domaine (elle ne les recopie
  pas). Envoyer une demande, l'accepter, bloquer, créer un groupe : tout réagit comme le
  fera le serveur.
- Un jeu de départ déterministe : la personne connectée et trois proches à des états
  variés (un jardin florissant, un jardin qui a soif, un jardin complet), une demande en
  attente, un groupe avec un classement.
- Une fausse connexion : les trois façons de se connecter ouvrent la même session de
  démonstration ; rien ne sort du téléphone.
- L'écran ne doit jamais présenter ces données comme réelles sans le dire : la
  démonstration est un état que le modèle d'écran peut lire.

## 5. Les tables (livrable C)

Dans `supabase/migrations/`, prêt à être appliqué le jour où le projet Supabase existe.

- Les tables de la section 2, avec leurs contraintes (bornes de `hizbCompleted`, `health`,
  `newPages` ; paire d'amitié unique sans sens ; pas d'amitié ni de blocage avec soi-même),
  leurs index et la suppression en cascade de la règle 10.
- **Règles d'accès par ligne sur chaque table, refus par défaut.** Ce que la section 3
  autorise, et rien d'autre : je lis et modifie mon profil ; je lis le profil réduit d'un
  autre ; je lis le résumé d'un proche accepté, non bloqué, qui montre son jardin ; je ne
  lis jamais la sauvegarde d'un autre ; je ne vois d'un groupe que ceux dont je suis
  membre ; je ne publie que mes propres lignes.
- Les opérations qui touchent deux personnes (accepter une demande, accepter un code,
  bloquer, quitter un groupe en le confiant) passent par des fonctions du serveur qui
  vérifient elles-mêmes qui appelle.
- **Recherche par nom** (règle 11) : la fonction `search_profiles(query)`, réservée à
  `authenticated`, qui ne rend que le nom et la relation, jamais une paire bloquée, et refuse
  au-delà de 30 recherches par minute et par compte (table `search_attempts`, comme
  `invite_attempts`). Aucune colonne n'est ajoutée à `profiles` : un réglage « ne pas me trouver »
  (`discoverable`) est une option pour plus tard (D36).
- **Tests des règles d'accès**, exécutés pour de vrai sur un PostgreSQL (pas seulement
  relus) : pour chaque table, ce que peut et ne peut pas faire le propriétaire de la ligne,
  un proche, un inconnu, une personne bloquée, une personne non connectée.
- `docs/specs/social-database.md` : chaque table et chaque règle expliquée en français
  simple, la marche à suivre le jour où le propriétaire crée le projet Supabase, et ce qui
  reste à décider (la sauvegarde du journal ; la façon d'empêcher une appli modifiée
  d'annoncer de fausses lectures).
- Rien de propre à Supabase n'est supposé de mémoire : les fonctions et rôles utilisés
  (`auth.uid()`, les rôles `anon` et `authenticated`, la création du profil à l'inscription)
  sont vérifiés dans la documentation en vigueur, avec la source citée.

## 6. Le scan du QR code : ce que l'écran devra ajouter

Le domaine fournit le lien (`inviteLink`) et sa lecture (`parseInviteLink`) ; **la caméra est
une tâche d'écran** et rien n'est installé dans ce lot. Elle demandera :

- **`expo-camera`** (`CameraView` avec la lecture des codes-barres limitée au QR). Licence :
  **MIT**, lue le 25 novembre 2026 dans le registre npm (`npm view expo-camera license`, versions
  55.0.22 et 55.0.23) ; les extraits de la recherche web ne portaient pas le texte de la licence,
  et le paquet n'est pas installé ici : à revérifier dans `node_modules/expo-camera/package.json`
  à l'installation (`docs/DECISIONS.md` impose les licences permissives, et
  `compliance/THIRD_PARTY_NOTICES.md` si le dépôt le tient). Version à prendre avec
  `npx expo install expo-camera` pour rester celle du SDK 58. Les noms exacts de l'interface et
  du réglage d'`app.json` sont **de mémoire, non vérifiés**.
- Le **texte d'autorisation de la caméra** (iOS) et la permission (Android), en trois langues.
- Un **composant qui dessine** le QR code du lien (autre dépendance, à choisir, licence à
  vérifier) : `expo-camera` lit les QR, il n'en dessine pas.
- Une **route de lien** (`quranapp://invite/<CODE>`) pour qu'un scan fait avec l'appareil photo
  du téléphone ouvre l'appli sur le code. Un schéma personnalisé n'ouvre rien si l'appli n'est pas
  installée : un lien web (liens universels) viendrait plus tard, avec un domaine.
- Le texte lu par la caméra passe par `parseInviteLink` avant tout usage (entrée venue
  d'ailleurs) ; un refus se traduit « ce n'est pas une invitation ».

**Fait le 25 novembre 2026 (onglet Proches)** : `expo-camera` 58.0.14 et `uqr` 0.1.3, licences
MIT relues dans leur fichier `LICENSE` après installation (`NOTICE.txt`) ; texte d'autorisation
en trois langues (`app.json`, réglages d'`expo-camera` et `locales`) ; la question de la caméra
au toucher de « Scanner un QR code » ; la route `quranapp://invite/<CODE>`
(`src/app/invite/[code].tsx`), qui remplit le champ du code sans l'accepter. Détails :
`src/features/friends/README.md`.

## 7. Hors de ce lot

Les écrans ; les notifications à distance ; les jardins partagés (khatma de groupe) ; le
compteur de hasanat ; la visite du jardin en 3D.
