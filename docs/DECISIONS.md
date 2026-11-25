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
