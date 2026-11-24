# Spécification — données et structure du Coran

Périmètre : `src/domain/quran`, `src/data/quran`, `tools/quran-data`, `assets/data`,
`docs/DATA_SOURCES.md`.

## But

Fournir à toute l'appli un texte du Coran **exact et vérifiable**, la mise en page du
mushaf de Médine (604 pages, 15 lignes) et la structure (sourates, juz, hizb, pages).

## Exigence absolue

Aucun mot affiché ne doit différer de la source. Toute incohérence entre deux sources est
**signalée et résolue explicitement**, jamais masquée par un repli silencieux.

## Sources

À choisir et documenter dans `docs/DATA_SOURCES.md` (origine, version, licence, obligations
d'attribution, empreinte du fichier d'origine). Paquets npm autorisés en `devDependencies`
pour l'outil de génération uniquement. Une source dont la licence interdit la
redistribution dans une appli est refusée.

Point connu à traiter : dans les essais de maquette, l'alignement mot à mot entre la mise
en page par lignes et le texte uthmani échouait sur une vingtaine de versets. Il faut en
trouver la cause et la régler proprement (ou documenter précisément ce qui reste).

## Livrables

### 1. Outil de génération `tools/quran-data`

- `npm run data:build` régénère tout `assets/data` de façon déterministe (deux exécutions
  donnent des fichiers identiques).
- `npm run data:verify` revérifie les invariants et les empreintes sans régénérer.

### 2. Données générées `assets/data`

- Versets : `assets/data/verses/uthmani.json`, forme `{ "<sourate>": ["verset 1", ...] }`.
- Pages : découpées pour un chargement à la demande (par juz ou par tranche de pages).
- Structure : sourates (nom arabe, translittération, nombre de versets, mecquoise ou
  médinoise), premier verset de chaque page, juz et hizb.
- `integrity.json` : empreinte SHA-256 du texte canonique et compteurs.
- Le texte est stocké tel que publié par la source. Aucune substitution de caractère
  pour arranger une police.

### 3. Domaine `src/domain/quran`

`types.ts` existe et fait référence (on peut l'étendre, pas le casser). À ajouter :

- lecture et validation des clés de verset (`"18:10"`) avec erreurs explicites ;
- fonctions de structure, pures et synchrones, à partir des données de structure :
  page d'un verset, hizb et juz d'une page et d'un verset, première et dernière page de
  chaque hizb, sourates présentes sur une page ;
- `hizbPageRanges()` : tableau des 60 hizb `{ hizb, firstPage, lastPage }`, utilisé par la
  progression.

### 4. Accès aux données `src/data/quran`

Implémentation de `QuranRepository` sur les fichiers JSON, avec chargement à la demande et
cache mémoire borné. Compatible iOS, Android, web et Jest.

## Invariants à tester

- 114 sourates, 6 236 versets, 604 pages, 30 juz, 60 hizb.
- Chaque page a au plus 15 lignes ; les pages 1 et 2 sont un cas particulier connu.
- Chaque mot de chaque verset apparaît exactement une fois dans les pages, dans l'ordre.
- La concaténation des mots d'un verset dans les pages est identique au texte du verset.
- Les plages de pages des hizb couvrent 1..604 sans trou ; deux hizb voisins partagent au
  plus une page.
- L'empreinte recalculée est égale à celle de `integrity.json`.
- Entrées invalides (sourate 0, verset 300 de la sourate 1, page 605) : erreur explicite.
