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
lancement, après explication. Programmation, déclencheurs et toucher d'une notification :
[specs/reminders.md](specs/reminders.md), « Programmation ».

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

Le moyen de compiler est remplacé par D24 ; l'installation par TestFlight reste.

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

## D24 — Compilation sur les Mac de GitHub, dépôt public, pas de compte Expo

Décisions du propriétaire (24 novembre 2026).

- **Pas de compte Expo.** Il ne veut pas avoir à gérer ce service : on n'utilise pas la
  compilation dans le cloud d'Expo (EAS). L'appli reste écrite avec Expo (un seul code pour
  iPhone et Android, D1) : c'est l'outil, pas le service.
- **Compilation sur un Mac hébergé par GitHub** (GitHub Actions), comme pour son autre appli,
  DishPlay (`Omazi/dishplay3d`), dont on reprend la méthode et les scripts : signature avec le
  certificat de distribution du compte, envoi par une clé de l'API App Store Connect, valeurs
  rangées dans les secrets GitHub. La clé et le certificat valent pour tout le compte Apple,
  donc pour cette appli aussi ; seuls la fiche de l'appli et son profil lui sont propres.
- **Le dépôt devient public.** Sur un dépôt privé, GitHub refusait de démarrer la moindre
  machine (paiement ou plafond de dépense du compte) ; sur un dépôt public, les machines
  standard sont gratuites. Conséquence : tout ce qui est poussé est lisible par tous. Voir
  `docs/SECURITY.md`, « Dépôt public ».
- **Le déploiement sur TestFlight viendra plus tard**, à son signal. D'ici là, chaque push
  est compilé pour iPhone, sans signature (`docs/BUILD.md`).

## D25 — Prénoms d'exemple

Décision du propriétaire (24 novembre 2026). Partout où l'appli ou ses images montrent des
proches d'exemple (premier lancement, page des proches, captures pour les boutiques), les
prénoms sont **Omar, Mustapha, Sarah et Taghread** (تغريد). Iman et Bilal, utilisés dans
l'ancien prototype, ne le sont plus.

## D26 — Le jardin sèche et revit par étapes, sous les yeux

Exigence du propriétaire (24 novembre 2026), sur l'animation : le dessèchement ne se montre
jamais d'un coup. On voit d'abord l'eau partir, puis les arbres perdre leurs feuilles, et
ainsi de suite jusqu'à la terre morte. À la reprise de la lecture, le jardin revient lui
aussi par étapes, plus vite qu'il n'a séché. Les règles (`specs/garden.md`) le font déjà :
quatorze jours pour mourir, cinq jours de lecture pour revenir d'une terre morte. Ce que
chaque étape doit montrer est écrit dans `specs/garden.md`, « Ce qu'on voit, étape par
étape ».

## D27 — L'écran d'écoute : au niveau de Shazam

Exigence du propriétaire (24 novembre 2026) : il n'a pas aimé le fond de la page de
détection du prototype. L'écran qui reconnaît un passage du Coran doit être aussi beau que
celui de Shazam, qu'il donne comme niveau à atteindre. On ne copie ni son dessin ni sa
marque ; on vise la même force : un seul geste, un écran entier qui écoute, un résultat qui
arrive avec évidence. Les écarts aux règles d'Apple que cela demande s'inscrivent au
registre de `design/SKILLS.md`.

## D28 — On ne présente que ce qu'on juge soi-même premium

Règle du propriétaire (24 novembre 2026), après deux séries d'écrans d'écoute qu'il a
refusées et que nous avions nous-mêmes jugées insuffisantes une fois la question posée.
Tant qu'un design est moche ou seulement correct, on ne le lui montre pas et on ne lui
demande pas son avis : on se corrige d'abord. Le détail est dans `design/SKILLS.md`,
règle 6.

## D29 — L'écran d'écoute en sombre : le même dessin, aux valeurs de nuit

**Validé par le propriétaire le 24 novembre 2026** (« Oui »). Proposition de l'architecte,
montrée après la revue de design indépendante (8, 8, 7, 7, 7 sur 10 ; un premier passage
avait échoué à 6 sur la finition : or trop fort, voile laiteux, points lumineux aux
jointures). La rosace en clair est validée (D27, feuille de route). Sa première version sombre (fond vert
sombre, étoile dorée, forte lueur) n'a pas plu. Deux palettes inventées ensuite, « Encre »
et « Lapis », sont retirées : elles sortaient de la charte.

Le mode sombre n'est pas un second thème à choisir. C'est le même dessin, avec la valeur
de nuit de chacune des quatre couleurs de l'appli (`design/brand-spec.md`, section 3) :
papier `#1B1915`, encre `#EFE8D8`, eau `#5CC8D6` (l'étoile du cœur prend la valeur de
contraste élevé `#8FE0EA`), or `#D9A441`. La lumière reste sur les lignes et grandit avec
la voix ; l'intérieur des cases reste net.

- Pas de réglage d'apparence dans l'appli : l'écran suit le réglage du téléphone
  (`dark-mode.md › Best practices`).
- Chaque couleur a sa valeur claire et sa valeur sombre, qui n'est pas une inversion
  (`dark-mode.md › Dark Mode colors`).
- Les lignes gardent le rang qu'elles ont en clair : l'étoile du cœur d'abord, l'étoile
  extérieure ensuite, l'or en filigrane. Contrastes sur le papier sombre, en silence puis
  avec la voix : cœur 7,70:1 puis 10,46:1 ; étoile extérieure 4,52:1 puis 5,89:1 ; or
  2,67:1 puis 3,25:1. L'or est un ornement, pas une information : en clair il est à
  1,9:1. Titre 14,38:1 ; bord du bouton « Arrêter » 3,13:1 (`accessibility.md › Vision`).
- En silence, un pétale discret part toutes les deux secondes environ : l'écran dit qu'il
  écoute même quand personne ne récite. Avec « réduire les animations », il ne part pas.
- Reste à faire en natif (revue de design) : une branche « augmenter le contraste » avec
  les valeurs prévues par la charte (`#8FE0EA`, `#EBC272`) ; avec « réduire les
  animations », aucun pétale ne grandit, la voix n'agit que sur la lumière des lignes.

## D30 — L'envoi sur TestFlight part du dépôt DishPlay

Décision du propriétaire, 24 novembre 2026. Il veut installer l'appli depuis TestFlight sans
avoir à retrouver sa clé Apple. Cette clé est déjà enregistrée dans le dépôt
`Omazi/dishplay3d`, et GitHub ne permet pas de copier un secret d'un dépôt à l'autre. À la
question « je peux faire partir l'envoi depuis le dépôt DishPlay ? », il a répondu : « Oui,
si tu me garantis que rien ne va être mélangé, cassé. »

Ce qui lui a été garanti, et qui borne donc ce qu'on a le droit de faire :

- aucun fichier existant de DishPlay n'est modifié ; un seul fichier y est ajouté, qui
  appelle le script de ce dépôt-ci ;
- l'appli Coran a son identifiant et sa fiche ; ses versions ne peuvent pas arriver dans
  celle de DishPlay ;
- aucun certificat n'est créé ni supprimé ;
- l'ajout ne déclenche aucun envoi ni aucune vérification de DishPlay (le fichier se pousse
  avec `[skip ci]` : voir `TESTFLIGHT.md`) ;
- retirer ce fichier ramène à l'état d'avant.

Ce qui ne lui a pas été garanti : que cela marche du premier coup.

Ce que la relecture de sécurité du 24 novembre 2026 a ajouté, et qu'il doit savoir : le
fichier de DishPlay suit la branche `main` de ce dépôt-ci. Qui peut écrire sur cette branche
décide donc de ce qui tournera avec la clé Apple au prochain lancement. Le figer sur un
commit demanderait de modifier DishPlay à chaque version de l'appli Coran ; ce n'est pas le
choix retenu. Les réglages qui ferment cette porte sont listés dans `SECURITY.md`.

