/**
 * The door is shut unless the build sets `EXPO_PUBLIC_SCREEN_CHECK=1`: the modules are loaded
 * after the variable is set, as the bundler reads it.
 */

import { ONBOARDING_PAGES } from '@/features/onboarding';

const { readFileSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: 'utf8') => string;
}>('node:fs');
const { resolve } = jest.requireActual<{ resolve: (...segments: string[]) => string }>('node:path');
/** The repository's root: tests run from it. */
const ROOT = resolve('.');

function loadDoor(flag: string | undefined, autoSwipe?: string) {
  const before = process.env.EXPO_PUBLIC_SCREEN_CHECK;
  if (flag === undefined) delete process.env.EXPO_PUBLIC_SCREEN_CHECK;
  else process.env.EXPO_PUBLIC_SCREEN_CHECK = flag;
  try {
    let door: typeof import('../door') | undefined;
    jest.isolateModules(() => {
      jest.doMock('react-native', () => ({
        Platform: { OS: 'ios' },
        Settings: {
          get: (key: string) =>
            key === 'screenCheckGo'
              ? 'onboarding'
              : key === 'screenCheckAutoSwipe'
                ? autoSwipe
                : undefined,
        },
      }));
      jest.doMock('../launcher', () => ({ ScreenCheckLauncher: () => null }));
      jest.doMock('../auto-run', () => ({
        pagerDriver: () => null,
        ScreenCheckAutoRun: () => null,
      }));
      door = jest.requireActual('../door');
    });
    return door as typeof import('../door');
  } finally {
    if (before === undefined) delete process.env.EXPO_PUBLIC_SCREEN_CHECK;
    else process.env.EXPO_PUBLIC_SCREEN_CHECK = before;
  }
}

describe.each([undefined, '', '0', 'true', 'yes'])('with EXPO_PUBLIC_SCREEN_CHECK=%p', (flag) => {
  it('has no launcher, no launch to show, and ignores the page parameter', () => {
    const door = loadDoor(flag);
    expect(door.ScreenCheckLauncher).toBeNull();
    expect(door.screenCheckLaunch).toBeNull();
    expect(door.screenCheckPage('3', 16)).toBeNull();
  });

  it('never swipes by itself, even when the launch argument is there', () => {
    const door = loadDoor(flag, '1');
    expect(door.screenCheckPagerDriver).toBeNull();
    expect(door.ScreenCheckAutoRun).toBeNull();
  });
});

describe('with EXPO_PUBLIC_SCREEN_CHECK=1', () => {
  it('has the launcher, reads the launch arguments and honours the page parameter', () => {
    const door = loadDoor('1');
    expect(door.ScreenCheckLauncher).not.toBeNull();
    expect(door.screenCheckLaunch).toMatchObject({ screen: 'onboarding' });
    expect(door.screenCheckPage('3', 16)).toBe(3);
    expect(door.screenCheckPage('17', 16)).toBeNull();
  });

  it('has no automatic swipe unless the launch argument asks for it', () => {
    const door = loadDoor('1');
    expect(door.screenCheckPagerDriver).toBeNull();
    expect(door.ScreenCheckAutoRun).toBeNull();
  });

  it('has the automatic swipe and its run when the launch asks with -screenCheckAutoSwipe 1', () => {
    const door = loadDoor('1', '1');
    expect(door.screenCheckPagerDriver).not.toBeNull();
    expect(door.ScreenCheckAutoRun).not.toBeNull();
  });
});

describe('the list of pictures of the iOS check', () => {
  it('counts as many introduction pages as the app has', () => {
    const list = readFileSync(resolve(ROOT, 'tools/ci/screens.py'), 'utf8');
    const count = /^ONBOARDING_PAGES = (\d+)$/m.exec(list)?.[1];
    expect(Number(count)).toBe(ONBOARDING_PAGES.length);
  });
});

describe('the builds that are published', () => {
  it('never set the flag', () => {
    for (const file of [
      '.github/workflows/testflight.yml',
      '.github/workflows/testflight-build.yml',
    ]) {
      expect(readFileSync(resolve(ROOT, file), 'utf8')).not.toMatch(/EXPO_PUBLIC_SCREEN_CHECK/);
    }
  });
});
