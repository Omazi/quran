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

## D8 — Seules les nouvelles pages comptent

Relire une page déjà lue dans la khatma en cours ne compte ni pour l'objectif, ni pour
arroser le jardin, ni pour la série. Décision produit : sinon on entretient son jardin en
relisant toujours la même page. Le lecteur n'enregistre une page qu'après un temps de
lecture minimal (règle précisée avec l'interface).

## D9 — Un jardin par khatma, un badge par khatma terminée

Chaque khatma fait pousser un jardin différent (variante déterministe : thème et graine).
Terminer une khatma donne un badge qui porte la vignette du jardin complet ; la khatma
suivante repart d'une terre nue. Le profil montre les badges et le jardin en cours.

## D10 — L'objectif du jour appartient à l'utilisateur ; le jardin avance au hizb

L'utilisateur fixe librement son objectif quotidien. Le jardin gagne un élément à chaque
hizb terminé ; entre deux hizb, l'élément suivant pousse au fil des pages lues.

## D11 — iOS d'abord, composants natifs, règles d'Apple

L'interface suit les Human Interface Guidelines (édition 2026) et utilise les composants
du système par Expo UI et les onglets natifs. Android suivra sur la même base : chaque
contrôle natif a une variante par défaut. Typographie système (San Francisco, New York),
SF Symbols, Liquid Glass réservé aux éléments flottants.

## D12 — Pas de jardin dessiné en code

Les jardins dessinés en code ont tous été refusés, et le skill SwiftUI Design l'interdit
(principe 4 : un emplacement neutre vaut mieux qu'une mauvaise image). À l'écran, le
jardin passe par un seul composant, `GardenScene`, qui ne reçoit qu'un `GardenState`. Au
lot 1, il affiche un emplacement neutre et l'état en clair. Le vrai jardin sera fait de
modèles 3D ; **leur provenance et leur style restent à décider avec le propriétaire**.

## D13 — Rappels par notifications locales

Aucun serveur : le plan des rappels est calculé sur le téléphone à partir de l'état du
jardin, puis programmé localement. L'autorisation est demandée à la fin du premier
lancement, après explication.

## D14 — Les skills d'abord

Pour l'interface, on suit les skills de design demandés par le propriétaire. On ne s'en
écarte que pour faire mieux, et l'écart est écrit. Règle et registre :
[design/SKILLS.md](design/SKILLS.md).

## D15 — Direction visuelle « L'eau », en attente de choix

Fonds et textes du système, accent bleu d'eau, titres en New York, clair et sombre.
Trois directions sont décrites dans [design/brand-spec.md](design/brand-spec.md) ; le
propriétaire choisit.
