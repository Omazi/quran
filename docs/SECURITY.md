# Sécurité et vie privée

## Principes

- **Le moins de données possible.** Le lot 1 ne crée aucun compte et n'envoie rien.
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
  du premier écran sur la branche `ci-screens`. Décidé par le propriétaire le 24 novembre 2026,
  pour que ces images se regardent depuis un téléphone. Ce qui le borne :
  - il ne compile rien et n'installe aucune dépendance : il lance deux étapes fournies par
    GitHub, figées par leur empreinte, et un script du dépôt pris sur `main`. La compilation
    reste dans `ios-check.yml`, en lecture seule ;
  - il ne lit que l'artefact d'une vérification réussie du `main` de ce dépôt, lancée par un
    push ou à la main : une exécution venue d'un fork est refusée, à deux endroits ;
  - il traite cet artefact comme une donnée non sûre : seules les quatre images attendues
    sont gardées, chacune lue jusqu'au bout pour vérifier que c'est un fichier PNG entier
    (`tools/ci/publish-screens.py`) ; rien de ce qu'il contient n'est exécuté ;
  - le script ne pousse que la branche `ci-screens`, qui ne contient rien d'autre. Son jeton,
    lui, pourrait écrire ailleurs : seule l'écriture du script l'en empêche. Une règle de
    protection de `main` (réglage du propriétaire, plus bas) fermerait cette porte ;
  - ce jeton n'existe que le temps de cette tâche.
- Les fichiers venus de tiers (texte et police du Coran) sont republiés tels quels, avec leur
  mention : voir `docs/DATA_SOURCES.md`. Leurs conditions de rediffusion restent à éclaircir.

## Signaler un problème

Écrire au propriétaire du dépôt, sans ouvrir de ticket public.

Trois réglages GitHub restent à activer par le propriétaire, maintenant que le dépôt est public :

- Settings › Actions › General : demander son accord avant de lancer les scripts sur la
  demande de fusion de tout contributeur extérieur.
- Settings › Security : le signalement privé des failles, pour qu'un inconnu ait un moyen de
  prévenir sans rien publier.
- Settings › Rules › Rulesets : une règle sur `main` qui interdit de forcer un push et de
  supprimer la branche, pour qu'aucun script ne puisse la réécrire.

## Sauvegarde et restauration de la progression

Décision du propriétaire : **changer de téléphone, ou supprimer l'appli puis la
retélécharger, doit ramener la personne là où elle en était** (D16).

Le journal de lecture révèle une pratique religieuse. Il ne quitte le téléphone que vers
les sauvegardes personnelles de la personne (son compte Apple ou Google), jamais vers un
serveur de l'appli tant que les comptes (lot 3) n'existent pas.

| Cas                             | Android                                                | iOS                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nouveau téléphone               | Sauvegarde automatique de Google (`allowBackup: true`) | Sauvegarde iCloud ou transfert direct : le stockage de l'appli y est inclus (`RCTAsyncStorageExcludeFromBackup: false`)                           |
| Suppression puis réinstallation | Restauré à l'installation par la sauvegarde de Google  | **Pas couvert par la sauvegarde** : iOS efface les données d'une appli supprimée. Il faut une copie dans iCloud (à faire, voir `specs/backup.md`) |

Limites à connaître : tout cela dépend des réglages de la personne (sauvegarde Google ou
iCloud activée). Rien n'est vérifié sur un appareil.

## Notifications

Seules des notifications locales sont utilisées : l'envoi à distance est désactivé dans la
configuration, et aucun jeton n'est demandé.
