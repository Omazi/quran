/**
 * The words of each reminder (docs/specs/reminders-copy.md): a rotating set of variants per kind,
 * chosen by the day, filled with where to resume and what is left of the goal, short enough for a
 * lock screen in the three languages, and resting on sourced texts only.
 */
import { quranStructure } from '@/data/quran';
import { addDays, parseLocalDate } from '@/domain/shared/local-date';
import { REMINDER_PRIORITY, type ReminderKind } from '@/domain/reminders';
import { initI18n, type AppLanguage } from '@/i18n';
import ar from '@/i18n/locales/ar/notifications.json';
import en from '@/i18n/locales/en/notifications.json';
import fr from '@/i18n/locales/fr/notifications.json';
import uthmani from '../../../../assets/data/verses/uthmani.json';

import { AL_KAHF_PAGE } from '../config';
import { REMINDER_COPY_SOURCES, reminderText, type ReminderTextData } from '../reminder-copy';

const KINDS: readonly ReminderKind[] = [...REMINDER_PRIORITY, 'friday-kahf'];
const LANGUAGES: readonly AppLanguage[] = ['fr', 'en', 'ar'];
const LOCALES = { fr, en, ar } as const;
const TUESDAY = parseLocalDate('2026-11-24');
/** Ten weeks: every variant of every kind, daily or weekly, comes up. */
const DAYS = Array.from({ length: 70 }, (_, day) => addDays(TUESDAY, day));

const TITLE_LIMIT = 35;
const BODY_LIMIT = 90;

/**
 * What a lock screen has room for is a matter of letters, not of the marks above and below them:
 * the vowels of the Arabic (and of the Quran's script) take no width of their own.
 */
function visibleLength(text: string): number {
  return [...text.normalize('NFC').replace(/\p{M}/gu, '')].length;
}

const BAQARAH = { page: 12, surah: 2 };
const SOME_DAY: ReminderTextData = {
  resume: BAQARAH,
  goal: { pagesLeft: 3, hasStarted: false },
};

function longestSurah(language: AppLanguage): number {
  const nameOf = (surah: number) => {
    const info = quranStructure.surah(surah);
    return language === 'ar' ? info.nameArabic : info.nameTransliterated;
  };
  return quranStructure.surahs
    .map((info) => info.surah)
    .reduce((longest, surah) => (nameOf(surah).length > nameOf(longest).length ? surah : longest));
}

beforeAll(() => initI18n('fr'));

describe('the variants', () => {
  it('give the daily reminder 6 to 10 texts, each garden state 2 or 3, Friday 3', () => {
    expect(REMINDER_COPY_SOURCES['daily-goal'].length).toBeGreaterThanOrEqual(6);
    expect(REMINDER_COPY_SOURCES['daily-goal'].length).toBeLessThanOrEqual(10);
    for (const kind of KINDS.filter((other) => other !== 'daily-goal' && other !== 'friday-kahf')) {
      expect([2, 3]).toContain(REMINDER_COPY_SOURCES[kind].length);
    }
    expect(REMINDER_COPY_SOURCES['friday-kahf']).toHaveLength(3);
  });

  it.each(LANGUAGES)('exist in %s, exactly as many as their sources', (language) => {
    const variants = LOCALES[language].variants as Record<string, Record<string, unknown>>;
    expect(Object.keys(variants).sort()).toEqual([...KINDS].sort());
    for (const kind of KINDS) {
      const count = REMINDER_COPY_SOURCES[kind].length;
      const expected = Array.from({ length: count }, (_, index) => String(index + 1));
      expect(Object.keys(variants[kind] ?? {})).toEqual(expected);
    }
  });

  it('change from one day to the next, and come back the same for the same day', () => {
    for (const date of DAYS.slice(0, 30)) {
      const today = reminderText('daily-goal', date, 'fr', SOME_DAY);
      const tomorrow = reminderText('daily-goal', addDays(date, 1), 'fr', SOME_DAY);
      expect(today.title).not.toBe(tomorrow.title);
      expect(reminderText('daily-goal', date, 'fr', SOME_DAY)).toEqual(today);
    }
  });

  it('change from one Friday to the next', () => {
    const friday = parseLocalDate('2026-11-27');
    for (let week = 0; week < 8; week += 1) {
      const date = addDays(friday, week * 7);
      expect(reminderText('friday-kahf', date, 'fr', SOME_DAY).title).not.toBe(
        reminderText('friday-kahf', addDays(date, 7), 'fr', SOME_DAY).title,
      );
    }
  });
});

