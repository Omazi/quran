# Envoyer l'appli sur TestFlight

Une seule commande envoie l'appli : le script `TestFlight`
(`.github/workflows/testflight.yml`). Il se lance à la main, jamais sur un push ni sur une
demande de fusion.

| Étape                                           | État                                                      |
| ----------------------------------------------- | --------------------------------------------------------- |
| Scripts écrits, testés sans Mac                 | Fait (42 tests, `tools/apple/test_*.py`)                  |
| Signature et envoi sur un Mac de GitHub         | **Jamais encore exécutés**                                |
| Fiche de l'appli dans App Store Connect         | **À créer par le propriétaire**, une fois (voir plus bas) |
| Appli installée depuis TestFlight sur un iPhone | Pas encore                                                |

## Pourquoi l'envoi part du dépôt DishPlay

Signer une appli demande la clé Apple du propriétaire. Elle est enregistrée dans les réglages
du dépôt `Omazi/dishplay3d` (environnement `testflight`), et GitHub ne permet ni de relire un
secret ni de le copier vers un autre dépôt. Le propriétaire a donc décidé, le
24 novembre 2026, que l'envoi de l'appli Coran partirait de ce dépôt-là (D30).

Ce que cela veut dire, précisément :

- `dishplay3d` contient un seul fichier pour nous : `.github/workflows/quran-testflight.yml`,
  quelques lignes qui appellent le script de ce dépôt-ci et lui confient trois secrets, nommés
  un par un. Aucun fichier de DishPlay n'est lu, compilé ni modifié.
- Tout ce que fait l'envoi est écrit ici, dans `Omazi/quran`, et relu ici.
- L'appli Coran a son identifiant (`com.omazi.quran`) et sa fiche. Une version de l'une ne
  peut pas arriver dans la fiche de l'autre : Apple range chaque envoi d'après l'identifiant
  inscrit dans l'appli signée, et le script refuse de signer autre chose que cet identifiant.
- Ce qui est partagé avec DishPlay, parce que cela appartient au compte et non à une appli :
  la clé d'accès à App Store Connect et le certificat de distribution. Le script s'en sert
  sans jamais créer, modifier ni supprimer de certificat. Il ajoute deux objets qui ne
  concernent que l'appli Coran : son identifiant et son profil de distribution.
- Pour revenir en arrière : supprimer ce fichier de `dishplay3d`.
- Ce fichier se pousse avec la mention `[skip ci]` dans le message du commit : à l'ajout, à
  chaque modification, et le jour où on le retire. Sans elle, la vérification iOS de DishPlay
  se lancerait : son script de tri (`ios/ci/check-plan.py`) range tout fichier de
  `.github/workflows/` du côté de l'appli. Vérifié le 24 novembre 2026 en lançant ce script
  sur ce seul fichier. Avec la mention, GitHub ne lance aucun script sur ce push ; le
  lancement à la main n'est pas touché.

Deux dépendances à connaître :

- `dishplay3d` doit être public au moment de l'envoi, sinon les Mac de GitHub sont comptés
  sur le forfait du compte (voir `BUILD.md`).
- Si un jour la clé est rangée aussi dans ce dépôt-ci (mêmes noms, voir plus bas), le même
  script se lance d'ici et le fichier de `dishplay3d` peut disparaître.

## Ce que fait le script

