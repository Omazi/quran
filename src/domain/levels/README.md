# Niveaux, jardins et badges

Décisions du propriétaire : D23 (un jardin par niveau, le même pour tout le monde) et D46 (sept
jardins, badges, surprise des jardins à venir, « Montrer mon niveau »). TypeScript pur, temps
injecté. Tout passe par `index.ts`.

- **Rien n'est enregistré ici.** L'historique des khatmas terminées (numéro, dates, niveau, style)
  se déduit du journal de lecture (`getProgression`). Le journal se fusionne page par page entre
  téléphones : une khatma terminée hors ligne, ou à moitié sur deux téléphones, donne le même
  historique partout dès que les pages se rejoignent ; elle est datée du jour de sa dernière page.
- **Niveau** = khatmas terminées + 1, plafonné au nombre de styles (`levelOfKhatma`). Au-delà du
  septième jardin, on reste sur le dernier style jusqu'à ce qu'une mise à jour en ajoute (ajouter
  à la fin de `GARDEN_STYLES`, ne jamais réordonner).
- **Nouveau jardin** : le niveau passe au suivant dès la dernière page ; le jardin terminé reste
  affiché tant que la khatma suivante n'a aucune page (`hasStarted`, D20).
- **Surprise** : un niveau verrouillé ne donne ni nom ni style (`styleId: null`).
- **Célébration** (`khatmaToCelebrate`) : la dernière khatma terminée, une seule fois
  (`celebratedKhatm`, réglage synchronisé par la règle `highest`), et seulement si elle date de
  moins de `celebrationWindowDays` jours : une vieille khatma revenue avec une copie restaurée
  n'est pas fêtée.
- Le thème de `gardenVariant` (`domain/garden/variant.ts`, `theme-1` à `theme-4`) est une place
  réservée qu'aucun rendu ne lit ; le style d'un jardin vient d'ici.
