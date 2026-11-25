# Maquettes de référence

Captures des maquettes « Le jardin, version 2 », validées pour le parcours et la
composition des écrans.

| Fichier         | Écran                                                                 |
| --------------- | --------------------------------------------------------------------- |
| `bienvenue.png` | Premier lancement : terre nue                                         |
| `accueil.png`   | Accueil : jardin, compteur de hizb, arrosage du jour, dernier élément |
| `soif.png`      | Accueil après 3 jours sans lecture                                    |
| `mort.png`      | Jardin desséché                                                       |
| `nouveau.png`   | Hizb terminé : nouvel élément et son verset                           |
| `mushaf.png`    | Lecture du mushaf                                                     |
| `voix.png`      | Lecture à voix haute (lot 2)                                          |
| `shazam.png`    | Reconnaissance d'un passage (lot 2)                                   |
| `khatm.png`     | Khatma terminée                                                       |
| `visite.png`    | Visite du jardin d'un proche (lot 3)                                  |

À savoir :

- **Le jardin des maquettes est un dessin de référence.** L'appli le montre en images
  rendues à partir des modèles 3D choisis (D35) ; le rendu reste un composant remplaçable
  qui affiche un `GardenState`.
- Les boutons « Continuer avec Apple / Google » de l'écran de bienvenue appartiennent au
  lot 3 (comptes). Au lot 1, l'appli démarre sans compte.
- Couleurs, typographies et espacements : `src/ui/tokens.ts` fait foi, pas les captures.
