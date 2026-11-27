/**
 * The words of a reminder: one of the variants of its kind, chosen by the day, filled with where
 * to resume and with what is left of the day's goal. The words live in the `notifications`
 * namespace (`variants.<kind>.<n>`); the spiritual texts they rest on, with their references and
 * gradings, are listed below and in docs/specs/reminders-copy.md (to be reviewed by a native
 * speaker of Arabic and by a person of knowledge).
 */
import { quranStructure } from '@/data/quran';
import type { Gender } from '@/domain/shared/gender';
import { copyVariantIndex, type ReadingGoalOfDay, type ReminderKind } from '@/domain/reminders';
import type { LocalDate } from '@/domain/shared/local-date';
import { genderContext, getTranslator, type AppLanguage } from '@/i18n';

import { AL_KAHF_PAGE } from './config';

/** A verse of the Quran: its Arabic is copied exactly from assets/data/verses/uthmani.json. */
interface QuranSource {
  readonly type: 'quran';
  readonly surah: number;
  readonly ayah: number;
}

/** A hadith: only well-known authentic ones, paraphrased faithfully in French and English. */
interface HadithSource {
  readonly type: 'hadith';
  readonly reference: string;
  readonly grading: string;
}

export type CopySource = QuranSource | HadithSource;

function verse(surah: number, ayah: number): QuranSource {
  return { type: 'quran', surah, ayah };
}

// The hadith the texts rest on. Wording and references checked on HadeethEnc and Dorar
// (25 November 2026); see docs/specs/reminders-copy.md for the Arabic and the meaning used.

/** "Whoever reads a letter of the Book of Allah has a good deed, and a good deed is ten like it." */
const EACH_LETTER: HadithSource = {
  type: 'hadith',
  reference: 'at-Tirmidhi 2910, from Ibn Mas‘ud',
  grading: 'hasan sahih (at-Tirmidhi), sahih (al-Albani)',
};
/** "Read the Quran, for it will come on the Day of Resurrection as an intercessor for its companions." */
const INTERCESSOR: HadithSource = {
  type: 'hadith',
  reference: 'Muslim 804, from Abu Umamah al-Bahili',
  grading: 'sahih (Sahih Muslim)',
};
/** "The deeds most beloved to Allah are the most constant, even if small." */
const CONSTANT_DEEDS: HadithSource = {
  type: 'hadith',
  reference: 'al-Bukhari 6465 and Muslim 783, from ‘A’ishah',
  grading: 'sahih (agreed upon)',
};
/** "…and the one who reads it, stumbling, finding it hard, has two rewards." */
const TWO_REWARDS: HadithSource = {
  type: 'hadith',
  reference: 'al-Bukhari 4937 and Muslim 798, from ‘A’ishah',
  grading: 'sahih (agreed upon)',
};
/** "The believer who reads the Quran is like a citron: its scent is good and its taste is good." */
const CITRON: HadithSource = {
  type: 'hadith',
  reference: 'al-Bukhari 5427 and Muslim 797, from Abu Musa al-Ash‘ari',
  grading: 'sahih (agreed upon)',
};
/** "Whoever reads Surat al-Kahf on Friday, light shines for him between the two Fridays." */
const KAHF_LIGHT: HadithSource = {
  type: 'hadith',
  reference: 'al-Hakim (al-Mustadrak) and al-Bayhaqi (as-Sunan al-Kubra), from Abu Sa‘id al-Khudri',
  grading: 'sahih (al-Albani, Sahih al-Jami‘ 6470, Sahih at-Targhib 736)',
};
/** "Whoever memorises ten verses from the beginning of Surat al-Kahf is protected from the Dajjal." */
const KAHF_TEN_VERSES: HadithSource = {
  type: 'hadith',
  reference: 'Muslim 809, from Abu ad-Darda’',
  grading: 'sahih (Sahih Muslim)',
};

/**
 * What each variant rests on, in the order of its texts (`variants.<kind>.1`, `.2`…). Its length
 * is the number of variants of the kind.
 */
export const REMINDER_COPY_SOURCES: Readonly<Record<ReminderKind, readonly CopySource[]>> = {
  'daily-goal': [
    EACH_LETTER,
    INTERCESSOR,
    verse(54, 17),
    CONSTANT_DEEDS,
    verse(13, 28),
    TWO_REWARDS,
    verse(2, 152),
    verse(38, 29),
  ],
  'water-stopped': [verse(73, 20), CONSTANT_DEEDS],
  thirsty: [CITRON, verse(17, 82)],
  wilting: [TWO_REWARDS, verse(54, 17)],
  dying: [EACH_LETTER, verse(73, 20)],
  'last-chance': [INTERCESSOR, verse(13, 28)],
  dead: [verse(57, 17), verse(2, 152)],
  'come-back': [verse(2, 186), TWO_REWARDS, verse(54, 17)],
  'friday-kahf': [KAHF_LIGHT, verse(18, 10), KAHF_TEN_VERSES],
};

/** Where the person left off: the page the reader opens, and the surah it is named after. */
export interface ReminderResume {
  readonly page: number;
  readonly surah: number;
}

export interface ReminderTextData {
  /** Null when there is no place to resume yet: the reader then opens on the first page. */
  readonly resume: ReminderResume | null;
  /** The goal of the day of the reminder (only the daily reminder says it). */
  readonly goal: ReadingGoalOfDay;
  /**
   * What the person says they are (owner, 26 November 2026): the Arabic then agrees with them
   * («متى شئتَ» / «متى شئتِ»). Null or absent: the plain wording, which says nothing of it.
   */
  readonly gender?: Gender | null;
}

export interface ReminderText {
  readonly title: string;
  readonly body: string;
}

/** The name of a surah as the app shows it in a language (the reader does the same). */
function surahName(surah: number, language: AppLanguage): string {
  const info = quranStructure.surah(surah);
  return language === 'ar' ? info.nameArabic : info.nameTransliterated;
}

/**
 * The text of a reminder of `kind` delivered on `date`, in `language`. Deterministic: the same
 * day and data always give the same words.
 */
export function reminderText(
  kind: ReminderKind,
  date: LocalDate,
  language: AppLanguage,
  { resume, goal, gender = null }: ReminderTextData,
): ReminderText {
  const t = getTranslator(language, 'notifications');
  const variant = copyVariantIndex(kind, date, REMINDER_COPY_SOURCES[kind].length) + 1;
  const values = {
    where:
      resume === null
        ? t('where.start')
        : t('where.at', { surah: surahName(resume.surah, language), page: resume.page }),
    goal: t(goal.hasStarted ? 'goal.left' : 'goal.today', { count: goal.pagesLeft }),
    page: AL_KAHF_PAGE,
    // A text without a form for this gender (all of French and English) keeps its plain wording.
    context: genderContext(gender),
  };
  return {
    title: t(`variants.${kind}.${variant}.title`, values),
    body: t(`variants.${kind}.${variant}.body`, values),
  };
}