1. **Vérifier le côté Apple** (Linux). La clé répond-elle ? L'identifiant est-il enregistré
   (il l'est sinon) ? La fiche de l'appli existe-t-elle ? Sans fiche, le script s'arrête là
   et le dit : aucun Mac n'est lancé pour rien.
2. **Compiler** (Mac, aucun secret). Même compilation que la vérification iOS, rangée dans
   une archive non signée.
3. **Signer et envoyer** (Mac, avec la clé). L'archive est d'abord contrôlée : c'est bien
   cette appli, ce numéro, et rien d'autre. Le certificat est installé dans un trousseau
   temporaire, le profil est retrouvé ou créé, l'archive est signée, l'appli signée est
   contrôlée à son tour, puis envoyée à Apple. Tout est retiré de la machine à la fin.
4. **Attendre Apple** (Linux). Le groupe de testeurs internes « Coran - Tests internes » est
   créé s'il manque, le titulaire du compte y est ajouté, puis le script attend qu'Apple ait
   traité la version et dit dans quel état elle est.

Le numéro de version vient de `app.json` (`version`). Le numéro de construction est la date
suivie de la minute du jour (par exemple `20261124.1380`) : il grandit tout seul.

Seul un commit déjà présent sur la branche `main` peut être envoyé.

## Ce que le propriétaire fait, une seule fois

Apple ne permet pas de créer la fiche d'une appli par script. Après un premier lancement en
mode `prepare` (qui enregistre l'identifiant) :

1. Ouvrir [App Store Connect](https://appstoreconnect.apple.com/apps), « Apps », bouton « + »,
   « Nouvelle app ».
2. Plateforme : iOS.
3. Nom : `Jannatuk` (D31). Il doit être libre : si Apple le refuse, le formulaire le dit tout
   de suite. Il pourra changer avant la première publication.
4. Langue principale : français.
5. Identifiant de lot : choisir « Jannatuk - com.omazi.quran ».
6. SKU : `quran-app` (un simple repère interne, jamais montré).
7. Accès : complet.

À partir de là, l'identifiant `com.omazi.quran` est définitif pour cette fiche.

## Lancer un envoi

Depuis `dishplay3d` : Actions › « Quran — TestFlight » › « Run workflow ». `mode` vaut `send`
(compiler, signer, envoyer) ou `prepare` (seulement vérifier le côté Apple). En ligne de
commande :

```sh
gh workflow run quran-testflight.yml -R Omazi/dishplay3d -f mode=send
```

## Réglages lus par le script

Les mêmes noms que DishPlay, dans l'environnement `testflight` du dépôt qui lance l'envoi.

| Nom                             | Nature   | Ce que c'est                                   |
| ------------------------------- | -------- | ---------------------------------------------- |
| `APPLE_TEAM_ID`                 | variable | Identifiant de l'équipe Apple                  |
| `APPLE_KEY_ID`                  | variable | Identifiant de la clé App Store Connect        |
| `APPLE_ISSUER_ID`               | variable | Identifiant de l'émetteur de cette clé         |
| `APP_STORE_CONNECT_API_KEY`     | secret   | Le texte du fichier `.p8` de la clé            |
| `IOS_DISTRIBUTION_P12_BASE64`   | secret   | Le certificat de distribution et sa clé privée |
| `IOS_DISTRIBUTION_P12_PASSWORD` | secret   | Le mot de passe de ce fichier                  |

Le fichier `.p8` reste local et dans les secrets de GitHub. Ne le copiez ni dans une
conversation, ni dans le dépôt.

## Ce qui protège la clé

Voir `SECURITY.md`, « Signature et envoi ». En bref : la tâche qui compile lance des outils
de tiers et ne voit aucun secret ; la tâche qui voit la clé ne lance que les outils d'Apple et
les scripts de `tools/apple`, écrits sans aucune dépendance. Les journaux d'un dépôt public
sont publics : les scripts n'y écrivent ni nom, ni adresse, ni clé.

## Limites connues

- Rien de tout cela n'a encore tourné sur un Mac. Le point le plus incertain : Xcode
  accepte-t-il d'exporter une archive compilée sans signature ? Si non, le script signe avec
  l'outil `codesign` d'Apple, étape prévue dans le même script.
- Ce qui a été essayé sans Mac, le 24 novembre 2026, avec de faux outils à la place de ceux
  d'Apple : le contrôle de l'archive, la signature à la main, le contrôle de l'appli signée
  et l'envoi (y compris un refus d'Apple qui ne dit pas son nom). Cela vérifie l'enchaînement
  et ce qui s'écrit dans le journal, pas le comportement des vrais outils.
- La façon dont le script reçoit la clé depuis DishPlay suit la documentation de GitHub
  (secrets nommés, environnement nommé dans la tâche). Elle ne sera vérifiée qu'au premier
  lancement : en mode `prepare`, qui ne lance aucun Mac. Si la clé n'arrive pas, le script
  s'arrête en le disant.
- L'appli n'a aucun droit particulier (pas de notifications à distance, pas d'iCloud, pas de
  widget). Le jour où elle en demandera, l'identifiant et la signature devront les porter.
- L'ajout du titulaire au groupe de testeurs peut être refusé par Apple depuis un script ; le
  script le dit alors, et l'ajout se fait à la main dans TestFlight.
