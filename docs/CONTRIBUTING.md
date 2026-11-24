# Règles de contribution

Langue : documentation en français ; code, noms et commentaires en anglais.

## Avant de coder

1. Lire `docs/ARCHITECTURE.md` et la spécification du module.
2. **Contester la spécification.** Noter ce qui est flou, contradictoire ou risqué, et le
   signaler avant d'écrire du code qui devine. Une hypothèse non signalée est un défaut.

## Code

- Simple d'abord : petites fonctions pures, noms complets, pas d'astuce.
- Types explicites sur toute API publique. `any` est interdit ; `as` doit être justifié
  par un commentaire.
- Entrées invalides : erreur explicite (`RangeError`, `TypeError`), jamais de valeur
  silencieusement corrigée.
- Pas de nombre magique : une constante nommée dans la configuration du module.
- Commentaires : le _pourquoi_, pas le _quoi_.
- Pas de nouvelle dépendance sans accord de l'architecte (taille, licence, maintenance).
- Un module expose son API par `index.ts` ; le reste est privé.

## Tests

- Chaque règle de la spécification a au moins un test, nommé d'après la règle.
- Tester les bords : 0, 1, maximum, dates limites, entrées vides, entrées invalides.
- Un test qui échoue n'est jamais supprimé ni affaibli pour passer : on corrige le code,
  ou on conteste la spécification auprès de l'architecte.

## Avant de rendre

`npm run check` doit passer : typage, lint, tests. Le rapport de fin dit honnêtement ce
qui est fait, ce qui ne l'est pas et ce qui reste douteux.

## Git

Branche `main` toujours verte. Messages de commit à l'impératif, en anglais
(`Add garden health decay`). Aucun secret, aucune clé, aucun fichier `.env` dans le dépôt.
