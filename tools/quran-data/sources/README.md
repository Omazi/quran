# Sources (copies conformes)

Ces fichiers sont des copies exactes, compressées avec gzip, des fichiers d'origine. On ne
les modifie jamais : `SHA256SUMS` donne l'empreinte de chaque fichier d'origine, et la
génération refuse toute copie qui ne lui correspond pas.

| Fichier                 | Origine                                                                                                               | Licence annoncée                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `quran.json.gz`         | `dist/quran.json` du paquet npm `quran-json@3.1.2`                                                                    | CC BY 4.0 ou CC BY-SA 4.0 (le paquet se contredit)           |
| `tanzil_simple.json.gz` | `dist/quran.json` du paquet npm `@muslims-community/quran@1.1.0` : texte « Uthmani Minimal » de Tanzil, malgré le nom | Texte : CC BY 3.0 et conditions de Tanzil, d'après le paquet |
| `qpages/NNN.json.gz`    | `pages/NNN.json` du paquet npm `quran-qcf4@1.1.0`                                                                     | MIT, Copyright (c) 2026 Mohamad Hajj Rabee                   |

Origine détaillée, ce qui est établi et ce qui ne l'est pas, texte de la licence MIT et
risques ouverts : [docs/DATA_SOURCES.md](../../../docs/DATA_SOURCES.md).

Pour lire un fichier : `gunzip -c quran.json.gz | head -c 300`. Pour contrôler une
empreinte : `gunzip -c quran.json.gz | sha256sum`.
