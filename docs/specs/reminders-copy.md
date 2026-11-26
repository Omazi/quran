# Textes des rappels

**À relire par un arabophone natif et par une personne de science** (`عالم` / étudiant en
sciences islamiques) avant toute version publique : les versets, les hadiths, leur sens en français
et en anglais, et tout l'arabe. Rien ici n'a encore été relu.

Décision du propriétaire du 25 novembre 2026, après avoir reçu le rappel du soir (« حديقتك تنتظرك —
بضع صفحات، ويبقى ماؤها جاريًا. », jugé « pas ouf ») : un ton **spirituel**, chaleureux, jamais
culpabilisant ; chaque notification dit **où reprendre** et **ce qui reste de l'objectif** ; le
jardin passe au second plan. Ce document complète `reminders.md` (« Texte des notifications »).

## Ce qui change par rapport à l'ancienne règle

`reminders.md` disait « rien de sensible sur un écran verrouillé » : aucun nombre, aucune sourate
hors du vendredi. **Le propriétaire a choisi l'inverse** : la sourate et la page de reprise, et le
nombre de pages du jour, sont dans le texte. Garde-fou : chaque rappel a désormais un texte de
remplacement quand la personne masque les aperçus (catégories iOS `reading-reminder` et
`friday-kahf`, texte `hiddenPreview` : « Un rappel pour toi »). Écart 127 de `docs/design/SKILLS.md`.

## Construction

- **Variantes** (`notifications.json › variants.<type>.<n>`) : 8 pour `daily-goal`, 2 ou 3 par état
  du jardin, 3 pour le vendredi. Leur source est dans `src/features/reminders/reminder-copy.ts`
  (`REMINDER_COPY_SOURCES`, une entrée par variante, dans l'ordre).
- **Choix par la date** (`copyVariantIndex`, domaine) : jours écoulés depuis le 1er janvier 2000,
  modulo le nombre de variantes ; semaines pour `friday-kahf` et `come-back` (hebdomadaires).
  Déterministe (replanifier ne change rien) ; deux rappels consécutifs d'un même type n'ont jamais
  la même variante. Aucun changement d'horizon : le plan couvre toujours 30 jours.
- **Données** : `{{where}}` = sourate (nom translittéré en français et anglais, nom arabe en
  arabe, comme le lecteur) et page de reprise, calculées par `resolveResumePage` puis
  `pageSurah`, exactement comme au toucher ; sans point de reprise (lecteur jamais ouvert, rien
  lu), « Commence à la première page. », là où le lecteur s'ouvre. `{{goal}}` (rappel du jour
  seulement) = pages restantes ce jour-là si rien de plus n'est lu (`readingGoalOn`) : aujourd'hui
  ce qui reste, les jours suivants l'objectif entier. `{{page}}` = 293, la page d'Al-Kahf.
- **Toucher** : inchangé. Rappel du jour et états du jardin → lecteur à la page de reprise (relue
  au moment du toucher : la même que le texte, puisque tout changement de page replanifie) ;
  vendredi → page 293 ; `dead` et `come-back` → accueil, donc leur texte ne nomme aucune page. Le
  lien est `/reader/<page>`, sans `follow=1` : le micro ne démarre jamais seul.
- **Replanification** : la page ouverte dans le lecteur entre dans les déclencheurs ; la signature
  d'une notification porte une empreinte de ses mots (`type@heure@langue#empreinte`), donc un
  texte périmé est remplacé. Les appels rapprochés sont fusionnés par la synchronisation.
- **Longueurs** : titre ≤ 35 lettres, corps ≤ 90, vérifiées par les tests dans les trois langues
  avec le pire cas (page 604, objectif à trois chiffres, plus long nom de sourate). On compte les
  lettres, pas les signes diacritiques (`\p{M}`), qui n'ont pas de largeur propre.
- **Aperçus du premier lancement** : `kinds.<type>` garde un exemple sans données par type, dans la
  même voix (montré par `src/features/onboarding/pages/notification-previews.tsx`).

## Règles d'écriture suivies

