/**
 * Independent anchors of the standard Madinah mushaf (riwaya of Hafs, 604 pages, 15 lines).
 *
 * Nothing here is read from the app's data or from its build tool. Every table was written
 * by the tester from general knowledge of the mushaf, then compared with the Tanzil-derived
 * lists of the `quran-meta` package (classic 1405 H handwriting); the two agreed everywhere.
 * A table is in this file only when the tester is certain of it. What is NOT certain is
 * listed in the tester's report as "not asserted", never guessed here.
 */

function splitKeys(rows: readonly string[]): readonly string[] {
  return rows.flatMap((row) => row.split(' '));
}

/** Verse count of each surah, Kufan count (the count of the Hafs mushaf). Sum: 6236. */
export const VERSE_COUNT_BY_SURAH: readonly number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112,
  78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37,
  35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52,
  44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8,
  8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

/**
 * Surahs headed "madaniyya" in the Madinah mushaf (28). The other 86 are headed "makkiyya".
 * Scholars discuss a few of them (13, 55, 76, 99...); this is the labelling of the mushaf.
 */
export const MEDINAN_SURAHS: readonly number[] = [
  2, 3, 4, 5, 8, 9, 13, 22, 24, 33, 47, 48, 49, 55, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 76, 98,
  99, 110,
];

/** Surah names as printed in the headings of the Madinah mushaf, without vowel signs. */
export const SURAH_NAMES_ARABIC: readonly string[] = [
  'الفاتحة',
  'البقرة',
  'آل عمران',
  'النساء',
  'المائدة',
  'الأنعام',
  'الأعراف',
  'الأنفال',
  'التوبة',
  'يونس',
  'هود',
  'يوسف',
  'الرعد',
  'إبراهيم',
  'الحجر',
  'النحل',
  'الإسراء',
  'الكهف',
  'مريم',
  'طه',
  'الأنبياء',
  'الحج',
  'المؤمنون',
  'النور',
  'الفرقان',
  'الشعراء',
  'النمل',
  'القصص',
  'العنكبوت',
  'الروم',
  'لقمان',
  'السجدة',
  'الأحزاب',
  'سبأ',
  'فاطر',
  'يس',
  'الصافات',
  'ص',
  'الزمر',
  'غافر',
  'فصلت',
  'الشورى',
  'الزخرف',
  'الدخان',
  'الجاثية',
  'الأحقاف',
  'محمد',
  'الفتح',
  'الحجرات',
  'ق',
  'الذاريات',
  'الطور',
  'النجم',
  'القمر',
  'الرحمن',
  'الواقعة',
  'الحديد',
  'المجادلة',
  'الحشر',
  'الممتحنة',
  'الصف',
  'الجمعة',
  'المنافقون',
  'التغابن',
  'الطلاق',
  'التحريم',
  'الملك',
  'القلم',
  'الحاقة',
  'المعارج',
  'نوح',
  'الجن',
  'المزمل',
  'المدثر',
  'القيامة',
  'الإنسان',
  'المرسلات',
  'النبأ',
  'النازعات',
  'عبس',
  'التكوير',
  'الانفطار',
  'المطففين',
  'الانشقاق',
  'البروج',
  'الطارق',
  'الأعلى',
  'الغاشية',
  'الفجر',
  'البلد',
  'الشمس',
  'الليل',
  'الضحى',
  'الشرح',
  'التين',
  'العلق',
  'القدر',
  'البينة',
  'الزلزلة',
  'العاديات',
  'القارعة',
  'التكاثر',
  'العصر',
  'الهمزة',
  'الفيل',
  'قريش',
  'الماعون',
  'الكوثر',
  'الكافرون',
  'النصر',
  'المسد',
  'الإخلاص',
  'الفلق',
  'الناس',
];

/** Page on which each surah begins. The same in every 604-page Madinah printing. */
export const FIRST_PAGE_OF_SURAH: readonly number[] = [
  1, 2, 50, 77, 106, 128, 151, 177, 187, 208, 221, 235, 249, 255, 262, 267, 282, 293, 305, 312, 322,
  332, 342, 350, 359, 367, 377, 385, 396, 404, 411, 415, 418, 428, 434, 440, 446, 453, 458, 467,
  477, 483, 489, 496, 499, 502, 507, 511, 515, 518, 520, 523, 526, 528, 531, 534, 537, 542, 545,
  549, 551, 553, 554, 556, 558, 560, 562, 564, 566, 568, 570, 572, 574, 575, 577, 578, 580, 582,
  583, 585, 586, 587, 587, 589, 590, 591, 591, 592, 593, 594, 595, 595, 596, 596, 597, 597, 598,
  598, 599, 599, 600, 600, 601, 601, 601, 602, 602, 602, 603, 603, 603, 604, 604, 604,
];

