# Architecture

## Principe

Une seule règle structure tout le code : **les dépendances pointent vers le domaine**.

```
src/app        écrans et navigation (Expo Router) : fins, sans logique
   │
src/features   un dossier par fonctionnalité : composants, hooks, état d'écran
   │
src/ui         système de design : jetons (couleurs, typo, espacements) et composants de base
   │
src/data       stockage et services : implémente les interfaces déclarées par le domaine
   │
src/domain     règles métier en TypeScript pur : aucun import React, Expo, stockage ou UI
```

- `src/domain` ne dépend de rien d'autre que de lui-même. ESLint le vérifie
  (`no-restricted-imports` dans `eslint.config.js`).
- Le domaine déclare les interfaces dont il a besoin (par exemple `QuranRepository`) ;
  `src/data` les implémente. On peut donc changer de stockage sans toucher aux règles.
- Les écrans (`src/app`) ne contiennent que de la composition. Toute logique testable vit
  dans le domaine ou dans un hook de `src/features`.

## Modules du domaine

| Module               | Rôle                                                                                | Spécification                          |
| -------------------- | ----------------------------------------------------------------------------------- | -------------------------------------- |
| `domain/shared`      | Dates locales (`LocalDate`)                                                         | —                                      |
| `domain/quran`       | Vocabulaire commun, structure du mushaf (sourates, pages, hizb), intégrité du texte | [quran.md](specs/quran.md)             |
| `domain/khatm`       | Journal de lecture, progression, objectif du jour, série                            | [khatm.md](specs/khatm.md)             |
| `domain/garden`      | État du jardin : 60 étapes, santé, dégradation, renaissance                         | [garden.md](specs/garden.md)           |
| `domain/recognition` | Normalisation de l'arabe, recherche de versets tolérante, suivi mot à mot           | [recognition.md](specs/recognition.md) |

Les modules communiquent par des valeurs simples passées en paramètre. Exemple : le jardin
ne lit pas le journal de lecture, il reçoit « nombre de hizb terminés » et « jours arrosés ».

## Règles transverses

- **Le temps est injecté.** Aucune fonction du domaine n'appelle `Date.now()` : la date du
  jour est un paramètre. Les règles sont ainsi déterministes et testables.
- **Les jours sont des `LocalDate`** (`YYYY-MM-DD` dans le fuseau de l'utilisateur),
  convertis une seule fois à la frontière de l'appli.
- **Le texte du Coran est une donnée générée, jamais écrite à la main.** Il sort de
  `tools/quran-data`, avec une empreinte vérifiée par les tests (voir `specs/quran.md`).
  L'affichage n'altère pas la donnée : un ajustement propre à une police se fait au rendu.
- **Les réglages métier sont des constantes nommées** regroupées dans un objet de
  configuration par module, pas des nombres épars dans le code.
- **Le moteur 3D et le moteur de reconnaissance vocale sont derrière des interfaces** :
  le domaine décrit _quoi_ afficher ou reconnaître, pas _comment_.

## Tests

- Domaine : tests unitaires Jest à côté du code (`__tests__/`), sans simulateur.
- Tests d'acceptation écrits par un testeur indépendant à partir de la spécification
  (`__tests__/acceptance/`).
- Interface : vérifiée par export web et captures d'écran, puis sur appareil réel.
