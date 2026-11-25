import {
  CHECK_FRIEND_ID,
  checkAddress,
  isPushedOverTabs,
  parseCheckLaunch,
  parseCheckPage,
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
      autoSwipe: true,
    });
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
      autoSwipe: false,
    });
  });
});

describe('checkAddress and isPushedOverTabs', () => {
  const launch = (screen: CheckLaunch['screen'], page: number | null = null): CheckLaunch => ({
    screen,
    page,
    script: null,
    seedsDemo: false,
    autoSwipe: false,
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
  });

  it('puts the tabs behind the screens that are pushed over them', () => {
    expect(isPushedOverTabs(launch('reader'))).toBe(true);
    expect(isPushedOverTabs(launch('friend'))).toBe(true);
    expect(isPushedOverTabs(launch('garden'))).toBe(false);
    expect(isPushedOverTabs(launch('onboarding'))).toBe(false);
  });
});
