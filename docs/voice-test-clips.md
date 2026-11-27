# Les enregistrements de la preuve de la voix (vérification iOS)

La vérification iOS (`.github/workflows/ios-check.yml`, étape « Voice proof ») fait réciter de
vrais enregistrements au **vrai moteur** de la voix, dans le simulateur d'iPhone : le module natif
lit le fichier au lieu du micro, par le même convertisseur en 16 kHz et les mêmes morceaux de
100 ms, au rythme du temps réel ; Whisper (le modèle livré), le découpage en phrases et la
recherche du passage sont ceux de l'appli. Pour chaque enregistrement, le rapport publié
(`crash-report.txt` sur la branche `ci-screens`, section « Voice proof ») dit le passage trouvé,
au bout de combien de secondes, et la durée de chaque lecture de Whisper :

```
voice-proof: faraj-2__83-1-3.wav expected 83:1-3 | found 83:1-83:3 at 6.1 s after 6 words | 7 readings, median 420 ms, max 610 ms | stopped at the answer | OK
voice-proof: DONE right 4/5, wrong 0
```

Depuis D49, la ligne dit aussi les contrôles par le son (`2 audio checks, max 1840 ms, answer by
the check` quand c'est le contrôle qui a trouvé). `OK` : le bon passage ; `MISS` : rien d'annoncé (l'appli dit « rien trouvé ») ; `WRONG` : un autre
passage annoncé (ce qui ne doit jamais arriver). Le simulateur calcule sur le processeur du Mac
(Metal n'y est pas disponible pour Whisper) : ses durées ne sont pas celles d'un iPhone.

Seule la version de contrôle sait faire cela (`EXPO_PUBLIC_SCREEN_CHECK=1`, dossier
`src/features/screen-check`) ; une version TestFlight ne lit jamais de fichier à la place du micro.

## Les enregistrements

Ils sont listés dans `tools/ci/voice-clips.json`. **Aucun son n'est dans le dépôt** : chaque fichier
est téléchargé pendant la vérification depuis sa source, et gardé seulement si sa taille et son
empreinte SHA-256 sont celles de la liste.

Aujourd'hui : cinq lecteurs ordinaires du jeu de données de Faraj Elahjal (« Quran Recitation
Dataset », sourate Al-Mutaffifin 1–3, lecture de Qalun, enregistrements au téléphone en 8 kHz).
Licence : celle du dépôt (utiliser, copier, modifier, publier, distribuer, « tel quel ») ; ces
lecteurs ne sont pas parmi ceux des tests de l'appli. Limite : un seul passage. Les récitations de
récitants professionnels (EveryAyah) ne peuvent pas servir ici : leurs conditions n'autorisent
qu'un usage personnel et éducatif, sans redistribution.

## Ajouter ses propres enregistrements (la place est prête)

Pour éprouver d'autres sourates, des versets longs, une autre voix, un vrai iPhone dans une vraie
pièce :

1. Enregistrer en **WAV** (n'importe quelle fréquence, mono ou stéréo : le convertisseur de
   l'appli s'en charge), 5 à 25 secondes, un passage connu.
2. Le mettre en ligne à une adresse `https://` stable dont on a les droits, par exemple une
   publication (« release ») du dépôt `Omazi/quran` : seul le propriétaire peut juger qu'il
   accepte que ces enregistrements soient publics.
3. Ajouter une entrée à `tools/ci/voice-clips.json` (8 au plus) :

   ```json
   {
     "name": "omar-ikhlas__112-1-4.wav",
     "url": "https://github.com/Omazi/quran/releases/download/voice-clips/omar-ikhlas.wav",
     "bytes": 123456,
     "sha256": "…",
     "source": "Enregistré par le propriétaire, iPhone, salon"
   }
   ```

   Le nom dit ce qu'il contient : `<nom>__<sourate>-<premier verset>-<dernier verset>.wav`.
   Taille et empreinte : `wc -c fichier.wav` et `shasum -a 256 fichier.wav`.

## Le banc de mesure (hors du dépôt)

La preuve dans le simulateur porte sur quelques enregistrements. Les chiffres sur plus de 600
extraits (plusieurs récitants, 3, 6 et 10 s, début au milieu d'un verset, bruit de pièce, bande
téléphonique) viennent du banc `tools/voice-bench` (voir son README), sur un ordinateur, avec le
même whisper.cpp que l'appli.
