# Décisions techniques

Chaque entrée : le choix, la raison, ce qui le ferait changer.

## D1 — Expo SDK 58, une seule base de code

React Native 0.88, iOS 27 et Android. Appareils visés : à partir de l'iPhone X (iOS 16).
_Changerait si_ une fonction native indispensable n'était pas atteignable par module Expo.

## D2 — Domaine en TypeScript pur, dépendances vers l'intérieur

Les règles (progression, jardin, reconnaissance) se testent sans téléphone et survivent à
un changement d'interface ou de stockage. Vérifié par ESLint.

## D3 — Données du Coran en fichiers JSON générés, pas de base SQLite pour le lot 1

Le lot 1 ne fait que lire des pages et des versets : des fichiers JSON découpés et chargés
à la demande suffisent, marchent partout (Expo Go, web, tests) et n'ajoutent aucun module
natif. L'accès passe par `QuranRepository`.
_Changerait si_ on ajoute recherche plein texte, annotations ou traductions multiples :
on implémentera alors la même interface avec SQLite.

## D4 — Moteur 3D du jardin : react-native-filament envisagé, à valider sur appareil

expo-gl exécute les appels graphiques sur le fil JavaScript, risqué sur un iPhone X.
Filament rend sur un fil séparé et lit les fichiers GLB. Tant que le test sur appareil
n'est pas fait, le jardin est décrit par `GardenState` (domaine) et affiché par un
composant remplaçable.

## D5 — Reconnaissance vocale sur l'appareil, moteur derrière une interface

whisper.rn avec un modèle spécialisé Coran. L'audio ne quitte pas le téléphone. La
recherche de versets et le suivi mot à mot sont dans le domaine, indépendants du moteur.

## D6 — Police du mushaf

Amiri Quran (licence OFL) pendant le développement. Les polices QPC du complexe du roi Fahd
demandent une autorisation : à obtenir avant publication. Le choix de police est isolé
dans le système de design.

## D7 — Backend branché plus tard

Le lot 1 fonctionne entièrement hors ligne, sans compte. Supabase arrive au lot 3, derrière
des interfaces de dépôt, avec des règles d'accès par ligne (RLS) dès la première table.
