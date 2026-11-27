# `domain/listening` : l'écran d'écoute, sans audio

Spécification : [docs/specs/listening.md](../../../docs/specs/listening.md).

- `types.ts` : l'interface `SpeechEngine` (démarrer, arrêter, niveau de la voix de 0 à 1,
  mots reconnus, fin, autorisation du micro). L'appli ne connaît que cette interface ; le
  vrai moteur (D5, D42 : `src/data/speech`) est branché derrière sans toucher à l'écran.
- `listening-machine.ts` : les états de l'écran et la fonction pure `transition`. Elle ne
  connaît ni le moteur ni l'horloge : la fonctionnalité lui dit ce qui s'est passé.
- `passage-location.ts` : les versets d'un passage reconnu et la page où il commence.
- `heard-search.ts` : quel passage nomment les mots entendus. Tous les mots d'abord ; si la
  recherche ne trouve pas, les 8 derniers seuls, avec les mêmes seuils (le bruit des premiers
  mots d'un lecteur ordinaire ne doit pas cacher la suite). Seul un `found` des derniers mots
  remplace la réponse ; mesures dans D42.
- `audio-check.ts` : le contrôle par le son (D49, D50) : les passages à relire, et la décision.
- `quran-letters.ts` : le Coran en lettres (celles que compare `native/quran-decoding`) ; dit
  si les lettres d'une relecture ne sont dites qu'à un endroit (D50).
- `recitation-follow.ts` : le suivi mot à mot sur une page (voix.png). Les mots sont comparés
  comme la recherche les compare (`isSameWordHeard`) ; un mot répété n'est pas une erreur.

## Les états

`idle` → `starting` (micro demandé et ouvert) → `listening` → l'un de :
`found`, `ambiguous`, `not-found` (`nothing-heard`, `too-few-words`, `no-match`),
`microphone-denied`, `failed`, `closed` (arrêt avant le premier mot : rien à dire).
De tout état final, `opened` relance une écoute.

## Règles

- **Jamais sûr à tort** (`specs/recognition.md`) : un passage n'est annoncé que si la
  recherche répond `found`. Un résultat `ambiguous` ne se tranche pas ici : l'écoute continue,
  d'autres mots peuvent départager ; à la fin, tous les endroits à égalité sont listés.
- Les endroits à égalité sont rendus **dans l'ordre du mushaf** : la recherche les classe
  d'abord par score, et une liste d'égaux ne doit pas avoir l'air classée.
- Une liste coupée par la recherche (`truncated`) le dit (`isComplete: false`, `totalCount`).
- Un évènement tardif (mots après le résultat, second « Arrêter ») ne change rien ; une valeur
  impossible lève une erreur.
- Le niveau de la voix ne passe pas par la machine : il change plusieurs fois par seconde et
  va directement au dessin.
