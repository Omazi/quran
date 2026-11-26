# Activer la connexion (Apple, Google, e-mail) — à faire par le propriétaire

Ce que **toi** tu dois faire dans les tableaux de bord pour que « Continuer avec Apple », « Continuer
avec Google » et « Continuer avec un e-mail » marchent. Tout est gratuit côté Supabase (offre
gratuite) et côté Google. Apple demande le compte développeur, que tu as déjà pour TestFlight.

**Règle d'or : aucun secret dans le dépôt, ni dans le chat.** Les secrets (le « Client Secret » de
Google, par exemple) se collent uniquement dans le tableau de bord de Supabase.

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
