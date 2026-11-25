# Spécification — sauvegarde locale et synchronisation avec le compte

Périmètre : `src/domain/sync` (règles pures), `src/store` (document enregistré, métadonnées de
synchronisation), `src/data/sync` (moteur, serveurs), `src/features/sync` (ligne des réglages),
`supabase/migrations/20261125120000_sync.sql` (tables et fonctions). Décision : D43.

## But

Demande du propriétaire (25 novembre 2026) : « l'utilisateur doit toujours avoir une sauvegarde
locale ainsi qu'une sauvegarde sur le cloud. S'il change de téléphone, il retrouve ses infos ;
s'il est hors ligne (ou pendant une mise à jour), ça sauvegarde en local et quand il se connecte
ça synchronise. » Et, plus tôt : supprimer puis réinstaller l'appli doit ramener la personne là
où elle en était (D16).

Principe : **le téléphone d'abord**. L'écran ne lit que le magasin local, toujours écrit en
premier. Le compte n'est qu'une copie de plus, fusionnée sans jamais rien écraser.

## 1. Sur le téléphone

- **Un seul document** (`app-data`, version 5) contient la progression (réglages, journal, temps)
  **et** les métadonnées de synchronisation (partie `sync`). Les deux sont donc toujours écrits
  ensemble : aucune fenêtre où l'un serait à jour sans l'autre.
- **Écriture atomique** : chaque clé est écrite d'un bloc par AsyncStorage (iOS : fichiers écrits
  `atomically:YES` ; Android : transaction SQLite — lu dans le code d'AsyncStorage 2.2.0).
- **Seconde copie** (`app-data-backup`) : le même texte, écrit juste après chaque écriture réussie
  du premier. Si le premier document est illisible, coupé ou abîmé, chaque partie manquante est
  reprise de la seconde copie avant de repartir de zéro. La personne n'est prévenue que de ce
  qu'aucune des deux copies n'a pu rendre. Le texte abîmé reste de côté (`app-data-rejected`).
- **Mises à jour** : chaque version passée du document (1, 2, les deux formes de la 3, 4, 5) est
  relue et réécrite au format courant ; un test charge un document de chaque version et vérifie
  que rien ne se perd (`src/store/__tests__/durability.test.ts`).
- **Retour à une version plus ancienne** (une version TestFlight installée par-dessus une plus
  récente) : la partie `sync` est **facultative** et ne change pas le numéro de version, donc une
  version précédente relit le document et laisse seulement `sync` de côté. Pour l'avenir : un
  document d'une version **plus récente** est lu comme un document courant si ses réglages et son
  journal passent les contrôles (une version nouvelle ne fait qu'ajouter des parties) ; sinon il
  est écarté comme avant. Règle à garder : n'ajouter que des parties facultatives.

## 2. Le modèle de synchronisation

Le domaine (`src/domain/sync`) décrit des **événements** : des faits jamais modifiés, identifiés
par leur contenu (`eventId`), qu'on peut recevoir deux fois ou dans n'importe quel ordre sans que
le résultat change.

| Événement  | Contenu                                    | Fusion                                                                  |
| ---------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `page`     | khatma, page, jour (une entrée du journal) | une entrée par (khatma, page), le jour le plus ancien                   |
| `time`     | téléphone, jour, secondes (appli, lecteur) | par téléphone et par jour, le plus grand ; on additionne les téléphones |
| `setting`  | clé, valeur, horodatage                    | registre : le choix le plus récent (exceptions plus bas)                |
| `bookmark` | page, posé ou retiré, horodatage           | le dernier changement de chaque page                                    |
| `pause`    | début, fin                                 | toutes, une fois chacune, les 50 premières par date                     |

- **Tout ce qui est dérivé est recalculé** : jardin, statistiques, khatmas terminées et badges
  viennent du journal fusionné. Une khatma terminée n'est donc pas un événement : elle se déduit.
- **Une seule khatma en cours** : l'union de deux journaux valides reste valide (une khatma n+1
  n'existe sur un téléphone que si la khatma n y est complète). Une entrée impossible (venue d'un
  événement abîmé ou forgé) est écartée par `normalizeJournal`.
