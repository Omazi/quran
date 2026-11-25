# Lots

## Lot 1 — Lire et faire pousser (en cours)

État de chaque module : _à faire_ → _rendu par le développeur_ → _testé par un testeur
indépendant_ → _validé_.

- [ ] Données du mushaf : texte uthmani, 604 pages, structure, empreinte d'intégrité — **à faire**
- [ ] Progression : journal de lecture, hizb terminés, objectif du jour, série, badges —
      **première version rendue ; à mettre à jour (décisions D8 à D10), puis à tester**
- [ ] Jardin : 60 étapes, santé, dégradation, renaissance, pause, un jardin par khatma —
      **première version écrite, non relue ; à mettre à jour (D9, D10), puis à tester**
- [ ] Reconnaissance (cœur) : normalisation, recherche de versets, suivi mot à mot — **à faire**
- [ ] Rappels : plan de notifications locales tiré de l'état du jardin — **à faire, après le
      module jardin**
- [ ] Interface (iOS d'abord) : premier lancement, accueil avec jardin, lecteur de mushaf,
      réglages — **en cours**
- [ ] Jardin en 3D sur appareil (test Filament), style final du jardin

## Lot 2 — La voix

Micro, modèle sur l'appareil, lecture suivie, reconnaissance d'un passage (« Shazam »).

- **Écran d'écoute** : au niveau de celui de Shazam (D27). État au 24 novembre 2026 :
  - Trois directions dessinées à la main (l'onde, la page, le jardin qui écoute) puis un
    prototype d'eau en mouvement : **refusés**, jugés moches.
  - Six styles générés en images ; le propriétaire a aimé les particules, les ondes et la
    rosace. Les trois ont été animés.
  - **Retenu : la rosace, en thème clair** (« il est beau »). C'est l'étoile à huit branches
    qui marque les quarts de hizb dans le mushaf : deux carrés superposés, huit carrés égaux
    autour d'une étoile, des pétales qui partent à chaque souffle de la voix.
  - Mode sombre : la version vert sombre et or n'a pas plu (« peut-être les couleurs »).
    Remplacée par le même dessin aux valeurs de nuit des couleurs de l'appli (D29) : papier
    sombre, eau et or. **Validée par le propriétaire le 24 novembre 2026.** Les essais
    « Encre » et « Lapis » sont retirés.
  - Reste à dessiner : le moment où le passage est reconnu, les cas « rien trouvé » et
    « micro refusé », la bannière en haut de l'écran et l'île dynamique.
  - Les ondes restent une seconde piste aboutie ; la sphère de particules n'est pas au
    niveau et n'a pas été montrée.
  - Prototype web de référence : hors dépôt pour l'instant (`gen/ecoute/styles/`). À refaire
    en natif dans l'appli, piloté par le vrai niveau de la voix.
- **Mémoriser (« le prof »)**, demande du propriétaire (24 novembre 2026). On choisit une
  sourate à apprendre, puis des exercices de difficulté croissante :
  1. les versets sont affichés ;
  2. des mots sont retirés : retrouver le mot qui va à cet endroit ;
  3. donner la suite de l'aya, à voix haute (reconnaissance) ou en la choisissant ;
  4. choisir la bonne aya parmi plusieurs.

- **Écouter un récitateur, avec suivi** (demande du propriétaire, 25 novembre 2026, à
  traiter plus tard) : choisir parmi plusieurs récitateurs ; pendant la récitation, le
  lecteur tourne les pages tout seul et montre le mot récité. Demande l'audio de chaque
  récitateur et le minutage mot à mot de chaque récitation : sources et licences à
  vérifier avant tout (règle des licences permissives).

## Lot 3 — Les proches

Comptes, proches, visite des jardins, jardins partagés (khatm de groupe), confidentialité.

- **Groupes et compétitions** (demande du propriétaire, 24 novembre 2026) : les gens créent
  des groupes et se mesurent entre eux, par exemple à qui lit le plus. À préciser avec lui :
  ce qui compte (pages nouvelles, récitation reconnue à voix haute, relectures), pour que
  relire sans cesse la même page ne fasse pas gagner (D8).
- **Compteur de hasanat**, pour chaque personne (demande confirmée le 24 novembre 2026) : un
  moteur dans le domaine, qui compte les lettres lues. Base : le hadith de la lettre, une
  hasana par lettre récitée, multipliée par dix (Sunan at-Tirmidhî n° 2910, d'après Ibn
  Mas'ûd ; référence relevée le 24 novembre 2026, à faire confirmer par une personne
  qualifiée comme tout contenu religieux). À trancher : la façon de compter les lettres dans
  l'écriture uthmani, et la formulation à l'écran (une estimation, avec sa source).

## Lot 4 — Comprendre et prolonger

Récits, contextes de révélation (sources vérifiées), écriture simple, widgets, rappels,
mode enfants.

- **Par sourate, deux sections** (rappel du propriétaire, 24 novembre 2026) : l'histoire de
  la sourate (son contexte de révélation, sabab al-nuzûl) et les récits qu'elle contient.
- **Règle** : on doit être certain de ce qu'on rapporte. Rien n'est écrit sans source
  nommée ; la source s'affiche avec le texte ; un récit dont l'authenticité est discutée est
  dit tel ou laissé de côté ; tout est relu par une personne qualifiée avant publication.
  Rien de tout cela ne s'écrit de mémoire.

## Questions ouvertes

- **Signature des écrans** : la relecture design note les écrans « sobres » (originalité
  4 sur 10) : rien n'y est propre à l'appli tant que le jardin n'a pas ses images. Deux
  choses la feront monter : les modèles du jardin (D12) et le choix parmi les maquettes
  fil de fer des pages « voix » et « rappels ».
- **Premier lancement, structure à venir** : une seule scène de jardin fixe en haut, qui
  change quand on tourne la page, et un pageur de texte dessous (aujourd'hui chaque page
  porte sa propre scène, qui glisse avec le texte).

- **Édition du mushaf** : tranché, édition de 1441 H (D17). Reste à comparer les 25 pages
  qui diffèrent du mushaf classique à un exemplaire imprimé de cette édition.
- **Écriture simple** : livrée avec D41 (colonne imlâ'î du Complexe, sans voyelles). Le
  propriétaire a décidé de garder ce texte sans voyelles (D41). Le fichier Tanzil Simple de provenance inconnue sert toujours
  seulement aux tests de la reconnaissance.
- **Licences des textes** : à vérifier à la source avant publication (voir
  `DATA_SOURCES.md`). Un écran de crédits est nécessaire.
- **Cinq mots collés** dans le texte uthmani (15:7, 27:20, 36:22, 37:164, 41:47) : gardés
  tels que publiés ; à faire confirmer par un enseignant.

- Jardin complet entre deux khatmas : il ne peut plus être arrosé. Proposé : il ne se
  dessèche pas tant que la khatma suivante n'a pas commencé.

- Direction visuelle à choisir (trois directions dans `design/brand-spec.md`).
- Jardins : télécharger les packs à la source officielle ; choisir sept jardins parmi les
  huit styles retenus et leur ordre (quel jardin pour quel niveau).
- Premier lancement : 16 pages sans « Passer », ou 10 pages selon les règles d'Apple
  (la page « lecture à voix haute » est dessinée depuis le 25 novembre 2026).
- Design du premier lancement : page « rappels » non validée.
- Présentation du texte du Coran (police, mise en page) à revoir avec le propriétaire.

- Nom de l'application : **Jannatuk** (D31). Reste à le faire accepter par Apple (création
  de la fiche) et à faire confirmer son sens par une personne qualifiée.
- Style final du jardin.
- Autorisation des polices du complexe du roi Fahd.
- Validation des contenus religieux par un enseignant (versets associés au jardin, récits).
