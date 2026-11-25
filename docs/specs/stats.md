# Spécification — les compteurs de lecture (hasanat, versets, mots, temps)

Demande du propriétaire, 25 novembre 2026 (D37) : un compteur de hasanat (demandé dès le
24 novembre), et aussi le nombre de versets lus, le nombre de mots lus et le temps passé dans
l'appli. **Pour le prochain déploiement**, dans une section remarquable, joliment présentée.
Les proches voient, sur le profil de l'autre, ses mots lus, ses versets lus et ses hasanat.

## 1. Ce qu'on compte (module `src/domain/stats`, TypeScript pur)

Tout se déduit du journal de lecture (`khatm`) et des données du mushaf : rien n'est saisi à
la main, rien n'est compté deux fois.

- **Pages lues** : les entrées du journal, toutes khatmas confondues. Relire une page dans la
  même khatma ne compte pas (D8) ; la relire dans une khatma suivante compte de nouveau.
- **Mots lus** : la somme des mots des pages lues (la mise en page donne les mots de chaque
  page, une coupure de verset entre deux pages comprise). Les marques de fin de verset ne
  sont pas des mots.
- **Versets lus** : un verset compte quand **tous** ses mots sont sur des pages lues de la
  même khatma. Un verset coupé entre deux pages compte à la lecture de la seconde.
- **Lettres lues** : la somme des lettres des mots lus. Est une lettre : chacune des 28
  lettres de l'alphabet arabe sous toutes ses formes (alif et ses variantes, hamza seule ou
  portée, tâ' marbûta, alif maqsûra), telle qu'elle est **écrite** dans le texte uthmani.
  Ne sont pas des lettres : voyelles, sukûn, shadda, tanwîn, signes de pause et
  d'annotation, tatweel, alif suscrit et petites lettres suscrites. La règle exacte est
  écrite dans le code, testée sur des mots choisis, et **marquée à faire valider par une
  personne qualifiée** : les savants comptent les lettres de façons diverses.
- **Hasanat (estimation)** : lettres lues × 10, d'après le hadith rapporté par Ibn Mas'ûd
  (Sunan at-Tirmidhî n° 2910 : une hasana par lettre, multipliée par dix). L'écran dit
  toujours que c'est une estimation, avec sa source, et qu'Allah seul en connaît la
  récompense. Comme tout contenu religieux, la formulation est à faire valider.
- **Temps de lecture** : le temps passé dans le lecteur, appli au premier plan (déjà mesuré
  pour la règle des 30 secondes). **Temps dans l'appli** : le temps total au premier plan.
  Les deux sont gardés par jour dans le magasin (le journal ne contient pas d'heure).
- **Par période** : aujourd'hui, cette semaine, ce mois, depuis le début ; et par khatma.

Les totaux du Coran entier servent de contrôle : une khatma complète doit donner exactement
6 236 versets et le nombre total de mots et de lettres que donnent les données (tests).

Performance : calculer une fois les mots, versets et lettres de chaque page (table générée
ou calcul paresseux en mémoire), puis additionner : aucun recalcul du texte à chaque
affichage.

## 2. Ce que voient les proches

Le résumé publié (`GardenSummary`, `specs/social.md`) gagne trois nombres : `wordsRead`,
`versesRead`, `hasanatEstimate`, depuis le début. Ils suivent le réglage `showLevel`. Le
temps passé n'est pas publié (la demande ne le cite pas, et c'est plus personnel). Domaine
`social`, fausses données et table `garden_summaries` mis à jour, avec leurs bornes.

## 3. L'écran (lot suivant, sur ce modèle)

Une section à part entière, signature visuelle du profil : les quatre nombres en grand, la
période au choix, l'évolution par jour. Dessinée d'abord en maquettes fil de fer (skill
Wireframe), puis revue de design avant d'être montrée (D28). Spécification d'écran à venir.

État (25 novembre 2026, branche `work/profile`) : l'onglet « Profil » remplace « Réglages »
(`src/features/profile`). Maquette fil de fer retenue : « Le récit » (la période, les hasanat en
grand avec leur source, l'évolution du chiffre choisi, les autres chiffres, chaque khatma, puis
les réglages). Le temps est compté par `useForegroundTimeRecording` (racine de l'appli), par
lots d'une minute et au passage en arrière-plan ; le temps de lecture est le temps où un
lecteur est ouvert, appli au premier plan. La table des pages est construite une fois, après le
premier affichage (`page-stats-table.ts`). Formulations des hasanat : **à faire valider**.
