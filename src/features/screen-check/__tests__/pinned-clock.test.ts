/** The pinned hour exists only in the check's build, on iOS, when the launch asks for it. */

function load(flag: string | undefined, hour: string | undefined, os = 'ios') {
  const before = process.env.EXPO_PUBLIC_SCREEN_CHECK;
  if (flag === undefined) delete process.env.EXPO_PUBLIC_SCREEN_CHECK;
  else process.env.EXPO_PUBLIC_SCREEN_CHECK = flag;
  try {
    let module: typeof import('../pinned-clock') | undefined;
    jest.isolateModules(() => {
      jest.doMock('react-native', () => ({
        Platform: { OS: os },
        Settings: { get: (key: string) => (key === 'screenCheckHour' ? hour : undefined) },
      }));
      module = jest.requireActual<typeof import('../pinned-clock')>('../pinned-clock');
    });
    return module!.screenCheckClock;
  } finally {
    if (before === undefined) delete process.env.EXPO_PUBLIC_SCREEN_CHECK;
    else process.env.EXPO_PUBLIC_SCREEN_CHECK = before;
  }
}

describe('screenCheckClock', () => {
  it('is the real clock (null) unless the check build is asked an hour', () => {
    expect(load(undefined, '10')).toBeNull();
    expect(load('0', '10')).toBeNull();
    expect(load('1', undefined)).toBeNull();
    expect(load('1', 'noon')).toBeNull();
    expect(load('1', '10', 'android')).toBeNull();
  });

  it('tells the asked hour in the check build', () => {
    const clock = load('1', '10');
    expect(clock).not.toBeNull();
    const moment = clock!();
    expect([moment.getHours(), moment.getMinutes()]).toEqual([10, 0]);
    const night = load('1', '22:15')!();
    expect([night.getHours(), night.getMinutes()]).toEqual([22, 15]);
  });
});
