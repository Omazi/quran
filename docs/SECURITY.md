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

## Signaler un problème

Écrire au propriétaire du dépôt, sans ouvrir de ticket public.