D24 reste vrai pour le reste (pas de compte Expo, compilation sur les Mac de GitHub). Détail :
`TESTFLIGHT.md`.

## D31 — Le nom de l'appli : Jannatuk (جنتك)

Décision du propriétaire, 24 novembre 2026, après une longue recherche (« Utilise le »).
جنتك veut dire « ton jardin » : en arabe, le même mot, _janna_, désigne le jardin et le
Paradis. C'est le jardin de l'appli, celui qui pousse hizb après hizb. Comme tout contenu
religieux, ce sens reste à faire confirmer par une personne qualifiée.

- **Vérifié** (recherche sur le web, 24 novembre 2026) : aucune appli de l'App Store portant
  exactement ce nom n'a été trouvée.
- **Risque connu, accepté par le propriétaire** : trois applis ont un nom voisin (« Jannaty »,
  « Jannati - جنَّتْي », « جنتي: القران الكريم »). Apple peut refuser un nom trop proche d'un
  autre.
- **Pas vérifié** : que le nom est libre auprès d'Apple (seul le formulaire d'App Store Connect
  le dit) ; qu'aucune marque déposée ne porte ce nom.

Ce qui porte le nom : le nom affiché de l'appli (`app.json`), les textes (`appName` : Jannatuk
en français et en anglais, جنتك en arabe), le libellé de l'identifiant chez Apple. Sur l'écran
d'accueil du téléphone, le nom est « Jannatuk » dans toutes les langues pour l'instant.

Ce qui ne le porte pas, exprès : l'identifiant `com.omazi.quran`, le nom du dépôt, le `slug`
et le schéma de lien (`quranapp`). Ils sont neutres, personne ne les voit, et ils survivent
ainsi à un changement de nom.
_Changerait si_ Apple refuse le nom : on en choisit un autre, seul le nom affiché bouge.

## D32 — La langue : celle du téléphone, modifiable dans les réglages

Décision du propriétaire, 24 novembre 2026, après la première installation. L'appli ne
demande pas la langue au premier lancement : elle prend celle du téléphone (français,
anglais ou arabe ; à défaut, la langue de repli de l'appli). La personne peut en changer
ensuite depuis les réglages de l'appli.

## D33 — Comptes et proches : d'abord sur de fausses données

Décision du propriétaire, 24 novembre 2026 : il créera le projet Supabase plus tard. En
attendant, l'inscription et les proches fonctionnent sur de fausses données, et tout ce qui
ne dépend pas du serveur est prêt : les modèles, les règles, les interfaces, les tables et
leurs règles d'accès. Détail : `specs/social.md`. Le jour où le serveur existe, on écrit une
seconde mise en œuvre des mêmes interfaces ; aucun écran ne change.
_Changerait si_ le propriétaire choisit un autre serveur que Supabase : seules les tables et
cette seconde mise en œuvre seraient à refaire.

## D34 — Après la première installation : l'ordre du travail

Le 24 novembre 2026, le propriétaire a installé la première version par TestFlight et l'a
jugée vide : pas de Coran, pas de jardin, pas d'écoute, pas d'inscription ni de proches. Il
a demandé que tout avance en parallèle. Ordre de ce qui lui sera montré : le lecteur du
Coran (`specs/reader.md`), le jardin en images dans le premier lancement et l'accueil,
l'écran d'écoute (`specs/listening.md`), puis l'inscription et les proches
(`specs/social.md`). Aucune nouvelle version ne lui est envoyée avant qu'un écran complet
ait passé la revue de design (D28).

## D35 — Le jardin en images calculées à l'avance, en attendant le moteur 3D

> **Révisé par D39 (25 novembre 2026)** : le jardin sera en vraie 3D, qu'on peut faire tourner
> (D4) ; ces images ne servent plus qu'aux vignettes et de repli.

Décidé par l'architecte le 24 novembre 2026, pour répondre à la demande du propriétaire
(« mets le jardin comme il doit ressembler ») sans attendre l'essai du moteur 3D sur
téléphone (D4), qui n'a pas eu lieu. Le jardin du niveau 1 est rendu hors de l'appli avec
les modèles choisis (D22), sous une seule caméra : une image par nombre d'éléments et par
état du feuillage, l'eau à part. `GardenScene` choisit l'image d'après le `GardenState`
(`specs/garden-pictures.md`).

Ce que cela donne : le jardin se voit, il pousse élément par élément, il sèche et revit par
étapes (D26). Ce que cela ne donne pas : faire tourner le jardin, visiter en 3D celui d'un
proche, les jardins des autres niveaux (D23). **À dire au propriétaire.**

Licence des modèles, lue le 24 novembre 2026 sur les pages des auteurs : Quaternius,
« Ultimate Stylized Nature Pack », CC0 (quaternius.com/packs/ultimatestylizednature.html) ;
Kenney, CC0 (fichier de licence du kit). Les fichiers utilisés viennent de miroirs GitHub,
pas des sites des auteurs, que cette machine ne peut pas joindre : à retélécharger à la
source avant une publication sur l'App Store.
Précisions du 25 novembre 2026 (architecte, après la revue de design) : un élément
n'apparaît que lorsque son hizb est terminé (plus d'image à moitié transparente : elle
faisait un fantôme) ; à la reprise, l'eau revient d'abord, puis les feuilles, puis les
éléments ; les images sont recoupées à la même boîte (`specs/garden-pictures.md`). La terre
morte reste une terre morte.
_Changerait si_ le moteur 3D est validé sur téléphone : `GardenScene` est le seul composant
à remplacer.

## D36 — Trois façons d'ajouter un proche ; groupes ouverts aux noms et aux pages

Décision du propriétaire, 25 novembre 2026, sur les points laissés ouverts par `specs/social.md`.

1. **Ajouter un proche de trois façons** : le code d'invitation (existait), la **recherche par
   nom** et le **scan d'un QR code**. Le QR porte le code sous forme de lien
   `quranapp://invite/<CODE>` (le schéma `quranapp` est celui d'`app.json`) : le scanner revient à
   taper le code, avec les mêmes règles (règle 6). La recherche est la règle 11.
2. **Groupes : tout membre voit les noms et les pages de tous les membres** (le classement, règle 9),
   amis ou non. Accepté tel que la spec l'écrit.
3. **Ajouter quelqu'un à un groupe ne demande pas son accord.** Accepté tel que la spec l'écrit
   (règle 8) ; la personne peut partir à tout moment.

Recherche et vie privée. Le principe est « le moins de données possible » (`docs/SECURITY.md`) : un
résultat de recherche ne montre que le **nom** et la **relation** (ami, demande envoyée ou reçue,
rien), jamais le jardin, le niveau ni une date. Un inconnu pouvait déjà lire un nom, mais **en
connaissant l'identifiant** (`get_public_profiles`, un `uuid` aléatoire que l'on n'obtient que par
un groupe, un code ou une demande). La recherche change cela : un nom devient **trouvable sans
identifiant**, par les premières lettres. C'est donc une exposition nouvelle, pas seulement un
usage de l'ancienne ; elle est bornée : 2 caractères au moins, début de mot seulement, 20
résultats, 30 recherches par minute et par compte, jamais soi-même ni une personne bloquée dans un
sens ou dans l'autre. Reste le moissonnage lent par des comptes jetables : la limite de création
de comptes de Supabase est à régler (non vérifié).

**Réglage « Être trouvé par mon nom » : pas pour l'instant.** Le propriétaire a jugé qu'il n'est
pas nécessaire (25 novembre 2026). Option pour plus tard : une colonne `profiles.discoverable`
(vrai par défaut) et un filtre dans `search_profiles` qui cache un inconnu mais pas un ami ni une
demande en attente ; le code et le QR fonctionneraient toujours. Sans ce réglage, toute personne
dont le nom correspond est trouvable (hors blocages) : c'est l'exposition décrite ci-dessus.

