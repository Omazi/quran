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

## Lot 3 — Les proches

Comptes, proches, visite des jardins, jardins partagés (khatm de groupe), confidentialité.

## Lot 4 — Comprendre et prolonger

Récits, contextes de révélation (sources vérifiées), écriture simple, widgets, rappels,
mode enfants.

## Questions ouvertes

- Rythme minimal : avec les réglages actuels (un jour manqué = +1, un jour lu = −3), lire
  un jour sur quatre suffit à garder le jardin en vie ; un jour sur cinq, il finit par
  mourir. À ajuster si c'est trop indulgent (constante `droughtDaysRecoveredPerWateredDay`).

- Nouvelle khatma : la première page lue après la 604e ouvre un nouveau jardin. Faut-il
  demander une confirmation avant (« Commencer un nouveau jardin ? ») ? Proposé : oui.
- Jardin complet entre deux khatmas : il ne peut plus être arrosé. Proposé : il ne se
  dessèche pas tant que la khatma suivante n'a pas commencé.

- Direction visuelle à choisir (trois directions dans `design/brand-spec.md`).
- Provenance et style des modèles 3D du jardin.
- Premier lancement : 16 pages sans « Passer », ou 10 pages selon les règles d'Apple.
- Design du premier lancement à retravailler (pages « lecture à voix haute » et
  « rappels » non validées).
- Présentation du texte du Coran (police, mise en page) à revoir avec le propriétaire.

- Nom de l'application.
- Style final du jardin.
- Autorisation des polices du complexe du roi Fahd.
- Validation des contenus religieux par un enseignant (versets associés au jardin, récits).
