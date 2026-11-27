import {
  CHECK_FRIEND_ID,
  checkAddress,
  isPushedOverTabs,
  parseCheckHour,
  parseCheckLaunch,
  parseCheckPage,
  pinnedClock,
  type CheckLaunch,
} from '../parse';

const reading = (values: Record<string, unknown>) => (argument: string) => values[argument];

describe('parseCheckPage', () => {
  it('ignores the parameter when the check is off, whatever it holds', () => {
    expect(parseCheckPage('3', false, 16)).toBeNull();
    expect(parseCheckPage(['3'], false, 16)).toBeNull();
  });

  it('reads a whole page from 1 to the count when the check is on', () => {
    expect(parseCheckPage('1', true, 16)).toBe(1);
    expect(parseCheckPage('16', true, 16)).toBe(16);
    expect(parseCheckPage(['5', '6'], true, 16)).toBe(5);
    expect(parseCheckPage(7, true, 16)).toBe(7);
  });

  it.each(['0', '17', '-1', '2.5', '1e1', ' 3', '', 'abc', undefined, null, {}, 2.5])(
    'refuses %p',
    (raw) => {
      expect(parseCheckPage(raw, true, 16)).toBeNull();
    },
  );
});

describe('parseCheckLaunch', () => {
  const asked = reading({
    screenCheckGo: 'reader',
    screenCheckPage: '9',
    screenCheckScript: 'imlaei',
    screenCheckSeed: 'demo',
    screenCheckAutoSwipe: '1',
    screenCheckVoiceProof: '1',
  });

  it('is off by default: nothing is asked when the flag is off', () => {
    expect(parseCheckLaunch(asked, false)).toBeNull();
  });

  it('reads what the launch asked when the flag is on', () => {
    expect(parseCheckLaunch(asked, true)).toEqual({
      screen: 'reader',
      page: 9,
      script: 'imlaei',
      seedsDemo: true,
      seedsGardens: false,
      autoSwipe: true,
      voiceProof: true,
    });
  });

  it('plays the voice proof only when asked with 1, and never by default', () => {
    const proof = (value?: string) =>
      parseCheckLaunch(reading({ screenCheckGo: 'quran', screenCheckVoiceProof: value }), true)
        ?.voiceProof;
    expect(proof(undefined)).toBe(false);
    expect(proof('true')).toBe(false);
    expect(proof('1')).toBe(true);
  });

  it('swipes by itself only when asked with 1, and never by default', () => {
    const swipe = (value?: string) =>
      parseCheckLaunch(reading({ screenCheckGo: 'onboarding', screenCheckAutoSwipe: value }), true)
        ?.autoSwipe;
    expect(swipe(undefined)).toBe(false);
    expect(swipe('0')).toBe(false);
    expect(swipe('yes')).toBe(false);
    expect(swipe('1')).toBe(true);
    expect(parseCheckLaunch(reading({ screenCheckAutoSwipe: '1' }), true)).toBeNull();
    expect(parseCheckLaunch(asked, false)).toBeNull();
  });

  it('asks nothing when no screen, or an unknown one, is named', () => {
    expect(parseCheckLaunch(reading({}), true)).toBeNull();
    expect(parseCheckLaunch(reading({ screenCheckGo: '/etc/passwd' }), true)).toBeNull();
    expect(parseCheckLaunch(reading({ screenCheckGo: 'toString' }), true)).toBeNull();
  });

  it('drops a script, a page or a seed that is not one of the known values', () => {
    expect(
      parseCheckLaunch(
        reading({
          screenCheckGo: 'garden',
          screenCheckScript: 'comic',
          screenCheckPage: '9999',
          screenCheckSeed: 'yes',
        }),
        true,
      ),
    ).toEqual({
      screen: 'garden',
      page: null,
      script: null,
      seedsDemo: false,
      seedsGardens: false,
      autoSwipe: false,
      voiceProof: false,
    });
  });

  it('fills the app with the gardens history when asked with gardens (D46)', () => {
    const launch = parseCheckLaunch(
      reading({ screenCheckGo: 'profile', screenCheckSeed: 'gardens' }),
      true,
    );
    expect(launch).toMatchObject({ seedsDemo: true, seedsGardens: true });
  });
});