## D37 — Les compteurs de lecture : hasanat, versets, mots, temps passé

Demande du propriétaire, 25 novembre 2026 (le compteur de hasanat, dès le 24) : afficher le
nombre de hasanat, de versets lus, de mots lus et le temps passé dans l'appli, **pour le
prochain déploiement**, dans une section remarquable, joliment présentée. Les proches voient,
sur le profil de l'autre, ses mots lus, ses versets lus et ses hasanat.

Ce qui est décidé (détail : `specs/stats.md`) :

- Tout se déduit du journal de lecture et des données du mushaf : rien n'est saisi à la main.
  Relire dans la même khatma ne compte pas (D8) ; relire dans une khatma suivante compte.
- Un verset compte quand tous ses mots sont sur des pages lues de la même khatma.
- Les **hasanat sont une estimation** : lettres lues × 10, d'après le hadith rapporté par
  Ibn Mas'ûd (Sunan at-Tirmidhî n° 2910). L'écran le dit toujours, avec la source, et dit
  qu'Allah seul connaît la récompense.
- La règle des lettres (module `domain/stats`, fichier `letters.ts`) compte les lettres
  **écrites** dans le texte uthmani de l'appli, sans les voyelles, la shadda, l'alif suscrit ni
  les petites lettres. Avec les données actuelles : 77 430 mots, 325 882 lettres, 6 236 versets
  pour une khatma complète.
