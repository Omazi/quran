# Compiler l'appli et l'installer sur un iPhone, sans Mac

Personne sur le projet n'a de Mac. L'appli se compile sur un Mac hébergé par GitHub (GitHub
Actions) et arrivera sur l'iPhone par TestFlight. Pas de compte Expo, pas de service de
compilation d'Expo (décision D24).

La méthode est celle de DishPlay, l'autre appli du propriétaire (`Omazi/dishplay3d`,
`docs/TESTFLIGHT.md`), qui compile, signe et envoie sur TestFlight de cette façon.

## Où on en est

| Étape                                | État                                                                |
| ------------------------------------ | ------------------------------------------------------------------- |
| Assembler le JavaScript pour iOS     | Vérifié le 24 novembre 2026 (1 605 modules, sans erreur)            |
| Générer le projet iOS natif          | Vérifié le 24 novembre 2026                                         |
| Compiler pour iPhone, sans signature | **Réussi** le 24 novembre 2026 sur un Mac de GitHub (19 min)        |
| Ouvrir l'appli dans le simulateur    | **Réussi** le même jour (44 min) ; images regardées (voir plus bas) |
| Signer et envoyer sur TestFlight     | **Réussi** le 25 novembre 2026 (version `20261125.136`)             |

Les deux premières lignes ont été vérifiées sous Linux (`npx expo export --platform ios`,
`npx expo prebuild --platform ios --no-install`). Tout le reste a besoin d'un Mac.

Première exécution complète : `a61b16d`, exécution 45484558341, dès l'ouverture du dépôt.
Les trois tâches sont vertes (tests 3 min, iPhone 19 min, simulateur 44 min). Deux points
restent ouverts :

- Les quatre images du premier écran sont dans l'artefact `ios-first-screen`, mais la
  session de travail de l'assistant n'a pas le droit de joindre l'hôte où GitHub range les
  artefacts (`*.blob.core.windows.net`). Le script `ios-screens.yml` les dépose donc sur la
  branche [`ci-screens`](https://github.com/Omazi/quran/tree/ci-screens), où elles se
  regardent depuis un téléphone (voir `SECURITY.md`, « Dépôt public »).
- Ce que montrent ces images (exécution 45484558341) : l'appli se lance, en français clair
  et sombre, en anglais et en arabe (mise en page inversée, point courant à droite). L'écran
  est l'aperçu des états du jardin ; l'image du jardin y est un rectangle gris, parce que le
  jardin n'a pas encore ses images. À corriger : en anglais, « Bare Earth » dans le titre et
  « Bare earth » dans l'image.
- GitHub signale que `actions/upload-artifact` v4.6.2 vise Node 20, qui est déprécié : à
  remplacer par une version plus récente, épinglée de la même façon.

## La vérification de compilation

`.github/workflows/ios-check.yml`, à chaque push sur `main` ou à la main (Actions › iOS
check › Run workflow). Aucun secret, rien n'est envoyé à Apple.

- **iPhone build** : génère le projet iOS, installe les pods, compile pour iPhone sans
  signature, puis vérifie le contenu de l'appli (identifiant `com.omazi.quran`, JavaScript
  embarqué, police du Coran présente). C'est lui qui décide du résultat.
- **First screen** : compile pour le simulateur, ouvre l'appli sur chacun de ses écrans et en
  garde une image : les 16 pages de l'introduction (français clair et sombre, arabe clair, la
  première en anglais), puis, avec un jardin et des proches de démonstration, le jardin, l'onglet
  Coran, le lecteur (écriture uthmani et simple), l'écoute (prête, micro éteint), l'onglet Proches,
  le jardin d'un proche, le profil et les réglages (français clair et sombre), et le jardin en
  anglais et en arabe. La liste est `tools/ci/screens.py`. Les images sont dans l'artefact
  `ios-first-screen` de l'exécution, puis sur la branche `ci-screens`. Il ne bloque jamais : les
  images sont faites pour être regardées, et une image est prise même si un écran n'a pas pu
  s'ouvrir.

### Contrôle des écrans

