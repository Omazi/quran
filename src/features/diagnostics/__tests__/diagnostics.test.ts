import { decodeCrashRecord } from '../crash-record';
import { createDiagnostics, type ErrorUtilsLike } from '../diagnostics';
import { createMemoryRecordFile, type RecordFile } from '../record-file';

const APP = { version: '0.1.0', build: '57', os: 'ios 26.1', device: 'iPhone 15' };

function setup(file: RecordFile = createMemoryRecordFile()) {
  let time = Date.parse('2026-11-25T18:00:00.000Z');
  const diagnostics = createDiagnostics({ file, now: () => time, app: APP });
  const advance = (ms: number) => {
    time += ms;
  };
  return { file, diagnostics, advance };
}

function fakeErrorUtils(onFatal: (error: unknown, isFatal?: boolean) => void = () => {}) {
  let handler: (error: unknown, isFatal?: boolean) => void = onFatal;
  const utils: ErrorUtilsLike = {
    getGlobalHandler: () => handler,
    setGlobalHandler: (next) => {
      handler = next;
    },
  };
  return { utils, throwIt: (error: unknown, isFatal = true) => handler(error, isFatal) };
}

describe('the recorder of the fatal error', () => {
  it('writes the record to the file BEFORE the default handler runs (which ends the app)', () => {
    const { file, diagnostics } = setup();
    let fileWhenDefaultRan: string | null = 'not run';
    const { utils, throwIt } = fakeErrorUtils(() => {
      fileWhenDefaultRan = file.read();
    });
    diagnostics.setRoute('/(tabs)/friends/demo-mustapha');
    diagnostics.breadcrumbs.add('gesture', 'garden-pan');
    diagnostics.installGlobalHandler(utils);

    throwIt(new TypeError('x is not a function'));

    const record = decodeCrashRecord(fileWhenDefaultRan);
    expect(record).toMatchObject({
      source: 'fatal',
      message: 'x is not a function',
      route: '/(tabs)/friends/demo-mustapha',
      app: APP,
      time: '2026-11-25T18:00:00.000Z',
      isShown: false,
    });
    expect(record?.stack).toContain('TypeError');
    expect(record?.breadcrumbs.map((crumb) => crumb.label)).toContain('garden-pan');
  });

  it('still hands the error to the default handler when the file cannot be written', () => {
    const file: RecordFile = {
      read: () => null,
      write: () => {
        throw new Error('disk full');
      },
      remove: () => {},
    };
    const { diagnostics } = setup(file);
    const seen: unknown[] = [];
    const { utils, throwIt } = fakeErrorUtils((error) => seen.push(error));
    diagnostics.installGlobalHandler(utils);
    const failure = new Error('boom');
    expect(() => throwIt(failure)).not.toThrow();
    expect(seen).toEqual([failure]);
  });

  it('passes isFatal along, and records a non-fatal error only in the trail', () => {
    const { file, diagnostics } = setup();
    const calls: [unknown, boolean | undefined][] = [];
    const { utils, throwIt } = fakeErrorUtils((error, isFatal) => calls.push([error, isFatal]));
    diagnostics.installGlobalHandler(utils);
    throwIt(new Error('soft'), false);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[1]).toBe(false);
    expect(file.read()).toBeNull();
    expect(diagnostics.breadcrumbs.snapshot().map((crumb) => crumb.kind)).toEqual(['error']);
  });

  it('records what is thrown even when it is not an Error', () => {
    const { file, diagnostics } = setup();
    const { utils, throwIt } = fakeErrorUtils();
    diagnostics.installGlobalHandler(utils);
    throwIt('a string was thrown');
    expect(decodeCrashRecord(file.read())?.message).toBe('a string was thrown');
  });

  it('puts the recent console errors in the record (where React says which component)', () => {
    const { file, diagnostics } = setup();
    const fake = { error: jest.fn(), warn: jest.fn() };
    const { utils, throwIt } = fakeErrorUtils();
    diagnostics.installConsoleCapture(fake as unknown as Console);
    diagnostics.installGlobalHandler(utils);
    fake.error('The above error occurred in the <FriendScreen> component:\n  at FriendScreen');
    throwIt(new Error('boom'));
    expect(decodeCrashRecord(file.read())?.recentErrors[0]).toContain('<FriendScreen>');
  });

  it('can be uninstalled: the previous handler comes back', () => {
    const { diagnostics } = setup();
    const { utils } = fakeErrorUtils();
    const before = utils.getGlobalHandler();
    const uninstall = diagnostics.installGlobalHandler(utils);
    expect(utils.getGlobalHandler()).not.toBe(before);
    uninstall();
    expect(utils.getGlobalHandler()).toBe(before);
  });
});