describe('the data in the text', () => {
  it('says where to resume and how much is left, in French', () => {
    const { body } = reminderText('daily-goal', TUESDAY, 'fr', SOME_DAY);
    expect(body).toBe('3 pages aujourd’hui. Reprends Al-Baqarah, page 12.');
  });

  it('says what is left once some of the day is read', () => {
    const started = { resume: BAQARAH, goal: { pagesLeft: 2, hasStarted: true } };
    expect(reminderText('daily-goal', TUESDAY, 'fr', started).body).toBe(
      'Encore 2 pages aujourd’hui. Reprends Al-Baqarah, page 12.',
    );
    const lastOne = { resume: BAQARAH, goal: { pagesLeft: 1, hasStarted: true } };
    expect(reminderText('daily-goal', TUESDAY, 'en', lastOne).body).toBe(
      'One more page today. Continue Al-Baqarah, page 12.',
    );
  });

  it('names the surah the way the app does in each language', () => {
    expect(reminderText('daily-goal', TUESDAY, 'en', SOME_DAY).body).toBe(
      '3 pages today. Continue Al-Baqarah, page 12.',
    );
    expect(reminderText('daily-goal', TUESDAY, 'ar', SOME_DAY).body).toBe(
      'هدف اليوم: 3 صفحات. المتابعة من سورة البقرة، الصفحة 12.',
    );
  });

  it('uses the Arabic plural that fits the number', () => {
    const left = (pagesLeft: number) =>
      reminderText('daily-goal', TUESDAY, 'ar', {
        resume: BAQARAH,
        goal: { pagesLeft, hasStarted: true },
      }).body;
    expect(left(1)).toContain('بقيت صفحة واحدة');
    expect(left(2)).toContain('بقيت صفحتان');
    expect(left(11)).toContain('بقيت 11 صفحةً');
  });

  it('falls back to the first page when there is no place to resume yet', () => {
    const fresh = { resume: null, goal: { pagesLeft: 5, hasStarted: false } };
    expect(reminderText('daily-goal', TUESDAY, 'fr', fresh).body).toBe(
      '5 pages aujourd’hui. Commence à la première page.',
    );
    for (const kind of ['thirsty', 'wilting', 'last-chance'] as const) {
      expect(reminderText(kind, TUESDAY, 'en', fresh).body).toContain('Start from the first page.');
    }
  });

  it('gives the garden reminders that open the reader the place to resume', () => {
    for (const kind of ['water-stopped', 'thirsty', 'wilting', 'dying', 'last-chance'] as const) {
      for (const date of DAYS.slice(0, 3)) {
        expect(reminderText(kind, date, 'fr', SOME_DAY).body).toContain(
          'Reprends Al-Baqarah, page 12.',
        );
      }
    }
  });

  it('names no page in the reminders that open the home screen', () => {
    for (const kind of ['dead', 'come-back'] as const) {
      for (const date of DAYS) {
        const { title, body } = reminderText(kind, date, 'fr', SOME_DAY);
        expect(`${title} ${body}`).not.toMatch(/page \d|Al-Baqarah/);
      }
    }
  });

  it('gives the page of Al-Kahf on Friday', () => {
    for (const date of DAYS.slice(0, 21)) {
      expect(reminderText('friday-kahf', date, 'fr', SOME_DAY).body).toContain(
        String(AL_KAHF_PAGE),
      );
    }
  });
});