- Le temps passé (dans l'appli, et dans le lecteur) est compté au premier plan, par jour
  local, dans le magasin ; il est sauvegardé avec la progression. Il n'est pas publié aux
  proches.

**À faire valider par une personne qualifiée avant le déploiement** : la règle des lettres (les
savants comptent de plusieurs façons : alif suscrit, shadda, hamza sur tatweel), le facteur dix
et la formulation de l'écran. Tant que ce n'est pas validé, l'écran garde le mot « estimation ».
_Changerait si_ la personne qualifiée retient une autre règle : seul `letters.ts` change, avec
ses tests ; les totaux de contrôle sont alors à relire.

## D38 — L'icône de l'appli : le nom en calligraphie, dont le trait finit en feuille

Proposée le 25 novembre 2026 (développeur d'interface). Version 6. **Le choix final revient au
propriétaire.**

Historique court : version 1, le plan du jardin (une fleur autour de l'étoile générique) ; 2, la
parcelle en vectoriel (une puce électronique) ; 3 et 4, l'arbre sur une île en 3D (une icône de jeu
mobile) ; 5, l'arbre au bord d'un ruisseau en rendu 3D (un brocoli d'un coup d'œil, l'éclairage dans
l'image). Toutes écartées en revue de design. Pour la version 6, le propriétaire a choisi la
direction : le mot جنتك en calligraphie, d'où sort une pousse ou de l'eau, propre à l'appli.

Ce que montre l'icône : جنتك en nastaliq (police Gulzar, licence OFL), blanc sur une eau profonde.
Le long trait du kaf traverse l'icône et finit en feuille verte ; les points des lettres sont de
l'eau. Le mot fait pousser le jardin. Détail, couleurs, couches, pistes écartées :
`design/brand-spec.md`, « Icône ».

- **Fichiers** : `assets/expo.icon` (format Icon Composer : fond en dégradé clair et sombre, trois
  couches PNG d'une couleur, tirées des formes vectorielles (actool de Xcode 26.6 plantait sur des couches SVG), feuille, eau, mot ; déjà désigné par `ios.icon`),
  `assets/images/icon.png` (1024, opaque, coins carrés), les trois couches Android, `favicon.png`,
  `splash-icon.png`. Tous sortent de `tools/app-icon/make_icon.py`, à l'identique d'une fois sur
  l'autre, à partir des contours du mot, `tools/app-icon/word.svg` (HarfBuzz et fontTools,
  `make_icon.py --outline`). La couleur de secours de l'icône Android (`app.json`) devient
  l'`accent`, `#0E6B78`. La version 5 et sa scène 3D restent dans l'historique git (commit
  `c3e0467`).
- **Écran de lancement** : inchangé, une couleur unie, sans logo (`launching.md › Launch screens`).
  Depuis le 25 novembre 2026 (demande du propriétaire, écart 115) : la couleur unie reste l'écran natif,
  puis la marque s'anime par-dessus (`src/features/launch`) avant de se fondre dans le premier écran.
- **Licences** : Gulzar, SIL Open Font License 1.1, qui permet tout usage, commercial compris ; la
  police n'est ni dans le dépôt ni dans l'appli, seuls les contours du mot y sont. Avis complet :
  `tools/app-icon/NOTICE.txt`. Outils non livrés : uharfbuzz (Apache-2.0), fontTools (MIT),
  rsvg-convert (LGPL, lancé comme programme à part), Pillow, numpy.
- **Vérifié** : aperçus à 1024, 180, 60 et 29 pixels, apparences claire et sombre, écrans
  d'accueil, approximations du teinté et du transparent, masques Android (rond, monochrome) ;
  silhouettes d'une seule teinte relues pour les lectures parasites (lettre en trop, flamme) ; deux
  exécutions de l'outil donnent les mêmes fichiers ; `icon.json` valide selon un schéma non
  officiel du format ; `npx expo config` lit l'icône et `npx expo prebuild` (copie temporaire)
  copie le paquet `expo.icon` et ses couches SVG dans le projet iOS et produit les icônes Android.
- **Pas vérifié** : le rendu réel d'iOS 26 (verre, reflets, versions teintée et transparente
  calculées par le système) et la lecture des couches SVG par Icon Composer et `actool` ; il faut
  un Mac ou un iPhone (D24). À regarder sur la prochaine version TestFlight.
- **À faire confirmer par une personne qualifiée** (calligraphe ou lecteur arabe exigeant) : que le
  mot se lit bien جنتك ; que le kaf final à la manière persane (ک, sans son petit signe intérieur),
  forme ordinaire du nastaliq, convient pour un mot arabe ; que la feuille sur la fin du trait ne
  gêne pas. Comme le nom lui-même (D31).
- **Risques connus** : du texte dans une icône, ce qu'Apple déconseille hors marque
  (`app-icons.md › Design` ; écart 51 de `design/SKILLS.md`) ; un lecteur non arabophone y voit un
  signe calligraphique et une feuille, pas un mot.
- **Choix du propriétaire (25 novembre 2026)** : le kaf final arabe (ك), avec son petit signe
  intérieur, la « sharta » du nastaliq, prise dans Noto Nastaliq Urdu (OFL), dont la propre mise en
  forme l'ajoute au kaf final d'un texte arabe ; les lettres de Gulzar restent les mêmes. Et le fond
  d'eau profonde en apparence par défaut (il a préféré celui de l'apparence sombre), l'apparence
  sombre d'un cran plus profonde ; couleur de repli Android `#0B3C44`. Contours dans
  `tools/app-icon/word-arabic.svg`, provenance dans `NOTICE.txt` ; réglages `KAF` et `FIELD_STYLE`
  en tête de `make_icon.py`.

_Changerait si_ le propriétaire préfère une autre écriture ou une autre couleur, ou si le rendu sur
iPhone déçoit : les réglages sont en tête de `make_icon.py`, et on relance l'outil.

## D39 — Les maquettes validées sont la référence visuelle

Décidé par le propriétaire le 25 novembre 2026. Les maquettes validées de `docs/design/`
(`accueil.png`, `soif.png`, `mort.png`, `nouveau.png`, `khatm.png`, `mushaf.png`, `visite.png`,
`bienvenue.png`, `voix.png`) font foi pour l'apparence. Les skills de design restent la méthode
(accessibilité, Dynamic Type, VoiceOver, cibles de 44 points, arabe en miroir, mouvement réduit) ;
quand une maquette contredit une règle d'Apple ou la charte, la maquette l'emporte, et l'écart est
inscrit dans `design/SKILLS.md` pour que le propriétaire tranche au cas par cas.

Décisions qui en découlent :

- **Couleur d'action : vert forêt `#1F5C45`** dans toute l'appli (boutons pleins, capsules, micro
  du lecteur, bouton proéminent du système, onglet choisi, liens). La nuit, un seul vert pour tout
  bouton plein, `#2E7A5B` avec un libellé blanc (5,18:1) ; les mots et symboles verts la nuit
  prennent `#7FCCA6`. Le bleu d'eau ne sert plus qu'à ce qui veut dire « eau » (arrosage, anneau,
  goutte).
- **Titres en Fraunces** (demi-gras, embarquée, licence OFL, `assets/fonts`), comme sur les
  maquettes. New York ne reste qu'au titre de l'écran d'écoute.
- **Nuit « crépuscule »** : un ciel sombre et chaud, des cartes sombres et chaudes ; les maquettes
  n'ont pas de version sombre, les valeurs sont dérivées et mesurées (4,5:1 pour le texte).
- **Cartes blanches arrondies avec l'ombre douce des maquettes** (de jour), **boutons en capsule
  dessinés** : on revient sur les « écarts corrigés » qui les avaient retirés.
- **Les pièces du système restent là où elles ne changent pas l'apparence** : barre d'onglets,
  barres de navigation, menus, feuilles d'action, interrupteurs, champs de texte, sélecteurs.
- **L'écran de reconnaissance de l'écoute garde la rosace validée** (D27, D29) : il n'est pas
  redessiné.
- **Un seul système de design** (25 novembre 2026, architecte, en application de cette règle) : une
  palette unique (`palette` dans `src/ui/tokens.ts`) au lieu de quatre (accueil, lecteur, Proches,
  suivi de la voix) ; un rôle, une valeur. Les composants partagés de `src/ui` (`Card`,
  `ActionButton`, `Avatar`, `DottedProgress`, `ProgressRing`, `SectionHeader`) servent à tous les
  onglets ; l'onglet Proches n'a plus de kit à lui pour ces pièces.
- **Écran de lancement : la marque calligraphique** (`assets/images/splash-mark.png`, tirée des
  couches de l'icône) sur l'eau profonde `#0B3C44`, `#072C33` en sombre. Demande du propriétaire,
  contre `launching.md › Launch screens` (pas de marque sur l'écran de lancement) : écart 115.
  Remplace la ligne « Écran de lancement » de D38. Depuis, l'écran natif est de couleur unie et la
  marque s'anime par-dessus (`src/features/launch`) ; ses couleurs sont les rôles `launch…` de la
  palette.
- **Le jardin sera en vraie 3D et pourra tourner** (pincer, glisser), comme décidé au départ (D4).
  Un autre agent le construit. Les images calculées à l'avance de D35 ne servent plus qu'aux
  vignettes (cartes des proches, « Jardins voisins ») et de repli quand la 3D n'est pas disponible.

_Changerait si_ le propriétaire valide de nouvelles maquettes, ou tranche autrement un des écarts
inscrits dans le registre.

## D40 — Le jardin en vraie 3D : expo-gl et three.js, un modèle cuit à l'avance

Exigence du propriétaire (25 novembre 2026) : « Le jardin on avait dit 3D et donc on doit pouvoir
le tourner », comme sur `design/visite.png` (« Glisse pour tourner, pince pour zoomer »). Proposé
par le développeur d'interface le 25 novembre 2026 ; remplace D35 pour le grand jardin de
l'accueil et la page d'un proche. Les images de D35 restent pour les vignettes (cartes des
proches, jardins voisins, profil, premier lancement, khatma terminée) et comme repli.

**Le moteur : expo-gl 58 et three.js 0.187, pas react-native-filament (D4).** Ce qui a été
vérifié le 25 novembre 2026 :

- react-native-filament 1.11.0 (MIT, dernière version du 27 mai 2026) : 343 Mo une fois
  installé ; demande un second moteur de worklets (`react-native-worklets-core`) à côté de celui
  de l'appli ; tickets ouverts sur Expo et la nouvelle architecture (plantage NSException avec
  Expo 54, module `Worklets` introuvable, chemins `file://` mal lus sur iOS) ; le dessèchement
  des plantes demanderait une matière Filament compilée hors ligne (`matc`) ; et rien ne s'en voit
  sur Linux, donc rien ne se vérifie ici.
- expo-gl 58.0.4 (MIT, version choisie par `npx expo install` pour le SDK 58) ; three 0.187.0
  (MIT), la version qui a rendu les images : mêmes matières, même ombre, même dessèchement, donc
  au repos le jardin 3D est l'image. Le rendu web d'expo-gl se photographie dans Chromium sans
  écran : tout ce qui suit a été regardé.
- La crainte de D4 (expo-gl dessine sur le fil JavaScript) est réduite, pas supprimée : on ne
  dessine que quand quelque chose bouge (geste, glissement, nouvelle étape ; zéro image en 3 s
  d'immobilité, mesuré) ; peu de dessins (43 pour le jardin au hizb 24, 74 pour le jardin
  complet, contre 1 par modèle placé sans fusion) ; les ombres ne sont recalculées qu'au
  changement d'étape (le soleil ne bouge pas avec la caméra) ; three.js n'est chargé qu'avec le
  premier contexte GL.

**Le modèle : cuit à l'avance, un seul fichier.** `tools/garden-3d` exécute le constructeur des
images (`garden.js`) pour les 732 étapes du jardin (60 éléments, 3 niveaux d'eau, 4 états du
feuillage) et note chaque morceau avec les étapes où il paraît ; les morceaux sont fusionnés par
matière (23 maillages) ou dessinés par instances quand un modèle revient (53 maillages : arbres,
fleurs, herbes, murs). Le fichier, `assets/models/garden/level-1/garden.glb`, est un GLB standard
(positions quantifiées, instances `EXT_mesh_gpu_instancing`), avec les textures en pixels bruts :
le téléphone ne décode aucune image et ne lit aucun FBX ; l'appli lit le fichier sans chargeur
glTF ni `TextDecoder` (`garden3d/glb.ts`). Montrer une étape, c'est choisir des plages de
triangles et des instances. 82 600 triangles stockés, 236 000 dessinés pour le jardin complet.

**Poids.** Le modèle : 4,9 Mo (dont 2,1 Mo de textures), 1,65 Mo compressé (gzip -9, ordre de
grandeur du paquet de l'appli). three.js : environ 0,7 Mo de JavaScript minifié. Les images de D35
(21 Mo) restent.

**Ce que fait le jardin** (`GardenView3D`, `specs/garden-pictures.md` pour l'étape montrée) :
même cadrage que les images par défaut ; glisser tourne autour de l'axe vertical, le bord du
jardin sous le doigt, avec élan qui ralentit comme une liste et qu'un toucher arrête ; une
légère inclinaison bornée (22° à 58°, le cadre s'élargit pour garder tout le jardin) ; pincer
zoome de 1 à 2,5 autour des doigts ; toucher deux fois zoome, ou revient à la vue de départ ;
« réduire les animations » : pas d'élan ni de glissement ; VoiceOver : une seule image, décrite
comme avant, avec trois actions (tourner à gauche, à droite, revenir) ; une consigne au premier
usage, retirée pour de bon dès le premier geste. Tant que le modèle charge, ou si le GL échoue,
l'image reste : jamais de cadre vide.

**Vérifié** : tests (lecture du fichier livré, étapes montrées, caméra, gestes et glissements
avec une horloge de test, repli sur l'image) ; export web regardé dans Chromium (accueil et page
d'un proche, angle par défaut, tourné de 90°, incliné, zoomé, fané, mourant, terre morte, clair
et sombre) ; comparaison à l'image de la même étape : contours superposés, écart moyen de 5 sur
255 pour les états secs (textures réduites, tachetures de la terre) ; `npx expo export --platform
ios` contient le GLB.

**Pas vérifié** : la fluidité et la mémoire sur un iPhone (aucun iPhone ni Mac ici, D24) ; les
textures téléversées par expo-gl en `Uint8Array`, les ombres (textures de profondeur de WebGL 2)
et la transparence du fond sur iOS ; Android. expo-gl dessine à la définition native de l'écran
(3x sur iPhone) : la limite de densité ne s'applique qu'au web. Si l'iPhone peine, réglages
dans l'ordre : `light.shadow.mapSize`, puis les ombres, puis `msaaSamples` du `GLView`.

**Licences** : expo-gl, three, expo-asset, expo-file-system : MIT (`NOTICE.txt`). Modèles :
Quaternius et Kenney, CC0, pris sur des miroirs GitHub : **à retélécharger chez les auteurs et à
recuire avant l'App Store** (`assets/models/garden/NOTICE.txt`, comme D22 et D35).

_Changerait si_ le premier essai sur iPhone est saccadé : le modèle cuit reste valable (GLB
standard) pour un autre moteur, Filament compris ; seuls `garden-three.ts` et
`garden-renderer.ts` changent.

## D41 — Lecture en défilement vertical, deux écritures

Décision du propriétaire (25 novembre 2026). Le Coran ne s'affiche plus comme un livre : pas de
pages qu'on tourne, pas de cadre doré. Le lecteur est **un défilement vertical continu** du
texte, et il propose **deux écritures**, « Uthmani | Simple », comme la barre du bas de la
maquette `mushaf.png`. Détail : `specs/reader.md`, sections 2, 3 et 9.

- **Le modèle des 604 pages ne change pas.** Le défilement est fait d'une section par page du
  mushaf ; une page commence toujours par un nouveau verset dans l'édition de l'appli (vérifié
  pour les 604 pages), donc une section contient exactement les versets de sa page. Khatma,
  jardin, hizb et statistiques (D37) comptent les mêmes pages.
- **Compter une page** : sa section a été à l'écran le temps que la page demande, en tout (temps
  partagé entre les sections visibles selon leur place), sa première et sa dernière ligne ont été
  vues, et rien ne compte pendant qu'on lance le texte (plus de 1,5 écran par seconde). Une seule
  fois ; la khatma décide du reste (D8). La pastille vient quand le temps est atteint, sans attendre de
  quitter la page. Seuils : jugement, **à confirmer par le propriétaire** sur un iPhone.
- **Suite du 25 novembre 2026 (propriétaire)** : le temps demandé suit la page, 0,2 s par mot
  de la page du mushaf, 8 s au moins (`requiredReadingSeconds`, module khatma ; page médiane
  ≈ 26 s) ; il **s'additionne** d'un passage à l'autre, en quittant le lecteur et en revenant
  (gardé en mémoire tant que l'appli tourne, pas sur l'appareil) ; une **ligne d'eau** discrète
  sous le titre montre qu'une page est en train de compter, puis une goutte « cette page
  comptera » ; l'écran **reste allumé** dans le lecteur (`expo-keep-awake`, MIT, version
  choisie par `npx expo install`), rendu à la veille en arrière-plan et en quittant le lecteur.
- **Micro vert = suivi de la récitation** (propriétaire, 25 novembre 2026) : dans le lecteur, depuis
  le verset à la ligne de lecture, avec le vrai moteur (D42) ; mot récité en or, mot à relire en
  rouge sur rose, défilement qui garde la ligne courante à la ligne de lecture, barre verte de
  voix.png ; une page suivie en entière par la voix compte comme lue (une fois, règles D8).
  L'écran d'essai `/voice-follow` est retiré : son adresse ouvre le lecteur en suivi. La
  reconnaissance de passage s'ouvre depuis l'onglet Coran (bouton à côté du titre).
- **Écriture uthmani** : texte et police du Complexe, version 0.18 (D19, D21), inchangés.
- **Écriture simple** : la colonne `aya_text_emlaey` du **même fichier** du Complexe
  (`hafsData_v18.json`, déjà dans `tools/quran-data/sources`, même empreinte), copiée sans aucun
  changement dans `assets/data/verses/imlaei.json` : 6 236 versets, 77 491 mots, empreinte
  SHA-256 du texte canonique `177f2aeabdbde65193126fc402af2700cc81df7288eae9869e469a31dc493d6a`,
  vérifiée par `data:verify` et les tests. Licence : celle des données uthmani du même fichier,
  déjà acceptée par D19 et D21 (aucune clause de partage à l'identique, d'usage non commercial ni
  GPL). Police : Amiri Regular, SIL Open Font License 1.1, d'un paquet déjà livré
  (`@expo-google-fonts/amiri`) ; aucune dépendance nouvelle.
- **Ce texte n'a pas de voyelles.** Le Complexe le publie « pour la recherche » (notes de version
  du fichier). Écartées : Tanzil « Simple » (voyellé, CC BY 3.0 en copie conforme, mais la FAQ de
  tanzil.net le dit « for non-commercial purposes », et le site est inaccessible ici pour relire
  ses conditions), le fichier `ara-quransimple.json` des jeux d'essai (origine inconnue), les
  données de quran.com et de Tarteel QUL (conditions non lisibles ici). **Décision du
  propriétaire** (25 novembre 2026, sur la question posée) : garder l'écriture simple telle
  qu'elle est livrée, le texte imlâ'î du Complexe, sans voyelles.
- **Taille du texte** : elle suit Dynamic Type, multipliée par un réglage du lecteur à cinq crans
  (écart 110). Le zoom de la page (écart 34) est retiré.
- **Mémorisé** : l'écriture et la taille (`settings.readerScript`, `settings.readerTextSize`,
  document de stockage version 6, migration de la version 5) ; la page de reprise reste
  `lastOpenedPage`, à la page près.
- **Liste** : `FlatList` de React Native (pas de dépendance nouvelle ; FlashList, licence MIT,
  demanderait l'accord de l'architecte et n'est pas nécessaire tant qu'un iPhone X défile bien).

_Changerait si_ le propriétaire préfère une écriture simple voyellée (il faut alors une source dont
la licence passe sa règle), une reprise au verset près, ou si le défilement n'est pas fluide sur un
iPhone X (FlashList, avec l'accord de l'architecte).

## D42 — La voix reconnue sur l'iPhone : Whisper tiny spécialisé Coran, dans l'appli

Décidé le 25 novembre 2026 (développeur, branche `work/voice-engine`), dans le cadre de D5. Le
micro du lecteur ne faisait rien dans TestFlight : seul le moteur simulé existait, et il est
retiré des versions publiées. Le vrai moteur est maintenant derrière la même interface
(`SpeechEngine`) ; les écrans n'ont pas changé.

**Le moteur** : whisper.rn 0.7.4 (MIT ; whisper.cpp 1.9.3, Metal sur iPhone, module « Turbo »
compatible nouvelle architecture, sans plugin Expo propre) avec le modèle
`tarteel-ai/whisper-tiny-ar-quran` (Tarteel, Whisper tiny affiné sur la récitation du Coran,
Apache-2.0), converti en GGML et quantifié q8_0 : **43,5 Mo**. Le micro est un module local de
l'appli (`modules/voice-capture`, Swift, AVAudioEngine converti en 16 kHz) : whisper.rn 0.7 n'a
plus d'enregistrement intégré, et le module « audio-pcm-stream » qu'il propose est un module de
l'ancien pont de React Native (cible iOS 8). Le côté JavaScript est `src/data/speech` : la voix
découpée en phrases par son niveau, chaque phrase relue toutes les 1,2 s, un mot donné quand deux
lectures de suite s'accordent (le reste à la pause), jamais de silence donné à Whisper (il écrit
des mots sur du silence : mesuré, un mot inventé sur un enregistrement muet).

