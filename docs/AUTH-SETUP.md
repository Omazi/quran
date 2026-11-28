# Activer la connexion (Apple, Google, e-mail) — à faire par le propriétaire

Ce que **toi** tu dois faire dans les tableaux de bord pour que « Continuer avec Apple », « Continuer
avec Google » et « Continuer avec un e-mail » marchent. Tout est gratuit côté Supabase (offre
gratuite) et côté Google. Apple demande le compte développeur, que tu as déjà pour TestFlight.

**Règle d'or : aucun secret dans le dépôt, ni dans le chat.** Les secrets (le « Client Secret » de
Google, par exemple) se collent uniquement dans le tableau de bord de Supabase.

> **Pour l'instant (décision du 27 novembre 2026) : pas d'écran de connexion.** Le téléphone reçoit
> tout seul un compte anonyme ; les proches s'ajoutent par code ou QR code. Ce qu'il faut faire pour
> ça est dans la section « Connexion anonyme (pour les proches) », à la fin. Apple, Google et l'e-mail
> (sections 1 à 6) viendront plus tard.

Les identifiants de l'appli : identifiant (bundle) iOS et paquet Android `com.omazi.quran`, projet
Supabase `onjjwtegzeuajkcnzyvj`, adresse de retour `quranapp://`.

> Après ces étapes, il reste un travail de **code** (pas pour toi) : brancher la vraie connexion à la
> place de la démonstration, puis allumer le drapeau (étapes 5 et 6 ci-dessous).

## 1. Apple — developer.apple.com