- Versets : en arabe, **copie exacte** de `assets/data/verses/uthmani.json` (un test le vérifie),
  entre ﴿ ﴾ ; un signe de pause qui fermerait l'extrait est laissé de côté. En français et en
  anglais : **sens, paraphrase de notre main**, pas une traduction littérale ; référence
  sourate:verset dans le tableau des sources.
- Hadiths : seulement des hadiths connus et authentiques, référence et degré ci-dessous. En
  français et en anglais, paraphrase fidèle, sans guillemets (rien n'est attribué mot pour mot au
  Prophète ﷺ). En arabe, le texte exact entre « » quand il est cité (H7), sinon une paraphrase
  sans guillemets.
- Formule ﷺ : aucune notification ne nomme le Prophète ﷺ (place comptée) ; ce document l'écrit ﷺ.
- Voix (charte) : tutoiement, phrases courtes, jamais de reproche ; « Allah » en français et en
  anglais ; chiffres occidentaux en arabe (écart 25).

## Sources

| Id      | Texte arabe (référence pour la relecture)                                                     | Sens utilisé                                                                                             | Référence                                                                      | Degré                                                                                                                                                        | Vérifié sur                                                  |
| ------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| H1      | مَنْ قَرَأَ حَرْفًا مِنْ كِتَابِ اللهِ فَلَهُ بِهِ حَسَنَةٌ، وَالْحَسَنَةُ بِعَشْرِ أَمْثَالِهَا                                    | Chaque lettre lue du Livre d'Allah vaut une bonne action, multipliée par dix                             | at-Tirmidhî 2910, d'Ibn Mas‘ûd                                                 | hasan (HadeethEnc) ; at-Tirmidhî : hasan sahîh gharîb, al-Albânî : sahîh (**à confirmer** sur une édition imprimée)                                          | hadeethenc.com/fr/browse/hadith/6275                         |
| H2      | اقْرَؤُوا القرْآنَ؛ فَإنَّهُ يَأتِي يَوْمَ القِيَامَةِ شَفِيعًا لأَصْحَابِهِ                                            | Lisez le Coran : il viendra le Jour de la Résurrection intercéder pour ses compagnons                    | Muslim 804, d'Abû Umâma al-Bâhilî                                              | sahîh                                                                                                                                                        | hadeethenc.com/en/browse/hadith/5383 (numéro : Sahîh Muslim) |
| H3      | سُئِلَ النَّبِيُّ ﷺ: أَيُّ الأَعْمَالِ أَحَبُّ إِلَى اللَّهِ؟ قَالَ: «أَدْوَمُهَا وَإِنْ قَلَّ»                                    | Les œuvres les plus aimées d'Allah sont les plus régulières, même peu nombreuses                         | al-Bukhârî 6465, Muslim 783, de ‘Â’isha                                        | sahîh (muttafaq ‘alayh)                                                                                                                                      | hadeethenc.com/ar/browse/hadith/66227                        |
| H4      | الْمَاهِرُ بِالْقُرْآنِ مَعَ السَّفَرَةِ الْكِرَامِ الْبَرَرَةِ، وَالَّذِي يَقْرَأُ الْقُرْآنَ وَيَتَتَعْتَعُ فِيهِ، وَهُوَ عَلَيْهِ شَاقٌّ، لَهُ أَجْرَانِ | Celui qui le lit en butant, avec peine, a deux récompenses                                               | Muslim 798, al-Bukhârî 4937, de ‘Â’isha                                        | sahîh (muttafaq ‘alayh)                                                                                                                                      | hadeethenc.com/ar/browse/hadith/10113                        |
| H5      | مَثَلُ الْمُؤْمِنِ الَّذِي يَقْرَأُ الْقُرْآنَ كَمَثَلِ الْأُتْرُجَّةِ، رِيحُهَا طَيِّبٌ وَطَعْمُهَا طَيِّبٌ                                | Le croyant qui lit le Coran est comme l'agrume (cédrat) : bon parfum, bon goût                           | al-Bukhârî 5427, Muslim 797, d'Abû Mûsâ al-Ash‘arî                             | sahîh (muttafaq ‘alayh)                                                                                                                                      | hadeethenc.com/ar/browse/hadith/6258                         |
| H6      | من قرأ سورةَ الكهفِ في يومِ الجمعةِ، أضاء له من النورِ ما بين الجمُعتَينِ                             | Qui lit Al-Kahf le vendredi, une lumière l'éclaire d'un vendredi à l'autre                               | al-Hâkim (al-Mustadrak), al-Bayhaqî (as-Sunan al-Kubrâ), d'Abû Sa‘îd al-Khudrî | sahîh selon al-Albânî (Sahîh al-Jâmi‘ 6470, Sahîh at-Targhîb 736) ; certains savants le jugent mawqûf (parole d'Abû Sa‘îd) : **à trancher par la relecture** | dorar.net/hadith/sharh/146478                                |
| H7      | مَنْ حَفِظَ عَشْرَ آيَاتٍ مِنْ أَوَّلِ سُورَةِ الكَهْفِ، عُصِمَ مِنَ الدَّجَّالِ                                              | Qui retient les dix premiers versets d'Al-Kahf est protégé du Dajjâl                                     | Muslim 809, d'Abû ad-Dardâ’                                                    | sahîh                                                                                                                                                        | hadeethenc.com/ar/browse/hadith/6265                         |
| Q 2:152 | فَٱذۡكُرُونِيٓ أَذۡكُرۡكُمۡ                                                                               | Souvenez-vous de Moi, Je Me souviendrai de vous (fr. : « Pensez à Moi, Je penserai à vous », paraphrase) | Al-Baqara, 152 (début)                                                         | —                                                                                                                                                            | uthmani.json                                                 |
| Q 2:186 | فَإِنِّي قَرِيبٌ                                                                                     | Je suis tout proche                                                                                      | Al-Baqara, 186 (extrait)                                                       | —                                                                                                                                                            | uthmani.json                                                 |
| Q 13:28 | أَلَا بِذِكۡرِ ٱللَّهِ تَطۡمَئِنُّ ٱلۡقُلُوبُ                                                                    | C'est par le rappel d'Allah que les cœurs s'apaisent                                                     | Ar-Ra‘d, 28 (fin)                                                              | —                                                                                                                                                            | uthmani.json                                                 |
| Q 17:82 | مِنَ ٱلۡقُرۡءَانِ مَا هُوَ شِفَآءٞ وَرَحۡمَةٞ                                                                   | Du Coran, Nous faisons descendre ce qui est guérison et miséricorde                                      | Al-Isrâ’, 82 (extrait)                                                         | —                                                                                                                                                            | uthmani.json                                                 |
| Q 18:10 | رَبَّنَآ ءَاتِنَا مِن لَّدُنكَ رَحۡمَةٗ                                                                       | Seigneur, accorde-nous de Ta part une miséricorde (invocation des jeunes de la caverne)                  | Al-Kahf, 10 (extrait)                                                          | —                                                                                                                                                            | uthmani.json                                                 |
| Q 38:29 | كِتَٰبٌ أَنزَلۡنَٰهُ إِلَيۡكَ مُبَٰرَكٞ                                                                          | Un Livre béni que Nous t'avons révélé, pour qu'on médite ses versets                                     | Sâd, 29 (début ; « pour méditer » vient de la suite du verset)                 | —                                                                                                                                                            | uthmani.json                                                 |
| Q 54:17 | وَلَقَدۡ يَسَّرۡنَا ٱلۡقُرۡءَانَ لِلذِّكۡرِ                                                                      | Nous avons rendu le Coran facile pour le rappel                                                          | Al-Qamar, 17 (début)                                                           | —                                                                                                                                                            | uthmani.json                                                 |
| Q 57:17 | يُحۡيِ ٱلۡأَرۡضَ بَعۡدَ مَوۡتِهَا                                                                           | (Allah) redonne vie à la terre après sa mort                                                             | Al-Hadîd, 17 (extrait)                                                         | —                                                                                                                                                            | uthmani.json                                                 |
| Q 73:20 | فَٱقۡرَءُواْ مَا تَيَسَّرَ مِنَ ٱلۡقُرۡءَانِ                                                                    | Lisez donc ce qui vous est facile du Coran                                                               | Al-Muzzammil, 20 (extrait)                                                     | —                                                                                                                                                            | uthmani.json                                                 |

Non retenu : « Le meilleur d'entre vous est celui qui apprend le Coran et l'enseigne » (al-Bukhârî
5027, sahîh, vérifié sur hadeethenc.com/en/browse/hadith/5913). Il ne tient pas en 35 lettres sans
perdre la moitié de son sens (« et l'enseigne »), et il parle d'apprendre et de transmettre plus
que de lire chaque jour.

## Questions pour la relecture

1. **Écriture des versets** : l'arabe uthmani du complexe du roi Fahd (signes comme ۡ, ٰ, ٞ) est fait
   pour sa police ; sur l'écran verrouillé, c'est la police du système qui l'affiche. **Non vérifié
   sur un iPhone.** Si le rendu est mauvais, l'écriture simple (`imlaei.json`) avec des voyelles
   ordinaires serait la solution, au prix de la règle « copie exacte de uthmani.json ».
2. H6 : marfû‘ ou mawqûf ? Le degré d'al-Albânî est donné ; l'avis d'un savant tranche.
3. Les paraphrases françaises et anglaises des versets (surtout 2:152, « Pensez à Moi… ») et des
   hadiths (H2 « le Coran intercédera pour toi » : le hadith dit « pour ses compagnons »).
4. L'arabe des phrases de l'appli (« المتابعة من سورة … »، « بقيت … لهدف اليوم ») : naturel ?
   Formes du pluriel (صفحةً après 11 à 99).

## Textes

Générés depuis `src/i18n/locales/*/notifications.json` (font foi en cas d'écart). Sources : voir
le tableau ci-dessus.

### Français

| Rappel          | N°  | Titre                               | Corps                                                                        | Source  |
| --------------- | --- | ----------------------------------- | ---------------------------------------------------------------------------- | ------- |
| `daily-goal`    | 1   | Chaque lettre lue, dix hasanat      | {{goal}} {{where}}                                                           | H1      |
| `daily-goal`    | 2   | Lis : le Coran intercédera pour toi | {{goal}} {{where}}                                                           | H2      |
| `daily-goal`    | 3   | Le Coran, rendu facile à retenir    | {{goal}} {{where}}                                                           | Q 54:17 |
| `daily-goal`    | 4   | Aimé d’Allah : peu, mais régulier   | {{goal}} {{where}}                                                           | H3      |
| `daily-goal`    | 5   | Le rappel d’Allah apaise les cœurs  | {{goal}} {{where}}                                                           | Q 13:28 |
| `daily-goal`    | 6   | Lire avec peine : double récompense | {{goal}} {{where}}                                                           | H4      |
| `daily-goal`    | 7   | Pensez à Moi, Je penserai à vous    | {{goal}} {{where}}                                                           | Q 2:152 |
| `daily-goal`    | 8   | Un Livre béni, pour méditer         | {{goal}} {{where}}                                                           | Q 38:29 |
| `water-stopped` | 1   | « Lisez ce qui vous est facile »    | L’eau de ton jardin s’est arrêtée. {{where}}                                 | Q 73:20 |
| `water-stopped` | 2   | L’acte le plus aimé : le régulier   | Une page relance l’eau de ton jardin. {{where}}                              | H3      |
| `thirsty`       | 1   | Le croyant qui lit, tel un agrume   | Bon parfum, bon goût. Ton jardin a soif. {{where}}                           | H5      |
| `thirsty`       | 2   | Le Coran, guérison et miséricorde   | Les plantes de ton jardin attendent un peu d’eau. {{where}}                  | Q 17:82 |
| `wilting`       | 1   | Même avec peine, deux récompenses   | Ton jardin se fane, mais il tient encore. {{where}}                          | H4      |
| `wilting`       | 2   | Allah a rendu le Coran facile       | Quelques pages redressent ton jardin. {{where}}                              | Q 54:17 |
| `dying`         | 1   | Une lettre, et déjà dix hasanat     | Ton jardin s’efface, mais rien n’est perdu. {{where}}                        | H1      |
| `dying`         | 2   | « Lisez ce qui vous est facile »    | Ton jardin commence à s’effacer. {{where}}                                   | Q 73:20 |
| `last-chance`   | 1   | Le Coran, un intercesseur pour toi  | Ton jardin peut encore revivre aujourd’hui. {{where}}                        | H2      |
| `last-chance`   | 2   | Le rappel d’Allah apaise les cœurs  | Une page aujourd’hui, et ton jardin tient. {{where}}                         | Q 13:28 |
| `dead`          | 1   | Allah redonne vie à la terre morte  | Ton jardin s’est asséché. Une page, et l’eau revient.                        | Q 57:17 |
| `dead`          | 2   | Pensez à Moi, Je penserai à vous    | La terre se souvient de tout. Une page, et l’eau revient.                    | Q 2:152 |
| `come-back`     | 1   | « Je suis tout proche », dit Allah  | Ton jardin est toujours là, quand tu voudras.                                | Q 2:186 |
| `come-back`     | 2   | Lire avec peine : double récompense | Revenir, même par une page, compte. Ton jardin t’attend.                     | H4      |
| `come-back`     | 3   | Le Coran, rendu facile à retenir    | Une page, et l’eau revient dans ton jardin.                                  | Q 54:17 |
| `friday-kahf`   | 1   | Une lumière d’un vendredi à l’autre | Pour qui lit Al-Kahf le vendredi. Elle commence page {{page}}.               | H6      |
| `friday-kahf`   | 2   | Seigneur, donne-nous Ta miséricorde | L’invocation des gens de la caverne (18:10). Al-Kahf, page {{page}}.         | Q 18:10 |
| `friday-kahf`   | 3   | Dix versets qui protègent           | Retenir les dix premiers versets d’Al-Kahf protège du Dajjâl. Page {{page}}. | H7      |

Morceaux insérés : `{{goal}}` = « Une page aujourd’hui. » / « {{count}} pages aujourd’hui. » / « Plus qu’une page aujourd’hui. » / « Encore {{count}} pages aujourd’hui. » ; `{{where}}` = « Reprends {{surah}}, page {{page}}. » / « Commence à la première page. » ; `{{page}}` = 293 (Al-Kahf).

### English

| Rappel          | N°  | Titre                               | Corps                                                                         | Source  |
| --------------- | --- | ----------------------------------- | ----------------------------------------------------------------------------- | ------- |
| `daily-goal`    | 1   | Every letter read: ten hasanat      | {{goal}} {{where}}                                                            | H1      |
| `daily-goal`    | 2   | Read it: it will intercede for you  | {{goal}} {{where}}                                                            | H2      |
| `daily-goal`    | 3   | The Quran, made easy to remember    | {{goal}} {{where}}                                                            | Q 54:17 |
| `daily-goal`    | 4   | Dear to Allah: little, but steady   | {{goal}} {{where}}                                                            | H3      |
| `daily-goal`    | 5   | Allah’s remembrance calms the heart | {{goal}} {{where}}                                                            | Q 13:28 |
| `daily-goal`    | 6   | Reading with effort: two rewards    | {{goal}} {{where}}                                                            | H4      |
| `daily-goal`    | 7   | Remember Me; I will remember you    | {{goal}} {{where}}                                                            | Q 2:152 |
| `daily-goal`    | 8   | A blessed Book, to reflect upon     | {{goal}} {{where}}                                                            | Q 38:29 |
| `water-stopped` | 1   | “Recite what is easy for you”       | Your garden’s water has stopped. {{where}}                                    | Q 73:20 |
| `water-stopped` | 2   | Most beloved: the steady deed       | One page gets your garden’s water flowing. {{where}}                          | H3      |
| `thirsty`       | 1   | A believer who reads, like a citron | Fine scent, fine taste. Your garden is thirsty. {{where}}                     | H5      |
| `thirsty`       | 2   | The Quran: healing and mercy        | Your garden’s plants are waiting for water. {{where}}                         | Q 17:82 |
| `wilting`       | 1   | Even when it’s hard: two rewards    | Your garden is wilting, but holding on. {{where}}                             | H4      |
| `wilting`       | 2   | Allah made the Quran easy           | A few pages lift your garden again. {{where}}                                 | Q 54:17 |
| `dying`         | 1   | One letter, already ten hasanat     | Your garden is fading, but nothing is lost. {{where}}                         | H1      |
| `dying`         | 2   | “Recite what is easy for you”       | Your garden is starting to fade. {{where}}                                    | Q 73:20 |
| `last-chance`   | 1   | The Quran, an intercessor for you   | Your garden can still revive today. {{where}}                                 | H2      |
| `last-chance`   | 2   | Allah’s remembrance calms the heart | One page today, and your garden holds on. {{where}}                           | Q 13:28 |
| `dead`          | 1   | Allah gives life to the dead earth  | Your garden has dried out. One page, and the water returns.                   | Q 57:17 |
| `dead`          | 2   | Remember Me; I will remember you    | The soil remembers everything. One page, and the water returns.               | Q 2:152 |
| `come-back`     | 1   | “I am near,” says Allah             | Your garden is still here, whenever you’re ready.                             | Q 2:186 |
| `come-back`     | 2   | Reading with effort: two rewards    | Coming back counts, even with one page. Your garden is waiting.               | H4      |
| `come-back`     | 3   | The Quran, made easy to remember    | One page, and the water returns to your garden.                               | Q 54:17 |
| `friday-kahf`   | 1   | A light from one Friday to the next | For whoever reads Al-Kahf on Friday. It begins on page {{page}}.              | H6      |
| `friday-kahf`   | 2   | Our Lord, grant us Your mercy       | The prayer of the youths of the cave (18:10). Al-Kahf, page {{page}}.         | Q 18:10 |
| `friday-kahf`   | 3   | Ten verses that protect             | Memorizing Al-Kahf’s first ten verses shields from the Dajjal. Page {{page}}. | H7      |

Morceaux insérés : `{{goal}}` = « One page today. » / « {{count}} pages today. » / « One more page today. » / « {{count}} more pages today. » ; `{{where}}` = « Continue {{surah}}, page {{page}}. » / « Start from the first page. » ; `{{page}}` = 293 (Al-Kahf).

### العربية

| Rappel          | N°  | Titre                              | Corps                                                               | Source  |
| --------------- | --- | ---------------------------------- | ------------------------------------------------------------------- | ------- |
| `daily-goal`    | 1   | بكل حرف حسنة، والحسنة بعشر أمثالها | {{goal}} {{where}}                                                  | H1      |
| `daily-goal`    | 2   | القرآن يأتي شفيعًا لأصحابه          | {{goal}} {{where}}                                                  | H2      |
| `daily-goal`    | 3   | ﴿وَلَقَدۡ يَسَّرۡنَا ٱلۡقُرۡءَانَ لِلذِّكۡرِ﴾         | {{goal}} {{where}}                                                  | Q 54:17 |
| `daily-goal`    | 4   | أحب الأعمال إلى الله أدومها وإن قل | {{goal}} {{where}}                                                  | H3      |
| `daily-goal`    | 5   | ﴿أَلَا بِذِكۡرِ ٱللَّهِ تَطۡمَئِنُّ ٱلۡقُلُوبُ﴾       | {{goal}} {{where}}                                                  | Q 13:28 |
| `daily-goal`    | 6   | من يقرؤه بمشقة فله أجران           | {{goal}} {{where}}                                                  | H4      |
| `daily-goal`    | 7   | ﴿فَٱذۡكُرُونِيٓ أَذۡكُرۡكُمۡ﴾                  | {{goal}} {{where}}                                                  | Q 2:152 |
| `daily-goal`    | 8   | ﴿كِتَٰبٌ أَنزَلۡنَٰهُ إِلَيۡكَ مُبَٰرَكٞ﴾             | {{goal}} {{where}}                                                  | Q 38:29 |
| `water-stopped` | 1   | ﴿فَٱقۡرَءُواْ مَا تَيَسَّرَ مِنَ ٱلۡقُرۡءَانِ﴾       | توقّف الماء في حديقتك. {{where}}                                     | Q 73:20 |
| `water-stopped` | 2   | أحب الأعمال إلى الله أدومها        | صفحة واحدة تعيد الماء إلى حديقتك. {{where}}                         | H3      |
| `thirsty`       | 1   | المؤمن الذي يقرأ القرآن كالأترجة   | ريحها طيب وطعمها طيب. حديقتك عطشى. {{where}}                        | H5      |
| `thirsty`       | 2   | ﴿مِنَ ٱلۡقُرۡءَانِ مَا هُوَ شِفَآءٞ وَرَحۡمَةٞ﴾      | نباتات حديقتك تنتظر قليلًا من الماء. {{where}}                       | Q 17:82 |
| `wilting`       | 1   | يقرؤه وهو عليه شاق، فله أجران      | حديقتك تذبل، لكنها ما زالت صامدة. {{where}}                         | H4      |
| `wilting`       | 2   | ﴿وَلَقَدۡ يَسَّرۡنَا ٱلۡقُرۡءَانَ لِلذِّكۡرِ﴾         | بضع صفحات تنعش حديقتك. {{where}}                                    | Q 54:17 |
| `dying`         | 1   | الحرف بحسنة، والحسنة بعشر أمثالها  | بدأت حديقتك تتلاشى، ولم يضع شيء. {{where}}                          | H1      |
| `dying`         | 2   | ﴿فَٱقۡرَءُواْ مَا تَيَسَّرَ مِنَ ٱلۡقُرۡءَانِ﴾       | حديقتك تحتاج إليك. {{where}}                                        | Q 73:20 |
| `last-chance`   | 1   | القرآن شفيع لأصحابه                | ما زال بوسع حديقتك أن تحيا اليوم. {{where}}                         | H2      |
| `last-chance`   | 2   | ﴿أَلَا بِذِكۡرِ ٱللَّهِ تَطۡمَئِنُّ ٱلۡقُلُوبُ﴾       | صفحة واحدة اليوم، وتبقى حديقتك. {{where}}                           | Q 13:28 |
| `dead`          | 1   | ﴿يُحۡيِ ٱلۡأَرۡضَ بَعۡدَ مَوۡتِهَا﴾              | جفّت حديقتك. صفحة واحدة، ويعود الماء.                                | Q 57:17 |
| `dead`          | 2   | ﴿فَٱذۡكُرُونِيٓ أَذۡكُرۡكُمۡ﴾                  | الأرض تتذكّر كل شيء. صفحة واحدة، ويعود الماء.                        | Q 2:152 |
| `come-back`     | 1   | ﴿فَإِنِّي قَرِيبٌ﴾                        | حديقتك ما زالت هنا، تنتظرك متى شئت.                                 | Q 2:186 |
| `come-back`     | 2   | من يقرؤه بمشقة فله أجران           | العودة ولو بصفحة واحدة لها أثرها. حديقتك تنتظرك.                    | H4      |
| `come-back`     | 3   | ﴿وَلَقَدۡ يَسَّرۡنَا ٱلۡقُرۡءَانَ لِلذِّكۡرِ﴾         | صفحة واحدة، ويعود الماء إلى حديقتك.                                 | Q 54:17 |
| `friday-kahf`   | 1   | نور ما بين الجمعتين                | لمن قرأ سورة الكهف يوم الجمعة. تبدأ في الصفحة {{page}}.             | H6      |
| `friday-kahf`   | 2   | ﴿رَبَّنَآ ءَاتِنَا مِن لَّدُنكَ رَحۡمَةٗ﴾          | من دعاء أصحاب الكهف (الكهف: 10). السورة في الصفحة {{page}}.         | Q 18:10 |
| `friday-kahf`   | 3   | يوم الجمعة مع سورة الكهف           | «من حفظ عشر آيات من أول سورة الكهف عُصم من الدجال». الصفحة {{page}}. | H7      |

Morceaux insérés : `{{goal}}` = « هدف اليوم: {{count}} صفحة. » / « هدف اليوم: صفحة واحدة. » / « هدف اليوم: صفحتان. » / « هدف اليوم: {{count}} صفحات. » / « هدف اليوم: {{count}} صفحةً. » / « هدف اليوم: {{count}} صفحة. » / « بقيت {{count}} صفحة لهدف اليوم. » / « بقيت صفحة واحدة لهدف اليوم. » / « بقيت صفحتان لهدف اليوم. » / « بقيت {{count}} صفحات لهدف اليوم. » / « بقيت {{count}} صفحةً لهدف اليوم. » / « بقيت {{count}} صفحة لهدف اليوم. » ; `{{where}}` = « المتابعة من سورة {{surah}}، الصفحة {{page}}. » / « البداية من الصفحة الأولى. » ; `{{page}}` = 293 (Al-Kahf).