**Pourquoi tiny et pas base** : sur le même enregistrement (36:1–5, 28,6 s), tiny et base
(`whisper-base-ar-quran`, q5_1, 59,7 Mo) écrivent le même texte, base avec une faute de plus
(« يسسس ») ; l'encodeur de base est environ 4 fois plus lent (11,9 s contre 3,2 s ici). Le temps
compte plus : la récitation doit avancer pendant qu'on lit.

**Pourquoi pas la reconnaissance d'Apple** (`SFSpeechRecognizer`, arabe sur l'appareil) : modèle
généraliste d'arabe moderne, pas de mesure possible ici sans iPhone ; le modèle affiné sur le
Coran était l'hypothèse de D5 et les mesures ci-dessous la soutiennent. Autre piste vue et non
retenue : les moteurs Zipformer/ONNX récents (paquets 0.1 sur npm, licences de modèles à
vérifier) ; à regarder si Whisper déçoit sur l'iPhone.

**Livraison du modèle : dans l'appli, pas téléchargé au premier usage.** 43,5 Mo laissent l'appli
bien sous la limite de téléchargement en données mobiles (200 Mo) ; la reconnaissance marche hors
ligne dès l'installation ; aucun écran de téléchargement à dessiner, aucun serveur, aucune
connexion à l'usage. Le fichier n'est pas dans le dépôt : le plugin du module le télécharge
pendant `expo prebuild` et vérifie sa taille et son SHA-256 (`ef01ab44…8b52`) ; un fichier
différent arrête la compilation (`docs/BUILD.md`, « Le modèle de la voix »).