1. Va dans **Certificates, Identifiers & Profiles › Identifiers**.
2. Ouvre l'identifiant de l'appli, `com.omazi.quran`.
3. Dans la liste des _Capabilities_, coche **Sign in with Apple**. Laisse vide le champ « Server-to-Server
   Notification Endpoint » (Supabase ne s'en sert pas).
4. Enregistre. Si Apple te le demande, régénère le profil de signature (_Profiles_) : l'appli est
   compilée sur GitHub, il faudra remettre le nouveau profil là où le certificat est gardé
   (`docs/BUILD.md`).
5. Rien d'autre pour Apple : pas de clé, pas de « Services ID », pas de secret. La connexion se fait
   dans l'appli, sans page web.

## 2. Google — console.cloud.google.com (gratuit)

1. Crée un projet (ou prends-en un) puis ouvre **APIs & Services › OAuth consent screen**. Choisis
   « Externe », mets le nom de l'appli (Jannatuk) et ton adresse e-mail. Publie l'écran (« In
   production »), sinon seuls tes comptes de test pourront se connecter.
2. Ouvre **Credentials › Create credentials › OAuth client ID** et crée **trois** identifiants :
   - **Web application** : donne un nom. Dans « Authorized redirect URIs », colle l'adresse de retour
     que Supabase affiche sur sa page Google (étape 4). Note l'**ID client** et le **secret** : ils vont
     dans Supabase, nulle part ailleurs.
   - **iOS** : le « Bundle ID » est `com.omazi.quran`.
   - **Android** : le nom du paquet est `com.omazi.quran`, plus l'**empreinte SHA-1** du certificat de
     signature (une pour les essais, une pour la version publiée).
3. Garde sous la main les trois ID clients (pas le secret) : tu en as besoin à l'étape 4.

## 3. Supabase — supabase.com/dashboard (projet `onjjwtegzeuajkcnzyvj`)

**Rappel : le projet est sur l'offre gratuite. Ne passe pas à un plan payant pour ça.**

### E-mail avec un code à 6 chiffres

1. **Authentication › Sign In / Providers › Email** : le fournisseur est déjà actif. Règle
   « Email OTP expiration » sur 600 secondes (10 minutes).
2. **Authentication › Emails › Templates › Magic Link** : dans le texte du message, mets la variable
   `{{ .Token }}` (c'est elle qui donne le code à 6 chiffres). Fais la même chose pour « Confirm
   signup » si le modèle existe (première connexion).
3. **Authentication › Rate Limits** : limite l'envoi d'e-mails et la création de comptes
   (`docs/specs/social-database.md`, 3.5).
4. Attention : l'envoi d'e-mails intégré de Supabase est **limité à très peu de messages par heure**
   (à vérifier dans la documentation de Supabase au moment de le faire). Pour de vrais utilisateurs, il
   faut brancher un petit service d'e-mail gratuit dans **Authentication › SMTP** (par exemple
   Resend ou Brevo : leurs offres gratuites suffisent au début, à vérifier).

### Apple

1. **Authentication › Sign In / Providers › Apple** : active le fournisseur.
2. Dans **Client IDs**, écris `com.omazi.quran`. Laisse le reste vide.
3. Enregistre.

### Google

1. **Authentication › Sign In / Providers › Google** : active le fournisseur.
2. Dans **Client IDs**, mets les trois ID clients de Google séparés par des virgules, l'ID du client
   **Web** en premier, puis iOS, puis Android.
3. Dans **Client Secret**, colle le secret du client **Web** (c'est le seul endroit où il va).
4. Active **Skip nonce check** (nécessaire pour iOS).
5. Sur cette même page, copie « Callback URL (for OAuth) » et colle-la dans le client Web de Google
   (étape 2.2). Enregistre.

### Adresses de retour

**Authentication › URL Configuration** : ajoute `quranapp://**` dans « Redirect URLs ».

## 4. Vérifier côté Supabase

- **Integrations › Data API** : le schéma `public` est exposé, `private` **ne l'est pas**.
- **Authentication › Users** : après un essai, le compte apparaît ici.
- Lance les conseillers de sécurité (**Advisors**) et regarde qu'il n'y a rien de rouge de nouveau.

## 5. Ce qui reste, côté code (pas pour toi)

1. Appliquer la migration `20261125120000_sync.sql` au projet (relue avant, par le coordinateur).
2. Brancher la vraie connexion (lot social) : remplacer la démonstration par Supabase Auth, et donner
   la session à la synchronisation (`session: null` dans `src/app/_layout.tsx`, `docs/specs/sync.md`
   § 7, étape 4).
3. Essai réel sur un iPhone : Apple, Google, un code par e-mail ; puis deux téléphones.

## 6. Allumer l'invitation à créer un compte

Quand les étapes 1 à 5 sont faites et essayées :

1. Dans `app.json`, mets `expo.extra.features.accountInvitation` à `true`.
2. Change la ligne qui garde `false` dans `src/features/home/__tests__/account-invitation.test.tsx`.
3. Publie une version TestFlight et vérifie : « Créer mon jardin » → la feuille « Ton jardin est
   prêt. » monte, Apple et Google connectent, « Plus tard » la ferme, et elle ne revient pas.

Ne l'allume **pas** avant : sans connexion qui marche, la feuille ne ferait que décevoir.

## Liste à cocher

- [ ] Apple : _Sign in with Apple_ activé pour `com.omazi.quran`
- [ ] Google : écran de consentement publié ; clients Web, iOS, Android créés
- [ ] Supabase : e-mail (modèle avec `{{ .Token }}`, expiration 10 min, limites réglées)
- [ ] Supabase : SMTP gratuit branché (avant de vrais utilisateurs)
- [ ] Supabase : Apple actif, Client ID `com.omazi.quran`
- [ ] Supabase : Google actif, trois ID, secret Web, _Skip nonce check_
- [ ] Supabase : `quranapp://**` dans les adresses de retour
- [ ] Code : vraie connexion branchée, essai sur iPhone
- [ ] `accountInvitation` mis à `true` (étape 6)

## Connexion anonyme (pour les proches)

Le téléphone crée tout seul, sans rien demander, un compte « anonyme » chez Supabase : pas
d'adresse, pas de mot de passe. Ce compte sert à ajouter des proches par code ou QR code et à
sauvegarder la progression dans le nuage. Tout est gratuit (offre gratuite de Supabase ; **ne passe
pas à un plan payant**).

### Ce que tu fais (une seule fois, 2 minutes)

1. Va sur **supabase.com/dashboard**, ouvre le projet `onjjwtegzeuajkcnzyvj`.
2. Menu de gauche : **Authentication › Sign In / Providers**.
3. En haut de la page, partie **User Signups** :
   - vérifie que **« Allow new users to sign up »** est allumé (il l'est par défaut) ;
   - allume **« Allow anonymous sign-ins »** ;
   - allume aussi **« Allow manual linking »** : ça ne change rien aujourd'hui, mais c'est ce qui
     permettra plus tard d'attacher Apple, Google ou un e-mail au compte anonyme **sans perdre** ses
     proches ni sa progression.
4. Clique sur **Save**.

C'est tout. Ne touche pas au reste.

### Le CAPTCHA : ne l'allume pas pour l'instant

Supabase recommande un CAPTCHA (hCaptcha ou Cloudflare Turnstile) contre les créations de comptes en
masse. **Mais l'appli crée le compte sans écran** : si tu allumes le CAPTCHA (**Authentication ›
Attack Protection › Enable Captcha protection**), Supabase refusera toutes les créations de compte
de l'appli, et plus personne ne pourra ajouter de proche. Il faudrait d'abord ajouter dans l'appli
une petite page de vérification (travail de code, à décider avec toi). Donc : **laisse le CAPTCHA
éteint**.

### Les limites (Authentication › Rate Limits)

- **Anonymous sign-ins** : 30 créations de compte par heure **et par adresse IP**, par défaut.
  Laisse 30. Ne descends pas plus bas : sur les réseaux mobiles, beaucoup de téléphones partagent la
  même adresse IP, et un nouveau proche pourrait être bloqué une heure.
- **Token refresh** : 1 800 par heure et par adresse IP (non réglable) : largement assez, l'appli
  renouvelle son jeton environ une fois par heure quand elle est ouverte.
- Le reste (e-mails, codes) ne concerne pas la connexion anonyme.

### Ce qui reste, côté code (pas pour toi)

Le drapeau `friendsAnonymous` (dans `app.json`) reste à `false` tant que tout ceci n'est pas fait :

1. Relire puis appliquer les migrations pas encore envoyées au projet :
   `20261126120000_profile_gender.sql` (le genre, absent du projet le 27 novembre 2026) et
   `20261127120000_anonymous_accounts.sql` (recherche par nom refusée aux comptes anonymes, nettoyage
   des comptes abandonnés). Puis lancer les conseillers de sécurité : l'avis « Anonymous sign-ins
   enabled » (lint 0012) est attendu, toutes les règles ont été relues pour les comptes anonymes.
2. Facultatif, conseillé : activer `pg_cron` (**Database › Extensions**) et planifier le nettoyage
   quotidien (la commande est à la fin de la migration).
3. Installer le trousseau du téléphone : `npx expo install expo-secure-store` (licence MIT), puis
   remplir `deviceSessionStorage` dans `src/data/auth/index.ts` (clé `supabase-anonymous-session`,
   `keychainAccessible: AFTER_FIRST_UNLOCK`, pour que la synchronisation marche aussi téléphone
   verrouillé). Sans lui, l'appli ne crée aucun compte, même drapeau allumé : le jeton n'est jamais
   écrit en clair (`docs/SECURITY.md`).
4. **Question pour toi** : le nom que tes proches verront. Il n'y a pas encore d'écran pour choisir
   son prénom ; en attendant, chaque compte s'appelle « Proche ». Il faut une maquette (un champ
   « Ton prénom » au premier ajout d'un proche ?) avant d'allumer le drapeau.
5. Publier son jardin pour que les proches le voient (`publishGardenSummary` existe, rien ne
   l'appelle encore) : sans ça, un proche voit le nom mais « jardin pas encore partagé ».
6. Essai réel sur deux téléphones (TestFlight) : ajout par code et par QR code, jardin visible, la
   ligne « Sauvegarde » dit « Synchronisé ».
7. Seulement alors : `friendsAnonymous` à `true`, et changer la ligne qui garde `false` dans
   `src/features/friends/__tests__/anonymous-account.test.tsx`.

### Plus tard : attacher Apple, Google ou un e-mail sans rien perdre

Le compte anonyme devient un compte normal en lui **attachant** une identité (« identity linking »,
d'où « Allow manual linking » plus haut) : même identifiant, donc mêmes proches, même progression.

- Apple ou Google, sur le téléphone : connexion native, puis on attache le jeton reçu au compte en
  cours (`linkIdentity` avec le jeton d'identité, dans la documentation de Supabase), au lieu de se
  connecter avec.
- E-mail : on ajoute l'adresse au compte en cours (`updateUser({ email })`), la personne tape le
  code reçu.
- Piège : si cet Apple, ce Google ou cet e-mail a **déjà** un compte, Supabase refuse de l'attacher.
  Il faut alors se connecter à l'ancien compte : la progression suit (la synchronisation envoie tout
  au nouveau compte), mais les proches du compte anonyme seraient perdus sans une petite fonction de
  fusion côté serveur, à écrire à ce moment-là.

### Liste à cocher (connexion anonyme)

- [ ] Supabase : « Allow anonymous sign-ins » allumé
- [ ] Supabase : « Allow manual linking » allumé
- [ ] Supabase : CAPTCHA laissé **éteint**
- [ ] Supabase : limite « Anonymous sign-ins » laissée à 30 par heure
- [ ] Code : migrations appliquées, trousseau installé, prénom décidé, essai sur deux iPhone