describe.each(LANGUAGES)('every text in %s', (language) => {
  const surah = longestSurah(language);
  const worstDays: ReminderTextData[] = [1, 2, 3, 11, 100, 604].flatMap((pagesLeft) =>
    [true, false].map((hasStarted) => ({
      resume: { page: 604, surah },
      goal: { pagesLeft, hasStarted },
    })),
  );
  worstDays.push({ resume: null, goal: { pagesLeft: 604, hasStarted: false } });

  it(`keeps the title within ${TITLE_LIMIT} and the body within ${BODY_LIMIT} letters`, () => {
    const tooLong: string[] = [];
    for (const kind of KINDS) {
      for (const date of DAYS) {
        for (const data of worstDays) {
          const { title, body } = reminderText(kind, date, language, data);
          if (visibleLength(title) > TITLE_LIMIT) tooLong.push(title);
          if (visibleLength(body) > BODY_LIMIT) tooLong.push(body);
        }
      }
    }
    expect([...new Set(tooLong)]).toEqual([]);
  });

  it('leaves no placeholder unfilled, never shouts', () => {
    for (const kind of KINDS) {
      for (const date of DAYS) {
        const { title, body } = reminderText(kind, date, language, SOME_DAY);
        expect(`${title} ${body}`).not.toMatch(/\{\{|\}\}|!/);
        expect(title.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('the sources', () => {
  type Variant = { title: string; body: string };
  const arVariants = ar.variants as Record<string, Record<string, Variant>>;
  const verses = uthmani as Record<string, string[]>;

  it('every verse quoted in Arabic is copied exactly from the Uthmani text of the app', () => {
    for (const kind of KINDS) {
      REMINDER_COPY_SOURCES[kind].forEach((source, index) => {
        const variant = arVariants[kind]?.[String(index + 1)];
        const quoted = [...`${variant?.title} ${variant?.body}`.matchAll(/﴿([^﴾]+)﴾/g)].map(
          (match) => match[1],
        );
        if (source.type !== 'quran') {
          expect(quoted).toEqual([]);
          return;
        }
        expect(quoted).toHaveLength(1);
        expect(verses[String(source.surah)]?.[source.ayah - 1]).toContain(quoted[0]);
      });
    }
  });

  it('every variant rests on a verse or on a hadith with its reference and grading', () => {
    for (const kind of KINDS) {
      for (const source of REMINDER_COPY_SOURCES[kind]) {
        if (source.type === 'quran') {
          expect(source.ayah).toBeGreaterThan(0);
          expect(verses[String(source.surah)]?.length).toBeGreaterThanOrEqual(source.ayah);
        } else {
          expect(source.reference.length).toBeGreaterThan(0);
          expect(source.grading).toMatch(/sahih|hasan/i);
        }
      }
    }
  });
});

describe('the words follow the gender of the person who reads them (owner, 26 November 2026)', () => {
  const GENDERS = ['male', 'female', null] as const;

  it('is neutral by default: no gender given gives the plain text, as before', () => {
    for (const kind of KINDS) {
      for (const language of LANGUAGES) {
        expect(reminderText(kind, TUESDAY, language, { ...SOME_DAY, gender: null })).toEqual(
          reminderText(kind, TUESDAY, language, SOME_DAY),
        );
      }
    }
  });

  it('French and English do not change: nothing they say to the person depends on gender', () => {
    for (const language of ['fr', 'en'] as const) {
      for (const kind of KINDS) {
        for (const date of DAYS) {
          const plain = reminderText(kind, date, language, SOME_DAY);
          for (const gender of GENDERS) {
            expect(reminderText(kind, date, language, { ...SOME_DAY, gender })).toEqual(plain);
          }
        }
      }
    }
  });

  it('Arabic says «متى شئتَ» to a man and «متى شئتِ» to a woman, and the unmarked «متى شئت» otherwise', () => {
    const seen = new Set<string>();
    for (const date of DAYS) {
      const plain = reminderText('come-back', date, 'ar', SOME_DAY).body;
      if (!plain.includes('متى شئت')) continue;
      seen.add(date);
      expect(reminderText('come-back', date, 'ar', { ...SOME_DAY, gender: 'male' }).body).toContain(
        'متى شئتَ',
      );
      expect(
        reminderText('come-back', date, 'ar', { ...SOME_DAY, gender: 'female' }).body,
      ).toContain('متى شئتِ');
      expect(plain).not.toMatch(/شئت[َِ]/);
    }
    // The wording is one of the variants of the kind: it comes up within ten weeks.
    expect(seen.size).toBeGreaterThan(0);
  });

  it('the Arabic of the other reminders is written neutrally: the same for a man and a woman', () => {
    for (const kind of KINDS) {
      for (const date of DAYS) {
        const male = reminderText(kind, date, 'ar', { ...SOME_DAY, gender: 'male' });
        const female = reminderText(kind, date, 'ar', { ...SOME_DAY, gender: 'female' });
        const plain = reminderText(kind, date, 'ar', SOME_DAY);
        if (plain.body.includes('متى شئت')) continue;
        expect(male).toEqual(plain);
        expect(female).toEqual(plain);
      }
    }
  });

  it.each(['male', 'female'] as const)(
    'a %s text is as short as the others for a lock screen, and has no left-over placeholder',
    (gender) => {
      for (const kind of KINDS) {
        for (const date of DAYS) {
          const { title, body } = reminderText(kind, date, 'ar', { ...SOME_DAY, gender });
          expect(visibleLength(title)).toBeLessThanOrEqual(TITLE_LIMIT);
          expect(visibleLength(body)).toBeLessThanOrEqual(BODY_LIMIT);
          expect(`${title} ${body}`).not.toMatch(/\{\{|\}\}/);
        }
      }
    },
  );

  it('the examples of the first launch (`kinds`) have the same forms', () => {
    const entry = ar.kinds['come-back'];
    expect(entry.body_male).toContain('شئتَ');
    expect(entry.body_female).toContain('شئتِ');
    expect(visibleLength(entry.body_female)).toBeLessThanOrEqual(BODY_LIMIT);
  });
});