describe('checkAddress and isPushedOverTabs', () => {
  const launch = (screen: CheckLaunch['screen'], page: number | null = null): CheckLaunch => ({
    screen,
    page,
    script: null,
    seedsDemo: false,
    seedsGardens: false,
    autoSwipe: false,
    voiceProof: false,
  });

  it('gives an address inside the app for every screen', () => {
    expect(checkAddress(launch('onboarding', 4))).toBe('/onboarding?page=4');
    expect(checkAddress(launch('onboarding'))).toBe('/onboarding');
    expect(checkAddress(launch('garden'))).toBe('/(tabs)');
    expect(checkAddress(launch('quran'))).toBe('/(tabs)/quran');
    expect(checkAddress(launch('reader'))).toBe('/reader/3');
    expect(checkAddress(launch('reader', 50))).toBe('/reader/50');
    expect(checkAddress(launch('listening'))).toBe('/listening');
    expect(checkAddress(launch('friends'))).toBe('/(tabs)/friends');
    expect(checkAddress(launch('friend'))).toBe(`/(tabs)/friends/${CHECK_FRIEND_ID}`);
    expect(checkAddress(launch('profile'))).toBe('/(tabs)/profile');
    expect(checkAddress(launch('settings'))).toBe('/settings');
    expect(checkAddress(launch('gardens'))).toBe('/my-gardens');
    expect(checkAddress(launch('khatma'))).toBe('/khatma-complete?khatm=1');
  });

  it('puts the tabs behind the screens that are pushed over them', () => {
    expect(isPushedOverTabs(launch('reader'))).toBe(true);
    expect(isPushedOverTabs(launch('friend'))).toBe(true);
    expect(isPushedOverTabs(launch('gardens'))).toBe(true);
    expect(isPushedOverTabs(launch('khatma'))).toBe(true);
    expect(isPushedOverTabs(launch('garden'))).toBe(false);
    expect(isPushedOverTabs(launch('onboarding'))).toBe(false);
  });
});

describe('parseCheckHour', () => {
  it('reads an hour, or an hour and minutes, as minutes since midnight', () => {
    expect(parseCheckHour('10', true)).toBe(600);
    expect(parseCheckHour('0', true)).toBe(0);
    expect(parseCheckHour('07', true)).toBe(420);
    expect(parseCheckHour('22:30', true)).toBe(1350);
    expect(parseCheckHour(['10'], true)).toBe(600);
    expect(parseCheckHour(10, true)).toBe(600);
  });

  it('asks nothing when the check is off, whatever is given', () => {
    expect(parseCheckHour('10', false)).toBeNull();
  });

  it.each(['24', '-1', '10:60', '10:5', '1e1', ' 10', '', 'noon', undefined, null, {}, 10.5])(
    'refuses %p',
    (raw) => {
      expect(parseCheckHour(raw, true)).toBeNull();
    },
  );
});

describe('pinnedClock', () => {
  it('keeps the real day and pins the time of day', () => {
    const now = () => new Date(2026, 10, 27, 20, 36, 51, 123);
    const moment = pinnedClock(600, now)();
    expect([moment.getFullYear(), moment.getMonth(), moment.getDate()]).toEqual([2026, 10, 27]);
    expect([moment.getHours(), moment.getMinutes(), moment.getSeconds()]).toEqual([10, 0, 0]);
  });

  it('does not touch the instant it was given', () => {
    const instant = new Date(2026, 10, 27, 20, 36);
    pinnedClock(600, () => instant)();
    expect(instant.getHours()).toBe(20);
  });
});
