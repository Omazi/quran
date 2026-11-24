# Données et structure du Coran

Vocabulaire commun (`types.ts`), structure du mushaf et intégrité du texte. Spécification :
`docs/specs/quran.md`. Origine et licence des données : `docs/DATA_SOURCES.md`.

TypeScript pur. Les données sont injectées : ce dossier ne lit aucun fichier. L'accès aux
fichiers générés est dans `src/data/quran`.

## Utilisation

```ts
import { quranRepository, quranStructure } from '@/data/quran';

// Structure : synchrone, calculée à partir de assets/data/structure.json.
const ref = quranStructure.verseRef('18:10'); // { surah: 18, verse: 10 }, vérifie que le verset existe
quranStructure.pageOfVerse(ref); // 294
quranStructure.hizbOfVerse(ref); // 30
quranStructure.juzOfPage(294); // 15
quranStructure.surahsOnPage(604); // [112, 113, 114]
quranStructure.hizbPageRanges(); // 60 × { hizb, firstPage, lastPage }, pour la progression

// Texte et pages : chargés à la demande.
const page = await quranRepository.getPage(294); // lignes, mots, fins de verset
const verse = await quranRepository.getVerse('18:10'); // uthmani par défaut
const minimal = await quranRepository.getVerse('18:10', 'uthmani-minimal');
const surah = await quranRepository.getSurahVerses(18);
```

## Règles à connaître

- **Le texte n'est jamais modifié.** Il est tel que la source le publie : le signe ۞ est
  collé au premier mot de 199 versets, le signe ۩ au dernier mot de 15 versets.
- **Couper un verset en mots : `splitVerseWords` uniquement.** Les mots sont séparés par une
  espace ordinaire. Le verset 2:72 contient une espace fine à l'intérieur d'un mot.
- **Deux textes, aucun en écriture simple.** `uthmani` est le texte du mushaf.
  `uthmani-minimal` est le texte « Uthmani Minimal » de Tanzil : même orthographe, moins de
  signes. L'écriture simple (imlâ'î) demande une autre source.
- **Cinq mots du texte uthmani en valent deux** pour la mise en page et pour le texte de
  Tanzil (15:7, 27:20, 36:22, 37:164, 41:47). Ils comptent pour un mot. Détail dans
  `docs/DATA_SOURCES.md`.
- **Les pages du mushaf n'existent qu'en `uthmani`.** `getPage` ne prend pas d'écriture.
- **Hizb et juz d'une page** : ceux de son premier verset. Le hizb suivant peut commencer
  plus bas sur la page ; elle appartient alors aux deux plages de `hizbPageRanges()`.
- **Entrée invalide** : `RangeError` (sourate 0, verset 300 de la sourate 1, page 605) ou
  `TypeError` (clé de verset mal formée). Rien n'est corrigé en silence.
- `parseVerseKey` vérifie la forme de la clé et la sourate. Seul `quranStructure.verseRef`
  sait combien de versets compte une sourate.

## Fichiers

| Fichier          | Rôle                                                    |
| ---------------- | ------------------------------------------------------- |
| `types.ts`       | Vocabulaire commun et interface `QuranRepository`       |
| `verse-key.ts`   | Lecture et écriture des clés de verset                  |
| `structure.ts`   | `createQuranStructure` : pages, hizb, juz, sourates     |
| `mushaf-page.ts` | De la mise en page stockée à la page affichée           |
| `words.ts`       | Découpage d'un verset en mots                           |
| `integrity.ts`   | Texte canonique dont `integrity.json` garde l'empreinte |
| `validation.ts`  | Gardes : numéros de sourate, de page, de hizb           |