/** First verse of each of the 30 juz. */
export const JUZ_STARTS: readonly string[] = splitKeys([
  '1:1 2:142 2:253 3:93 4:24 4:148 5:82 6:111 7:88 8:41',
  '9:93 11:6 12:53 15:1 17:1 18:75 21:1 23:1 25:21 27:56',
  '29:46 33:31 36:28 39:32 41:47 46:1 51:31 58:1 67:1 78:1',
]);

/** Page on which each juz begins (juz 7 and juz 11 begin in the middle of their page). */
export const FIRST_PAGE_OF_JUZ: readonly number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402,
  422, 442, 462, 482, 502, 522, 542, 562, 582,
];

/** First verse of each of the 60 hizb. Hizb 2k-1 begins with juz k. */
export const HIZB_STARTS: readonly string[] = splitKeys([
  '1:1 2:75 2:142 2:203 2:253 3:15 3:93 3:171 4:24 4:88',
  '4:148 5:27 5:82 6:36 6:111 7:1 7:88 7:171 8:41 9:34',
  '9:93 10:26 11:6 11:84 12:53 13:19 15:1 16:51 17:1 17:99',
  '18:75 20:1 21:1 22:1 23:1 24:21 25:21 26:111 27:56 28:51',
  '29:46 31:22 33:31 34:24 36:28 37:145 39:32 40:41 41:47 43:24',
  '46:1 48:18 51:31 55:1 58:1 62:1 67:1 72:1 78:1 87:1',
]);

/** Page on which each hizb begins. */
export const FIRST_PAGE_OF_HIZB: readonly number[] = [
  1, 11, 22, 32, 42, 51, 62, 72, 82, 92, 102, 112, 121, 132, 142, 151, 162, 173, 182, 192, 201, 212,
  222, 231, 242, 252, 262, 272, 282, 292, 302, 312, 322, 332, 342, 352, 362, 371, 382, 392, 402,
  413, 422, 431, 442, 451, 462, 472, 482, 491, 502, 513, 522, 531, 542, 553, 562, 572, 582, 591,
];

/**
 * First verse of each of the 240 quarters of hizb (Tanzil list). The mushaf prints the sign
 * U+06DE at 199 of them: not before the first verse of a surah (41 quarters).
 * One known disagreement: the mushaf prints the sign at 15:49, this list says 15:50.
 */
export const HIZB_QUARTER_STARTS: readonly string[] = splitKeys([
  '1:1 2:26 2:44 2:60 2:75 2:92 2:106 2:124 2:142 2:158 2:177 2:189',
  '2:203 2:219 2:233 2:243 2:253 2:263 2:272 2:283 3:15 3:33 3:52 3:75',
  '3:93 3:113 3:133 3:153 3:171 3:186 4:1 4:12 4:24 4:36 4:58 4:74',
  '4:88 4:100 4:114 4:135 4:148 4:163 5:1 5:12 5:27 5:41 5:51 5:67',
  '5:82 5:97 5:109 6:13 6:36 6:59 6:74 6:95 6:111 6:127 6:141 6:151',
  '7:1 7:31 7:47 7:65 7:88 7:117 7:142 7:156 7:171 7:189 8:1 8:22',
  '8:41 8:61 9:1 9:19 9:34 9:46 9:60 9:75 9:93 9:111 9:122 10:11',
  '10:26 10:53 10:71 10:90 11:6 11:24 11:41 11:61 11:84 11:108 12:7 12:30',
  '12:53 12:77 12:101 13:5 13:19 13:35 14:10 14:28 15:1 15:50 16:1 16:30',
  '16:51 16:75 16:90 16:111 17:1 17:23 17:50 17:70 17:99 18:17 18:32 18:51',
  '18:75 18:99 19:22 19:59 20:1 20:55 20:83 20:111 21:1 21:29 21:51 21:83',
  '22:1 22:19 22:38 22:60 23:1 23:36 23:75 24:1 24:21 24:35 24:53 25:1',
  '25:21 25:53 26:1 26:52 26:111 26:181 27:1 27:27 27:56 27:82 28:12 28:29',
  '28:51 28:76 29:1 29:26 29:46 30:1 30:31 30:54 31:22 32:11 33:1 33:18',
  '33:31 33:51 33:60 34:10 34:24 34:46 35:15 35:41 36:28 36:60 37:22 37:83',
  '37:145 38:21 38:52 39:8 39:32 39:53 40:1 40:21 40:41 40:66 41:9 41:25',
  '41:47 42:13 42:27 42:51 43:24 43:57 44:17 45:12 46:1 46:21 47:10 47:33',
  '48:18 49:1 49:14 50:27 51:31 52:24 53:26 54:9 55:1 56:1 56:75 57:16',
  '58:1 58:14 59:11 60:7 62:1 63:4 65:1 66:1 67:1 68:1 69:1 70:19',
  '72:1 73:20 75:1 76:19 78:1 80:1 82:1 84:1 87:1 90:1 94:1 100:9',
]);

