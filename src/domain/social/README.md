# Comptes et proches (social)

Règles métier des comptes, des proches, des groupes et des classements, et interfaces
(`AuthGateway`, `SocialRepository`) que `src/data/social` met en œuvre sur de fausses données.
Spécification : `docs/specs/social.md` ; décisions D23, D25, D33, D36.

TypeScript pur, fonctions pures, temps et hasard injectés. Tout passe par `index.ts`.

## Le principe : le lien d'une paire (`Bond`)

Une paire de personnes = une ligne d'amitié au plus (dans un sens ou dans l'autre) + au plus un
blocage par sens. Les règles d'une paire (demande, blocage, code, encouragement, groupe) prennent
le `Bond` de la paire et rendent le `Bond` qu'elle devient. Qui stocke lit le lien avec
`bondBetween(tables, a, b)`, appelle la règle, puis réécrit avec `replaceBond`.

## Règles → fonctions

| Règle                    | Fonctions                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| 1 Nom affiché            | `parseDisplayName`, `createProfile`, `applyProfileChanges`                                               |
| 2 Demande d'amitié       | `requestFriendship`, `acceptFriendRequest`, `declineFriendRequest`, `removeFriendship`                   |
| 3 Blocage                | `blockPerson`, `unblockPerson`, `isBlockedEitherWay`, `hasBlocked`                                       |
| 4 Ce qu'un autre voit    | `viewOf(owner, viewerId, bond)` → `SelfView`, `FriendView`, `OtherView` ou `null`                        |
| 5 Résumé du jardin       | `toGardenSummary`, `toBadge`, `toBadges`                                                                 |
| 6 Code d'invitation      | `parseInviteCode`, `generateInviteCode`, `createInvite`, `acceptInvite`, `inviteLink`, `parseInviteLink` |
| 7 Encouragement          | `sendNudge`                                                                                              |
| 8 Groupe                 | `createGroup`, `addGroupMember`, `leaveGroup`, `removeGroupMember`                                       |
| 9 Classement             | `periodRange`, `computeLeaderboard`, `toDailyReading`                                                    |
| 10 Suppression du compte | `deleteAccountData`                                                                                      |
| 11 Recherche par nom     | `parseSearchQuery`, `normalizeSearchText`, `matchesSearchQuery`, `searchRelation`, `searchPeople`        |
| Connexion                | `parseEmail`, `parseEmailCode`, `signInProvidersFor`                                                     |

Un refus de règle est une `SocialRuleError` (sous-classe de `RangeError`) avec une `reason`
(`SocialRefusal`) que l'écran traduit. Une valeur que seul un bogue ou une donnée abîmée peut
produire (mauvais type, date impossible, nombre hors bornes) lève un `TypeError` ou `RangeError`
simple. Rien n'est jamais corrigé en silence.

## Hypothèses (à confirmer)

- **Une ligne par paire, renvoi.** Une demande refusée reste en base (statut `declined`) : c'est
  ce qui fait attendre l'expéditeur. Un renvoi, après le délai, **remplace** la ligne (nouvelle
  demande, nouvelle `createdOn`). Celui qui a refusé peut demander tout de suite (la ligne
  change de sens). Retirer une amitié supprime la ligne ; on ne retire pas une ligne refusée.
