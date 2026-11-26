import {
  DEFAULT_REMINDERS_CHOICES,
  READING_MOMENTS,
  readingMomentAt,
  readingMomentTime,
  remindersForReadingMoment,
} from '../index';

describe('reading moments', () => {
  it('maps each moment to its fixed local time', () => {
    expect(readingMomentTime('after-fajr')).toEqual({ hour: 6, minute: 30 });
    expect(readingMomentTime('midday')).toEqual({ hour: 12, minute: 30 });
    expect(readingMomentTime('evening')).toEqual({ hour: 19, minute: 0 });
    expect(readingMomentTime('before-sleep')).toEqual({ hour: 22, minute: 0 });
  });

  it('lists the four moments in the order of the day', () => {
    expect(READING_MOMENTS).toEqual(['after-fajr', 'midday', 'evening', 'before-sleep']);
  });

  it('finds the moment back from its time, and null for a time chosen by hand', () => {
    expect(readingMomentAt({ hour: 19, minute: 0 })).toBe('evening');
    expect(readingMomentAt({ hour: 20, minute: 30 })).toBeNull();
  });

  it('refuses an unknown moment', () => {
    expect(() => readingMomentTime('noon' as never)).toThrow(TypeError);
  });
});

describe('remindersForReadingMoment', () => {
  it('turns the daily reminder on at the moment, Friday Al-Kahf and the thirsty garden on', () => {
    expect(remindersForReadingMoment('midday')).toEqual({
      dailyEnabled: true,
      dailyTime: { hour: 12, minute: 30 },
      fridayKahfEnabled: true,
      thirstyGardenEnabled: true,
    });
  });

  it('lets the person switch Friday Al-Kahf and the thirsty garden off', () => {
    const change = remindersForReadingMoment('evening', {
      fridayKahf: false,
      thirstyGarden: false,
    });
    expect(change.fridayKahfEnabled).toBe(false);
    expect(change.thirstyGardenEnabled).toBe(false);
    expect(change.dailyEnabled).toBe(true);
  });

  it('proposes both optional reminders by default', () => {
    expect(DEFAULT_REMINDERS_CHOICES).toEqual({ fridayKahf: true, thirstyGarden: true });
  });
});