**Licences** (lues dans les fichiers, `NOTICE.txt`) : whisper.rn MIT ; whisper.cpp et ggml MIT ;
safe-buffer, buffer, base64-js MIT ; ieee754 BSD-3-Clause ; Whisper d'OpenAI MIT ; le modèle de
Tarteel Apache-2.0, d'après le fichier LICENSE de la publication qui le convertit et la NOTICE
d'une seconde conversion indépendante. **La fiche du modèle sur huggingface.co n'a pas pu être
ouverte** depuis la session (hôte refusé) : à vérifier une fois, en un clic.

**Ce qui a été mesuré** (whisper.cpp 1.9.6 compilé sous Linux, CPU, 2 cœurs partagés ; greedy,
arabe ; transcriptions passées dans la recherche du domaine) :

- **Lecteurs ordinaires** : 28 personnes différentes, enregistrées au téléphone, avec leurs
  fautes, récitant 83:1–3 (jeu de données de Faraj Elahjal, licence permissive, lecture de
  Qalun). Les mots arrivant un à un comme sur l'écran : **passage trouvé pour 19 sur 28 (68 %)**
  sur l'enregistrement entier (10 à 25 s), **14 sur 28** dans les 10 premières secondes ; **jamais
  un autre passage**. Les 9 autres : « rien trouvé », dit honnêtement. Trouvé en général après 3 à
  6 mots. Avant l'ajustement ci-dessous : 16 sur 28.
- **Récitant professionnel** (36:1–5, lent, provenance de l'enregistrement inconnue : mesure
  locale seulement, rien gardé) : trouvé à 10 s dans les six conditions essayées (propre, bruit
  rose, bande téléphone, ralenti de 15 %, écho, 24 dB plus bas). Une fenêtre isolée de 5 s ne
  suffit pas : elle ne contient qu'un à trois mots d'une récitation lente, sous le minimum de
  trois mots de la recherche.
- **Temps** : sur cette machine chargée par d'autres travaux (charge 13 à 24 sur 2 cœurs), 5,3 à
  30 s par fenêtre de 5 s (3,6 s de calcul au mieux). **Sans valeur pour l'iPhone**, qui utilise
  Metal : le temps réel sur le téléphone reste à mesurer.

**Ajustements du domaine (avec tests)** : `searchHeardWords` cherche aussi les 8 derniers mots
seuls quand tous les mots ne trouvent rien (le bruit d'une isti'adha mal entendue ne cache plus la
suite) ; sur 400 suites de 14 mots tirées au hasard du vocabulaire du Coran, aucune fenêtre de 8
mots n'a été trouvée (une fenêtre de 6 l'a été une fois : d'où 8). Le suivi mot à mot compare avec
la tolérance de la recherche (`isSameWordHeard`) et ne marque plus en rouge un mot répété. Les
28 transcriptions sont dans les tests (`src/domain/listening/__fixtures__/ordinary-readers.ts`).

**Seulement vérifiable sur l'iPhone** : la compilation du module Swift et de whisper.rn par
Xcode 26.6 ; l'alerte du micro et ses textes ; la qualité du micro de l'iPhone (meilleure que les
enregistrements téléphoniques mesurés, parfois en 8 kHz) ; le temps de chaque relecture avec
Metal ; la mémoire ; la reprise après un appel ; le seuil de voix (`minSpeechDb`, réglé sans
iPhone) dans une pièce bruyante.

**Décisions pour le propriétaire** :

1. **Héberger le modèle chez lui.** L'adresse actuelle est la publication GitHub d'un tiers
   (`mano270699/watazawwadu-models`). L'empreinte empêche un fichier changé d'entrer, pas la
   disparition de la publication. Proposition : créer une publication dans `Omazi/quran` avec ce
   même fichier, puis mettre son adresse en tête de `voice-model.json`.
2. **Une page de mentions dans l'appli** (déjà ouverte dans `NOTICE.txt`) : la licence Apache du
   modèle et la BSD d'ieee754 demandent que leur texte accompagne l'appli publiée sur l'App Store.

_Changerait si_ l'iPhone est trop lent avec tiny (essayer d'abord moins de relectures), si la
qualité déçoit chez de vrais lecteurs (base, ou un autre modèle affiné), ou si Apple propose un
modèle arabe coranique sur l'appareil.

## D43 — Toujours une sauvegarde locale et une sauvegarde dans le compte, synchronisées

Demande du propriétaire, 25 novembre 2026 : « l'utilisateur doit toujours avoir une sauvegarde
locale ainsi qu'une sauvegarde sur le cloud ; s'il change de téléphone, il retrouve ses infos ;
hors ligne (ou pendant une mise à jour), ça sauvegarde en local et, quand il se connecte, ça
synchronise ». Elle tranche la question laissée ouverte par `specs/social-database.md` (7.1) :
le journal **est** gardé sur le serveur, pour son propriétaire seul. Détail : `specs/sync.md`.

- **Le téléphone d'abord** : l'écran ne lit que le magasin local, toujours écrit en premier, dans
  un seul document qui contient aussi ce qui reste à synchroniser ; une seconde copie de ce
  document le remplace s'il est abîmé ; chaque version passée est relue sans perte.
- **Synchronisation par événements** (pages lues, temps par téléphone et par jour, réglages,
  signets, pauses), identifiés par leur contenu, fusionnés de façon déterministe ; jardin,
  statistiques et khatmas sont recalculés depuis le journal fusionné. Le dernier choix gagne pour
  les réglages (horloge hybride, corrigée par celle du serveur), sauf la graine des jardins (la
  plus ancienne) et l'introduction terminée (vrai gagne).
- **Serveur** : deux tables Supabase, propriétaire seul (RLS), écrites uniquement par deux
  fonctions qui contrôlent, bornent et limitent ; compactage des événements dépassés.
- **Compte** : la synchronisation commence après la connexion (Apple, Google, e-mail par Supabase
  Auth, à brancher) ; à la première connexion, tout le téléphone est envoyé et fusionné, jamais
  écrasé. En attendant le projet, l'appli fonctionne entièrement hors ligne et le dit dans les
  réglages.
- **Sans nouvelle dépendance** : pas de bibliothèque Supabase ni de NetInfo ; `fetch` suffit et un
  échec de requête dit qu'on est hors ligne.

