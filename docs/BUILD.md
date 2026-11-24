# Compiler l'appli et l'installer sur un iPhone, sans Mac

L'appli se compile dans le cloud d'Expo (EAS Build) et arrive sur l'iPhone par TestFlight.
Tout se lance depuis un terminal, sous Linux comme ailleurs.

**Rien de ceci n'a pu être essayé dans l'environnement de développement** : ni la
compilation native, ni l'envoi à Apple. La première compilation peut échouer ; dans ce
cas, garder le journal d'erreur.

## Ce qu'il faut

- Node.js 22 et git.
- Un compte Expo, gratuit : <https://expo.dev>. Le forfait gratuit limite le nombre de
  compilations par mois.
- Le compte développeur Apple.
- L'appli TestFlight sur l'iPhone.

## La première fois

```sh
git clone https://github.com/Omazi/quran.git
cd quran
npm ci
npx eas-cli@latest login
npx eas-cli@latest init
```

`init` crée le projet côté Expo et inscrit son identifiant dans `app.json`
(`extra.eas.projectId`). **Enregistrer ce changement dans le dépôt** :

```sh
git add app.json && git commit -m "Link the Expo project" && git push
```

## Compiler et envoyer sur TestFlight

```sh
npx eas-cli@latest build --platform ios --profile testflight --auto-submit
```

La commande pose quelques questions la première fois :

- la connexion à Apple (identifiant Apple et code de validation) : c'est EAS qui la
  demande, sur ta machine ; elle sert à créer le certificat et le profil de signature ;
- laisser EAS créer et gérer le certificat, le profil et la clé d'App Store Connect.

Ensuite la compilation tourne chez Expo, puis le résultat part chez Apple. Le premier
envoi crée la fiche de l'appli dans App Store Connect.

## Installer sur l'iPhone

1. Dans App Store Connect, onglet TestFlight de l'appli : créer un groupe de test interne
   et s'y ajouter.
2. Attendre que la version soit traitée par Apple, puis l'ouvrir dans TestFlight.

## Les deux profils

| Profil       | Pour quoi          | Particularité                                                                                         |
| ------------ | ------------------ | ----------------------------------------------------------------------------------------------------- |
| `testflight` | Les essais         | Affiche en bas de l'onglet Jardin la section « Aperçu » qui fait passer le jardin d'un état à l'autre |
| `production` | La version publiée | Sans cet aperçu                                                                                       |

## Quoi regarder en premier

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

## Ce qui n'est pas encore activé

- La copie de la progression dans iCloud : voir `docs/specs/backup.md`, « Activation ».
- Les identifiants `com.omazi.quran` et le nom « Quran App » sont provisoires.
