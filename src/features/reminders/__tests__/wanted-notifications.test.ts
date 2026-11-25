/**
 * From the store to the notifications: the garden of the person feeds the plan, the plan becomes
 * dated notifications with their text. The clock is a fixed day, on the real journal builders.
 */
import { quranRepository, quranStructure } from '@/data/quran';
import { recordPageRead, type ReadingJournal } from '@/domain/khatm';
import { DEFAULT_REMINDERS } from '@/store';
import { addDays, parseLocalDate } from '@/domain/shared/local-date';
import { initI18n } from '@/i18n';
import {
  buildReadingHistory,
  READING_HISTORY_CONFIG,
} from '@/features/home/dev-preview/reading-histories';

import { AL_KAHF_PAGE } from '../config';
import { buildReminderInput, type ReminderSource } from '../reminder-input';
import { buildWantedNotifications, slotMoment } from '../wanted-notifications';

// A Tuesday: the Fridays of the plan are the 27th and the following ones.
const TODAY = parseLocalDate('2026-11-24');
const RANGES = quranStructure.hizbPageRanges();
// The Friday reminder is on by default (owner's decision of 25 November 2026).
const WITH_FRIDAY = { ...DEFAULT_REMINDERS };
const MORNING = { date: TODAY, time: { hour: 8, minute: 0 } };

beforeAll(() => initI18n('fr'));

function sourceOf(
  history: Parameters<typeof buildReadingHistory>[0],
  overrides: Partial<ReminderSource> = {},
): ReminderSource {
  const { journal, settings } = buildReadingHistory(history, TODAY, RANGES);
  return {
    journal,
    dailyGoalPages: settings.dailyGoalPages,
    userSeed: settings.userSeed,
    pauses: settings.pauses,
    reminders: WITH_FRIDAY,
    ...overrides,
  };
}

function wanted(source: ReminderSource, language: 'fr' | 'en' | 'ar' = 'fr') {
  return buildWantedNotifications(buildReminderInput(source, MORNING, RANGES), language);
}

function readMore(journal: ReadingJournal, pages: number): ReadingJournal {
  const lastRead = Math.max(0, ...journal.map((entry) => entry.page));
  let next = journal;
  for (let page = lastRead + 1; page <= lastRead + pages; page += 1) {
    next = recordPageRead(next, { page, date: TODAY });
  }
  return next;
}

describe('the page of Al-Kahf', () => {
  it('is the page where the header of sourate 18 is printed, in the data of the Quran', async () => {
    const page = await quranRepository.getPage(AL_KAHF_PAGE);
    const headers = page.lines.flatMap((line) =>
      line.kind === 'surah-header' ? [line.surah] : [],
    );
    expect(headers).toContain(18);
    // The page before it ends inside Al-Isra: no earlier page opens Al-Kahf.
    const before = await quranRepository.getPage(AL_KAHF_PAGE - 1);
    expect(before.lines.some((line) => line.kind === 'surah-header' && line.surah === 18)).toBe(
      false,
    );
  });

  it('opens on the last verses of Al-Isra, then the header: the page the printed mushaf shows', () => {
    expect(quranStructure.firstVerseOfPage(AL_KAHF_PAGE).surah).toBe(17);
  });
});

describe('the daily reminder follows what was read today', () => {
  it('is planned for today while the goal is not reached', () => {
    const source = sourceOf('thriving');
    const first = wanted(source)[0];
    expect(first?.id).toBe('reminder.2026-11-24.reading');
    expect(first?.target).toBe('resume');
  });

  it('is dropped for today once the goal is reached, and tomorrow keeps its own', () => {
    const base = sourceOf('thriving');
    const metGoal = sourceOf('thriving', {
      journal: readMore(base.journal, base.dailyGoalPages),
    });
    const ids = wanted(metGoal).map((notification) => notification.id);
    expect(ids).not.toContain('reminder.2026-11-24.reading');
    expect(ids).toContain('reminder.2026-11-25.reading');
  });

  it('is not planned at all when the reminders are off', () => {
    const off = {
      ...WITH_FRIDAY,
      dailyEnabled: false,
      thirstyGardenEnabled: false,
      fridayKahfEnabled: false,
    };
    expect(wanted(sourceOf('thriving', { reminders: off }))).toEqual([]);
  });

  it('counts the pages read today the way the goal does', () => {
    const input = buildReminderInput(sourceOf('thriving'), MORNING, RANGES);
    expect(input.pagesReadToday).toBe(3);
    expect(input.dailyGoalPages).toBe(READING_HISTORY_CONFIG.dailyGoalPages);
  });
});