- **Réglages qui voyagent** : langue, objectif du jour, rappels, dernière page ouverte (le plus
  récent gagne) ; graine des jardins (**la plus ancienne gagne** : un nouveau téléphone prend les
  jardins du compte) ; introduction terminée (**vrai gagne**). Une valeur que le magasin refuserait
  est ignorée, une clé inconnue aussi (venue d'une version plus récente).
- **Horloges** : chaque téléphone horodate avec une horloge hybride (jamais en arrière, toujours
  au-delà de tout horodatage déjà vu). Un changement fait après avoir vu celui d'un autre téléphone
  gagne donc, même si les horloges diffèrent. L'horloge suit celle du serveur dès sa première
  réponse (`createSyncClock`) ; un horodatage vu ailleurs ne peut l'avancer que d'un jour au plus,
  et le serveur ramène tout horodatage à un jour au plus après son heure.
- **Réglages jamais choisis** : à la création des métadonnées, les réglages présents sont horodatés
  0 (sauf la graine, horodatée à l'instant) : ils cèdent devant n'importe quel choix du compte. Un
  nouveau téléphone ne remplace donc pas les réglages du compte par ses valeurs de départ.
- **Le temps déjà compté** au moment où la synchronisation commence (mise à jour de l'appli, copie
  iCloud revenue) devient une **base** : il n'est envoyé qu'une fois le temps du compte connu, pour
  ce qui le dépasse. Le temps d'un jour vaut « ce téléphone + le plus grand de (autres téléphones,
  base) ». Ainsi une réinstallation ou deux téléphones restaurés depuis la même copie ne comptent
  pas deux fois le même temps.
- **Jumeaux** : un téléphone restauré depuis la sauvegarde d'un autre porte le même nom. Quand un
  téléphone reçoit, sous son propre nom, un compteur plus avancé que le sien, il prend un nouveau
  nom ; leurs temps s'additionnent de nouveau.
- **Boîte d'envoi** : avant la première connexion, rien n'attend (le journal lui-même suffit). À la
  première connexion — ou avec un autre compte — **tout ce que le téléphone contient est envoyé**
  et fusionné avec le compte, jamais mis à sa place. Ensuite chaque changement local ajoute son
  événement ; un nouveau choix du même réglage, ou le nouveau compteur du même jour, remplace
  l'ancien en attente.

La fusion est vérifiée par des scénarios (jours hors ligne puis synchronisation, deux téléphones,
doublons, réinstallation, horloges décalées) et par un test de convergence : trois téléphones,
120 actions tirées au hasard, horloges qui reculent, ordre de synchronisation quelconque, sur
huit graines ; tous finissent identiques.

## 3. Le moteur (`src/data/sync`)

Une synchronisation : **recevoir** tout ce qui est nouveau (page par page ; le magasin fusionne et
retient où il en est), **régler la base de temps**, puis **envoyer** la boîte d'envoi par lots de
200, chaque lot oublié dès que le serveur l'a. Un échec n'importe où laisse les données du
téléphone entières et le reste dans la boîte d'envoi.

- Quand : au démarrage, au retour au premier plan, en quittant le premier plan (iOS laisse
  quelques secondes), 5 s après un changement, toutes les 2 min au premier plan.
- Nouvel essai après un échec : 2 s, puis le double à chaque échec, jusqu'à 5 min, avec un écart
  aléatoire. Pas de module réseau (NetInfo) : l'échec d'une requête suffit à savoir qu'on est hors
  ligne, et aucune dépendance native n'est ajoutée.
- Deux téléphones actifs en même temps : chacun fusionne ce que l'autre a envoyé ; l'ordre ne
  change pas le résultat.
- Serveurs : `SyncBackend` (interface du domaine). `createSupabaseSyncBackend` appelle les deux
  fonctions SQL par l'API REST (`POST /rest/v1/rpc/sync_push`, `sync_pull`), avec la clé publique
  et le jeton de la personne, sans bibliothèque. `createMemorySyncBackend` sert aux tests.
- **Sans projet Supabase dans la compilation, ou sans vraie connexion, la synchronisation ne
  démarre pas** : l'appli marche entièrement hors ligne et la ligne des réglages dit « Sauvegardé
  sur ce téléphone ». La connexion de démonstration (`src/data/social`) n'est pas un compte et ne
  synchronise jamais (`session: null` dans `src/app/_layout.tsx`).

## 4. Les sauvegardes du téléphone (déjà en place, vérifiées)

- iOS : `RCTAsyncStorageExcludeFromBackup: false` (app.json) garde le dossier d'AsyncStorage dans
  les sauvegardes iCloud et sur ordinateur (par défaut, AsyncStorage 2.x l'en exclut). La clé est
  bien dans l'`Info.plist` produit par `expo prebuild`.
- Android : `allowBackup: true`, sans règle d'exclusion ; la sauvegarde automatique de Google
  prend alors toute la base `RKStorage` (25 Mo au plus par appli). Vérifié dans le manifeste
  produit par `expo prebuild`.
- Un test (`os-backup-config.test.ts`) échoue si quelqu'un retire l'un de ces réglages.

### Ce qui revient, dans quel cas

| Cas                                         | Sans compte                                                                                    | Avec compte (après la mise en service)      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Nouveau téléphone, sauvegarde iCloud/Google | tout revient avec la sauvegarde du téléphone                                                   | idem, puis fusion avec le compte            |
| Nouveau téléphone sans sauvegarde           | rien                                                                                           | tout revient à la connexion                 |
| iOS : supprimer puis réinstaller            | la copie iCloud clé-valeur, **si** le module natif est activé (`specs/backup.md`) ; sinon rien | tout revient à la connexion                 |
| Android : supprimer puis réinstaller        | restauré par Google à l'installation (si activé)                                               | idem, puis fusion                           |
| Hors ligne, mise à jour de l'appli          | tout reste sur le téléphone                                                                    | idem ; envoyé au retour du réseau           |
| Document local abîmé                        | repris de la seconde copie                                                                     | idem, et le journal revient aussi du compte |

## 5. Le serveur (`supabase/migrations/20261125120000_sync.sql`)

- `sync_events` : une ligne par événement et par personne (`id` = contenu de l'événement,
  `seq` = ordre par compte). `sync_accounts` : dernier numéro, nombre d'événements, fenêtre de la
  limite d'appels.
- **Propriétaire seul** : RLS sur les deux tables ; la personne connectée lit ses propres
  événements (pour les consulter ou les exporter) et rien d'autre ; personne n'écrit directement.
  `sync_accounts` n'a ni droit ni règle. `anon` n'a rien. Les lignes partent avec le compte.
- `sync_push(events)` : 200 événements au plus par appel ; chaque événement est contrôlé champ par
  champ et réécrit avec ses seuls champs connus ; un événement mal formé est ignoré et compté
  (`rejected`), jamais stocké, pour qu'un événement refusé ne bloque pas l'envoi des suivants.
  Jours acceptés : du 1er janvier 2020 au lendemain du jour du serveur. 2 Ko au plus par
  événement, 100 000 événements au plus par compte (`sync_quota_exceeded`).
- `sync_pull(after, limit)` : les événements après `after`, dans l'ordre, 1 000 au plus.
- 120 appels par minute et par compte (`sync_rate_limited`). La ligne du compte est verrouillée
  pendant chaque appel : les numéros sont donnés dans l'ordre des validations, un téléphone ne
  saute donc jamais un événement.
- **Compactage** : un événement définitivement dépassé par un autre de la même chose (compteur
  plus petit du même téléphone et du même jour, choix plus ancien d'un réglage « le plus récent
  gagne », page relue plus tard) est supprimé ou pas stocké. Un compte garde ainsi environ une
  ligne par page lue, par téléphone et par jour, par réglage et par signet. Pas besoin
  d'instantanés : un nouveau téléphone lit l'état compacté en quelques requêtes.
- Fonctions `security definer`, `search_path` vide, droits donnés fonction par fonction (les
  droits de la migration sociale ne sont pas touchés).

## 6. La ligne des réglages

`src/features/sync/sync-status-section.tsx`, insérée en fin de liste dans
`src/features/settings/settings-screen.tsx` : une section « Sauvegarde », une ligne « Sauvegardé
sur ce téléphone » et, quand un compte existe, une note : « Synchronisé il y a 2 min »,
« Synchronisation… », « Hors ligne — sera synchronisé », « Pas encore synchronisé — nouvel essai
automatique ». Rien à toucher. Français, anglais, arabe (espace de noms `sync`).

## 7. Mise en service

**État au 25 novembre 2026** : le projet Supabase existe (offre gratuite, région ca-central-1,
`https://onjjwtegzeuajkcnzyvj.supabase.co`) ; la migration sociale y est appliquée (en cinq
morceaux équivalents). L'adresse et la **clé publiable** sont dans `app.json`
(`expo.extra.supabase`) : ce sont des valeurs publiques, faites pour être dans l'appli. Des
variables `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou
`EXPO_PUBLIC_SUPABASE_ANON_KEY`), si une compilation les définit, l'emportent (pour viser un autre
projet). **Jamais** de clé secrète (`sb_secret_…`) ni `service_role`, ni dans l'appli, ni dans le
dépôt, ni dans la compilation. Tant que la connexion n'est pas branchée, l'appli ne synchronise
rien, même avec ces valeurs.

Ce qui reste :

1. **Appliquer `20261125120000_sync.sql`** au projet (après relecture ; par le coordinateur), puis
   relancer les conseillers de sécurité. Attendus : les deux fonctions `sync_push` et `sync_pull`
   appelables par `authenticated` (c'est voulu), `sync_accounts` avec RLS et sans règle (voulu :
   seules les fonctions y touchent).
2. Dans _Integrations › Data API_, vérifier que le schéma `public` est exposé et que `private`
   **ne l'est pas**.
3. **Activer les fournisseurs de connexion** (_Authentication › Sign In / Providers_) — à faire par
   le propriétaire :
   - **E-mail, par code à 6 chiffres** (l'appli demande un code, pas un lien) : le fournisseur Email
     est actif par défaut ; dans _Authentication › Emails › Templates_, mettre `{{ .Token }}` dans le
     modèle « Magic link » (documentation de Supabase, lue le 25 novembre 2026), et, de mémoire, à
     vérifier, dans « Confirm signup » pour la toute première connexion ; le code fait 6 chiffres
     (règle de l'appli, `SOCIAL_CONFIG.emailCodeLength`) ; durée de validité (_Providers › Email ›
     Email OTP Expiration_) : 10 min conseillé. Pour la production,
     un serveur SMTP à soi (_Authentication › SMTP_) : l'envoi intégré de Supabase est limité à
     quelques e-mails par heure.
   - **Apple** (obligatoire sur iOS dès que Google est proposé) : sur developer.apple.com, activer
     « Sign in with Apple » pour l'identifiant `com.omazi.quran` ; dans Supabase, activer Apple et
     mettre `com.omazi.quran` dans _Client IDs_ (connexion native depuis l'appli, sans page web,
     par `signInWithIdToken`). De mémoire, à vérifier dans la documentation au moment de le faire :
     une clé et un Services ID ne servent qu'à la connexion web (non prévue).
   - **Google** : dans Google Cloud Console, créer un écran de consentement et trois identifiants
     OAuth : iOS (bundle `com.omazi.quran`), Android (paquet `com.omazi.quran` + empreinte SHA-1 du
     certificat de signature), Web (son ID et son secret vont dans Supabase) ; dans Supabase,
     activer Google, coller l'ID et le secret Web, et ajouter les ID iOS et Android dans
     _Client IDs_ autorisés (de mémoire, à vérifier). Le secret Google reste dans le tableau de bord de Supabase.
   - _Authentication › URL Configuration_ : ajouter `quranapp://**` aux adresses de redirection
     (schéma d'`app.json`).
   - _Authentication › Rate Limits_ : régler la création de comptes et l'envoi d'e-mails
     (`specs/social-database.md`, 3.5).
4. **Brancher la vraie connexion** (lot social) : fournir à `useAppSync` une `SyncSession`
   (`getAccount` = id de l'utilisateur, `getAccessToken` = jeton de session gardé dans le trousseau)
   à la place de `session: null` dans `src/app/_layout.tsx`.
5. **Essai réel** avec deux comptes et deux téléphones : lire hors ligne sur l'un, reconnecter,
   vérifier sur l'autre ; réinstaller ; vérifier qu'un compte ne lit rien de l'autre.

## 8. Limites connues

- Les tests SQL tournent sur PostgreSQL 17 seul, avec une imitation de Supabase écrite de mémoire
  (`supabase/tests/shim.sql`) : l'API REST, le passage du jeton et les réglages du projet ne sont
  pas testés. À refaire sur le vrai projet (étape 7).
- Le format exact des requêtes REST (`/rest/v1/rpc/…`, en-têtes `apikey` et `Authorization`) suit
  la documentation de Supabase consultée le 25 novembre 2026 ; il n'a jamais été essayé contre un
  vrai projet.
- Rien n'est vérifié sur un téléphone (aucun Mac, D24) : sauvegarde iCloud, Auto Backup, quelques
  secondes au passage en arrière-plan.
- Journal sur le serveur : il révèle une pratique religieuse. Lisible par le propriétaire du projet
  et par Supabase (clé secrète). Le chiffrement par l'appli reste une option (D43).
- Changer de compte sur le même téléphone envoie la progression du téléphone au nouveau compte.
- Deux téléphones restaurés depuis la même sauvegarde et utilisés le même jour : pour les jours
  d'avant la détection du jumeau, le temps du jour est le plus grand des deux, pas leur somme.
- Un journal très long : le document est relu en une fois ; AsyncStorage Android lit au plus
  environ 2 Mo par clé (soit environ 70 khatmas complètes).
- Un compte plein (100 000 événements) ne reçoit plus rien ; l'appli réessaie toutes les 5 min.

## 9. Tests

- `src/domain/sync/__tests__/sync.test.ts` : fusion, horloges, base de temps, jumeaux,
  réinstallation, boîte d'envoi, données non fiables, nouveaux essais, convergence aléatoire.
- `src/store/__tests__/durability.test.ts` : chaque version passée du document, seconde copie,
  versions plus anciennes et plus récentes de l'appli ; `sync-store.test.ts` : métadonnées tenues
  par le magasin, fusion de ce qui vient du compte.
- `src/data/sync/__tests__` : moteur (hors ligne, échec au milieu d'un envoi, deux téléphones,
  réinstallation, horloge fausse, déclencheurs), serveur Supabase (requêtes, erreurs, délai),
  configuration.
- `src/features/sync/__tests__` : la ligne des réglages dans les trois langues, le démarrage.
- `supabase/tests/sync.test.mjs` (`npm run db:test`) : 24 tests sur PostgreSQL 17 avec les deux
  migrations. Cinq copies volontairement abîmées de la migration (règle de lecture ouverte à tous,
  limite d'appels retirée, fonction privée ouverte, page 999 acceptée, compactage faussé) font
  chacune échouer au moins un test.
