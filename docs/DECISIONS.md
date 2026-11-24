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

## D16 — La progression survit au changement de téléphone et à la réinstallation

Décision du propriétaire. Android : sauvegarde automatique de Google. iOS : le stockage de
l'appli est inclus dans les sauvegardes, et une copie du journal est gardée dans iCloud
pour le cas « supprimer puis réinstaller », que la sauvegarde d'iOS ne couvre pas. Les
comptes (lot 3) prendront le relais entre plateformes. Voir
[specs/backup.md](specs/backup.md).

## D17 — Édition du mushaf : 1441 H

Décision du propriétaire (24 novembre 2026) : l'appli suit la mise en page de l'édition de
1441 H, celle des données actuelles. 25 pages y diffèrent du mushaf de Médine classique ;
elles restent à comparer à un exemplaire imprimé de cette édition avant toute sortie.

## D18 — Compilation dans le cloud, installation par TestFlight

Le propriétaire a un compte développeur Apple et pas de Mac. Les compilations iOS se font
par Expo EAS, l'installation sur son iPhone par TestFlight.

## D19 — Police du Coran : Hafs du Complexe du roi Fahd, telle quelle

Décision du propriétaire (24 novembre 2026). Le texte uthmani emploie des signes dont le
dessin n'est juste que dans cette police. Elle est gratuite ; le Complexe interdit de la
modifier et de la vendre, et ne dit rien de son intégration dans une appli. On l'intègre
sans la modifier, dans une appli gratuite, avec la mention du Complexe dans les crédits.
Amiri Quran (D6) n'est plus utilisée pour le texte uthmani.

## D20 — Rythme du jardin et nouvelle khatma : confirmés

Décisions du propriétaire (24 novembre 2026). Un jour de lecture retire trois jours de
sécheresse : lire un jour sur quatre garde le jardin en vie. La première page lue après
une khatma terminée lance le nouveau jardin, sans confirmation.

## D21 — Texte du Coran : celui du Complexe du roi Fahd, avec sa police

Décision du propriétaire (24 novembre 2026), après comparaison des rendus. Aucune version
de la police ne correspondait exactement au texte d'origine (venu d'un tiers, il différait
du texte du Complexe en 1 120 endroits). On prend donc le texte publié par le Complexe et
sa police dans la **même version** (0.18) : ils correspondent par construction. Ne jamais
mélanger les versions : l'encodage de certains signes a changé de l'une à l'autre.

## D22 — Modèles du jardin : packs libres, plantes Quaternius stylisé et architecture Kenney

Décision du propriétaire (24 novembre 2026), après comparaison de rendus : le mélange des
plantes du Stylized Nature MegaKit de Quaternius et de l'architecture des kits de Kenney.
Les deux sont annoncés en CC0 par leurs auteurs. Les copies utilisées pour les essais
viennent de dépôts GitHub tiers : **avant toute sortie, les remplacer par les
téléchargements officiels** et garder la preuve de leur licence. D12 reste vrai : aucun
jardin n'est dessiné en code.

## D23 — Un jardin par niveau

Décisions du propriétaire (24 novembre 2026). Chaque khatma terminée fait passer au niveau
suivant, et chaque niveau a son propre jardin, au style et à l'aménagement totalement
différents. **Le jardin d'un niveau est le même pour tout le monde** : on reconnaît le
niveau de quelqu'un à son jardin. Styles retenus : cour à fontaine, oasis, verger au bord
de l'eau, jardin de montagne, cerisiers en fleurs, pinède et clairière, jardin de nuit,
île sur un lac (huit styles pour sept jardins prévus à la première version : à trancher
sur images). Au-delà du dernier jardin, les jardins reviennent en attendant que des mises
à jour en ajoutent. Le niveau et le jardin sont visibles par les proches par défaut ; un
réglage permet de les cacher.

Conséquence pour le code : la variante du jardin ne dépend plus que du numéro de khatma
(plus de graine propre à l'utilisateur), et chaque jardin a son propre catalogue de 60
éléments.
