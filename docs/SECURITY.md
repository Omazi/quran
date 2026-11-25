# Sécurité et vie privée

## Principes

- **Le moins de données possible.** Sans compte, rien n'est envoyé. Avec un compte, seule la
  progression de la personne part vers son compte, pour elle seule (D43, `specs/sync.md`).
- **La voix reste sur le téléphone.** La reconnaissance est faite sur l'appareil ; aucun
  enregistrement n'est transmis ni conservé sans accord explicite.
- **Aucun secret dans l'application ni dans le dépôt.** Tout ce qui est embarqué dans une
  appli mobile est lisible : seules des clés publiques (`EXPO_PUBLIC_*`) y figurent. Les
  clés privées restent côté serveur.
- **Le serveur ne fait jamais confiance à l'appli.** Dès le lot 3 : règles d'accès par
  ligne (RLS) sur chaque table, refus par défaut, tests de ces règles.
- **Stockage local** : préférences et journal de lecture en stockage applicatif ; jetons de
  session dans le trousseau (`expo-secure-store`), jamais en clair.
- **Entrées non fiables** (liens profonds, codes QR, codes d'invitation, données serveur) :
  validées par un schéma avant usage.

## Exigences des boutiques, à prévoir

- Connexion Google proposée ⇒ « Se connecter avec Apple » obligatoire sur iOS.
- Compte créé dans l'appli ⇒ suppression du compte possible depuis l'appli.
- Micro : texte d'autorisation clair, demandé au moment de l'usage.
- Mode enfants : règles spécifiques (Apple Kids, Google Families) ; traité à part.

## Contrôles automatiques

- `npm audit --omit=dev` en intégration continue (échec dès une faille élevée).
- Revue de sécurité par un agent dédié avant chaque push (secrets, dépendances, entrées).

## Dépôt public

Le dépôt est public (D24). Tout ce qui y est poussé, historique compris, est lisible par tous.

- Aucun secret dans le dépôt, jamais : ni clé, ni certificat, ni mot de passe, ni jeton. Les
  clés Apple ne vivent que dans les secrets de GitHub, que personne ne peut relire.
- L'historique a été passé en revue avant l'ouverture (24 novembre 2026, 25 commits) : aucun
  secret, aucune adresse personnelle.
- La compilation sur Mac (`ios-check.yml`) n'a pas de déclencheur de demande de fusion. Une
  demande venue d'une copie du dépôt (un « fork ») peut toutefois modifier sa propre copie du
  script : ce qui l'arrête, c'est l'accord demandé avant de lancer les scripts d'un
  contributeur extérieur (réglage plus bas, à étendre à tous les contributeurs extérieurs).
  Les vérifications sous Linux (`ci.yml`) s'y lancent, avec un jeton en lecture seule et sans
  aucun secret. Un script qui lit un secret ne doit jamais se lancer sur une demande de fusion,
  ni publier son journal : les artefacts d'un dépôt public sont publics.
- Les versions des étapes fournies par GitHub sont figées par leur empreinte.
- Un seul script a le droit d'écrire dans le dépôt : `ios-screens.yml`, qui dépose les images
  des écrans sur la branche `ci-screens`. Décidé par le propriétaire le 24 novembre 2026,
  pour que ces images se regardent depuis un téléphone. Ce qui le borne :
  - il ne compile rien et n'installe aucune dépendance : il lance deux étapes fournies par
    GitHub, figées par leur empreinte, et un script du dépôt pris sur `main`. La compilation
    reste dans `ios-check.yml`, en lecture seule ;
  - il ne lit que l'artefact d'une vérification réussie du `main` de ce dépôt, lancée par un
    push ou à la main : une exécution venue d'un fork est refusée, à deux endroits ;
  - il traite cet artefact comme une donnée non sûre : seules les images dont le nom est dans `tools/ci/screens.py`
    sont gardées (une liste fixe, lue sur `main`), chacune lue jusqu'au bout pour vérifier que c'est un fichier PNG entier
    (`tools/ci/publish-screens.py`, avec un plafond de taille par image et au total) ; rien de ce qu'il contient n'est exécuté ;
  - le seul fichier qui n'est pas une image et qui est gardé est le rapport de la chasse au plantage, `crash-report.txt`
    (nom fixe de `tools/ci/screens.py`) : du texte UTF-8 de 200 Ko au plus, dont la première ligne est `VERDICT: ` suivi
    d'un mot connu, débarrassé des caractères non imprimables, affiché comme un simple lien (jamais interprété).
    Les `.ips`, les journaux du simulateur et le reste de `build/crash/` restent dans l'artefact (14 jours) ;
  - le script ne pousse que la branche `ci-screens`, qui ne contient rien d'autre. Son jeton,
    lui, pourrait écrire ailleurs : seule l'écriture du script l'en empêche. Une règle de
    protection de `main` (réglage du propriétaire, plus bas) fermerait cette porte ;
  - ce jeton n'existe que le temps de cette tâche.
- Les fichiers venus de tiers (texte et police du Coran) sont republiés tels quels, avec leur
  mention : voir `docs/DATA_SOURCES.md`. Leurs conditions de rediffusion restent à éclaircir.

## Signature et envoi sur TestFlight

Décision du propriétaire (D30) : l'envoi part du dépôt `Omazi/dishplay3d`, qui détient déjà
la clé Apple. Détail dans `TESTFLIGHT.md`. Ce qui protège cette clé :

- Le script ne se lance qu'à la main. Jamais sur un push, jamais sur une demande de fusion.
- Le dépôt DishPlay ne confie que trois secrets, nommés un par un (la clé d'accès, le
  certificat, son mot de passe). Ses autres secrets ne sont pas transmis.
- Seul un commit déjà présent sur la branche `main` de ce dépôt est compilé, et seuls les
  scripts de ce commit sont lancés. Le contrôle vise la branche par son nom complet : une
  étiquette (« tag ») nommée `main` ne passe pas pour elle.
- Deux tâches séparées. Celle qui compile lance npm, CocoaPods et les étapes de compilation
  de Xcode, donc du code de tiers : elle ne reçoit aucun secret. C'est garanti par la façon
  dont elle est écrite : elle est un script à part (`testflight-build.yml`), appelé sans lui
  confier le moindre secret, où que le dépôt qui lance l'envoi range les siens. Celle qui
  signe reçoit la clé et ne lance que les outils d'Apple, Python et les scripts de
  `tools/apple` (plus `tools/ci/select-xcode.sh`, qui n'y appelle que Xcode). Ces scripts
  n'utilisent que la bibliothèque standard de Python : rien n'est téléchargé à côté de la clé.
- L'archive qui passe d'une tâche à l'autre est contrôlée avant signature
  (`tools/apple/check-app.py`, avec ses tests) : une seule appli, qui est un vrai dossier
  atteint par de vrais dossiers, le bon identifiant, le bon numéro, aucune extension ni autre
  code rangé dedans (quel que soit le nom qu'on lui donne, lien compris), aucun lien qui sort
  de l'appli. Les mêmes questions sont reposées à l'appli signée, avant l'envoi.
- Le certificat vit dans un trousseau temporaire, retiré à la fin de la tâche avec le profil
  et la clé.
- Les journaux d'un dépôt public sont publics. Les scripts n'y écrivent ni nom, ni adresse,
  ni clé. Deux protections se recouvrent. D'abord, dès que le certificat est installé, le
  script donne à GitHub le nom de son titulaire et celui de l'équipe : GitHub les remplace
  alors par `***` dans tout ce que la tâche affiche ensuite, quelle que soit la phrase.
  Ensuite, le journal de Xcode n'est jamais publié en entier ; pendant la signature, rien de
  ce que dit `codesign` n'est montré ; et les lignes de Xcode, d'`altool` et d'une
  vérification de signature qui échoue passent par `tools/apple/redact.py`, qui masque le
  titulaire d'un certificat, une équipe nommée et les adresses.
- Aucun certificat n'est créé, modifié ni supprimé. Rien de DishPlay n'est lu ni modifié.

Ce qui reste vrai malgré tout, à savoir avant de s'en servir :

- **Qui peut écrire sur `main` de ce dépôt décide de ce qui tournera avec la clé Apple** au
  prochain lancement. Le fichier de DishPlay appelle le script de ce dépôt par le nom de sa
  branche, pas par un commit figé : rien n'est relu du côté de DishPlay. Aujourd'hui, trois
  choses peuvent écrire ici : le propriétaire, les sessions de travail qu'il ouvre, et le
  jeton du script `ios-screens.yml` (il ne pousse que la branche `ci-screens`, mais son droit
  d'écriture vaut pour tout le dépôt, sauf les scripts de `.github/workflows`). Deux réglages
  du propriétaire fermeraient cette porte : une règle qui réserve les mises à jour de `main`
  au propriétaire (plus bas), et un accord demandé à chaque usage de l'environnement
  `testflight` de DishPlay (ce réglage s'appliquerait aussi aux envois de DishPlay).
- N'importe quel commit déjà passé par `main` peut être envoyé, donc aussi une ancienne
  version de ces scripts. Aucune version antérieure à cette relecture n'a été poussée.
- L'identifiant de l'équipe, celui de la clé et celui de son émetteur s'affichent dans le
  journal public : ce sont des variables, que GitHub ne masque pas. Ce sont des repères, pas
  des clés ; l'envoi de DishPlay les montre de la même façon.
- Le masquage des noms ne couvre que le titulaire du certificat et l'équipe du profil, tels
  qu'Apple les écrit. Au premier envoi, le journal public a été relu : aucun nom, aucune
  adresse, aucune clé. Ce premier envoi n'a rencontré aucune erreur : les messages d'erreur,
  où un nom risque le plus d'apparaître, n'ont donc pas encore été vus en vrai.
- L'appli signée contient du code de tiers (c'est le cas de toute appli), et la clé de
  DishPlay sert désormais à deux applis.
- Seul le chemin normal a tourné sur un Mac ; les chemins de secours, non (voir
  `TESTFLIGHT.md`, « Limites connues »).

## Signaler un problème

Écrire au propriétaire du dépôt, sans ouvrir de ticket public.

Trois réglages GitHub restent à activer par le propriétaire, maintenant que le dépôt est public :

- Settings › Actions › General : demander son accord avant de lancer les scripts sur la
  demande de fusion de tout contributeur extérieur.
- Settings › Security : le signalement privé des failles, pour qu'un inconnu ait un moyen de
  prévenir sans rien publier.
- Settings › Rules › Rulesets : une règle sur `main` qui réserve ses mises à jour au
  propriétaire (ou impose une demande de fusion), interdit de forcer un push et de supprimer
  la branche. Interdire seulement le push forcé ne suffit pas : un push ordinaire sur `main`
  change déjà ce qui tournera avec la clé Apple. Et une règle qui interdit de créer une
  étiquette nommée `main` (GitHub la prendrait avant la branche pour choisir le script
  d'envoi).

## Sauvegarde et restauration de la progression

Décision du propriétaire : **changer de téléphone, ou supprimer l'appli puis la
retélécharger, doit ramener la personne là où elle en était** (D16).

Décision du propriétaire du 25 novembre 2026 (D43) : **toujours une sauvegarde locale et une
sauvegarde dans le compte**, synchronisées (`specs/sync.md`).

Le journal de lecture révèle une pratique religieuse. Sans compte, il ne quitte le téléphone que
vers les sauvegardes personnelles de la personne (son compte Apple ou Google). Avec un compte, il
est aussi gardé sur le serveur, pour elle seule : voir « Synchronisation avec le compte » plus bas.

| Cas                             | Android                                                 | iOS                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nouveau téléphone               | Sauvegarde automatique de Google (`allowBackup: true`)  | Sauvegarde iCloud ou transfert direct : le stockage de l'appli y est inclus (`RCTAsyncStorageExcludeFromBackup: false`)                           |
| Suppression puis réinstallation | Restauré à l'installation par la sauvegarde de Google   | **Pas couvert par la sauvegarde** : iOS efface les données d'une appli supprimée. Il faut une copie dans iCloud (à faire, voir `specs/backup.md`) |
| Avec un compte (tous les cas)   | Tout revient à la connexion, fusionné avec le téléphone | Tout revient à la connexion, fusionné avec le téléphone                                                                                           |

Limites à connaître : tout cela dépend des réglages de la personne (sauvegarde Google ou
iCloud activée). Rien n'est vérifié sur un appareil.
Les deux réglages d'`app.json` ont été relus dans les fichiers natifs produits par
`expo prebuild` (25 novembre 2026), et un test échoue si l'un disparaît.

## Synchronisation avec le compte

Détail : `specs/sync.md` ; tables et fonctions : `supabase/migrations/20261125120000_sync.sql`.

- **Propriétaire seul.** RLS sur `sync_events` et `sync_accounts` ; une personne connectée lit ses
  propres événements et rien d'autre ; personne n'écrit les tables directement ; `anon` n'a aucun
  droit. Les lignes sont supprimées avec le compte. Testé (`npm run db:test`, `sync.test.mjs`).
- **Le serveur ne fait pas confiance à l'appli.** `sync_push` contrôle chaque événement champ par
  champ, le réécrit avec ses seuls champs connus, refuse les jours impossibles, borne la taille (2 Ko
  par événement, 200 par appel, 100 000 par compte) et limite à 120 appels par minute. Un
  horodatage est ramené à un jour au plus après l'heure du serveur.
- **L'appli ne fait pas confiance au serveur.** Tout ce qui revient est recontrôlé
  (`parseSyncEvent`) puis passé par les règles du magasin ; une valeur refusée est ignorée.
- **Aucun secret dans l'appli ni dans le dépôt.** L'appli ne reçoit que l'URL du projet et sa clé
  publiable, publiques par nature : elles sont dans `app.json` (`expo.extra.supabase`), et des
  variables `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` peuvent les remplacer. La clé secrète (`service_role`) ne sort jamais du tableau de bord de Supabase. Le jeton de
  session viendra de Supabase Auth et sera gardé dans le trousseau, jamais dans le document.
- **Ce qui reste vrai** : le journal est lisible sur le serveur par qui détient la clé secrète du
  projet (le propriétaire, Supabase). Une appli modifiée ne peut écrire que dans son propre compte.
- **Identifiant de téléphone** : 20 caractères tirés au hasard, propres à l'appli, qui ne disent
  rien de l'appareil ; ils ne servent qu'à additionner le temps de plusieurs téléphones d'une même
  personne.
- **Non vérifié** : l'API REST et l'authentification réelles de Supabase (tests sur PostgreSQL
  seul, imitation écrite de mémoire). À refaire sur le vrai projet avec deux comptes d'essai.

## Notifications

Seules des notifications locales sont utilisées : l'envoi à distance est désactivé dans la
configuration, et aucun jeton n'est demandé.

## Micro et reconnaissance vocale (D42)

- **La voix ne quitte pas le téléphone.** Le micro (`modules/voice-capture`) envoie les
  échantillons à JavaScript, en mémoire ; Whisper (whisper.rn) les lit sur le téléphone. Aucun
  fichier audio n'est écrit, rien n'est envoyé. L'appli n'ouvre aucune connexion pour reconnaître
  la voix : le modèle est dans l'appli dès l'installation.
- **Un lien ne peut pas ouvrir le micro.** `quranapp://listening` et
  `quranapp://reader/<n>?follow=1` affichent l'écran, prêt, avec son bouton « Commencer l'écoute » ;
  seule la navigation interne (`markOpenedInApp`, `src/features/listening/in-app-open.ts`) démarre
  l'écoute d'elle-même. La marque vit en mémoire, elle ne peut pas venir d'une adresse.
- **Le micro n'est ouvert que sur l'écran qui écoute**, après l'alerte du système, demandée au
  moment de l'usage (texte en français, anglais, arabe : `app.json`, `assets/app-metadata`). Il se
  ferme dès que le passage est trouvé, au bouton « Arrêter », quand l'écran se ferme, quand
  l'appli passe en arrière-plan, et quand le système reprend le micro (appel, Siri). Pas de mode
  audio en arrière-plan. Micro refusé : l'écran renvoie vers les réglages du système.
- **Le modèle est vérifié à la compilation.** Il est téléchargé par le plugin du module pendant
  `npx expo prebuild`, et refusé si son SHA-256 n'est pas celui de `voice-model.json`. Le téléchargement est limité : https
  seulement (redirections comprises), jamais plus d'octets que `bytes` (le fichier est effacé avant
  le calcul de l'empreinte), 10 minutes au plus, arrêt si le flux se fige. Un modèle
  n'exécute pas de code, mais un fichier changé pourrait faire planter whisper.cpp ou tromper la
  reconnaissance : l'empreinte l'empêche d'entrer dans l'appli.
- L'appareil photo garde son seul usage (scanner un QR code) : il n'enregistre jamais de son. La
  clé `NSMicrophoneUsageDescription` est celle de l'appli, pas celle du plugin de l'appareil photo.