- **Blocage et lignes.** Bloquer supprime l'amitié et la demande en attente, mais **garde** une
  ligne refusée (sinon bloquer puis débloquer effacerait l'attente). Débloquer ne rend pas
  l'amitié.
- **Le blocage ne se voit pas.** Le bloqué reçoit `person-unavailable` (comme pour un compte qui
  n'existe pas) ; celui qui a bloqué reçoit `you-blocked-them`.
- **Ce qu'un non-proche voit :** le nom seulement (règle 4). Une demande en attente ou refusée
  n'est pas une amitié.
- **Code d'invitation :** 8 caractères d'un alphabet de 31 (sans 0 O 1 I L), valable 7 jours
  (le 24 ⇒ jusqu'au 1er inclus), **utilisable par plusieurs personnes** jusqu'à son terme. Il
  est strict : pas de majuscules automatiques (c'est l'écran qui met en capitales). Le hasard est
  injecté (`generateInviteCode(randomIndex)`) ; le vrai doit être cryptographique. Qui tape le
  code est le demandeur de la ligne, le propriétaire le destinataire ; un code passe outre une
  demande refusée (le propriétaire l'a donné).
- **Lien du QR code (D36) :** `quranapp://invite/<CODE>` ; `parseInviteLink` accepte cette forme
  exacte ou un code seul, et refuse tout le reste avec `invite-code-malformed` (pas de nouvelle
  raison : l'écran dit « ce n'est pas une invitation »). Rien n'est rogné : un espace ou un saut de
  ligne après le lien le fait refuser. Un test garde `INVITE_LINK_PREFIX` égal au schéma d'`app.json`.
- **Recherche par nom (D36, règle 11) :** les mots d'un nom sont séparés par les espaces, `-`, `.`,
  `,`, `_`, `'` et `’` ; la requête de plusieurs mots trouve des mots qui se suivent (« al s » trouve
  « Omar Al-Sayed ») ; arabe : voyelles et tatweel ignorés, alef, ى, ة, ی, ک unifiés (les hamzas
  tombent d'elles-mêmes à la décomposition NFD) ; relation d'une demande refusée = `none`. Pas
  de réglage « ne pas me trouver » (option pour plus tard, D36). Le
  démonstrateur ne limite pas le nombre de recherches : c'est une règle du serveur
  (`too-many-searches`). Le tri est par nom normalisé puis identifiant, comparé en points de code
  UTF-16 (côté serveur, en classement `"C"`).
- **Encouragement :** un par ami et par jour **toutes sortes confondues** ; le jour est celui de
  l'expéditeur.
- **Groupe :** l'invité est ajouté tout de suite (pas d'état « invitation en attente » : la
  section 2 n'en a pas). Le plus ancien membre = plus petit `joinedOn`, puis plus petit
  identifiant (les dates n'ont pas d'heure : il faut un départage). Un propriétaire seul qui
  part emporte le groupe.
- **Classement :** semaine du lundi au dimanche, mois civil du jour donné ; égalités : 1, 1, 3,
  listées par identifiant. Toute ligne `DailyReading` est contrôlée, même hors période.
- **Suppression :** idempotente (rejouable). Supprime aussi les blocages faits _contre_ la
  personne.
- **Publication :** `toGardenSummary` refuse `lastWateredOn` après aujourd'hui ;
  `toDailyReading` refuse un jour après aujourd'hui.
- **Adresse e-mail :** ASCII seulement pour l'instant ; aucune correction (l'écran retire les
  espaces).

## Ce que le serveur doit reproduire exactement

Voir `docs/specs/social-database.md` (livrable C). Points sensibles :

- noms de tables et de colonnes : ceux de `types.ts` en `snake_case` ;
- bornes : `SOCIAL_CONFIG` (30 caractères de nom comptés en points de code, 604 pages, 60 hizb,
  50 membres, 7 jours d'attente, code de 8 caractères de `INVITE_CODE_ALPHABET`, 7 jours de
  validité, `expiresOn` incluse) ;
- paire d'amitié unique : index unique sur `(least(a, b), greatest(a, b))` **avec le même
  classement que les identifiants** (en `collate "C"` si ce sont des textes) ;
- caractères interdits et espaces de bord d'un nom : listes de `config.ts`, pas la classe
  « caractère de contrôle » du moteur ;
- ordre du « plus ancien membre » : `joined_on`, puis `user_id` ;
- un blocage refuse avec la même réponse qu'un compte inexistant.

## Règles qu'un serveur ne peut pas faire respecter (à décider)

- **Les jours viennent du téléphone.** Un « un par jour » (encouragements), un
  `DailyReading` ou `lastWateredOn` sont crus sur parole : une appli modifiée peut mentir. Le
  serveur peut borner (jour = jour UTC du serveur ± 1) mais pas vérifier.
- **Les pages lues** du classement ne se vérifient pas non plus (déjà noté en section 5).
- **Le classement montre à tout membre** le nom et les pages de tous les autres membres, amis ou
  non, même bloqués entre eux : plus que « le résumé du jardin » de la section 1. **Accepté par le
  propriétaire le 25 novembre 2026 (D36).**
- **Ajout à un groupe sans accord** de l'invité : il expose son nom et ses pages à des membres
  qu'il ne connaît pas. **Accepté par le propriétaire (D36).**
- **La recherche par nom** rend un nom trouvable sans connaître l'identifiant ; bornée, mais un
  moissonnage lent par des comptes jetables reste possible (voir `docs/specs/social-database.md`, 3.6).