describe('the console capture', () => {
  it('still calls the real console.error, keeps the last five, and cannot loop', () => {
    const { diagnostics } = setup();
    const original = jest.fn();
    const fake = { error: original } as unknown as Console;
    const uninstall = diagnostics.installConsoleCapture(fake);
    for (let index = 0; index < 8; index += 1) fake.error(`problem ${index}`, { index });
    expect(original).toHaveBeenCalledTimes(8);
    expect(diagnostics.recentConsoleErrors()).toHaveLength(5);
    expect(diagnostics.recentConsoleErrors()[4]).toContain('problem 7');
    uninstall();
    expect(fake.error).toBe(original);
  });
});

describe('the next launch', () => {
  function closedWithAFatalError() {
    const first = setup();
    const { utils, throwIt } = fakeErrorUtils();
    first.diagnostics.installGlobalHandler(utils);
    throwIt(new Error('closed'));
    return first.file;
  }

  it('shows the sheet once for a fatal record, then keeps the record for the settings', () => {
    const file = closedWithAFatalError();

    const second = setup(file).diagnostics;
    second.load();
    expect(second.getSnapshot().previous?.message).toBe('closed');
    expect(second.getSnapshot().isSheetOpen).toBe(true);

    // The next launch: the record is still there, the sheet does not come again.
    const third = setup(file).diagnostics;
    third.load();
    expect(third.getSnapshot().previous?.message).toBe('closed');
    expect(third.getSnapshot().isSheetOpen).toBe(false);
  });

  it('shows nothing when the app closed with no JavaScript record (then it was native)', () => {
    const { diagnostics } = setup();
    diagnostics.load();
    expect(diagnostics.getSnapshot()).toEqual({ previous: null, isSheetOpen: false });
  });

  it('does not show the sheet for an error screen the person already saw', () => {
    const first = setup();
    first.diagnostics.recordBoundaryError(new Error('screen failed'), '\n    at Foo');
    const second = setup(first.file).diagnostics;
    second.load();
    expect(second.getSnapshot().previous).toMatchObject({
      source: 'boundary',
      message: 'screen failed',
      componentStack: '\n    at Foo',
    });
    expect(second.getSnapshot().isSheetOpen).toBe(false);
  });

  it('closes the sheet and, on request, forgets the record for good', () => {
    const file = closedWithAFatalError();
    const { diagnostics } = setup(file);
    const listener = jest.fn();
    diagnostics.subscribe(listener);
    diagnostics.load();
    diagnostics.dismissSheet();
    expect(diagnostics.getSnapshot().isSheetOpen).toBe(false);
    expect(diagnostics.getSnapshot().previous).not.toBeNull();
    diagnostics.clear();
    expect(diagnostics.getSnapshot()).toEqual({ previous: null, isSheetOpen: false });
    expect(file.read()).toBeNull();
    expect(listener).toHaveBeenCalled();
    const after = setup(file).diagnostics;
    after.load();
    expect(after.getSnapshot().previous).toBeNull();
  });

  it('does not fail on a file it cannot read, or one that holds rubbish', () => {
    const broken: RecordFile = {
      read: () => {
        throw new Error('unreadable');
      },
      write: () => {},
      remove: () => {},
    };
    const unreadable = setup(broken).diagnostics;
    expect(() => unreadable.load()).not.toThrow();
    const rubbish = setup(createMemoryRecordFile('}{')).diagnostics;
    rubbish.load();
    expect(rubbish.getSnapshot().previous).toBeNull();
  });

  it('keeps the same snapshot object until something changes (for useSyncExternalStore)', () => {
    const { diagnostics } = setup();
    diagnostics.load();
    expect(diagnostics.getSnapshot()).toBe(diagnostics.getSnapshot());
  });

  it('opens the sheet again on request (the settings row) when there is a record', () => {
    const file = closedWithAFatalError();
    const { diagnostics } = setup(file);
    diagnostics.load();
    diagnostics.dismissSheet();
    diagnostics.openSheet();
    expect(diagnostics.getSnapshot().isSheetOpen).toBe(true);

    const empty = setup().diagnostics;
    empty.load();
    empty.openSheet();
    expect(empty.getSnapshot().isSheetOpen).toBe(false);
  });
});