/** The 15 verses of prostration marked in the Madinah mushaf (sign U+06E9). */
export const SAJDA_VERSES: readonly string[] = splitKeys([
  '7:206 13:15 16:50 17:109 19:58 22:18 22:77 25:60 27:26 32:15 38:24 41:38 53:62 84:21 96:19',
]);

/**
 * First verse of each of the 604 pages in the classic Madinah mushaf (1405 H handwriting),
 * the page list of Tanzil and of most apps. Checked by the tester from memory at every
 * surah start, every juz start and every hizb start.
 */
export const CLASSIC_PAGE_STARTS: readonly string[] = splitKeys([
  '1:1 2:1 2:6 2:17 2:25 2:30 2:38 2:49 2:58 2:62',
  '2:70 2:77 2:84 2:89 2:94 2:102 2:106 2:113 2:120 2:127',
  '2:135 2:142 2:146 2:154 2:164 2:170 2:177 2:182 2:187 2:191',
  '2:197 2:203 2:211 2:216 2:220 2:225 2:231 2:234 2:238 2:246',
  '2:249 2:253 2:257 2:260 2:265 2:270 2:275 2:282 2:283 3:1',
  '3:10 3:16 3:23 3:30 3:38 3:46 3:53 3:62 3:71 3:78',
  '3:84 3:92 3:101 3:109 3:116 3:122 3:133 3:141 3:149 3:154',
  '3:158 3:166 3:174 3:181 3:187 3:195 4:1 4:7 4:12 4:15',
  '4:20 4:24 4:27 4:34 4:38 4:45 4:52 4:60 4:66 4:75',
  '4:80 4:87 4:92 4:95 4:102 4:106 4:114 4:122 4:128 4:135',
  '4:141 4:148 4:155 4:163 4:171 4:176 5:3 5:6 5:10 5:14',
  '5:18 5:24 5:32 5:37 5:42 5:46 5:51 5:58 5:65 5:71',
  '5:77 5:83 5:90 5:96 5:104 5:109 5:114 6:1 6:9 6:19',
  '6:28 6:36 6:45 6:53 6:60 6:69 6:74 6:82 6:91 6:95',
  '6:102 6:111 6:119 6:125 6:132 6:138 6:143 6:147 6:152 6:158',
  '7:1 7:12 7:23 7:31 7:38 7:44 7:52 7:58 7:68 7:74',
  '7:82 7:88 7:96 7:105 7:121 7:131 7:138 7:144 7:150 7:156',
  '7:160 7:164 7:171 7:179 7:188 7:196 8:1 8:9 8:17 8:26',
  '8:34 8:41 8:46 8:53 8:62 8:70 9:1 9:7 9:14 9:21',
  '9:27 9:32 9:37 9:41 9:48 9:55 9:62 9:69 9:73 9:80',
  '9:87 9:94 9:100 9:107 9:112 9:118 9:123 10:1 10:7 10:15',
  '10:21 10:26 10:34 10:43 10:54 10:62 10:71 10:79 10:89 10:98',
  '10:107 11:6 11:13 11:20 11:29 11:38 11:46 11:54 11:63 11:72',
  '11:82 11:89 11:98 11:109 11:118 12:5 12:15 12:23 12:31 12:38',
  '12:44 12:53 12:64 12:70 12:79 12:87 12:96 12:104 13:1 13:6',
  '13:14 13:19 13:29 13:35 13:43 14:6 14:11 14:19 14:25 14:34',
  '14:43 15:1 15:16 15:32 15:52 15:71 15:91 16:7 16:15 16:27',
  '16:35 16:43 16:55 16:65 16:73 16:80 16:88 16:94 16:103 16:111',
  '16:119 17:1 17:8 17:18 17:28 17:39 17:50 17:59 17:67 17:76',
  '17:87 17:97 17:105 18:5 18:16 18:21 18:28 18:35 18:46 18:54',
  '18:62 18:75 18:84 18:98 19:1 19:12 19:26 19:39 19:52 19:65',
  '19:77 19:96 20:13 20:38 20:52 20:65 20:77 20:88 20:99 20:114',
  '20:126 21:1 21:11 21:25 21:36 21:45 21:58 21:73 21:82 21:91',
  '21:102 22:1 22:6 22:16 22:24 22:31 22:39 22:47 22:56 22:65',
  '22:73 23:1 23:18 23:28 23:43 23:60 23:75 23:90 23:105 24:1',
  '24:11 24:21 24:28 24:32 24:37 24:44 24:54 24:59 24:62 25:3',
  '25:12 25:21 25:33 25:44 25:56 25:68 26:1 26:20 26:40 26:61',
  '26:84 26:112 26:137 26:160 26:184 26:207 27:1 27:14 27:23 27:36',
  '27:45 27:56 27:64 27:77 27:89 28:6 28:14 28:22 28:29 28:36',
  '28:44 28:51 28:60 28:71 28:78 28:85 29:7 29:15 29:24 29:31',
  '29:39 29:46 29:53 29:64 30:6 30:16 30:25 30:33 30:42 30:51',
  '31:1 31:12 31:20 31:29 32:1 32:12 32:21 33:1 33:7 33:16',
  '33:23 33:31 33:36 33:44 33:51 33:55 33:63 34:1 34:8 34:15',
  '34:23 34:32 34:40 34:49 35:4 35:12 35:19 35:31 35:39 35:45',
  '36:13 36:28 36:41 36:55 36:71 37:1 37:25 37:52 37:77 37:103',
  '37:127 37:154 38:1 38:17 38:27 38:43 38:62 38:84 39:6 39:11',
  '39:22 39:32 39:41 39:48 39:57 39:68 39:75 40:8 40:17 40:26',
  '40:34 40:41 40:50 40:59 40:67 40:78 41:1 41:12 41:21 41:30',
  '41:39 41:47 42:1 42:11 42:16 42:23 42:32 42:45 42:52 43:11',
  '43:23 43:34 43:48 43:61 43:74 44:1 44:19 44:40 45:1 45:14',
  '45:23 45:33 46:6 46:15 46:21 46:29 47:1 47:12 47:20 47:30',
  '48:1 48:10 48:16 48:24 48:29 49:5 49:12 50:1 50:16 50:36',
  '51:7 51:31 51:52 52:15 52:32 53:1 53:27 53:45 54:7 54:28',
  '54:50 55:17 55:41 55:68 56:17 56:51 56:77 57:4 57:12 57:19',
  '57:25 58:1 58:7 58:12 58:22 59:4 59:10 59:17 60:1 60:6',
  '60:12 61:6 62:1 62:9 63:5 64:1 64:10 65:1 65:6 66:1',
  '66:8 67:1 67:13 67:27 68:16 68:43 69:9 69:35 70:11 70:40',
  '71:11 72:1 72:14 73:1 73:20 74:18 74:48 75:20 76:6 76:26',
  '77:20 78:1 78:31 79:16 80:1 81:1 82:1 83:7 83:35 85:1',
  '86:1 87:16 89:1 89:24 91:1 92:15 95:1 97:1 98:8 100:10',
  '103:1 106:1 109:1 112:1',
]);

