# Base de données des comptes et des proches (livrable C)

Ce document explique, en langage simple, ce que fait `supabase/migrations/20261124230000_social.sql`,
comment on le teste, ce qu'il faut faire le jour où le propriétaire crée le projet Supabase, et
ce qui reste à décider. Il accompagne `docs/specs/social.md` (sections 1, 2, 3 et 5) et le code
de `src/domain/social`.

**Rien n'a été envoyé à Supabase.** Il n'y a pas de projet Supabase : le fichier est prêt à être
appliqué plus tard. Les tests tournent sur un PostgreSQL local, jetable.

## 1. Ce qui est vérifié, et ce qui ne l'est pas

| Sujet                                                                                               | État                                                                                   |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Les règles d'accès et les fonctions du fichier SQL se comportent comme décrit, sur PostgreSQL 17.12 | **VÉRIFIÉ** (88 tests, section 8)                                                      |
| Le même fichier fonctionne sur un vrai projet Supabase                                              | **NON VÉRIFIÉ** (aucun projet)                                                         |
| `auth.uid()`, les rôles `anon` et `authenticated`                                                   | **NON VÉRIFIÉ** (voir ci-dessous)                                                      |
| La création du profil à l'inscription                                                               | **NON VÉRIFIÉ**                                                                        |
| `security definer` et `set search_path`                                                             | **NON VÉRIFIÉ** (le test vérifie le comportement dans PostgreSQL, pas la doc Supabase) |
| `supabase db push`, `supabase test db`                                                              | **NON VÉRIFIÉ**                                                                        |
| Les droits donnés par défaut par Supabase aux rôles `anon` et `authenticated`                       | **NON VÉRIFIÉ** (le fichier ne s'y fie pas, voir 3.1)                                  |
| Le schéma `private` n'est pas offert par l'API de Supabase                                          | **NON VÉRIFIÉ**                                                                        |
| Le propriétaire des fonctions peut supprimer une ligne de `auth.users`                              | **NON VÉRIFIÉ**                                                                        |
| La base d'un projet Supabase est en UTF8                                                            | **NON VÉRIFIÉ**                                                                        |

**Pourquoi « non vérifié »** : la consigne était de vérifier dans la documentation en vigueur
avec `WebSearch`, sans `WebFetch`. La recherche n'a renvoyé que des titres et des adresses de
pages, sans leur texte. Elle prouve que ces pages existent ; elle ne dit pas ce qu'elles
contiennent. Rien de ce qui suit n'est donc confirmé par la documentation. Tout ce que le
fichier suppose de Supabase vient de la mémoire de son auteur et reste à relire. Pages trouvées
par la recherche, à lire avant la mise en service :

- Règles d'accès par ligne, `auth.uid()`, rôles :
  <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Créer un profil à l'inscription (déclencheur sur `auth.users`), `security definer` :
  <https://supabase.com/docs/guides/auth/managing-user-data>
- Contrôles de sécurité automatiques de Supabase (« advisors ») :
  <https://supabase.com/docs/guides/observability/advisors.md>
- Ligne de commande : <https://supabase.com/docs/reference/cli/supabase-test> (`supabase test`),
  <https://supabase.com/docs/reference/cli/supabase-migration-new> (nom des migrations). Aucune
  page sur `supabase db push` n'est sortie de la recherche.

Ce que le fichier suppose de Supabase, à confirmer sur ces pages :

1. `auth.users(id uuid)` existe et `auth.uid()` rend l'identifiant de la personne connectée, ou
   rien si personne n'est connecté.
2. Les rôles `anon` (visiteur non connecté) et `authenticated` (personne connectée) existent.
3. Les requêtes de l'application passent par l'un de ces deux rôles ; la clé secrète
   (`service_role`) ignore les règles par ligne et ne doit jamais être dans l'appli.
4. Les fonctions du schéma `public` sont appelables par l'API ; celles du schéma `private`
   ne le sont pas.
5. Une migration peut créer des fonctions et des tables dans `public` et un schéma `private`.

## 2. Les tables

Les noms sont ceux de `src/domain/social/types.ts` en `snake_case`. Les jours sont des dates
(`date`) ; ceux que le serveur écrit lui-même sont des jours **UTC**.

| Table              | Rôle                                                                                                                                                           | Contraintes principales                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`         | Le compte : `id` (celui de `auth.users`), `display_name`, `show_garden`, `show_level` (vrais par défaut, D23), `created_on`                                    | nom : règle 1 ; supprimé avec le compte                                                                                                  |
| `garden_summaries` | Une ligne par personne : `level` (≥ 1), `hizb_completed` (0 à 60), `health` (0 à 1), `last_watered_on`, `streak_days` (≥ 0), `badge_count` (≥ 0), `updated_on` | aucun numéro de page, aucune heure                                                                                                       |
| `friendships`      | Une ligne par paire : `requester_id`, `addressee_id`, `status` (`pending`, `accepted`, `declined`), `created_on`, `responded_on`                               | paire unique quel que soit le sens (index sur `least`/`greatest`) ; pas avec soi-même ; `responded_on` vide si et seulement si `pending` |
| `blocks`           | `blocker_id`, `blocked_id`, `created_on`                                                                                                                       | pas avec soi-même ; un blocage par sens au plus                                                                                          |
| `invites`          | `code`, `owner_id`, `created_on`, `expires_on`                                                                                                                 | code de 8 caractères de l'alphabet de `config.ts` (31 caractères, sans 0 O 1 I L)                                                        |
| `nudges`           | `from_id`, `to_id`, `kind` (`encourage`, `congratulate`), `sent_on`                                                                                            | un par ami et par jour (clé unique) ; pas à soi-même                                                                                     |
| `groups`           | `id`, `name`, `owner_id`, `created_on`                                                                                                                         | nom : règle 1                                                                                                                            |
| `group_members`    | `group_id`, `user_id`, `role` (`owner`, `member`), `joined_on`                                                                                                 | un seul rôle `owner` par groupe, et c'est `groups.owner_id` (vérifié à la fin de chaque transaction)                                     |
| `daily_readings`   | `user_id`, `day`, `new_pages` (0 à 604)                                                                                                                        | une ligne par personne et par jour                                                                                                       |
| `badges`           | `user_id`, `khatm_number` (≥ 1), `completed_on`                                                                                                                | un badge par khatma                                                                                                                      |
| `reading_backups`  | `user_id`, `journal` (JSON, un objet, 2 Mo au plus), `updated_on`                                                                                              | **propriétaire seul** ; à confirmer (section 7)                                                                                          |
| `invite_attempts`  | **Ajoutée** : essais ratés de code d'invitation (`user_id`, `attempted_at`)                                                                                    | personne ne la lit ni ne l'écrit                                                                                                         |

Les identifiants de personnes sont des `uuid` (ceux de Supabase). Comparer deux `uuid` revient
à comparer leurs 16 octets, c'est-à-dire leur écriture hexadécimale en minuscules dans l'ordre
du classement `"C"` : le plus petit identifiant est le même côté TypeScript (comparaison de
textes minuscules) et côté base.

**Suppression en cascade (règle 10).** Toutes les tables pointent vers `profiles(id)` avec
`on delete cascade`, et `profiles` pointe vers `auth.users(id)` de la même façon. Supprimer le
compte (ligne de `auth.users`) supprime donc le profil puis tout le reste : résumé, amitiés,
blocages faits par la personne **et contre elle**, invitations, encouragements envoyés **et reçus**,
appartenances, lectures, badges, sauvegarde. Un test vérifie, table par table, qu'il ne reste
rien. Un groupe dont le propriétaire part passe au plus ancien membre (le plus petit
`joined_on`, puis le plus petit `user_id`), ou disparaît s'il était seul : c'est un déclencheur
sur `profiles`, donc vrai aussi quand le compte est supprimé par un administrateur ou par une
Edge Function.

## 3. Les règles d'accès

### 3.1 Deux verrous

1. **Les droits.** Le fichier retire d'abord _tous_ les droits de `anon` et `authenticated` sur
   chaque table, puis redonne un par un ceux dont on a besoin, souvent colonne par colonne
   (on ne peut pas changer son `id` ni sa date de création, ni la `user_id` d'une ligne). On ne
   compte donc pas sur les droits par défaut de Supabase, que l'auteur n'a pas pu relire. Le
   test de départ les copie (voir section 8) pour prouver que le fichier les neutralise.
2. **Les règles par ligne (RLS).** Activées sur **les 12 tables**, refus par défaut : sans règle,
   rien ne passe. Il y en a 27, toutes pour le rôle `authenticated` seulement. Le visiteur non
   connecté (`anon`) n'a ni droit ni règle : la base lui répond « permission refusée ».

Une règle qui manquerait ne suffit donc pas à ouvrir une porte, et un droit qui traînerait ne
suffit pas non plus : les deux verrous doivent céder. (Un essai l'a confirmé : donner par erreur le droit de
changer `user_id` sur une lecture du jour ne change rien, parce que la règle par ligne refuse
aussi.)

### 3.2 Ce que chacun peut faire

« Propriétaire » = la personne dont la ligne parle. « Ami » = ami accepté, sans blocage. « Bloqué » =
bloqué par le propriétaire. Les colonnes « Inconnu » et « Non connecté » sont les cas de la
section 5 de la spec.

| Table              | Propriétaire                                                       | Ami                                                                 | Inconnu | Bloqué                                     | Non connecté |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------- | ------- | ------------------------------------------ | ------------ |
| `profiles`         | lit, crée, change son nom et ses deux réglages                     | rien en direct ; son **nom** par `get_public_profiles`              | pareil  | rien, pas même le nom                      | rien         |
| `garden_summaries` | lit, publie, change, retire le sien                                | rien en direct ; le jardin par `list_friends` / `get_friend_garden` | rien    | rien                                       | rien         |
| `friendships`      | lit ses lignes ; écrit par fonctions                               | lit sa ligne                                                        | rien    | rien                                       | rien         |
| `blocks`           | lit les siens ; écrit par fonctions                                | rien                                                                | rien    | **rien** (il ne voit pas qu'il est bloqué) | rien         |
| `invites`          | lit et retire les siens ; crée par `create_invite`                 | rien                                                                | rien    | rien                                       | rien         |
| `nudges`           | lit ceux qu'il envoie et reçoit                                    | idem pour ses propres lignes                                        | rien    | rien                                       | rien         |
| `groups`           | lit ceux dont il est membre ; le propriétaire du groupe le renomme | idem                                                                | rien    | rien                                       | rien         |
| `group_members`    | lit les membres des groupes dont il est membre                     | idem                                                                | rien    | rien                                       | rien         |
| `daily_readings`   | lit, écrit, retire les siennes                                     | **rien** (seulement des sommes, par `group_leaderboard`)            | rien    | rien                                       | rien         |
| `badges`           | lit, écrit, retire les siens                                       | lit si `show_level`                                                 | rien    | rien                                       | rien         |
| `reading_backups`  | lit, écrit, retire la sienne                                       | **rien**                                                            | rien    | rien                                       | rien         |
| `invite_attempts`  | rien                                                               | rien                                                                | rien    | rien                                       | rien         |

Les écritures qui touchent deux personnes **ne passent jamais par un accès direct à la table** :
aucun droit d'insertion sur `friendships`, `blocks`, `invites`, `nudges`, `groups`,
`group_members`. C'est ce qui ferme : insérer soi-même une amitié acceptée, s'accepter soi-même,
choisir un code d'invitation devinable, se faire entrer dans un groupe.

### 3.3 Pourquoi un ami lit le jardin par une fonction et non par la table

La règle 4 est plus fine qu'une règle par ligne : `show_garden` cache le jardin, mais
`show_level` cache **seulement** deux colonnes (`level`, `badge_count`) de la **même ligne**. Une
règle par ligne ne sait pas cacher une colonne. Pour que rien ne fuite si une règle est mal
écrite, la table `garden_summaries` n'est lisible que par son propriétaire. Un ami appelle :

- `list_friends()` : mes amis acceptés (personne de bloqué), leur nom, et les valeurs du jardin ;
  une valeur cachée vaut `null`, et `garden_visible` / `level_visible` disent pourquoi ;
- `get_friend_garden(p_friend)` : la même chose pour un seul ami (aucune ligne si ce n'est pas un
  ami).

Les badges, eux, sont tout-ou-rien : un ami les lit par une vraie règle par ligne (`show_level`).

Un inconnu ne voit que le **nom**, par `get_public_profiles(ids)` (200 identifiants au plus) :
la table `profiles` n'est pas lisible en direct, parce que ses autres colonnes (réglages, date
de création) ne sont pas pour lui. Si l'un des deux a bloqué l'autre : aucune ligne du tout.

### 3.4 Les fonctions

Toutes sont `security definer` (elles s'exécutent avec les droits du propriétaire du fichier et
vérifient **elles-mêmes qui appelle**, par `auth.uid()`), avec `set search_path = ''` (tous les
noms y sont écrits en entier : une personne ne peut pas détourner une fonction en créant un
objet de même nom ailleurs). Personne n'a le droit de les appeler sauf `authenticated`.

| Fonction                                      | Règle | Ce qu'elle fait                                                                                                                                                                                                                     |
| --------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `send_friend_request(to)`                     | 2, 3  | demande ; une demande vers quelqu'un qui en a envoyé une l'accepte ; attend 7 jours après un refus (à compter de `responded_on`) ; celui qui a refusé n'attend pas                                                                  |
| `respond_friend_request(other, accept)`       | 2     | seul le destinataire accepte ou refuse                                                                                                                                                                                              |
| `remove_friendship(other)`                    | 2     | l'un ou l'autre ami retire une amitié acceptée (rien d'autre : ni demande en attente, ni refus)                                                                                                                                     |
| `block_user(target)` / `unblock_user(target)` | 3     | bloque (retire l'amitié acceptée et la demande en attente, garde une demande refusée, supprime les encouragements entre les deux) ; débloque                                                                                        |
| `create_invite()`                             | 6     | tire un code de 8 caractères, valable jusqu'à `created_on + 7` inclus ; 5 codes vivants au plus                                                                                                                                     |
| `accept_invite(code)`                         | 6     | crée l'amitié acceptée ; rend un texte (voir plus bas)                                                                                                                                                                              |
| `send_nudge(to, kind, sent_on)`               | 7     | un par ami et par jour, toutes sortes confondues                                                                                                                                                                                    |
| `create_group(name)`                          | 8     | crée le groupe, le créateur en est le propriétaire                                                                                                                                                                                  |
| `add_group_member(group, user)`               | 8     | un membre ajoute **son** ami ; 50 membres au plus                                                                                                                                                                                   |
| `leave_group(group, successor)`               | 8     | quitter ; le propriétaire d'un groupe qui a d'autres membres nomme son successeur ; seul, il ferme le groupe                                                                                                                        |
| `get_public_profiles(ids)`                    | 4     | noms                                                                                                                                                                                                                                |
| `list_friends()`, `get_friend_garden(friend)` | 4     | jardins des amis                                                                                                                                                                                                                    |
| `list_group_members(group)`                   | 8     | membres d'un de mes groupes, avec leur nom                                                                                                                                                                                          |
| `group_leaderboard(group, from, to)`          | 9     | somme de `new_pages` par membre entre deux jours (366 jours au plus) ; rang 1 au plus grand, **ex æquo : même rang puis le suivant saute (1, 1, 3)** ; un membre sans lecture figure avec 0 ; classés par rang puis par identifiant |
| `delete_my_account()`                         | 10    | supprime la ligne de `auth.users` de l'appelant : la cascade fait le reste                                                                                                                                                          |

Les cas d'erreur sont des messages courts, **ceux de `src/domain/social/errors.ts` avec des
tirets bas** : `cannot_befriend_yourself`, `already_friends`, `request_already_sent`,
`request_declined_recently`, `no_pending_request`, `not_the_addressee`, `not_friends`,
`cannot_block_yourself`, `already_blocked`, `not_blocked`, `you_blocked_them`,
`person_unavailable`, `already_nudged_today`, `group_not_found`, `already_a_member`,
`group_full`, `owner_must_hand_over`, `successor_not_a_member`, `name_empty`, `name_too_long`,
`name_forbidden_character` (plus `name_has_edge_spaces`, `invalid_target`, `invalid_kind`,
`invalid_answer`, `invalid_successor`, `invalid_period`, `invalid_ids`, `day_out_of_range`,
`too_many_invites`, `not_authenticated`, `profile_required`).

Le blocage ne se voit pas : celui qui est bloqué reçoit `person_unavailable`, la même réponse que
pour un compte qui n'existe pas ; celui qui a bloqué reçoit `you_blocked_them`.

`accept_invite` est le seul qui **rend** son refus au lieu de le lever : une erreur annulerait le
décompte des essais ratés (10 par heure et par compte, au-delà : `too_many_attempts`). Il
rend `accepted`, `already_friends`, `invite_code_malformed`, `invite_not_found`, `invite_expired`,
`invite_is_yours`, `you_blocked_them`, `too_many_attempts`. Si le propriétaire du code a bloqué la
personne, la réponse est `invite_not_found` (jamais « bloqué »). Le code est strict : pas de
majuscules automatiques (c'est l'écran qui les met).

### 3.5 Pourquoi les codes d'invitation ne se devinent pas

- Les codes sont tirés par le serveur (`gen_random_uuid()`, source sûre de PostgreSQL), sans biais
  (tirage avec rejet), jamais choisis par le client. Personne ne peut insérer son code.
- La table `invites` n'est lisible que par son propriétaire : on ne peut ni lister ni chercher.
- Les essais ratés sont comptés : 10 par heure et par compte.
- Il reste 31^8 ≈ 8,5 × 10^11 codes possibles. **Limite honnête** : quelqu'un qui crée beaucoup
  de comptes multiplie ses essais. Ce qui l'en empêche, ce sont la validité de 7 jours, les 5 codes
  vivants au plus, et le fait qu'un code ne donne qu'un lien d'amitié (pas le journal, qui
  n'est jamais partagé). Pour durcir : limiter la création de comptes dans les réglages
  d'authentification de Supabase (NON VÉRIFIÉ).

## 4. Ce qu'un client malveillant ne peut pas faire (et le test qui le dit)

| Tentative                                                     | Ce qui l'arrête                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Insérer une amitié acceptée, ou s'accepter soi-même           | aucun droit d'écriture sur `friendships`                                             |
| Lire le résumé de quelqu'un qui le cache ou qui m'a bloqué    | table lisible par le propriétaire seul ; la fonction `list_friends` ne rend rien     |
| Écrire la lecture du jour de quelqu'un d'autre                | règle par ligne (`user_id = auth.uid()`) **et** droit de colonne                     |
| Deviner des codes d'invitation                                | codes serveur, table illisible, 10 essais par heure                                  |
| Lire l'appartenance aux groupes des autres                    | règle par ligne : seulement mes groupes                                              |
| Se faire ajouter à un groupe, ou y ajouter un inconnu         | aucun droit d'écriture ; `add_group_member` vérifie que l'appelant est membre et ami |
| Savoir qui m'a bloqué                                         | `blocks` n'est lisible que par celui qui bloque ; refus = « personne introuvable »   |
| Lire la sauvegarde d'un ami ou d'un membre du même groupe     | propriétaire seul                                                                    |
| Appeler une fonction sans être connecté                       | aucun droit d'exécution pour `anon`                                                  |
| Écrire un jour dans le futur ou avant 2020, plus de 604 pages | contraintes et déclencheur                                                           |
| Changer le propriétaire d'un groupe à la main                 | pas de droit sur `owner_id` ; la cohérence propriétaire / membre est vérifiée        |

## 5. Les jours

Le serveur connaît le jour UTC, pas le jour local de la personne. Ce que fait le fichier :
`created_on`, `responded_on`, `joined_on`, les dates d'invitation et le délai de 7 jours sont
des jours UTC du serveur. Ce que l'appli envoie (`last_watered_on`, `completed_on`, `day` d'une
lecture, `updated_on`, `sent_on` d'un encouragement) est un jour local : il est refusé s'il tombe
**après le jour UTC du serveur + 1** (les fuseaux vont de moins de 12 à plus de 14 heures). Le
`day` d'une lecture est aussi refusé avant le 1er janvier 2020 (cette borne n'est pas dans la
spec : elle empêche d'écrire des milliers d'années de lignes). Pour un encouragement, le jour doit
être à un jour près du jour UTC du serveur, dans les deux sens.

## 6. Les étapes le jour où le propriétaire crée le projet Supabase

Tout ce qui suit est **à confirmer sur les pages de la section 1** : l'auteur n'a pas pu les lire.

1. Créer le projet sur supabase.com. Noter l'adresse du projet et la **clé publique** (« anon » ou
   « publishable »). La clé secrète (`service_role`) ne va **jamais** dans l'appli ni dans le dépôt
   (dépôt public, `docs/SECURITY.md`).
2. Installer la ligne de commande Supabase, se connecter, lier le dossier au projet
   (`supabase login`, puis `supabase link --project-ref <référence>`).
3. Appliquer la migration : `supabase db push`. Elle crée les tables, les règles et les
   fonctions. Elle ne touche pas aux utilisateurs.
4. Contrôles tout de suite après :
   - dans l'éditeur de tables, les 12 tables doivent afficher « RLS activé » ;
   - lancer le contrôle de sécurité de Supabase (« Advisors », page de la section 1) et lire chaque
     alerte : il signalera sans doute les fonctions appelables par l'API ; c'est voulu (elles
     vérifient l'appelant), mais chaque alerte doit être comprise ;
   - dans les réglages de l'API, vérifier que `private` **n'est pas** dans la liste des schémas
     offerts, et que `public` l'est ;
   - avec deux comptes d'essai : lire le jardin de l'autre avant et après acceptation ; essayer
     d'insérer une amitié par l'API (doit être refusé) ; bloquer, puis refaire une demande.
5. Régler l'authentification : connexion avec Apple (obligatoire sur iOS dès que Google est
   proposé), avec Google, par code envoyé par e-mail (6 chiffres : `emailCodeLength` de
   `config.ts`), limites de création de comptes et d'envoi d'e-mails.
6. **Le profil à l'inscription.** Le fichier ne crée pas de déclencheur sur `auth.users` (il
   dépendrait de détails non vérifiés). L'appli crée son profil juste après la première
   connexion : `insert into profiles (id, display_name)` avec `id` = son identifiant. Tant que ce
   n'est pas fait, toutes les fonctions répondent `profile_required`. Si l'on préfère un
   déclencheur à l'inscription, c'est la page « Managing user data » de la section 1 qui dit
   comment ; il faudra alors y répondre à la règle 1 (nom de 1 à 30 caractères).
7. **Suppression du compte.** `delete_my_account()` supprime la ligne de `auth.users`. Cela
   suppose que le propriétaire de la fonction en a le droit (NON VÉRIFIÉ). Si Supabase refuse,
   la solution de repli est une Edge Function qui appelle l'API d'administration avec la clé
   secrète (côté serveur seulement) : la cascade et le passage des groupes se font tout seuls.
8. Brancher l'appli : deuxième mise en œuvre de `AuthGateway` et `SocialRepository` (aucun écran
   ne change). Les noms de colonnes sont ceux de `types.ts` en `snake_case` ; les lectures
   des amis, des noms et des classements passent par les fonctions de la section 3.4.
9. `supabase test db` (tests pgTAP) n'est pas utilisé : les tests de ce lot sont en JavaScript
   (section 8). Les passer sur le vrai projet ne se fait pas par cette commande.

## 7. Ce qui reste à décider

### 7.1 La sauvegarde du journal

`docs/specs/social.md` demande une confirmation du propriétaire avant toute mise en service, car le
journal de lecture révèle une pratique religieuse. Le fichier SQL crée la table
`reading_backups`, **lisible et modifiable par son propriétaire seul** (aucune lecture par un ami,
un inconnu, un bloqué, un membre du même groupe ; testé), mais **rien ne l'utilise tant que
l'appli ne l'écrit pas**. Choix :

1. **La garder** : un nouveau téléphone retrouve la progression (D16). Le journal est alors
   sur le serveur, lisible par toute personne qui a la clé secrète du projet, donc par le
   propriétaire du projet et par Supabase.
2. **La supprimer** (une migration `drop table`) : la progression reste sauvegardée par iCloud
   ou Google seulement (`docs/SECURITY.md`).
3. **La garder, chiffrée par l'appli** avant l'envoi, avec une clé que seule la personne a :
   le serveur ne verrait qu'un texte illisible. Plus sûr, mais une clé perdue = progression
   perdue. Hors de ce lot.

Taille limitée à 2 Mo (hypothèse). Une seule ligne par personne.

### 7.2 Une appli modifiée peut annoncer de fausses lectures

**Les chiffres envoyés par l'appli ne sont pas dignes de confiance, et aucune règle de base de
données ne peut le corriger.** `new_pages` vient du journal du téléphone ; une appli modifiée peut
envoyer 604 pages tous les jours, `streak_days` à 36 500, une `health` de 1. Le serveur n'a aucun
moyen de vérifier qu'une page a été lue (la voix reste sur le téléphone, `docs/SECURITY.md`).

Ce qui **limite** les dégâts, et c'est tout :

- 0 à 604 pages par jour ; un jour ne peut pas être dans le futur (au-delà d'un jour) ni avant
  2020 ; une ligne par personne et par jour (impossible de compter deux fois un jour) ;
- chacun n'écrit que ses propres lignes ; un tricheur ne triche qu'avec **son** score ;
- les classements ne comptent que les membres d'un groupe où l'on est entré par un ami ;
- les valeurs n'ont aucun effet ailleurs (pas d'argent, pas de récompense).

Ce qui **resterait possible** : monter en tête d'un classement de groupe avec 604 pages par jour
(une personne qui lit réellement lit bien moins que cela dans une journée). Pistes pour
une version suivante, à décider : plafond par jour plus réaliste que 604 (à fixer avec le propriétaire) ; signaler
automatiquement les scores qui dépassent ce qu'une personne peut lire ; un propriétaire de
groupe qui peut retirer un membre (n'existe pas dans la spec) ; ne montrer les classements
qu'entre amis ; ne jamais y attacher de récompense. Le plafond de 604 de la spec reste la
borne appliquée.

### 7.3 Autres points à trancher

- **Les groupes montrent à tout membre le nom et les pages des autres**, amis ou non, bloqués ou
  non (plus que « le résumé du jardin » de la section 1). Même remarque que dans le README du
  domaine.
- **Un membre ajoute un ami à un groupe sans son accord** (la spec n'a pas d'invitation en
  attente). L'ajouté peut partir à tout moment.
- **Un code d'invitation sert à plusieurs personnes** jusqu'à son dernier jour (choix de
  l'architecte). Le propriétaire peut le retirer (`delete` sur `invites`).
- **Les noms** sont lisibles par toute personne connectée, non bloquée, qui connaît l'identifiant
  (rien n'oblige à être ami : règle 4). L'identifiant est un `uuid` aléatoire ; il est connu de
  qui partage un groupe, un code d'invitation ou une demande.
- **Les encouragements** : le jour d'un encouragement est envoyé par l'appli et accepté à un jour
  près (section 5). Une appli modifiée peut donc en envoyer jusqu'à trois par ami et par
  « jour » (hier, aujourd'hui, demain).
- **La création de comptes en masse** n'est pas limitée par ce fichier (voir 3.5).

## 8. Les tests

**Commande unique : `npm run db:test`** (cinq à dix secondes ; aucune connexion à un service).

- Un vrai PostgreSQL 17.12 est démarré par le paquet `embedded-postgres`
  (version `17.12.0-beta.19`, licence MIT, devDependency unique ; hors de `npm run check`). Il
  télécharge ses binaires à l'installation (`npm install`) ; rien d'autre n'est requis. Lancé en
  tant que `root` (conteneur, intégration continue), le paquet crée un utilisateur système
  `postgres` : PostgreSQL refuse de tourner sous `root`.
- `supabase/tests/shim.sql` **(réservé aux tests, jamais dans la migration)** remplace ce que
  Supabase fournit : `auth.users`, `auth.uid()` (lit les « claims » du jeton comme le fait l'API,
  de mémoire), les rôles `anon` et `authenticated`, et — pour prouver que la migration ne s'y fie
  pas — des droits par défaut très larges sur les nouvelles tables et fonctions.
- `supabase/tests/harness.mjs` démarre la base, applique le shim puis la migration, et donne à
  chaque test une transaction annulée à la fin. Chaque acteur agit pour de vrai : `SET ROLE
anon` ou `authenticated` avec une identité (`omar` propriétaire, `sarah` amie acceptée,
  `mustapha` inconnu, `taghread` bloquée, `anon` non connecté).
- `supabase/tests/social.test.mjs` : **88 tests en 12 groupes** (structure, une table ou un
  ensemble de règles par groupe). À la fin de chaque test, les contrôles différés (un seul
  propriétaire par groupe, c'est `owner_id`) sont réglés : chaque test prouve aussi que les
  données restent cohérentes.
- Une migration modifiée peut être essayée avec `SOCIAL_MIGRATION=/chemin/fichier.sql npm run
db:test` : c'est ainsi qu'on a vu des tests échouer quand une règle manque.

**Essais d'altération** (13 règles abîmées une par une dans une copie du fichier ; le test doit
alors échouer) : 12 sur 13 font échouer au moins un test. Exemple : remplacer la règle
d'insertion de `daily_readings` par `with check (true)` fait échouer « nobody writes someone
else's reading » (`Missing expected rejection: sarah: expected failure of: insert into
public.daily_readings ...`), alors que ce test passe sur la vraie migration. La treizième
altération (laisser changer `user_id` à la main sur une lecture) n'est pas détectée **parce que la
règle par ligne refuse déjà** : c'est le second verrou.

**Limites de ces tests**, à connaître :

- C'est PostgreSQL 17.12 seul : pas l'image de Supabase, pas l'API (PostgREST), pas
  l'authentification (GoTrue). Un test ne vérifie pas que `private` est caché de l'API, ni les
  réglages du projet, ni la façon dont le jeton est transmis à la base.
- Le shim est écrit de mémoire : si Supabase fait autrement, les tests resteront verts et la vraie
  base pourra différer. À refaire sur le vrai projet à la première mise en service (deux comptes
  d'essai, étape 4 de la section 6).
- Une seule connexion de test, en série : aucun test de concurrence (deux demandes d'amitié
  simultanées, par exemple ; les fonctions prennent des verrous de ligne, mais cela n'est pas
  testé).
- La base de test est créée en UTF8 avec le classement `C`. Les caractères sont comptés en points
  de code ; si le projet Supabase n'est pas en UTF8 (non vérifié), les noms accentués seront mal
  comptés.
- PGlite (PostgreSQL en WebAssembly) n'a pas été essayé : `embedded-postgres` a suffi.

## 9. Toutes les hypothèses et interprétations

À aligner avec le côté TypeScript. Les points marqués (A) viennent de l'architecte (message du
24 novembre) ; les autres sont des choix de l'auteur.

1. **Noms de tables et de colonnes** : ceux de `types.ts` en `snake_case`. Ajouts : la table
   `invite_attempts`. Pas de colonne en plus ailleurs.
2. **Identifiants** : `uuid`. (A) paire unique sur `least/greatest`, avec le classement `"C"` : pour
   des `uuid` c'est l'ordre des octets, le même que le classement `"C"` des écritures en
   minuscules.
3. **Nom** (A) : 1 à 30 points de code ; les listes d'espaces de bord et de caractères interdits sont
   celles de `config.ts`, écrites en toutes lettres. Les moitiés de paires (U+D800 à U+DFFF) ne peuvent
   pas exister dans une base UTF8. Le serveur **refuse** un nom avec des espaces au bord
   (`name_has_edge_spaces`, absent de `errors.ts`) au lieu de le rogner ; l'appli envoie le nom déjà
   rogné. Une écriture directe dans `profiles` ou `groups` qui échoue donne une violation de
   contrainte `profiles_display_name_valid` / `groups_name_valid` (code `23514`) ; pour avoir
   la raison fine, utiliser `create_group` (qui rend `name_empty`, etc.).
4. **Bornes** (A) : exactement celles listées. **Aucune borne haute inventée** sur `level`,
   `streak_days`, `badge_count`, `khatm_number` (seulement ≥ 1 ou ≥ 0, et la taille d'un entier).
5. **Demande d'amitié** (A) : délai de 7 jours à compter de `responded_on` (refusée le 1er, renvoyable le
   8). Renvoi après délai : la ligne est remplacée (nouvelle date, `responded_on` vide). Celui qui a
   refusé écrit tout de suite : la ligne change de sens. Renvoyer une demande déjà envoyée :
   `request_already_sent` (pas silencieux). Retirer : seulement une amitié acceptée.
6. **Blocage** (A) : retire amitié acceptée et demande en attente, garde la demande refusée. Après un
   blocage : ni demande, ni encouragement, ni code, ni ajout à un groupe, ni jardin ; le bloqué ne
   voit rien, pas même le nom ; le bloqueur reçoit `you_blocked_them`. **Divergence** : `block_user`
   supprime aussi les encouragements entre les deux (pour qu'un bloqué ne reste pas lisible) ; la
   règle 3 ne le dit pas. Un compte inexistant et un compte qui m'a bloqué donnent la même erreur
   `person_unavailable`.
7. **Ce qu'un ami voit** (A) : jardin si `show_garden` ; `level`, `badge_count` et badges si
   `show_level`. Par fonction pour le jardin, par règle pour les badges (section 3.3). `updated_on`
   suit le jardin.
8. **Code d'invitation** (A) : 8 caractères de l'alphabet de `config.ts` ; `expires_on = created_on + 7` ;
   valable **jusqu'à `expires_on` inclus** ; plusieurs personnes peuvent s'en servir ; strict (pas
   de majuscules automatiques). Qui tape le code est le demandeur de la ligne, le propriétaire le
   destinataire ; une demande en attente ou refusée entre les deux est remplacée. **Ajouts de
   l'auteur** : 5 codes vivants au plus par personne ; 10 essais ratés par heure ; réponse par texte
   plutôt que par erreur (section 3.4).
9. **Encouragement** : un par ami et par jour, toutes sortes confondues (A). Le jour est celui de l'expéditeur,
   accepté à un jour près du jour UTC du serveur. Ordre des refus : soi-même → `not_friends` ;
   blocage ; pas ami → `not_friends`.
10. **Groupe** : ajout immédiat par un membre qui est l'ami de l'ajouté (pas d'invitation en
    attente) ; 50 membres, propriétaire compris. Les refus à celui qui n'est pas membre sont
    `group_not_found` **dans tous les cas** (même pour un groupe qui existe), plus discret que
    `not-a-member` du domaine. Passation : plus petit `joined_on`, puis plus petit `user_id` (A) ; groupe
    vide supprimé ; un seul propriétaire, égal à `owner_id` (A, vérifié en fin de transaction).
11. **Classement** : 1, 1, 3 pour les égalités ; classés par rang puis identifiant ; période de
    366 jours au plus ; le nom vient de `profiles`, même pour des membres bloqués entre eux (section 7.3).
12. **Jours** (A) : aucun jour de l'appli après le jour UTC du serveur + 1. **Ajout** : pas avant 2020
    pour les lectures du jour (section 5).
13. **Suppression** (A) : toutes les lignes, y compris les blocages faits contre la personne et les
    encouragements dans les deux sens.
14. **Création du profil** : par l'appli, une insertion directe (`id` = soi-même) ; pas de
    déclencheur sur `auth.users` (non vérifié). Les fonctions répondent `profile_required` sans profil.
15. **Sauvegarde** : taille 2 Mo, objet JSON ; propriétaire seul (section 7.1).
16. **Pas de `force row level security`** : les fonctions `security definer`, propriétaires des
    tables, passent au-dessus des règles par ligne ; c'est leur rôle.
17. **Fonctions de l'API** : l'appel d'une fonction (`rpc`) est la seule porte pour les
    opérations à deux personnes. Les seules fonctions du schéma `private` ouvertes à
    `authenticated` sont celles que les règles par ligne et les contraintes appellent :
    `is_group_member` et `can_view_level` (elles ne répondent que sur l'appelant) et
    `name_problem` (sans effet de bord). Les autres aides (`assert_no_block`, `are_friends`...) ne
    sont appelables par personne.