Vie privée : le journal révèle une pratique religieuse. Sur le serveur, il est lisible par le
propriétaire du projet et par Supabase (clé secrète), par personne d'autre. Option écartée pour
l'instant : le chiffrer dans l'appli avec une clé que seule la personne a (une clé perdue serait
une progression perdue).
_Changerait si_ le propriétaire choisit le chiffrement côté appli, ou un autre serveur : seules la
migration et `createSupabaseSyncBackend` seraient à refaire, les règles de fusion restent.

## D44 — Le jardin pousse page par page, sous les yeux

Exigence du propriétaire (25 novembre 2026) : « Si un hizb fait environ 10 pages et que j'en ai lu
2 ou 3, je dois voir une petite pousse, quelque chose ; pas : je lis tout le hizb et, pop, un
changement. Le changement doit apparaître petit à petit selon le nombre de pages lues, et il doit
être animé. L'arbre ne doit pas apparaître d'un coup : il commence jeune, puis grandit, puis ses
feuilles apparaissent, comme un vrai arbre. » Remplace la précision de D35 « un élément
n'apparaît que lorsque son hizb est terminé ».

- **La croissance** est celle qui existait : `GrowingElement.growth`, pages comptées du hizb en
  cours sur ses pages (une page ne compte qu'après son temps de lecture, règle inchangée). La
  plante existe dès la première page comptée. Le module khatm donne aussi les pages
  (`currentHizbPagesRead`, `currentHizbPageCount`), pour « 3 pages sur 10 ». Les étapes sont
  nommées dans `domain/garden/growth.ts` : pousse (0 à 0,15), jeune arbre au tronc fin (0,15 à
  0,45), tronc qui s'épaissit et branches (0,45 à 0,75), feuillage (0,75 à 1), fleurs ou fruits en
  dernier. Sécheresse et flétrissement : inchangés.
- **En 3D** (`garden3d/growth-three.ts`) : l'élément qui pousse est dessiné à part avec les
  morceaux du modèle cuit (tronc et feuilles y sont déjà des maillages séparés) : une butte de
  terre et sa pousse (modèles Kenney, CC0, cuits dans le GLB, +7 Ko, à 27 % de la hauteur de
  l'arbre) dès la première page ; le jeune arbre sort de la pousse dès 10 %, plus haut qu'elle à
  30 % avec ses premières feuilles à la cime ; la pousse ne s'efface qu'entre 35 % et 45 %, quand
  l'arbre est nettement plus grand. Rien ne paraît jamais plus petit ni plus nu qu'une page avant
  (testé). Le tronc d'un jeune arbre est dessiné plus épais que sa part (×1,8 au début, puis ×1 à
  75 %), pour se lire sur le jardin entier ; son épaisseur dessinée ne fait que croître. Ses
  branches poussent depuis le tronc, ses feuilles gonflent grappe par grappe, du haut vers le bas
  (décalées, avec un léger rebond), ses fleurs ou fruits à la fin. Une plante sort de terre touffe
  après touffe ; un élément construit monte morceau par morceau, l'eau en dernier. À 1, c'est
  exactement l'élément de l'étape suivante : pas de saut.
- **Écart voulu au découpage demandé** : des premières feuilles viennent avec le jeune arbre (20 %
  du feuillage à 30 %, 40 % à 75 %), le gros du feuillage reste entre 0,75 et 1. Un jeune arbre
  sans aucune feuille ressemblait aux arbres nus d'un jardin qui sèche (feuillage 2 et 3) : on
  l'aurait cru mourant. **À confirmer par le propriétaire.**
- **L'animation** : quand l'accueil revient au premier plan (retour du lecteur compris), la plante
  pousse depuis la croissance montrée la dernière fois jusqu'à celle d'aujourd'hui, une seule
  fois (1,2 à 2,5 s, courbe de sortie forte du skill animate), dans la boucle de rendu, sans rendu
  React par image. La croissance montrée est gardée sur l'appareil, par plante
  (`garden-growth-shown`). Un hizb fini entre-temps : la plante finit sa croissance, puis la
  suivante sort de terre. « Réduire les animations » : la plante à sa croissance, sans animation.
  Le jardin d'un proche montre sa croissance sans l'animer.
- **Sans GL** (image de repli, vignettes) : l'élément, découpé des images (`grow/eNN.webp`,
  650 Ko, `tools/garden-pictures/growth-sprites.py`), est posé sur le jardin, plus petit, depuis
  son pied, un palier par étape. Feuillage vert seulement (pas de version fanée).

**Vérifié** : tests (pages et croissance, étapes, pose continue, mémoire, lecteur d'animation avec
horloge de test, scène three.js sans GL, surface avec un faux moteur de rendu) ; rendu hors écran
des arbres (grenadier, palmier, cyprès) à 0,05, 0,1, 0,2, 0,3, 0,45, 0,6, 0,9 et 1, de près et à la taille
de l'accueil, et des fleurs, canaux et murs, regardé.
**Pas vérifié** : la fluidité sur iPhone (aucun iPhone ici, D24), en particulier l'ombre recalculée
à chaque image pendant la pousse (environ 2 s).

_Changerait si_ le propriétaire veut un arbre sans feuilles jusqu'à 75 %, ou d'autres seuils.

## D45 — La reconnaissance de la voix mesurée sur de vraies récitations, puis réglée

Décidé le 26 novembre 2026 (développeur, branche `work/voice-bench`), à la demande du
propriétaire : « la reconnaissance est super importante ; personne n'a prouvé qu'elle reconnaît
une vraie récitation de bout en bout ». Complète D42.

**Le banc** (`tools/voice-bench`, README) : whisper.cpp 1.9.3 compilé depuis les sources que
whisper.rn 0.7.4 embarque, le modèle de l'appli (même SHA-256), les réglages de l'appli, **le vrai
moteur** (`whisper-speech-engine.ts`, rejoué sur une horloge simulée, chaque lecture comptée
`350 ms + 20 ms par mot` comme sur un iPhone : estimation) et **la vraie recherche**. 102
enregistrements : 30 lecteurs ordinaires (jeu de Faraj Elahjal, 83:1–3, téléphone 8 kHz, licence
permissive, voix inconnues des tests) et 6 récitants professionnels sur 24 passages, sourates
courtes et longues (EveryAyah : usage personnel et éducatif, mesure locale seulement ; **le modèle
a probablement été entraîné sur ces voix**, leurs chiffres sont optimistes). Extraits de 3, 6 et
10 s, un sur deux commençant au milieu d'un verset ; propre, bruit de pièce à 20 et 10 dB, bande
téléphonique. Aucun son dans le dépôt.

**Ce qui a été mesuré** (top-1 : premier passage annoncé juste ; « faux » : un autre passage
annoncé ; top-3 : le bon passage parmi les trois premiers classés à la fin) :

| Écoute comme sur le téléphone, 312 extraits | Avant               | Après               |
| ------------------------------------------- | ------------------- | ------------------- |
| top-1 / faux / top-3                        | 60,3 % / 0 / 72,4 % | 61,5 % / 0 / 72,4 % |
| 10 s propres · bruit 10 dB · téléphone      | 77 · 69 · 73 %      | 77 · 73 · 73 %      |
| 3 s · 6 s (propres)                         | 13 · 54 %           | 15 · 56 %           |
| lecteurs ordinaires · professionnels        | 44 · 68 %           | 45 · 69 %           |
| temps médian jusqu'au bon passage           | 6,5 s               | **5,2 s**           |