/**
 * Pages that docs/DATA_SOURCES.md declares as starting at another verse than the classic
 * list, because the layout follows another printing ("1441 H"). The tester is certain of
 * the classic column and could NOT verify the layout column against a printed mushaf.
 */
export const DECLARED_PAGE_START_DIFFERENCES: readonly {
  readonly page: number;
  readonly layout: string;
  readonly classic: string;
}[] = [
  { page: 121, layout: '5:78', classic: '5:77' },
  { page: 122, layout: '5:84', classic: '5:83' },
  { page: 123, layout: '5:91', classic: '5:90' },
  { page: 145, layout: '6:131', classic: '6:132' },
  { page: 532, layout: '55:19', classic: '55:17' },
  { page: 533, layout: '55:42', classic: '55:41' },
  { page: 534, layout: '55:70', classic: '55:68' },
  { page: 565, layout: '68:17', classic: '68:16' },
  { page: 568, layout: '69:36', classic: '69:35' },
  { page: 570, layout: '70:41', classic: '70:40' },
  { page: 576, layout: '74:19', classic: '74:18' },
  { page: 584, layout: '79:17', classic: '79:16' },
  { page: 586, layout: '80:41', classic: '81:1' },
  { page: 588, layout: '83:5', classic: '83:7' },
  { page: 589, layout: '83:34', classic: '83:35' },
  { page: 590, layout: '84:25', classic: '85:1' },
  { page: 592, layout: '87:11', classic: '87:16' },
  { page: 593, layout: '88:23', classic: '89:1' },
  { page: 594, layout: '89:23', classic: '89:24' },
  { page: 595, layout: '90:19', classic: '91:1' },
  { page: 596, layout: '92:10', classic: '92:15' },
  { page: 597, layout: '94:3', classic: '95:1' },
  { page: 598, layout: '96:13', classic: '97:1' },
  { page: 599, layout: '98:6', classic: '98:8' },
  { page: 600, layout: '100:6', classic: '100:10' },
];

