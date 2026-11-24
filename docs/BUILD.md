# Compiler l'appli et l'installer sur un iPhone, sans Mac

Personne sur le projet n'a de Mac. L'appli se compile sur un Mac hébergé par GitHub (GitHub
Actions) et arrivera sur l'iPhone par TestFlight. Pas de compte Expo, pas de service de
compilation d'Expo (décision D24).

La méthode est celle de DishPlay, l'autre appli du propriétaire (`Omazi/dishplay3d`,
`docs/TESTFLIGHT.md`), qui compile, signe et envoie sur TestFlight de cette façon.

## Où on en est

| Étape                                | État                                                               |
| ------------------------------------ | ------------------------------------------------------------------ |
| Assembler le JavaScript pour iOS     | Vérifié le 24 novembre 2026 (1 605 modules, sans erreur)           |
| Générer le projet iOS natif          | Vérifié le 24 novembre 2026                                        |
| Compiler pour iPhone, sans signature | **Réussi** le 24 novembre 2026 sur un Mac de GitHub (19 min)       |
| Ouvrir l'appli dans le simulateur    | **Réussi** le même jour (44 min) ; images **pas encore regardées** |
| Signer et envoyer sur TestFlight     | **À écrire**, le jour où le propriétaire le demande                |

Les deux premières lignes ont été vérifiées sous Linux (`npx expo export --platform ios`,
`npx expo prebuild --platform ios --no-install`). Tout le reste a besoin d'un Mac.

Première exécution complète : `a61b16d`, exécution 45484558341, dès l'ouverture du dépôt.
Les trois tâches sont vertes (tests 3 min, iPhone 19 min, simulateur 44 min). Deux points
restent ouverts :

- Les quatre images du premier écran sont dans l'artefact `ios-first-screen`, mais la
  session de travail de l'assistant n'a pas le droit de joindre l'hôte où GitHub range les
  artefacts (`*.blob.core.windows.net`). Personne ne les a donc encore regardées. Le
  propriétaire peut les télécharger depuis la page de l'exécution.
- GitHub signale que `actions/upload-artifact` v4.6.2 vise Node 20, qui est déprécié : à
  remplacer par une version plus récente, épinglée de la même façon.

## La vérification de compilation

`.github/workflows/ios-check.yml`, à chaque push sur `main` ou à la main (Actions › iOS
check › Run workflow). Aucun secret, rien n'est envoyé à Apple.

- **iPhone build** : génère le projet iOS, installe les pods, compile pour iPhone sans
  signature, puis vérifie le contenu de l'appli (identifiant `com.omazi.quran`, JavaScript
  embarqué, police du Coran présente). C'est lui qui décide du résultat.
- **First screen** : compile pour le simulateur, ouvre l'appli et garde une image de son
  premier écran en français (clair et sombre), en anglais et en arabe. Les images sont dans
  l'artefact `ios-first-screen` de l'exécution. Il ne bloque jamais : les images sont faites
  pour être regardées.

Le Xcode utilisé est le plus récent installé sur la machine, hors versions bêta
(`tools/ci/select-xcode.sh`) ; le journal de chaque exécution dit lequel.

**Pourquoi le dépôt est public** : sur un dépôt privé, GitHub refusait de démarrer la moindre
machine (paiement ou plafond de dépense du compte). Sur un dépôt public, les machines
standard sont gratuites. Si le dépôt redevient privé, chaque compilation sur Mac compte dix
fois son temps dans le quota du compte : ne plus la lancer à chaque push.

## L'envoi sur TestFlight (plus tard)

Rien n'est encore écrit. Le jour venu, on reprend les scripts de DishPlay
(`ios/ci/install-signing.py`, `tools/asc_profile.py`, `tools/asc_testflight.py`,
`ios-testflight.yml`), adaptés à une appli Expo.

Ce qui existe déjà côté Apple et se réutilise, parce que cela vaut pour tout le compte : la
clé de l'API App Store Connect et le certificat de distribution. Ce qui est propre à cette
appli : sa fiche dans App Store Connect et son profil de signature.

À faire par le propriétaire, parce que cela passe par ses identifiants :

1. Créer la fiche de l'appli dans App Store Connect (Apps › + › New App), avec l'identifiant
   `com.omazi.quran`. **Cet identifiant devient définitif à ce moment-là.**
2. Ranger dans le dépôt `Omazi/quran` (Settings › Secrets and variables › Actions) les mêmes
   valeurs que dans `dishplay3d`, sous les mêmes noms :

   | Type     | Nom                                                                                         |
   | -------- | ------------------------------------------------------------------------------------------- |
   | Variable | `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_ISSUER_ID`                                          |
   | Secret   | `APP_STORE_CONNECT_API_KEY`, `IOS_DISTRIBUTION_P12_BASE64`, `IOS_DISTRIBUTION_P12_PASSWORD` |

   Les variables se relisent dans les réglages de `dishplay3d`. Les secrets ne se relisent
   pas : il faut les fichiers d'origine (`AuthKey_….p8`, le `.p12` et son mot de passe). S'ils
   sont perdus, on crée une deuxième clé chez Apple (l'ancienne continue de servir à DishPlay)
   et un nouveau certificat.

Ne jamais copier une clé, un certificat ou un mot de passe dans une conversation ni dans le
dépôt.

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

## Version d'essai et version publiée

Une compilation faite avec la variable `EXPO_PUBLIC_STATE_PREVIEW=1` affiche en bas de
l'onglet Jardin la section « Aperçu », qui fait passer le jardin d'un état à l'autre. La
version publiée se compile sans cette variable et ne contient pas cet aperçu
(`src/features/home/state-preview.ts`).

## Ce qui n'est pas encore activé

- La copie de la progression dans iCloud : voir `docs/specs/backup.md`, « Activation ».
- L'identifiant `com.omazi.quran` et le nom « Quran App » sont provisoires tant que la fiche
  de l'appli n'est pas créée.