describe('the garden reminders', () => {
  it('never put two reading notifications on one day', () => {
    const notifications = wanted(sourceOf('thirsty'));
    const readingDays = notifications
      .filter((notification) => notification.target !== 'al-kahf')
      .map((notification) => notification.id);
    expect(new Set(readingDays).size).toBe(readingDays.length);
  });

  it('say the garden is thirsty, in the voice of the garden, when it dries', () => {
    const texts = wanted(sourceOf('thirsty')).map((notification) => notification.title);
    expect(texts.some((title) => title.includes('soif') || title.includes('eau'))).toBe(true);
  });

  it('after the death of the garden, leave only a few come-back reminders then fall silent', () => {
    const notifications = wanted(sourceOf('dead'));
    const reading = notifications.filter((notification) => notification.target !== 'al-kahf');
    expect(reading.length).toBeLessThanOrEqual(6);
    expect(reading.some((notification) => notification.target === 'resume')).toBe(false);
  });

  it('send a dead garden to the home screen, where it is revived', () => {
    const targets = new Set(wanted(sourceOf('dead')).map((notification) => notification.target));
    expect(targets.has('home')).toBe(true);
  });
});

describe('Friday', () => {
  it('has its own notification, at the Friday time, opening Al-Kahf', () => {
    const friday = wanted(sourceOf('thriving')).find(
      (notification) => notification.id === 'reminder.2026-11-27.friday',
    );
    expect(friday?.target).toBe('al-kahf');
    expect(friday?.date.getHours()).toBe(WITH_FRIDAY.fridayTime.hour);
    expect(friday?.title).toBe('C’est vendredi');
  });

  it('stays next to the reading reminder of that day', () => {
    const ids = wanted(sourceOf('thriving')).map((notification) => notification.id);
    expect(ids).toContain('reminder.2026-11-27.reading');
    expect(ids).toContain('reminder.2026-11-27.friday');
  });
});

describe('time and language', () => {
  it('places a slot on the clock of the phone', () => {
    const moment = slotMoment({ date: addDays(TODAY, 3), time: { hour: 9, minute: 5 } });
    expect([moment.getFullYear(), moment.getMonth(), moment.getDate()]).toEqual([2026, 10, 27]);
    expect([moment.getHours(), moment.getMinutes()]).toEqual([9, 5]);
  });

  it('writes the text in the language asked, and signs it with that language', () => {
    const fr = wanted(sourceOf('thriving'), 'fr')[0];
    const en = wanted(sourceOf('thriving'), 'en')[0];
    const ar = wanted(sourceOf('thriving'), 'ar')[0];
    expect(fr?.title).toBe('Ton jardin t’attend');
    expect(en?.title).toBe('Your garden is waiting');
    expect(ar?.title).toBe('حديقتك تنتظرك');
    expect(new Set([fr?.signature, en?.signature, ar?.signature]).size).toBe(3);
  });

  it('is deterministic: the same store and moment give the same notifications', () => {
    expect(wanted(sourceOf('thirsty'))).toEqual(wanted(sourceOf('thirsty')));
  });
});

describe('with the reminders as proposed at the first launch', () => {
  it('has the Friday Al-Kahf notification, switched on by default', () => {
    expect(DEFAULT_REMINDERS.fridayKahfEnabled).toBe(true);
    const notifications = wanted(sourceOf('thriving', { reminders: DEFAULT_REMINDERS }));
    expect(notifications.some((notification) => notification.target === 'al-kahf')).toBe(true);
  });

  it('has none once the person has switched the Friday reminder off', () => {
    const off = { ...DEFAULT_REMINDERS, fridayKahfEnabled: false };
    const notifications = wanted(sourceOf('thriving', { reminders: off }));
    expect(notifications.some((notification) => notification.target === 'al-kahf')).toBe(false);
  });
});

describe('a bare earth', () => {
  it('gets the daily and the Friday reminders, no garden reminder', () => {
    const notifications = wanted(sourceOf('bare-earth'));
    const titles = new Set(notifications.map((notification) => notification.title));
    expect(titles).toEqual(new Set(['Ton jardin t’attend', 'C’est vendredi']));
  });
});