/** Verses of surah 55 that are the refrain, word for word (31 verses). */
export const REFRAIN_VERSES_OF_SURAH_55: readonly number[] = [
  13, 16, 18, 21, 23, 25, 28, 30, 32, 34, 36, 38, 40, 42, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63,
  65, 67, 69, 71, 73, 75, 77,
];

/** Verses of surah 77 that are the refrain, word for word (10 verses). */
export const REFRAIN_VERSES_OF_SURAH_77: readonly number[] = [
  15, 19, 24, 28, 34, 37, 40, 45, 47, 49,
];

/** Verses of surah 54 that are the refrain, word for word (4 verses). */
export const REFRAIN_VERSES_OF_SURAH_54: readonly number[] = [17, 22, 32, 40];

/** Verses of surah 26 that are the refrain "wa-inna rabbaka la-huwa l-azizu r-rahim" (8 verses). */
export const REFRAIN_VERSES_OF_SURAH_26: readonly number[] = [9, 68, 104, 122, 140, 159, 175, 191];

/** Surahs whose first verse is the three letters alif-lam-mim alone. */
export const SURAHS_OPENING_WITH_ALIF_LAM_MIM: readonly number[] = [2, 3, 29, 30, 31, 32];

/** Surahs whose first verse is the two letters ha-mim alone. */
export const SURAHS_OPENING_WITH_HA_MIM: readonly number[] = [40, 41, 42, 43, 44, 45, 46];

/** The only surah printed without a basmala. */
export const SURAH_WITHOUT_BASMALA = 9;

/** The surah that holds a second basmala, inside verse 30. */
export const SURAH_WITH_TWO_BASMALAS = 27;
export const VERSE_OF_SECOND_BASMALA = '27:30';

/** The longest verse of the Quran (the verse of debt); it fills page 48 on its own. */
export const LONGEST_VERSE = '2:282';

/** Item of a list that must exist: a missing item is a mistake in the test, not a result. */
export function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`No item at index ${index} (the list has ${items.length} items).`);
  }
  return item;
}

/** 0-based rank of a verse in reading order, computed from the anchors alone. */
export function readingRank(key: string): number {
  const [surahText, verseText] = key.split(':');
  const surah = Number(surahText);
  const verse = Number(verseText);
  const count = VERSE_COUNT_BY_SURAH[surah - 1];
  if (count === undefined || !Number.isInteger(verse) || verse < 1 || verse > count) {
    throw new RangeError(`Anchor tables: "${key}" is not a verse.`);
  }
  const versesBefore = VERSE_COUNT_BY_SURAH.slice(0, surah - 1).reduce((sum, n) => sum + n, 0);
  return versesBefore + verse - 1;
}

/** Every verse key in reading order ("1:1" ... "114:6"), computed from the anchors alone. */
export function allVerseKeys(): string[] {
  return VERSE_COUNT_BY_SURAH.flatMap((count, index) =>
    Array.from({ length: count }, (_, verseIndex) => `${index + 1}:${verseIndex + 1}`),
  );
}