Cette tâche compile l'appli avec `EXPO_PUBLIC_SCREEN_CHECK=1` (`ios-check.yml`, et nulle part
ailleurs : ni `testflight.yml`, ni `testflight-build.yml`, ni le workflow de DishPlay qui les
appelle ; un test de l'appli le vérifie). Cette version comprend des arguments de lancement
(`xcrun simctl launch … -screenCheckGo reader -screenCheckPage 3 -screenCheckScript imlaei
-screenCheckSeed demo`) qui ouvrent un écran précis, sautent l'animation de lancement et, avec
`demo`, remplissent l'appli (historique de lecture, temps passé, proches de démonstration
connectés). L'adresse `/onboarding?page=N` (de 1 à 16) n'est lue que dans cette version. Sans la
variable, rien de cela n'existe dans le paquet (`src/features/screen-check/door.ts`) : les
arguments et le paramètre sont ignorés. L'écoute s'ouvre sans lancer le micro, comme pour tout
lien. Les pages de l'introduction se photographient avant le remplissage (ensuite l'introduction
n'est plus qu'une relecture) ; le nombre de pages est dans `tools/ci/screens.py`.

Un push ne lance les Mac que s'il touche à ce dont l'appli est faite (`src/`, `assets/`,
`modules/`, `app.json`, les dépendances, le script lui-même). La documentation seule ne
lance rien : une vérification prend environ 45 minutes de Mac.

Le Xcode utilisé est le plus récent installé sur la machine, hors versions bêta
(`tools/ci/select-xcode.sh`) ; le journal de chaque exécution dit lequel.

**Pourquoi le dépôt est public** : sur un dépôt privé, GitHub refusait de démarrer la moindre
machine (paiement ou plafond de dépense du compte). Sur un dépôt public, les machines
standard sont gratuites. Si le dépôt redevient privé, chaque compilation sur Mac compte dix
fois son temps dans le quota du compte : ne plus la lancer à chaque push.

## L'envoi sur TestFlight

Écrit le 24 novembre 2026, à la demande du propriétaire : voir `docs/TESTFLIGHT.md`. L'envoi
part du dépôt `dishplay3d`, qui détient déjà la clé Apple (D30). Le premier envoi a réussi :
la version `20261125.136` est dans TestFlight. La fiche de l'appli existe dans App Store
Connect, donc l'identifiant `com.omazi.quran` est maintenant définitif pour elle.

## Quoi regarder en premier sur l'iPhone

Liste tirée de la relecture design, dans l'ordre :

1. Premier lancement en mode clair : les pages remplissent-elles l'écran, les points de
   pagination s'affichent-ils, les interrupteurs et les sélecteurs d'heure répondent-ils ?
2. La dernière page : la note, le bouton, la demande d'autorisation du système, l'arrivée
   sur le jardin.
3. L'onglet Jardin : une seule zone qui défile ? La scène, les lignes et le bouton
   s'affichent-ils dans la liste ? Quelque chose passe-t-il sous la barre d'onglets ?
4. La même chose en mode sombre (le libellé du bouton principal doit rester lisible).
5. La taille de texte au maximum.
6. Le téléphone en arabe : redémarrage au premier lancement, onglets et pages en miroir.

## La reconnaissance vocale (D42)

Trois pièces natives entrent dans l'appli avec la reconnaissance vocale :

