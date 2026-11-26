# Banc de mesure de la voix

De vraies récitations, passées par **le même whisper.cpp que l'appli** (1.9.3, les sources que
whisper.rn 0.7.4 embarque, `node_modules/whisper.rn/cpp`), **le même modèle** (le fichier GGML de
`modules/voice-capture/voice-model.json`, vérifié par son SHA-256), **les mêmes réglages** que
`whisper-transcriber.ts` (repris de `RNWhisperJSI.cpp`, `createTranscribeConfig`), **le vrai moteur**
de l'appli (`whisper-speech-engine.ts` : découpage en phrases, relectures, accord de deux lectures)
et **la vraie recherche** du passage (`searchHeardWords`). Seul le processeur change : un ordinateur
ici, Metal sur l'iPhone. Résultats et décisions : `docs/DECISIONS.md`, D45.

Rien de ce banc n'entre dans l'appli. **Aucun son n'entre dans le dépôt** : les enregistrements
restent dans un dossier hors du dépôt (le script refuse d'écrire dedans) ; seuls du texte et des
chiffres en sortent.

## Les enregistrements

| Source                                                                                                            | Licence                                                                                             | Usage ici                                                                                 |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Faraj Elahjal, « Quran Recitation Dataset » (83:1–3, Qalun, ~320 lecteurs ordinaires, téléphone 8 kHz)            | permissive (LICENSE du dépôt : utiliser, copier, modifier, publier, distribuer)                     | 30 lecteurs, **jamais vus** par les tests de l'appli ; aussi la preuve dans le simulateur |
| EveryAyah, par le miroir octet pour octet `MohamedAbulgasem/Taqwa-data` (6 récitants professionnels, 24 passages) | **non permissive** : usage personnel et éducatif (conditions d'alquran.cloud), droits aux récitants | mesure locale seulement, jamais dans le dépôt ni dans la CI                               |

**Biais connu** : le modèle de Tarteel a été affiné sur EveryAyah ; ces six récitants ont très
probablement été entendus pendant l'entraînement. Leurs chiffres sont donc **optimistes** ; ceux
des lecteurs ordinaires (voix inconnues, téléphone, autre lecture, fautes) sont les plus proches
d'un vrai utilisateur.

Chaque enregistrement existe en cinq conditions : propre, bruit de pièce synthétique (bruit rose,
grondement, ronflement du secteur) à **20, 15 et 10 dB** de rapport signal/bruit, et **bande
téléphonique** (300–3 400 Hz, passée par 8 kHz). Les extraits durent **3, 6 et 10 s** ; un
enregistrement sur deux commence **au milieu de son premier verset**.

## Lancer

```bash
# 1. Le moteur (2 à 5 minutes) et le modèle
OBJ_DIR=<travail>/obj bash tools/voice-bench/build-driver.sh <travail>/whisper-driver
curl -L -o <travail>/ggml-quran-tiny-q8_0.bin <adresse de voice-model.json>   # vérifier le SHA-256

# 2. Les enregistrements (hors du dépôt)
python3 -I tools/voice-bench/prepare-clips.py <données> <liste des fichiers Faraj>

# 3. La mesure : chaque extrait lu en entier (rapide), ou écouté comme sur le téléphone
VOICE_BENCH_MANIFEST=<données>/manifest.json VOICE_BENCH_WORK=<travail> \
VOICE_BENCH_CONFIG=app VOICE_BENCH_PHASE=offline,offline-score npx jest tools/voice-bench --runInBand
VOICE_BENCH_PHASE=listen,score ...   # le moteur de l'appli, au temps simulé de l'iPhone
```

Variables : `VOICE_BENCH_CONFIG` (réglages nommés dans `voice-bench.test.ts`),
`VOICE_BENCH_DECODING` / `VOICE_BENCH_ENGINE` (réglages en JSON), `VOICE_BENCH_MODEL`,
`VOICE_BENCH_MATCHERS` (variantes de la recherche, chacune avec son index),
`VOICE_BENCH_STREAMS` (filtre), `VOICE_BENCH_PLAN` (conditions et durées), `VOICE_BENCH_TAG`,
`VOICE_BENCH_SCORE_TAG`, `VOICE_BENCH_FIXED_MS` / `VOICE_BENCH_PER_WORD_MS` (durée d'une lecture
sur l'iPhone simulé). Les lectures sont gardées en cache (`cache-<modèle>.jsonl`).

**Ne lancer qu'une mesure à la fois** : ggml attend ses fils en tournant ; deux mesures sur deux
cœurs se ralentissent l'une l'autre d'un facteur 10 et faussent les temps.

## Ce qu'on compte

- **top-1** : le premier passage annoncé (comme l'écran, au premier `found`) touche les versets
  entendus ; **wrong** : un autre passage annoncé (la règle « jamais sûr à tort ») ;
- **top-3** : le bon passage est annoncé, ou est parmi les trois premiers que la recherche classe
  à la fin (seuil abaissé à 0,4) ;
- **temps** : médiane, depuis le premier son de l'extrait, de l'annonce juste. En lecture entière,
  les mots sont étalés régulièrement sur l'extrait (estimation) ; en écoute, c'est l'horloge
  simulée : chaque lecture de Whisper dure `350 ms + 20 ms par mot` sur l'iPhone (estimation, pas
  une mesure) ;
- **trouvé au hasard** : sur 1 000 suites de 3 à 14 mots tirés au hasard du Coran, données mot à
  mot, combien la recherche en annonce une (le prix d'une recherche plus tolérante) ;
- **RTF** : temps de calcul sur la durée de son, sur cet ordinateur (2 cœurs x86 virtuels).

## Ce qui n'est pas vérifié

La durée réelle d'une lecture sur un iPhone (Metal) ; la qualité du micro d'un iPhone dans une
vraie pièce ; des récitants professionnels jamais entendus par le modèle ; d'autres passages que
83:1–3 chez les lecteurs ordinaires.