/** Page of a verse according to a list of page starts (1-based page number). */
export function pageInList(pageStarts: readonly string[], key: string): number {
  const rank = readingRank(key);
  let page = 0;
  for (const start of pageStarts) {
    if (readingRank(start) > rank) {
      break;
    }
    page += 1;
  }
  return page;
}

// Jest runs every file under __tests__ as a suite and the tester may write nowhere else:
// the anchors check themselves here, in their own suite only.
const OWN_FILE_NAME = 'mushaf-anchors.ts';
if (String(expect.getState().testPath).endsWith(OWN_FILE_NAME)) {
  describe('anchors of the Madinah mushaf are consistent with each other', () => {
    const isStrictlyIncreasing = (keys: readonly string[]): boolean => {
      const ranks = keys.map(readingRank);
      return ranks.every((rank, index) => index === 0 || rank > itemAt(ranks, index - 1));
    };

    it('114 surahs and 6236 verses', () => {
      expect(VERSE_COUNT_BY_SURAH).toHaveLength(114);
      expect(VERSE_COUNT_BY_SURAH.reduce((sum, n) => sum + n, 0)).toBe(6236);
      expect(allVerseKeys()).toHaveLength(6236);
    });

    it('28 Medinan surahs, 114 distinct names', () => {
      expect(new Set(MEDINAN_SURAHS).size).toBe(28);
      expect(MEDINAN_SURAHS.every((surah) => surah >= 1 && surah <= 114)).toBe(true);
      expect(new Set(SURAH_NAMES_ARABIC).size).toBe(114);
    });

    it('30 juz, 60 hizb, 240 quarters, in reading order and nested', () => {
      expect(JUZ_STARTS).toHaveLength(30);
      expect(HIZB_STARTS).toHaveLength(60);
      expect(HIZB_QUARTER_STARTS).toHaveLength(240);
      expect(isStrictlyIncreasing(HIZB_QUARTER_STARTS)).toBe(true);
      expect(HIZB_QUARTER_STARTS.filter((_, index) => index % 4 === 0)).toEqual(HIZB_STARTS);
      expect(HIZB_STARTS.filter((_, index) => index % 2 === 0)).toEqual(JUZ_STARTS);
    });

    it('15 prostration verses in reading order', () => {
      expect(SAJDA_VERSES).toHaveLength(15);
      expect(isStrictlyIncreasing(SAJDA_VERSES)).toBe(true);
    });

    it('604 classic page starts in reading order, agreeing with the surah, juz and hizb pages', () => {
      expect(CLASSIC_PAGE_STARTS).toHaveLength(604);
      expect(CLASSIC_PAGE_STARTS[0]).toBe('1:1');
      expect(isStrictlyIncreasing(CLASSIC_PAGE_STARTS)).toBe(true);
      expect(
        FIRST_PAGE_OF_SURAH.map((_, index) => pageInList(CLASSIC_PAGE_STARTS, `${index + 1}:1`)),
      ).toEqual(FIRST_PAGE_OF_SURAH);
      expect(JUZ_STARTS.map((key) => pageInList(CLASSIC_PAGE_STARTS, key))).toEqual(
        FIRST_PAGE_OF_JUZ,
      );
      expect(HIZB_STARTS.map((key) => pageInList(CLASSIC_PAGE_STARTS, key))).toEqual(
        FIRST_PAGE_OF_HIZB,
      );
    });

    it('25 declared differences, whose classic column is the classic list', () => {
      expect(DECLARED_PAGE_START_DIFFERENCES).toHaveLength(25);
      for (const difference of DECLARED_PAGE_START_DIFFERENCES) {
        expect(CLASSIC_PAGE_STARTS[difference.page - 1]).toBe(difference.classic);
        expect(difference.layout).not.toBe(difference.classic);
      }
    });

    it('refrain lists have the well-known lengths', () => {
      expect(REFRAIN_VERSES_OF_SURAH_55).toHaveLength(31);
      expect(REFRAIN_VERSES_OF_SURAH_77).toHaveLength(10);
      expect(REFRAIN_VERSES_OF_SURAH_54).toHaveLength(4);
      expect(REFRAIN_VERSES_OF_SURAH_26).toHaveLength(8);
    });
  });
}
