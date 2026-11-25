# Envoyer l'appli sur TestFlight

Une seule commande envoie l'appli : le script `TestFlight`
(`.github/workflows/testflight.yml`). Il se lance à la main, jamais sur un push ni sur une
demande de fusion.

| Étape                                            | État                                                  |
| ------------------------------------------------ | ----------------------------------------------------- |
| Scripts écrits, testés sans Mac                  | Fait (53 tests, `tools/apple/test_*.py`)              |
| Contrôle côté Apple (clé, identifiant)           | **Réussi** le 24 novembre 2026, lancé depuis DishPlay |
| Fiche de l'appli dans App Store Connect          | Créée par le propriétaire le 24 novembre 2026         |
| Signature et envoi sur un Mac de GitHub          | **Réussis** au premier essai (version `20261125.136`) |
| Version traitée par Apple, visible de TestFlight | **Oui** (état `VALID`), groupe de testeurs créé       |
| Appli installée depuis TestFlight sur un iPhone  | Pas encore constaté                                   |

Premier envoi : exécution 45531696761 de `Omazi/dishplay3d`, dans la nuit du 24 au 25 novembre
2026, sur le commit `8446451`. Compilation 14 minutes, signature et envoi 4 minutes, attente
du traitement par Apple 3 minutes. Xcode a exporté l'archive compilée sans signature : la signature à
la main, prévue en secours, n'a pas servi.

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
2. **Compiler** (Mac, aucun secret : `testflight-build.yml`). Même compilation que la
   vérification iOS, rangée dans une archive non signée.
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
de tiers et ne reçoit aucun secret (c'est un script à part, `testflight-build.yml`, appelé sans
secret) ; la tâche qui voit la clé ne lance que les outils d'Apple, Python, les scripts de
`tools/apple`, écrits sans aucune dépendance, et `tools/ci/select-xcode.sh`, qui n'y appelle
que Xcode. Les journaux d'un dépôt public sont publics : les scripts n'y écrivent ni nom, ni
adresse, ni clé, et demandent à GitHub de masquer le nom du titulaire du certificat.

## Limites connues

- Le chemin normal a tourné une fois, avec succès. Les chemins de secours n'ont jamais tourné
  sur un Mac : la signature à la main avec `codesign` (si Xcode refusait d'exporter) et
  l'affichage des erreurs de Xcode ou d'Apple. Ils ont été essayés sans Mac, le 24 novembre
  2026, avec de faux outils à la place de ceux d'Apple : cela vérifie l'enchaînement et ce qui
  s'écrit dans le journal, pas le comportement des vrais outils.
- Apple prévient (avertissement 90725) : l'appli est compilée avec le SDK d'iOS 26.5
  (Xcode 26.6, le plus récent sur les Mac de GitHub ce jour-là). À partir d'avril 2027, Apple
  n'acceptera que les applis compilées avec le SDK d'iOS 27 (Xcode 27). Le script prend le
  Xcode publié le plus récent de la machine : il suivra dès que GitHub l'installera. À
  surveiller avant avril 2027.
- Le journal public de l'envoi a été relu après coup : aucun nom, aucune adresse, aucune clé.
- La façon dont le script reçoit la clé depuis DishPlay (secrets nommés, environnement nommé
  dans la tâche) a été vérifiée par un vrai lancement en mode `prepare` le 24 novembre 2026 :
  la clé a répondu et l'identifiant `com.omazi.quran` a été enregistré, sous le libellé
  « Jannatuk ». L'ajout du fichier dans DishPlay n'a lancé aucune vérification de DishPlay.
- L'appli n'a aucun droit particulier (pas de notifications à distance, pas d'iCloud, pas de
  widget). Le jour où elle en demandera, l'identifiant et la signature devront les porter.
- L'ajout du titulaire au groupe de testeurs peut être refusé par Apple depuis un script ; le
  script le dit alors, et l'ajout se fait à la main dans TestFlight.
