# Spécification — copie de la progression dans iCloud

Périmètre : `src/store` (interface et règle de restauration), `src/data/storage`
(implémentations).

## But

Sur iOS, supprimer l'appli efface ses données, et la sauvegarde iCloud ne les rend que si
l'on restaure tout le téléphone. Pour que la personne retrouve sa progression après une
réinstallation, on garde une copie du journal et des réglages dans son iCloud.

## Principe

- Le magasin déclare une interface `ProgressBackup { read(), write(document) }`. Une
  implémentation inerte sert sur le web, dans les tests et quand iCloud est indisponible.
- **Écriture** : après chaque enregistrement local réussi, le même document est écrit
  dans la copie (sans bloquer l'interface ; un échec n'est jamais une erreur visible).
- **Restauration** : au démarrage, si le stockage local est vide (première ouverture ou
  réinstallation) et qu'une copie existe, elle est validée comme tout contenu relu
  (version, types, bornes), puis adoptée. Le premier lancement est alors sauté.
- **Conflit** : dès que le téléphone a au moins une page lue à lui, il fait foi et la
  copie est remplacée. Tant qu'il n'en a aucune (appli neuve, journal local rejeté), une
  copie valide est adoptée. On ne fusionne pas (la fusion viendra avec les comptes,
  lot 3).
- **Après une restauration**, le premier lancement est sauté : l'autorisation des
  notifications n'a donc pas été demandée. Les réglages montrent cet état et proposent
  de l'accorder.
- **Taille** : le stockage clé-valeur d'iCloud est limité à 1 Mo. Le document est écrit
  dans une forme compacte ; au-delà d'un seuil, les khatmas terminées sont réduites à
  leur badge (dates de début et de fin). À tester avec 500 khatmas.
- La personne peut ne pas avoir iCloud, ou l'avoir désactivé : rien ne casse, rien n'est
  demandé.

## Côté iOS

Stockage clé-valeur d'iCloud (`NSUbiquitousKeyValueStore`), par un petit module natif local
(`modules/progress-backup`, 35 lignes de Swift).

**Ce module n'a jamais été compilé ni exécuté** (aucun Mac dans l'environnement de
développement). Il est donc **tenu hors des compilations** tant qu'il n'est pas vérifié :
sans lui, l'appli utilise l'implémentation inerte et tout le reste fonctionne.

### Activation (à faire par le propriétaire, sur un Mac)

1. Sur le compte développeur Apple, activer la capacité iCloud avec « Key-value storage »
   pour l'identifiant de l'appli.
2. Dans `package.json`, retirer `progress-backup` de `expo.autolinking.exclude`.
3. Dans `app.json`, sous `ios.entitlements`, ajouter
   `"com.apple.developer.ubiquity-kvstore-identifier": "$(TeamIdentifierPrefix)<identifiant de l'appli>"`.
   (`usesIcloudStorage` ne sert à rien ici : dans cette version d'Expo il n'agit qu'avec
   le sélecteur de documents.)
4. Compiler. Si le module ne compile pas, corriger le Swift ou remettre l'exclusion.
5. Sur un vrai iPhone connecté à iCloud : lire des pages, supprimer l'appli, la
   réinstaller, et mesurer le temps que met la copie à revenir.

Limite : Apple présente ce stockage comme une synchronisation de réglages, sans garantie
de délai. Pour ne pas dépendre de l'instant du démarrage, une copie valide est adoptée
tant que le téléphone n'a aucune page lue à lui, même si elle arrive après le premier
lancement. Les comptes (lot 3) seront la solution solide, valable aussi entre Android et
iOS.

## Confidentialité

La copie reste dans le compte iCloud de la personne. L'appli n'a aucun serveur. Les
réglages iOS permettent de la supprimer.

## À tester

Stockage local vide et copie valide ; copie corrompue ou d'une version inconnue (écartée,
premier lancement normal) ; les deux présents (le local gagne) ; échec d'écriture ;
document trop gros ; implémentation inerte.
