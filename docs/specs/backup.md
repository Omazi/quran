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
- **Conflit** : si le stockage local n'est pas vide, il fait foi ; la copie est remplacée.
  On ne fusionne pas (la fusion viendra avec les comptes, lot 3).
- **Taille** : le stockage clé-valeur d'iCloud est limité à 1 Mo. Le document est écrit
  dans une forme compacte ; au-delà d'un seuil, les khatmas terminées sont réduites à
  leur badge (dates de début et de fin). À tester avec 500 khatmas.
- La personne peut ne pas avoir iCloud, ou l'avoir désactivé : rien ne casse, rien n'est
  demandé.

## Côté iOS

Stockage clé-valeur d'iCloud (`NSUbiquitousKeyValueStore`), par un module natif. Il faut
la capacité iCloud sur l'identifiant de l'appli (compte développeur Apple du
propriétaire) et `usesIcloudStorage` dans la configuration.

Limite : Apple présente ce stockage comme une synchronisation de réglages, sans garantie
de délai. Une réinstallation faite dans la minute peut précéder l'arrivée de la copie.
Les comptes (lot 3) seront la solution solide et valable aussi entre Android et iOS.

## Confidentialité

La copie reste dans le compte iCloud de la personne. L'appli n'a aucun serveur. Les
réglages iOS permettent de la supprimer.

## À tester

Stockage local vide et copie valide ; copie corrompue ou d'une version inconnue (écartée,
premier lancement normal) ; les deux présents (le local gagne) ; échec d'écriture ;
document trop gros ; implémentation inerte.