- **whisper.rn 0.7.4** (npm, MIT) : Whisper sur le téléphone (whisper.cpp 1.9.3, Metal sur
  iPhone). Module « Turbo » de React Native, relié automatiquement ; iOS 13 au minimum, l'appli
  vise iOS 16.4. Par défaut il apporte un `rnwhisper.xcframework` déjà compilé (3,5 Mo pour
  l'iPhone) : rien n'est compilé de whisper.cpp sur le Mac de GitHub.
- **`modules/voice-capture`** (module local de l'appli, Swift) : le micro, converti en 16 kHz.
  Relié automatiquement comme les autres modules de `modules/` (il n'est pas dans
  `expo.autolinking.exclude`). Voir son `README.md`.
- **Le modèle** `ggml-quran-tiny-q8_0.bin` (43,5 Mo), copié dans l'appli par le plugin du module.

Vérifié sous Linux le 25 novembre 2026 (copie temporaire, `npx expo prebuild --platform ios
--no-install`) : le projet iOS contient le modèle (empreinte vérifiée) dans les ressources de la
cible, `NSMicrophoneUsageDescription` dans `Info.plist` (français) et dans les
`InfoPlist.strings` anglais, français et arabe ; l'autoliaison trouve `whisper.rn` et
`voice-capture`. **Pas vérifié** : la compilation par Xcode 26.6 (aucun Mac ici) ; la première
exécution de `ios-check.yml` ou de l'envoi TestFlight le dira. Points à regarder dans son journal
si elle échoue : `VoiceCaptureModule.swift` (jamais compilé), les en-têtes `RCTBridge+Private.h`
utilisés par whisper.rn pour installer ses fonctions JSI (présents dans React Native 0.88).

### Le modèle de la voix

Le fichier n'est pas dans le dépôt. Pendant `npx expo prebuild`, le plugin
(`modules/voice-capture/app.plugin.js`) le télécharge à l'adresse de
`modules/voice-capture/voice-model.json`, vérifie sa taille et son SHA-256
(`ef01ab44…8b52`), le garde dans `node_modules/.cache/voice-model` et le place dans le projet
iOS. Un fichier qui ne correspond pas est refusé et la compilation s'arrête, avec l'adresse et la
raison. Le Mac de GitHub le télécharge à chaque compilation (43,5 Mo).

On voit qu'il est entré, à trois endroits :

- le journal de `expo prebuild` affiche `voice model ok: 43537433 ef01ab44…` une fois le fichier
  placé **et revérifié** dans `ios/<App>/` ; le plugin vérifie aussi que le projet Xcode le copie
  dans l'appli (« Copy Bundle Resources ») et arrête la compilation sinon ;
- après la compilation, `tools/ci/check-voice-model.sh` vérifie le fichier **dans l'appli
  construite** (taille et SHA-256), dans `ios-check.yml` et `testflight-build.yml` ;
- sur l'iPhone, Réglages → appui long sur « Version » : le diagnostic de la voix dit si le
  fichier est dans l'appli et sa taille, si Whisper l'a chargé, l'état du micro, le dernier
  niveau, la dernière transcription et la dernière erreur.

- Hors ligne : `VOICE_MODEL_FILE=/chemin/ggml-quran-tiny-q8_0.bin` (toujours vérifié).
- Derrière un proxy (la session de l'assistant) : `NODE_USE_ENV_PROXY=1`.
- Changer de modèle : nouveau fichier, nouvelle taille, nouvelle empreinte dans
  `voice-model.json`, et D42 à mettre à jour.

Le modèle est hébergé dans le dépôt du propriétaire, sur la branche `voice-model` de
`Omazi/quran` (hors de l'historique de `main`), décision du propriétaire du 25 novembre 2026 ;
la publication du tiers qui l'a converti (`mano270699/watazawwadu-models`, sans modification du
modèle de Tarteel, Apache-2.0) reste en seconde adresse. L'empreinte refuse tout fichier changé.

## Version d'essai et version publiée

Une compilation faite avec la variable `EXPO_PUBLIC_STATE_PREVIEW=1` affiche en bas de
l'onglet Jardin la section « Aperçu », qui fait passer le jardin d'un état à l'autre. La
version publiée se compile sans cette variable et ne contient pas cet aperçu
(`src/features/home/state-preview.ts`).

La même variable garde le moteur vocal simulé : `/listening?scenario=…` et
`/voice-follow?…&scenario=follow` rejouent un scénario, pour les tests et les captures. Sans
scénario, même une version d'essai écoute avec le vrai micro. La version publiée (TestFlight) n'a
que le vrai moteur (`src/features/listening/speech-engine-door.ts`).

## Ce qui n'est pas encore activé

- La copie de la progression dans iCloud : voir `docs/specs/backup.md`, « Activation ».
- La fiche de l'appli a été créée par le propriétaire. Le nom qu'elle porte chez Apple n'a pas
  été relu d'ici : à confirmer avec lui que c'est bien « Jannatuk » (D31).