Ce temps compte chaque lecture de Whisper au même prix (estimation iPhone) : il ne montre pas le
repli de température (point 1 ci-dessous). Mesuré à part, sur cet ordinateur (2 cœurs x86, rien
d'autre en cours), mêmes extraits lus avec et sans repli : les 20 extraits les plus lents, **16,0 s
au pire avec le repli, 1,3 s sans** (63,6 s de calcul au total contre 18,8 s) ; 24 autres extraits
pris au hasard, 6,5 s au pire contre 1,1 s (29,1 s contre 17,4 s) ; 78 débuts d'enregistrement de
10 s, aucune différence (0,78 s par lecture, RTF 0,08). Sur 612 extraits lus en entier, mêmes
réponses : 60,9 % / 0 faux / 71,1 % avec le repli, 60,3 % / 0 / 71,1 % sans. Jamais
un autre passage annoncé, dans aucune mesure. Un extrait de 3 s ne contient souvent que 2 à 4 mots :
trop peu pour la recherche (3 mots au moins), c'est voulu.

**Changé dans l'appli** :

1. **Plus de repli de température** (`temperatureInc: 0`, `whisper-transcriber.ts`). Par défaut,
   whisper.cpp relit une lecture dont il doute jusqu'à cinq fois, à des températures croissantes,
   cinq candidats chaque fois. Sur ces récitations il doute de temps en temps (bruit, téléphone, lecteurs
   ordinaires, un mot coupé à la fin du son) : une lecture pouvait durer 12 fois plus, pour les
   mêmes passages trouvés. Sur l'iPhone, une lecture qui dure fige les mots à l'écran, et au-delà
   de 20 s l'écoute échoue (`transcribeTimeoutMs`).
2. **Les mots pas encore définitifs sont cherchés aussi** (`searchWithPartialWords`,
   `use-listening.ts`) : un mot ne devient définitif qu'à l'accord de deux lectures, une lecture
   plus tard ; chercher aussi les mots de la dernière lecture annonce le passage 1,3 s plus tôt
   (médiane), avec les mêmes seuils, sans aucun passage faux. Seul un `found` compte.
3. **306 transcriptions réelles** dans les tests (`__fixtures__/bench-recitations.ts`) : la
   recherche ne doit jamais nommer un autre passage et doit en trouver au moins autant.

**Essayé, pas retenu** :

- **Recherche en faisceau** (beam 3) : +1 point en écoute (63 %), +3 en lecture entière, pour
  1,7 à 2,2 fois plus de calcul et des réponses un peu plus lentes. Pas assez pour un coût non
  mesuré sur l'iPhone.
- **Phrase d'amorce** (« بسم الله الرحمن الرحيم ») : **sans aucun effet** avec `maxContext: 0`
  (whisper.cpp ne lit l'amorce que si le contexte est permis : transcriptions identiques sur 260
  extraits) ; avec un contexte de 64 jetons, **pire** : 53 % au lieu de 58 % (le modèle écrit la
  basmala ou mange les premiers mots, surtout sur 3 s).
- **Seuils de la recherche** (8 variantes : fenêtre des derniers mots 6 ou 12, mots proches à 0,65
  ou 0,6, seuils de score, pénalités) : au mieux +2 points, toujours au prix de plus de passages
  annoncés sur des suites de mots tirés au hasard du Coran (6 sur 1 000 aujourd'hui ; 10 à 19 sur
  1 000 avec les variantes), et parfois un passage faux sur les vrais extraits. La règle « jamais
  sûr à tort » passe avant : rien changé.

**Le levier qui reste : le modèle `base`** (`tarteel-ai/whisper-base-ar-quran`, Apache-2.0, GGML
q5_1, 59,7 Mo, même publication que `tiny`) — en lecture entière sur 260 extraits : **66 % au lieu
de 58 %**, lecteurs ordinaires **52 % au lieu de 35 %**, bruit 10 dB 81 % au lieu de 69 %, sans
aucun passage faux ; mais environ 4 fois plus de calcul (RTF 0,35) et 16 Mo de plus dans l'appli.
D42 l'avait écarté pour le temps, sur un seul enregistrement. **Question au propriétaire** : passer à
`base` après une mesure du temps d'une lecture sur un vrai iPhone (la preuve du simulateur donne
déjà le temps sur le processeur d'un Mac).

**Autre piste pour le propriétaire** : quand rien n'est trouvé, montrer « peut-être » les trois
passages les plus proches. Le bon passage y est 10 points plus souvent qu'en top-1 (72 % contre
62 %). C'est un changement d'écran, à dessiner : pas fait.

**La preuve native** : la version de contrôle de la vérification iOS fait lire de vraies
récitations par le module natif à la place du micro (même convertisseur, mêmes morceaux, temps
réel), puis par le vrai Whisper et la vraie recherche, dans le simulateur ; le passage trouvé et la
durée de chaque lecture sont publiés dans `crash-report.txt` (`docs/voice-test-clips.md`). Le module
refuse tout fichier hors de son dossier `voice-proof` ; une version TestFlight n'appelle jamais
cette fonction.

**Pas vérifié** : la durée d'une lecture sur un iPhone avec Metal (estimée, jamais mesurée ici) ;
le micro d'un iPhone dans une vraie pièce ; des récitants professionnels jamais entendus par le
modèle ; d'autres passages que 83:1–3 chez des lecteurs ordinaires ; la compilation du nouveau code
Swift (`startFile`) et la preuve elle-même, qui attendent la prochaine vérification iOS.

_Changerait si_ un iPhone montre que `base` tient le rythme (le prendre), ou que `tiny` est trop
lent même sans repli (relire moins souvent : `passEveryMs`).

## D46 — Niveaux, jardins et badges

Décisions du propriétaire (rappelées le 26 novembre 2026, maquettes `design/maquettes-2026-11-26/`).
Chaque khatma terminée donne un **badge** : l'étoile dorée à huit branches, le jardin complet
dedans, le numéro de la khatma. La khatma suivante fait pousser un **nouveau jardin**, lancé par
la première page lue (D20). **Niveau = khatmas terminées + 1** ; chaque niveau a son style, le même
pour tout le monde (D23). Sept jardins dans la première version, dans cet ordre : cour à fontaine,
oasis, verger au bord de l'eau, jardin de montagne, cerisiers en fleurs, pinède et clairière,
jardin de nuit (l'île sur un lac attend). **Au-delà du septième, on reste sur le dernier style**
jusqu'à ce qu'une mise à jour en ajoute (remplace « les jardins reviennent » de D23). Le niveau
est visible par défaut ; « Montrer mon niveau » (dans le Profil) le cache aux proches. Le profil
montre aux autres les badges et le jardin en cours. Les jardins à venir restent une **surprise** :
« À venir », ni nom ni image, sur le profil comme dans « Mes jardins ».

Choix de mise en œuvre (développeur, 26 novembre 2026) :

- Rien de nouveau n'est enregistré pour l'historique : il se déduit du journal (`domain/levels`),
  qui se fusionne déjà page par page entre téléphones. Deux réglages s'ajoutent (document v8) :
  `showLevel` (le plus récent gagne) et `celebratedKhatm` (nouvelle règle de synchro `highest`).
- La célébration s'ouvre une fois, dès la dernière page comptée (par-dessus le lecteur), ou à
  l'ouverture si la khatma vient d'un autre téléphone ; elle est marquée vue dès qu'elle s'affiche.
  Une khatma de plus de 7 jours (copie restaurée, vieux journal) n'est pas fêtée.
- **Images des niveaux 2 à 7 : provisoires.** Aucun jardin n'est dessiné en code (D12) : ils
  reprennent les images du niveau 1 avec une teinte légère propre à chaque style
  (`src/features/gardens/garden-style-art.ts`, registre des styles, TODO). Personne ne les voit
  avant une khatma complète. Les rendre avec l'outil de D22, puis remplacer l'entrée du registre.
- Le thème de `gardenVariant` (`theme-1` à `theme-4`, graine propre à l'utilisateur) n'est lu par
  aucun rendu ; le style vient du niveau. L'aligner sur D23 touche l'accueil (autre chantier).

_Changerait si_ le propriétaire voit les images provisoires et préfère une autre solution, ou
change l'ordre des jardins avant que des badges existent.
